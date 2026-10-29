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
