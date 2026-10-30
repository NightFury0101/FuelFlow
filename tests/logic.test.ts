import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleNutrients, sumNutrients, servingOptions, amountFor, macroWarning, formatAmount } from '../src/lib/nutrition';
import { bmrMifflin, calculateTargets, balanceCarbs } from '../src/lib/targets';
import { addDays, ageFromBirthDate, isValidDateKey, rangeKeys, toDateKey } from '../src/lib/date';
import { dailyTotals, summarize, loggingStreak, changeFromPrevious, changeOver, weeklyTrend } from '../src/lib/analytics';
import { migrateLegacy, normalizeData, diaryCsv, emptyData } from '../src/lib/storage';
import { mapOffProduct } from '../src/lib/foodSearch';
import { searchReference, REFERENCE_FOODS } from '../src/lib/referenceFoods';
import { lbToKg, kgToLb, displayWater } from '../src/lib/units';
import type { Food, FoodEntry, WeightEntry } from '../src/lib/types';

const rice: Food = {
  id: 'r',
  name: 'Rice',
  source: 'reference',
  baseUnit: 'g',
  baseAmount: 100,
  nutrients: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
  servings: [{ label: '1 cup', amount: 158 }],
};

function entry(date: string, kcal: number, protein = 0, createdAt = 0): FoodEntry {
  const n = { kcal, protein, carbs: 0, fat: 0 };
  return {
    id: Math.random().toString(),
    date,
    meal: 'lunch',
    createdAt,
    food: { ...rice, nutrients: n, baseUnit: 'serving', baseAmount: 1 },
    servingLabel: '1 serving',
    quantity: 1,
    amount: 1,
    nutrients: n,
  };
}

test('scales nutrients by grams', () => {
  const n = scaleNutrients(rice, 158);
  assert.equal(n.kcal, 205);
  assert.equal(n.carbs, 44.6);
  assert.deepEqual(scaleNutrients(rice, 0).kcal, 0);
  assert.deepEqual(scaleNutrients(rice, -5).kcal, 0);
});

test('serving options include raw grams and amounts multiply', () => {
  const opts = servingOptions(rice);
  assert.ok(opts.some((o) => o.label === 'g' && o.amount === 1));
  assert.equal(amountFor(opts[0], 1.5), 237);
});

test('sums totals without float noise', () => {
  const t = sumNutrients([{ nutrients: { kcal: 100.4, protein: 0.1, carbs: 0.2, fat: 0 } }, { nutrients: { kcal: 50, protein: 0.2, carbs: 0.1, fat: 1 } }]);
  assert.equal(t.kcal, 150);
  assert.equal(t.protein, 0.3);
  assert.equal(t.carbs, 0.3);
});

test('macro warning flags inconsistent labels only', () => {
  assert.equal(macroWarning({ kcal: 200, protein: 10, carbs: 25, fat: 6.5 }), null);
  assert.ok(macroWarning({ kcal: 50, protein: 30, carbs: 30, fat: 10 }));
});

test('Mifflin-St Jeor matches known values', () => {
  // 30 y, 70 kg, 175 cm male: 10*70 + 6.25*175 - 5*30 + 5 = 1648.75
  assert.equal(bmrMifflin('male', 70, 175, 30), 1648.75);
  assert.equal(bmrMifflin('female', 60, 165, 25), 1345.25);
});

test('weight-loss target is moderate and above resting needs', () => {
  const r = calculateTargets({ sex: 'female', age: 30, heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', special: 'none' });
  assert.ok(r.adjustment <= 0 && r.adjustment >= -500);
  assert.ok(r.targets.kcal >= r.bmr - 10);
  const macroKcal = r.targets.protein * 4 + r.targets.carbs * 4 + r.targets.fat * 9;
  assert.ok(Math.abs(macroKcal - r.targets.kcal) <= 10, 'macros add up to calories');
});

test('sedentary loss never goes below BMR', () => {
  const r = calculateTargets({ sex: 'female', age: 60, heightCm: 155, weightKg: 52, activity: 'sedentary', goal: 'lose', special: 'none' });
  assert.ok(r.targets.kcal >= Math.max(1200, r.bmr) - 10);
});

test('under-18 and pregnancy get maintenance plus a professional note', () => {
  const teen = calculateTargets({ sex: 'male', age: 16, heightCm: 175, weightKg: 70, activity: 'active', goal: 'lose', special: 'none' });
  assert.equal(teen.appliedGoal, 'maintain');
  assert.equal(teen.adjustment, 0);
  assert.ok(teen.needsProfessional);
  const preg = calculateTargets({ sex: 'female', age: 28, heightCm: 160, weightKg: 65, activity: 'light', goal: 'lose', special: 'pregnant' });
  assert.equal(preg.appliedGoal, 'maintain');
  assert.ok(preg.needsProfessional);
});

test('gain surplus is small', () => {
  const r = calculateTargets({ sex: 'male', age: 25, heightCm: 180, weightKg: 75, activity: 'moderate', goal: 'gain', special: 'none' });
  assert.ok(r.adjustment > 0 && r.adjustment <= 300);
});

test('balanceCarbs fills remaining calories', () => {
  assert.equal(balanceCarbs({ kcal: 2000, protein: 150, fat: 60 }), 215);
});

test('date helpers are local and DST-safe', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(rangeKeys('2026-10-29', 3), ['2026-10-27', '2026-10-28', '2026-10-29']);
  assert.ok(isValidDateKey('2026-02-28'));
  assert.ok(!isValidDateKey('2026-02-30'));
  assert.equal(ageFromBirthDate('2000-10-30', '2026-10-29'), 25);
  assert.equal(ageFromBirthDate('2000-10-29', '2026-10-29'), 26);
  assert.equal(toDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('daily totals distinguish missing days from zero', () => {
  const days = dailyTotals([entry('2026-10-28', 500, 30), entry('2026-10-28', 300, 10), entry('2026-10-29', 0)], '2026-10-29', 3);
  assert.equal(days[0].logged, false);
  assert.equal(days[1].kcal, 800);
  assert.equal(days[2].logged, true);
  assert.equal(days[2].kcal, 0);
  const s = summarize(days, { kcal: 800, protein: 40, carbs: 0, fat: 0, waterMl: 0 });
  assert.equal(s.loggedDays, 2);
  assert.equal(s.avgKcal, 400);
  assert.equal(s.proteinHitDays, 1);
  assert.equal(s.onTargetDays, 1);
});

test('streak counts consecutive days', () => {
  const e = [entry('2026-10-27', 1), entry('2026-10-28', 1), entry('2026-10-29', 1), entry('2026-10-25', 1)];
  assert.equal(loggingStreak(e, '2026-10-29'), 3);
  assert.equal(loggingStreak(e.slice(0, 2), '2026-10-29'), 2); // today not logged yet
});

const w = (date: string, kg: number): WeightEntry => ({ id: date, date, kg, createdAt: 0 });

test('weight change uses dated records, not entry order', () => {
  const list = [w('2026-10-20', 80), w('2026-10-01', 82), w('2026-10-27', 79.4)];
  assert.deepEqual(changeFromPrevious(list), { kg: -0.6, previousDate: '2026-10-20' });
  assert.equal(changeOver(list, 7), -0.6);
  assert.equal(changeOver([w('2026-10-27', 80), w('2026-10-28', 79)], 7), null, 'no entry a week back');
  assert.equal(weeklyTrend(list.slice(0, 2)), null, 'needs at least 3 points');
  const t = weeklyTrend(list);
  assert.ok(t !== null && t < 0);
});

test('legacy fuelflow-meals data is migrated, never dropped silently', () => {
  const legacy = JSON.stringify([
    { name: 'Oatmeal', calories: 300, protein: 10, meal: 'Breakfast', date: '2026-10-01' },
    { name: '', calories: 100 },
    { food: 'Apple', kcal: 95 },
  ]);
  const out = migrateLegacy(legacy, new Date(2026, 9, 29).getTime());
  assert.equal(out.length, 2);
  assert.equal(out[0].meal, 'breakfast');
  assert.equal(out[0].date, '2026-10-01');
  assert.equal(out[1].meal, 'snacks');
  assert.equal(migrateLegacy('not json').length, 0);
});

test('normalizeData drops malformed records from imports', () => {
  const d = normalizeData({ entries: [{ id: 'x' }, entry('2026-10-29', 100)], weights: [w('2026-10-29', 70), w('bad', 70), w('2026-10-29', 9999)] });
  assert.equal(d.entries.length, 1);
  assert.equal(d.weights.length, 1);
  assert.equal(normalizeData(null).entries.length, 0);
});

test('CSV escapes commas and quotes', () => {
  const d = emptyData();
  const e = entry('2026-10-29', 100);
  e.food = { ...e.food, name: 'Rice, "jasmine"' };
  d.entries = [e];
  assert.ok(diaryCsv(d).includes('"Rice, ""jasmine"""'));
});

test('Open Food Facts mapping rejects incomplete data', () => {
  assert.equal(mapOffProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } }), null);
  const f = mapOffProduct({ code: '2', product_name: 'Bar', brands: 'Acme, Other', serving_quantity: '40', serving_size: '40 g', nutriments: { 'energy_100g': 1674, proteins_100g: 20, carbohydrates_100g: 50, fat_100g: 15 } });
  assert.ok(f);
  assert.equal(f!.nutrients.kcal, 400);
  assert.equal(f!.brand, 'Acme');
  assert.equal(f!.servings[0].amount, 40);
});

test('reference foods are searchable and self-consistent', () => {
  assert.equal(searchReference('rice')[0].name, 'White rice, cooked');
  assert.equal(searchReference('').length, 0);
  for (const f of REFERENCE_FOODS) {
    const implied = f.nutrients.protein * 4 + f.nutrients.carbs * 4 + f.nutrients.fat * 9;
    assert.ok(Math.abs(implied - f.nutrients.kcal) <= Math.max(25, f.nutrients.kcal * 0.15), `${f.name}: ${implied} vs ${f.nutrients.kcal}`);
  }
});

test('unit conversion round-trips', () => {
  assert.ok(Math.abs(lbToKg(kgToLb(72.5)) - 72.5) < 1e-9);
  assert.equal(displayWater(250, { weight: 'kg', height: 'cm', water: 'ml' }), '250 ml');
  assert.equal(displayWater(2000, { weight: 'kg', height: 'cm', water: 'ml' }), '2 L');
  assert.equal(displayWater(1500, { weight: 'kg', height: 'cm', water: 'ml' }), '1.5 L');
});

import { buildRecipeFood, snapshotFood } from '../src/lib/nutrition';

test('recipe nutrition = sum of ingredients ÷ servings, loggable by weight when all in grams', () => {
  const tuna = REFERENCE_FOODS.find((f) => f.id === 'ref:tuna-skipjack')!; // 132 kcal/100 g
  const rice = REFERENCE_FOODS.find((f) => f.id === 'ref:rice-white')!; // 130 kcal/100 g
  const r = buildRecipeFood('r1', 'Tuna rice', 2, [
    { food: tuna, servingLabel: 'g', quantity: 200, amount: 200 },
    { food: rice, servingLabel: 'g', quantity: 400, amount: 400 },
  ]);
  // total = 264 + 520 = 784 kcal → 392 per serving; total weight 600 g → 300 g per serving
  assert.equal(r.nutrients.kcal, 392);
  assert.equal(r.baseUnit, 'g');
  assert.equal(r.baseAmount, 300);
  assert.equal(r.source, 'recipe');
  assert.equal(scaleNutrients(r, 150).kcal, 196, 'half a serving by weight');
  assert.equal(r.recipe!.servings, 2);
});

test('recipe with non-gram ingredients is logged per serving', () => {
  const bar: Food = { id: 'c', name: 'Bar', source: 'custom', baseUnit: 'serving', baseAmount: 1, nutrients: { kcal: 200, protein: 10, carbs: 20, fat: 8 }, servings: [{ label: '1 bar', amount: 1 }] };
  const r = buildRecipeFood('r2', 'Bars', 4, [{ food: bar, servingLabel: '1 bar', quantity: 6, amount: 6 }]);
  assert.equal(r.baseUnit, 'serving');
  assert.equal(r.nutrients.kcal, 300);
  assert.equal(r.nutrients.protein, 15);
});

test('diary snapshots drop recipe ingredient lists', () => {
  const r = buildRecipeFood('r3', 'X', 1, [{ food: rice, servingLabel: '1 cup', quantity: 1, amount: 158 }]);
  const s = snapshotFood(r);
  assert.equal(s.recipe, undefined);
  assert.equal(s.nutrients.kcal, r.nutrients.kcal);
});

test('meal plan items survive import validation', () => {
  const d = normalizeData({ planned: [entry('2026-11-02', 300), { id: 'bad' }] });
  assert.equal(d.planned.length, 1);
});

test('amount labels read naturally', () => {
  const banana = REFERENCE_FOODS.find((f) => f.id === 'ref:banana')!;
  assert.equal(formatAmount({ food: banana, servingLabel: '1 medium', quantity: 1, amount: 118 }), '1 medium · 118 g');
  assert.equal(formatAmount({ food: banana, servingLabel: '1 medium', quantity: 2, amount: 236 }), '2 × 1 medium · 236 g');
  assert.equal(formatAmount({ food: banana, servingLabel: 'g', quantity: 80, amount: 80 }), '80 g');
  assert.equal(formatAmount({ food: banana, servingLabel: '100 g', quantity: 1, amount: 100 }), '100 g');
  const r = buildRecipeFood('r', 'R', 2, [{ food: banana, servingLabel: 'g', quantity: 200, amount: 200 }]);
  assert.equal(formatAmount({ food: r, servingLabel: r.servings[0].label, quantity: 1, amount: 100 }), '1 serving (100 g)');
});

import { milestones, weeklyBuckets } from '../src/lib/analytics';
import { summarizeMeasures, toDisplay, fromDisplay, MEASURES } from '../src/lib/measurements';
import { resolveTheme } from '../src/lib/theme';

test('milestones follow the goal and only count what happened', () => {
  const ws = [w('2026-09-01', 80), w('2026-09-10', 78.9), w('2026-09-20', 77.8), w('2026-10-01', 75.9)];
  const fmt = (kg: number) => `${Math.round(kg * 10) / 10} kg`;
  const r = milestones({ weights: ws, entries: [], goal: 'lose', startKg: 80, goalKg: 72, stepKg: 2, fmt, today: '2026-10-02' });
  const ids = r.reached.map((m) => m.id);
  assert.ok(ids.includes('first-weigh-in'));
  assert.ok(ids.includes('step-1') && ids.includes('step-2'), '4.1 kg lost passes 2 and 4 kg');
  assert.equal(r.reached.find((m) => m.id === 'step-2')!.date, '2026-10-01');
  assert.ok(ids.includes('halfway'), 'halfway (76 kg) passed at 75.9');
  assert.ok(!ids.includes('goal'));
  const nextW = r.next.find((m) => m.id.startsWith('step') || m.id === 'goal')!;
  assert.equal(nextW.id, 'step-3');
  assert.equal(nextW.detail, '1.9 kg to go');
  const gain = milestones({ weights: [w('2026-09-01', 60), w('2026-10-01', 61)], entries: [], goal: 'gain', stepKg: 2, fmt, today: '2026-10-01' });
  assert.equal(gain.next[0].detail, '1 kg to go');
  const keep = milestones({ weights: ws, entries: [], goal: 'maintain', stepKg: 2, fmt, today: '2026-10-01' });
  assert.ok(!keep.reached.some((m) => m.id.startsWith('step')), 'no loss milestones when maintaining');
});

test('logging streak milestones', () => {
  const days = Array.from({ length: 8 }, (_, i) => entry(addDays('2026-10-01', i), 100));
  const r = milestones({ weights: [], entries: days, goal: 'maintain', stepKg: 2, fmt: String, today: '2026-10-08' });
  assert.equal(r.reached.find((m) => m.id === 'streak-7')!.date, '2026-10-07');
  assert.equal(r.next[0].id, 'streak-30');
  const gap = milestones({ weights: [], entries: [entry('2026-10-01', 1), entry('2026-10-03', 1)], goal: 'maintain', stepKg: 2, fmt: String, today: '2026-10-03' });
  assert.ok(!gap.reached.some((m) => m.id === 'streak-7'));
  assert.equal(gap.next[0].detail, '6 more days in a row');
});

test('weekly buckets average logged days only', () => {
  const days = Array.from({ length: 14 }, (_, i) => ({ date: addDays('2026-10-01', i), value: i < 7 ? (i % 2 ? 1000 : null) : 2000 }));
  const b = weeklyBuckets(days);
  assert.equal(b.length, 2);
  assert.deepEqual(b.map((x) => [x.date, x.value, x.days]), [['2026-10-01', 1000, 3], ['2026-10-08', 2000, 7]]);
  assert.equal(weeklyBuckets([{ date: '2026-10-01', value: null }])[0].value, null);
});

test('measurements: summary and unit conversion', () => {
  const list = [{ ...w('2026-10-01', 80), waistCm: 90 }, { ...w('2026-10-20', 79), waistCm: 87.5, bodyFatPct: 24 }, w('2026-10-25', 78.8)];
  const sum = summarizeMeasures(list);
  const waist = sum.find((x) => x.measure.key === 'waistCm')!;
  assert.deepEqual([waist.first.value, waist.latest.value, waist.count], [90, 87.5, 2]);
  assert.equal(sum.find((x) => x.measure.key === 'bodyFatPct')!.count, 1);
  const waistM = MEASURES[0];
  const imperial = { weight: 'lb', height: 'ftin', water: 'floz' } as const;
  assert.equal(toDisplay(waistM, 91.44, imperial), 36);
  assert.equal(fromDisplay(waistM, 36, imperial), 91.4);
});

test('theme: dark by default, follows phone only when asked', () => {
  assert.equal(resolveTheme(undefined, true), 'dark');
  assert.equal(resolveTheme('light', false), 'light');
  assert.equal(resolveTheme('system', true), 'light');
  assert.equal(resolveTheme('system', false), 'dark');
});

test('a year of days makes 52 weekly buckets', () => {
  const year = Array.from({ length: 365 }, (_, i) => ({ date: addDays('2025-10-31', i), value: 1 }));
  const b = weeklyBuckets(year);
  assert.equal(b.length, 52);
  assert.equal(b[0].days, 8);
  assert.equal(b.at(-1)!.date, addDays('2025-10-31', 358));
});
