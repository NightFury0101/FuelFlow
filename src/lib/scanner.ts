import { AiError, callClaude, extractJson, type AiConfig } from './ai';
import { SCAN_SYSTEM } from './prompts';

// Client for the AI food scanner.
// The browser never talks to an AI provider directly: it sends the photo to a small server
// (see /server/scan-worker.js) that keeps the API key secret. Until that server URL is set
// in Profile → AI scanner, the scanner says so and offers manual logging instead.

export interface ScanItem {
  name: string;
  serving: string; // e.g. "1 cup", "about 150 g"
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface ScanResult {
  items: ScanItem[];
  questions: string[];
  notes?: string;
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return 'That file isn’t a supported photo. Use a JPG, PNG or WebP image.';
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'That photo is larger than 15 MB. Try a smaller one.';
  return null;
}

/** Downscale to keep uploads fast and private data minimal. Returns a JPEG data URL. */
export async function compressImage(file: File, maxSide = 1024, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This photo couldn’t be read. If it’s a HEIC photo, try a JPG instead.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing isn’t available in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const clampNum = (v: unknown, max: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};

/** Never trust a server payload blindly — validate every field. */
export function parseScanResponse(json: unknown): ScanResult {
  const j = (json || {}) as Record<string, unknown>;
  const rawItems = Array.isArray(j.items) ? j.items : [];
  const items: ScanItem[] = rawItems
    .map((it) => {
      const x = (it || {}) as Record<string, unknown>;
      const name = String(x.name || '').trim().slice(0, 80);
      if (!name) return null;
      const conf = String(x.confidence || 'low').toLowerCase();
      return {
        name,
        serving: String(x.serving || x.servingDescription || '').slice(0, 60),
        grams: Math.round(clampNum(x.grams, 3000)),
        kcal: Math.round(clampNum(x.kcal ?? x.calories, 5000)),
        protein: Math.round(clampNum(x.protein, 500) * 10) / 10,
        carbs: Math.round(clampNum(x.carbs, 800) * 10) / 10,
        fat: Math.round(clampNum(x.fat, 500) * 10) / 10,
        confidence: (conf === 'high' || conf === 'medium' ? conf : 'low') as ScanItem['confidence'],
      };
    })
    .filter((x): x is ScanItem => x !== null)
    .slice(0, 12);
  const questions = (Array.isArray(j.questions) ? j.questions : []).map((q) => String(q).slice(0, 200)).filter(Boolean).slice(0, 3);
  return { items, questions, notes: typeof j.notes === 'string' ? j.notes.slice(0, 300) : undefined };
}

export class ScanError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

export async function scanFood(ai: AiConfig, imageDataUrl: string, details: string, signal?: AbortSignal): Promise<ScanResult> {
  if (ai.kind === 'key') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(imageDataUrl);
    if (!m) throw new ScanError('That photo couldn’t be prepared. Try another one.', false);
    try {
      const text = await callClaude(ai.key, {
        system: SCAN_SYSTEM,
        maxTokens: 1200,
        signal,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
              { type: 'text', text: details.trim() ? `Extra details from me: ${details.slice(0, 500)}` : 'Estimate this meal.' },
            ],
          },
        ],
      });
      return parseScanResponse(extractJson(text));
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      if (e instanceof AiError) throw new ScanError(e.message, e.retryable);
      throw new ScanError('Something went wrong while scanning.');
    }
  }

  let res: Response;
  try {
    res = await fetch(ai.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl, details: details.slice(0, 500) }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ScanError('Couldn’t reach the scanner. Check your connection and try again.');
  }
  if (res.status === 429) throw new ScanError('Too many scans in a short time. Wait a minute and try again.');
  if (res.status === 413) throw new ScanError('That photo is too large for the scanner.', false);
  if (!res.ok) throw new ScanError(`The scanner had a problem (error ${res.status}). Try again in a moment.`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ScanError('The scanner sent back something unexpected. Try again.');
  }
  return parseScanResponse(json);
}

export function isValidEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
