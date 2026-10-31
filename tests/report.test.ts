import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, reportText } from '../src/lib/report';
import type { AppData, FoodEntry, Profile, WeightEntry } from '../src/lib/types';

const units = { weight: 'kg', height: 'cm', water: 'ml' } as Profile['units'];
const profile = {
  name: 'Aisha',
  goal: 'lose',
  goalWeightKg: 64,
  units,
  targets: { kcal: 1600, protein: 100, carbs: 180, fat: 50, waterMl: 2500 },
} as unknown as Profile;

const food = (date: string, kcal: number, protein: number) =>
  ({ id: date + kcal, date, meal: 'lunch', createdAt: 0, nutrients: { kcal, protein, carbs: 0, fat: 0 } }) as unknown as FoodEntry;
const kg = (date: string, v: number, extra: Partial<WeightEntry> = {}) => ({ id: date, date, kg: v, createdAt: 0, ...extra }) as WeightEntry;

const data = {
  entries: [food('2026-10-25', 1500, 105), food('2026-10-26', 1700, 80), food('2026-10-31', 1620, 95), food('2026-09-01', 3000, 10)],
  water: [
    { id: 'a', date: '2026-10-30', ml: 2000, createdAt: 0 },
    { id: 'b', date: '2026-10-31', ml: 1500, createdAt: 0 },
    { id: 'c', date: '2026-10-31', ml: 500, createdAt: 0 },
  ],
  weights: [kg('2026-10-20', 72.0, { waistCm: 86 }), kg('2026-10-27', 71.2), kg('2026-10-31', 70.5, { waistCm: 84.5 })],
  planned: [],
  savedMeals: [],
  foods: [],
  profile,
} as unknown as AppData;

test('7-day report: averages only count logged days, change is measured from the last weigh-in before the period', () => {
  const r = buildReport({ data, profile, days: 7, today: '2026-10-31' });
  assert.equal(r.from, '2026-10-25');
  assert.equal(r.loggedDays, 3);
  assert.equal(r.avgKcal, 1607);
  assert.equal(r.avgProtein, 93);
  assert.equal(r.onTargetDays, 3); // all within ±10% of 1,600
  assert.equal(r.proteinHitDays, 2); // ≥ 90 g
  assert.equal(r.avgWaterMl, 2000); // two days with water, 2.0 L each
  assert.deepEqual(r.weights.map((w) => w.date), ['2026-10-20', '2026-10-27', '2026-10-31']);
  assert.equal(r.changeKg, -1.5);
  assert.deepEqual(r.measures, [{ label: 'Waist', unit: 'cm', from: 86, to: 84.5 }]);
});

test('text version reads well and never invents numbers', () => {
  const r = buildReport({ data, profile, days: 7, today: '2026-10-31' });
  const t = reportText(r, units);
  assert.match(t, /^FuelFlow progress — Aisha/);
  assert.match(t, /Weight: 72 kg → 70.5 kg \(−1.5 kg\)/);
  assert.match(t, /Calories: 1,607 kcal\/day on average \(target 1,600\) · on target 3 of 3 logged days/);
  assert.match(t, /Waist: 86 → 84.5 cm \(−1.5 cm\)/);
  assert.match(t, /Food logged 3 of 7 days/);
});

test('an empty period gives empty averages, not zeros', () => {
  const r = buildReport({ data: { ...data, entries: [], water: [], weights: [] } as AppData, profile, days: 30, today: '2026-10-31' });
  assert.equal(r.avgKcal, null);
  assert.equal(r.avgWaterMl, null);
  assert.equal(r.changeKg, null);
  assert.equal(r.endKg, null);
  assert.ok(!/Calories:/.test(reportText(r, units)));
});
