import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain JS module
import worker from '../server/coach-worker.js';

const ORIGIN = 'capacitor://localhost';
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
let rc: Record<string, unknown> = {};

beforeEach(() => {
  calls = [];
  rc = {};
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith('https://api.revenuecat.com/')) {
      const id = decodeURIComponent(url.split('/subscribers/')[1]);
      return new Response(JSON.stringify({ subscriber: { entitlements: rc[id] ?? {} } }), { status: 200 });
    }
    if (url.includes('generativelanguage')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini says hi' }] } }] }), { status: 200 });
    if (url.includes('anthropic')) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Claude says hi' }] }), { status: 200 });
    return new Response('nope', { status: 500 });
  }) as typeof fetch;
});

const chat = (env: Record<string, string>, user?: string, origin = ORIGIN) =>
  worker.fetch(
    new Request('https://coach.example/chat', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...(user ? { 'X-FuelFlow-User': user } : {}) },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Dinner ideas?' }], context: '' }),
    }),
    env,
  );

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const PREMIUM_ENV = { GEMINI_API_KEY: 'g', ALLOWED_ORIGIN: 'https://x.github.io, capacitor://localhost', REVENUECAT_SECRET_KEY: 'sk_test', DAILY_LIMIT: '2' };

test('private mode: allowed origins only, answers with Claude by default', async () => {
  const env = { ANTHROPIC_API_KEY: 'a', ALLOWED_ORIGIN: 'https://x.github.io' };
  assert.equal((await chat(env, undefined, 'https://evil.example')).status, 403);
  const r = await chat(env, undefined, 'https://x.github.io');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).reply, 'Claude says hi');
});

test('premium mode: no user id or no subscription → 402; never calls the AI', async () => {
  assert.equal((await chat(PREMIUM_ENV)).status, 402);
  rc['$RCAnonymousID:expired'] = { premium: { expires_date: past } };
  assert.equal((await chat(PREMIUM_ENV, '$RCAnonymousID:expired')).status, 402);
  assert.equal((await chat(PREMIUM_ENV, '$RCAnonymousID:nobody')).status, 402);
  assert.ok(!calls.some((c) => c.url.includes('generativelanguage')));
  // The RevenueCat secret is sent only to RevenueCat.
  const rcCall = calls.find((c) => c.url.startsWith('https://api.revenuecat.com/'))!;
  assert.equal((rcCall.init!.headers as Record<string, string>).Authorization, 'Bearer sk_test');
});

test('premium mode: active subscriber gets answers (Gemini), up to the daily limit, then 429 with limit flag', async () => {
  rc['$RCAnonymousID:paid'] = { premium: { expires_date: future } };
  const a = await chat(PREMIUM_ENV, '$RCAnonymousID:paid');
  assert.equal(a.status, 200);
  assert.equal((await a.json()).reply, 'Gemini says hi');
  assert.equal((await chat(PREMIUM_ENV, '$RCAnonymousID:paid')).status, 200);
  const c = await chat(PREMIUM_ENV, '$RCAnonymousID:paid');
  assert.equal(c.status, 429);
  assert.equal((await c.json()).limit, true);
  // Subscription result is cached: only one RevenueCat lookup for three requests.
  assert.equal(calls.filter((x) => decodeURIComponent(x.url).endsWith('/subscribers/$RCAnonymousID:paid')).length, 1);
});

test('CORS allows the app origin and the user header', async () => {
  const r = await worker.fetch(new Request('https://coach.example/chat', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), PREMIUM_ENV);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.match(r.headers.get('Access-Control-Allow-Headers') || '', /X-FuelFlow-User/);
  const h = await (await worker.fetch(new Request('https://coach.example/health', { headers: { Origin: ORIGIN } }), PREMIUM_ENV)).json();
  assert.deepEqual(h, { ok: true, configured: true, premium: true });
});
