// Connection to the AI (Claude) for the photo scanner and nutrition coach.
//
// Two ways to connect:
//  • "key"    — the user pastes their own Anthropic API key. It is stored only in this browser
//               (localStorage, separate from the diary data, never exported in backups or sent
//               anywhere except api.anthropic.com). Simple, fine for personal use.
//  • "server" — the user's own Cloudflare Worker (server/scan-worker.js) holds the key instead.
//               Safer when other people use the app.

import { safeLocalStorage } from './storage';

export const KEY_STORAGE = 'fuelflow:anthropic-key';
export const MODEL = 'claude-sonnet-5-5';
const API = 'https://api.anthropic.com/v1/messages';

export type AiConfig = { kind: 'key'; key: string } | { kind: 'server'; url: string };

export function getApiKey(): string | null {
  try {
    return safeLocalStorage()?.getItem(KEY_STORAGE) || null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null) {
  const s = safeLocalStorage();
  if (!s) return;
  if (key) s.setItem(KEY_STORAGE, key.trim());
  else s.removeItem(KEY_STORAGE);
  window.dispatchEvent(new Event('fuelflow:ai-changed'));
}

export function looksLikeKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

export function maskKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 10)}…${key.slice(-4)}` : '••••';
}

/** Which connection to use. A key on this device wins over a server URL. */
export function resolveAi(serverUrl?: string): AiConfig | null {
  const key = getApiKey();
  if (key) return { kind: 'key', key };
  if (serverUrl) return { kind: 'server', url: serverUrl };
  return null;
}

export class AiError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

type Content = string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }>;

/** Call Claude directly from the browser with the user's own key. Returns the reply text. */
export async function callClaude(key: string, opts: { system: string; messages: Array<{ role: 'user' | 'assistant'; content: Content }>; maxTokens: number; signal?: AbortSignal }): Promise<string> {
  let res: Response;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: opts.maxTokens, system: opts.system, messages: opts.messages }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AiError('Couldn’t reach the AI. Check your internet connection and try again.');
  }
  if (!res.ok) {
    let msg = '';
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      msg = j.error?.message || '';
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new AiError('Your API key wasn’t accepted. Check it in Profile → AI scanner & coach.', false);
    if (res.status === 403) throw new AiError('This API key doesn’t have permission to use Claude.', false);
    if (res.status === 429) throw new AiError('Too many requests in a short time. Wait a minute and try again.');
    if (res.status === 529 || res.status === 503) throw new AiError('The AI is busy right now. Try again in a moment.');
    if (res.status === 413) throw new AiError('That photo is too large.', false);
    if (res.status === 400 && /credit|balance|billing/i.test(msg)) throw new AiError('Your Anthropic account is out of credit. Add credit at console.anthropic.com.', false);
    throw new AiError(`The AI had a problem (error ${res.status}). Try again.`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('')
    .trim();
}

/** Pull the first JSON object out of a model reply (tolerates code fences or stray words). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('The AI’s answer couldn’t be read. Try again.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError('The AI’s answer couldn’t be read. Try again.');
  }
}

/** Cheapest possible request to confirm a key works. */
export async function testKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    await callClaude(key, { system: 'Reply with OK.', messages: [{ role: 'user', content: 'Ping' }], maxTokens: 5 });
    return { ok: true, message: 'Connected — the scanner and coach are ready.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Couldn’t connect.' };
  }
}
