// Connection to the AI for the nutrition coach.
//
// Ways to connect:
//  • Gemini key — the user pastes a Google AI Studio key (has a free tier).
//  • Claude key — the user pastes an Anthropic API key (pay as you go).
//    Keys are stored only in this browser (localStorage, separate from the diary data, never
//    exported in backups) and are sent only to that provider's API.
//  • Own server — the user's Cloudflare Worker (server/coach-worker.js) holds a Claude key instead.

import { safeLocalStorage } from './storage';

export type Provider = 'gemini' | 'claude';

export const KEY_STORAGE: Record<Provider, string> = { claude: 'fuelflow:anthropic-key', gemini: 'fuelflow:gemini-key' };
export const PROVIDER_STORAGE = 'fuelflow:ai-provider';

export const CLAUDE_MODEL = 'claude-sonnet-5-5';
// Free-tier Gemini models, newest first. If Google retires one, the next is tried automatically.
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

export const PROVIDER_INFO: Record<Provider, { name: string; console: string; consoleLabel: string; placeholder: string }> = {
  gemini: { name: 'Gemini', console: 'https://aistudio.google.com/apikey', consoleLabel: 'aistudio.google.com', placeholder: 'AIza…' },
  claude: { name: 'Claude', console: 'https://console.anthropic.com/settings/keys', consoleLabel: 'console.anthropic.com', placeholder: 'sk-ant-…' },
};

export type AiConfig = { kind: 'key'; provider: Provider; key: string } | { kind: 'server'; url: string };

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const ls = () => {
  try {
    return safeLocalStorage();
  } catch {
    return null;
  }
};

export function getApiKey(provider: Provider): string | null {
  return ls()?.getItem(KEY_STORAGE[provider]) || null;
}

export function getProvider(): Provider | null {
  const p = ls()?.getItem(PROVIDER_STORAGE);
  return p === 'gemini' || p === 'claude' ? p : null;
}

/** Save (or remove) a key. Saving a key also makes that provider the active one. */
export function setApiKey(provider: Provider, key: string | null) {
  const s = ls();
  if (!s) return;
  if (key) {
    s.setItem(KEY_STORAGE[provider], key.trim());
    s.setItem(PROVIDER_STORAGE, provider);
  } else {
    s.removeItem(KEY_STORAGE[provider]);
    if (getProvider() === provider) s.removeItem(PROVIDER_STORAGE);
  }
  window.dispatchEvent(new Event('fuelflow:ai-changed'));
}

export function setProvider(provider: Provider) {
  ls()?.setItem(PROVIDER_STORAGE, provider);
  window.dispatchEvent(new Event('fuelflow:ai-changed'));
}

export function looksLikeKey(provider: Provider, key: string): boolean {
  const k = key.trim();
  return provider === 'claude' ? /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k) : /^AIza[0-9A-Za-z_-]{30,}$/.test(k);
}

export function maskKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 8)}…${key.slice(-4)}` : '••••';
}

/** Which connection to use: the active provider's key, then any saved key, then the server URL. */
export function resolveAi(serverUrl?: string): AiConfig | null {
  const active = getProvider();
  const order: Provider[] = active === 'claude' ? ['claude', 'gemini'] : ['gemini', 'claude'];
  for (const p of order) {
    const key = getApiKey(p);
    if (key) return { kind: 'key', provider: p, key };
  }
  if (serverUrl) return { kind: 'server', url: serverUrl };
  return null;
}

export class AiError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string; status?: string } };
    return `${j.error?.status || ''} ${j.error?.message || ''}`;
  } catch {
    return '';
  }
}

/** Call Claude directly from the browser with the user's own key. */
export async function callClaude(key: string, opts: { system: string; messages: ChatMessage[]; maxTokens: number; signal?: AbortSignal }): Promise<string> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: opts.maxTokens, system: opts.system, messages: opts.messages }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AiError('Couldn’t reach the AI. Check your internet connection and try again.');
  }
  if (!res.ok) {
    const msg = await readError(res);
    if (res.status === 401) throw new AiError('Your Claude API key wasn’t accepted. Check it in Profile → AI nutrition coach.', false);
    if (res.status === 403) throw new AiError('This API key doesn’t have permission to use Claude.', false);
    if (res.status === 429) throw new AiError('Too many requests in a short time. Wait a minute and try again.');
    if (res.status === 529 || res.status === 503) throw new AiError('The AI is busy right now. Try again in a moment.');
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

/** Call Gemini directly from the browser with the user's own Google AI Studio key. */
export async function callGemini(key: string, opts: { system: string; messages: ChatMessage[]; maxTokens: number; signal?: AbortSignal }): Promise<string> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    // Newer Gemini models may spend part of the budget on internal reasoning, so allow headroom.
    generationConfig: { maxOutputTokens: Math.max(opts.maxTokens * 2, 64) },
  });
  let lastStatus = 0;
  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: opts.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new AiError('Couldn’t reach the AI. Check your internet connection and try again.');
    }
    if (res.status === 404) {
      lastStatus = 404;
      continue; // model retired or not available — try the next one
    }
    if (!res.ok) {
      const msg = await readError(res);
      if (/API_KEY_INVALID|API key not valid/i.test(msg) || res.status === 401) throw new AiError('Your Gemini API key wasn’t accepted. Check it in Profile → AI nutrition coach.', false);
      if (res.status === 403) throw new AiError('This key can’t use the Gemini API. Create a new key at aistudio.google.com.', false);
      if (res.status === 429) throw new AiError('You’ve reached Gemini’s free limit for now. Wait a minute — or until tomorrow if it’s the daily limit — and try again.');
      if (res.status === 400 && /location|region|not supported/i.test(msg)) throw new AiError('Gemini isn’t available in your region with this key.', false);
      if (res.status >= 500) throw new AiError('Gemini is busy right now. Try again in a moment.');
      throw new AiError(`The AI had a problem (error ${res.status}). Try again.`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) throw new AiError('Gemini declined to answer that. Try rephrasing your question.', false);
    const c = data.candidates?.[0];
    const text = (c?.content?.parts || [])
      .filter((p) => !p.thought)
      .map((p) => p.text || '')
      .join('')
      .trim();
    if (!text && c?.finishReason === 'SAFETY') throw new AiError('Gemini declined to answer that. Try rephrasing your question.', false);
    return text;
  }
  throw new AiError(lastStatus === 404 ? 'Google has changed its free Gemini models. Update FuelFlow to the latest version.' : 'The AI had a problem. Try again.', false);
}

export function callAi(config: { provider: Provider; key: string }, opts: { system: string; messages: ChatMessage[]; maxTokens: number; signal?: AbortSignal }): Promise<string> {
  return config.provider === 'gemini' ? callGemini(config.key, opts) : callClaude(config.key, opts);
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
export async function testKey(provider: Provider, key: string): Promise<{ ok: boolean; message: string }> {
  try {
    await callAi({ provider, key }, { system: 'Reply with OK.', messages: [{ role: 'user', content: 'Ping' }], maxTokens: 5 });
    return { ok: true, message: `Connected to ${PROVIDER_INFO[provider].name} — your nutrition coach is ready.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Couldn’t connect.' };
  }
}

export function isValidEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
