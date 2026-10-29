import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, loadMessages, saveMessages, MAX_HISTORY } from '../src/lib/coach';
import { emptyData } from '../src/lib/storage';
import type { Profile, FoodEntry } from '../src/lib/types';

const profile: Profile = {
  name: 'Aisha',
  sex: 'female',
  activity: 'light',
  goal: 'lose',
  special: 'none',
  diet: ['Halal'],
  units: { weight: 'kg', height: 'cm', water: 'ml' },
  targets: { kcal: 1600, protein: 100, carbs: 180, fat: 50, waterMl: 2500 },
  targetsCustomized: false,
  meals: [
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'lunch', name: 'Lunch' },
  ],
  onboarded: true,
  setupIncomplete: false,
  waterQuickAdds: [250, 500],
  createdAt: 0,
};

const entry = (date: string, name: string, kcal: number, protein: number): FoodEntry => {
  const n = { kcal, protein, carbs: 10, fat: 5 };
  return { id: name + date, date, meal: 'lunch', createdAt: 1, food: { id: name, name, source: 'reference', baseUnit: 'serving', baseAmount: 1, nutrients: n, servings: [] }, servingLabel: '1 serving', quantity: 1, amount: 1, nutrients: n };
};

test('private mode shares targets but never food or weight', () => {
  const d = emptyData();
  d.entries = [entry('2026-10-30', 'Secret cake', 500, 5)];
  d.weights = [{ id: 'w', date: '2026-10-30', kg: 70, createdAt: 0 }];
  const ctx = buildContext(profile, d, false, '2026-10-30');
  assert.ok(ctx.includes('1600 kcal'));
  assert.ok(ctx.includes('Halal'));
  assert.ok(ctx.includes('NOT shared'));
  assert.ok(!ctx.includes('Secret cake'));
  assert.ok(!ctx.includes('70 kg'));
});

test('shared mode summarises real records only', () => {
  const d = emptyData();
  d.entries = [entry('2026-10-30', 'Tuna curry', 600, 40), entry('2026-10-28', 'Rice', 300, 6)];
  d.water = [{ id: 'x', date: '2026-10-30', ml: 750, createdAt: 0 }];
  const ctx = buildContext(profile, d, true, '2026-10-30');
  assert.ok(ctx.includes('Lunch: Tuna curry'));
  assert.ok(ctx.includes('Remaining today: 1000 kcal, protein 60 g'));
  assert.ok(ctx.includes('logged 1/7 days'));
  assert.ok(ctx.includes('Water today: 750 ml'));
  assert.ok(!ctx.includes('Latest weight'), 'no weight line without weigh-ins');
});

test('empty log is stated, not invented', () => {
  const ctx = buildContext(profile, emptyData(), true, '2026-10-30');
  assert.ok(ctx.includes('Nothing logged yet today'));
  assert.ok(ctx.includes('No food logged in the previous 7 days'));
});

test('chat history is validated and capped', () => {
  const mem = new Map<string, string>();
  const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  const many = Array.from({ length: 80 }, (_, i) => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', text: 'm' + i, at: i })) as never;
  saveMessages(s, many);
  assert.equal(loadMessages(s).length, MAX_HISTORY);
  mem.set('fuelflow:coach:v1', JSON.stringify([{ role: 'system', text: 'x' }, { role: 'user', text: 'ok' }]));
  assert.equal(loadMessages(s).length, 1);
  mem.set('fuelflow:coach:v1', 'garbage');
  assert.equal(loadMessages(s).length, 0);
});

import { extractJson, looksLikeKey, maskKey, AiError, isValidEndpoint, callGemini, GEMINI_MODELS } from '../src/lib/ai';

test('reads JSON from model replies with fences or extra words', () => {
  const reply = 'Here you go:\n```json\n{"name":"Mas huni","kcal":260}\n```';
  assert.deepEqual(extractJson(reply), { name: 'Mas huni', kcal: 260 });
  assert.throws(() => extractJson('no json here'), AiError);
});

test('API key format check and masking', () => {
  assert.ok(looksLikeKey('claude', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123'));
  assert.ok(!looksLikeKey('claude', 'AIzaSyA1234567890abcdefghijklmnopqrstuv'));
  assert.ok(looksLikeKey('gemini', 'AIzaSyA1234567890abcdefghijklmnopqrstuv'));
  assert.ok(!looksLikeKey('gemini', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123'));
  assert.ok(!looksLikeKey('gemini', ''));
  const m = maskKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123');
  assert.ok(m.startsWith('sk-ant-a') && m.endsWith('0123') && !m.includes('mnop'));
});

test('server URL must be https (or localhost for testing)', () => {
  assert.ok(isValidEndpoint('https://coach.example.workers.dev'));
  assert.ok(isValidEndpoint('http://localhost:8787'));
  assert.ok(!isValidEndpoint('http://example.com'));
  assert.ok(!isValidEndpoint('not a url'));
});

test('coach sees planned food separately from eaten food', () => {
  const d = emptyData();
  d.entries = [entry('2026-10-30', 'Oats', 300, 10)];
  d.planned = [{ ...entry('2026-10-30', 'Fish curry', 550, 40), id: 'p1' }];
  const ctx = buildContext(profile, d, true, '2026-10-30');
  assert.ok(ctx.includes('Logged today: 300 kcal'));
  assert.ok(ctx.includes('Planned but not yet eaten today'));
  assert.ok(ctx.includes('Fish curry'));
});

type Call = { url: string; init: RequestInit };
function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Call[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = orig) };
}

test('Gemini request format and reply parsing', async () => {
  const m = mockFetch([{ status: 200, body: { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'Eat more fish.' }] }, finishReason: 'STOP' }] } }]);
  try {
    const reply = await callGemini('AIzaTEST', {
      system: 'SYS',
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Protein ideas?' },
      ],
      maxTokens: 900,
    });
    assert.equal(reply, 'Eat more fish.', 'thought parts are dropped');
    const c = m.calls[0];
    assert.ok(c.url.endsWith(`/models/${GEMINI_MODELS[0]}:generateContent`));
    assert.equal((c.init.headers as Record<string, string>)['x-goog-api-key'], 'AIzaTEST');
    assert.ok(!c.url.includes('AIzaTEST'), 'key never in the URL');
    const body = JSON.parse(String(c.init.body));
    assert.equal(body.systemInstruction.parts[0].text, 'SYS');
    assert.deepEqual(body.contents.map((x: { role: string }) => x.role), ['user', 'model', 'user']);
  } finally {
    m.restore();
  }
});

test('Gemini falls back to the next free model when one is retired', async () => {
  const m = mockFetch([
    { status: 404, body: { error: { status: 'NOT_FOUND' } } },
    { status: 200, body: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } },
  ]);
  try {
    assert.equal(await callGemini('k', { system: 's', messages: [{ role: 'user', content: 'x' }], maxTokens: 5 }), 'ok');
    assert.ok(m.calls[1].url.includes(GEMINI_MODELS[1]));
  } finally {
    m.restore();
  }
});

test('Gemini errors become clear messages', async () => {
  const cases: Array<[number, unknown, RegExp]> = [
    [400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }, /wasn’t accepted/],
    [429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }, /free limit/],
    [503, { error: { status: 'UNAVAILABLE' } }, /busy/],
  ];
  for (const [status, body, re] of cases) {
    const m = mockFetch([{ status, body }]);
    try {
      await assert.rejects(callGemini('k', { system: 's', messages: [{ role: 'user', content: 'x' }], maxTokens: 5 }), (e: Error) => re.test(e.message));
    } finally {
      m.restore();
    }
  }
});
