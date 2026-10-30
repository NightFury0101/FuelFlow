import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultReminders, planReminders, reconcile, MAX_PENDING, type ReminderSettings } from '../src/lib/reminders';
import type { FoodEntry, WaterEntry } from '../src/lib/types';

const MEALS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snacks', name: 'Snacks' },
];
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = at(2026, 10, 28, 10, 0); // a Wednesday, 10:00 local
const on = (s: ReminderSettings): ReminderSettings => ({ ...s, enabled: true });
const entry = (date: string, meal: string) => ({ date, meal }) as FoodEntry;
const water = (date: string, ml: number) => ({ id: 'w', date, ml, createdAt: 0 }) as WaterEntry;

test('defaults: breakfast, lunch, dinner and two water reminders on; snacks and weigh-in off; master off', () => {
  const d = defaultReminders(MEALS);
  assert.equal(d.enabled, false);
  const onIds = d.items.filter((i) => i.on).map((i) => i.id);
  assert.deepEqual(onIds, ['meal:breakfast', 'meal:lunch', 'meal:dinner', 'water:1', 'water:2']);
});

test('nothing is planned while reminders are switched off', () => {
  assert.equal(planReminders({ settings: defaultReminders(MEALS), meals: MEALS, entries: [], water: [], waterGoalMl: 2000, now: NOW }).length, 0);
});

test('plans the next 7 days, skipping times already past today', () => {
  const plan = planReminders({ settings: on(defaultReminders(MEALS)), meals: MEALS, entries: [], water: [], waterGoalMl: 2000, now: NOW });
  const today = plan.filter((p) => p.at.getDate() === 28).map((p) => p.title);
  // 08:00 breakfast is past at 10:00; 11:00 water, 12:30 lunch, 15:30 water, 19:00 dinner remain.
  assert.deepEqual(today, ['Time for some water', 'Log your lunch', 'Time for some water', 'Log your dinner']);
  assert.equal(plan.length, 4 + 6 * 5);
  assert.ok(plan.every((p, i) => i === 0 || p.at >= plan[i - 1].at), 'sorted by time');
  assert.equal(new Set(plan.map((p) => p.id)).size, plan.length, 'unique ids');
  assert.equal(plan.find((p) => p.title === 'Log your lunch')!.route, '/diary');
});

test('a meal already logged today gets no reminder today, but still does tomorrow', () => {
  const plan = planReminders({ settings: on(defaultReminders(MEALS)), meals: MEALS, entries: [entry('2026-10-28', 'lunch')], water: [], waterGoalMl: 2000, now: NOW });
  const lunches = plan.filter((p) => p.title === 'Log your lunch');
  assert.equal(lunches[0].at.getDate(), 29);
});

test('water reminders stop for the day once the goal is reached', () => {
  const plan = planReminders({ settings: on(defaultReminders(MEALS)), meals: MEALS, entries: [], water: [water('2026-10-28', 1200), water('2026-10-28', 900)], waterGoalMl: 2000, now: NOW });
  assert.equal(plan.filter((p) => p.title.includes('water') && p.at.getDate() === 28).length, 0);
  assert.ok(plan.some((p) => p.title.includes('water') && p.at.getDate() === 29));
});

test('weigh-in happens once a week on the chosen day', () => {
  const s = on(defaultReminders(MEALS));
  s.items = s.items.map((i) => (i.kind === 'weigh' ? { ...i, on: true, weekday: 5 } : i)); // Friday
  const weigh = planReminders({ settings: s, meals: MEALS, entries: [], water: [], waterGoalMl: 2000, now: NOW }).filter((p) => p.route === '/progress');
  assert.equal(weigh.length, 1);
  assert.equal(weigh[0].at.getDay(), 5);
  assert.equal(weigh[0].at.getHours(), 7);
});

test('saved settings survive meal changes: new meals appear, removed ones go, bad times are repaired', () => {
  const saved: ReminderSettings = {
    enabled: true,
    items: [
      { id: 'meal:lunch', kind: 'meal', meal: 'lunch', time: '13:15', on: false },
      { id: 'meal:gone', kind: 'meal', meal: 'gone', time: '09:00', on: true },
      { id: 'water:1', kind: 'water', time: '25:99', on: true },
    ],
  };
  const meals = [...MEALS, { id: 'meal-x', name: 'Pre-workout' }];
  const r = reconcile(saved, meals);
  assert.equal(r.enabled, true);
  const lunch = r.items.find((i) => i.id === 'meal:lunch')!;
  assert.equal(lunch.time, '13:15');
  assert.equal(lunch.on, false);
  assert.ok(!r.items.some((i) => i.id === 'meal:gone'));
  assert.ok(r.items.some((i) => i.id === 'meal:meal-x'));
  assert.equal(r.items.find((i) => i.id === 'water:1')!.time, '11:00');
  assert.equal(reconcile(null, MEALS).enabled, false);
});

test('never more than the iPhone limit of pending reminders', () => {
  const meals = Array.from({ length: 8 }, (_, k) => ({ id: `m${k}`, name: `Meal ${k}` }));
  const s = on(defaultReminders(meals));
  s.items = s.items.map((i) => ({ ...i, on: true }));
  const plan = planReminders({ settings: s, meals, entries: [], water: [], waterGoalMl: 2000, now: at(2026, 10, 28, 5, 0) });
  assert.equal(plan.length, MAX_PENDING);
});
