import type { FoodEntry, Targets, WaterEntry, WeightEntry } from './types';
import { addDays, daysBetween, rangeKeys } from './date';
import { sumNutrients } from './nutrition';

export interface DayTotal {
  date: string;
  logged: boolean; // false = no record (different from a recorded zero)
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function dailyTotals(entries: FoodEntry[], endDate: string, days: number): DayTotal[] {
  const byDay = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date);
    if (list) list.push(e);
    else byDay.set(e.date, [e]);
  }
  return rangeKeys(endDate, days).map((date) => {
    const list = byDay.get(date);
    if (!list || list.length === 0) return { date, logged: false, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const t = sumNutrients(list);
    return { date, logged: true, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat };
  });
}

export interface PeriodSummary {
  loggedDays: number;
  totalDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  proteinHitDays: number; // days at ≥ 90% of protein target
  onTargetDays: number; // days within ±10% of calorie target
}

export function summarize(days: DayTotal[], targets: Targets): PeriodSummary {
  const logged = days.filter((d) => d.logged);
  const n = logged.length;
  const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => (n ? Math.round((logged.reduce((s, d) => s + d[k], 0) / n) * 10) / 10 : null);
  return {
    loggedDays: n,
    totalDays: days.length,
    avgKcal: n ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / n) : null,
    avgProtein: avg('protein'),
    avgCarbs: avg('carbs'),
    avgFat: avg('fat'),
    proteinHitDays: logged.filter((d) => d.protein >= targets.protein * 0.9).length,
    onTargetDays: logged.filter((d) => Math.abs(d.kcal - targets.kcal) <= targets.kcal * 0.1).length,
  };
}

/** Consecutive days with at least one food entry, ending today (or yesterday if today has none yet). */
export function loggingStreak(entries: FoodEntry[], today: string): number {
  const days = new Set(entries.map((e) => e.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function waterByDay(water: WaterEntry[], endDate: string, days: number): Array<{ date: string; ml: number | null }> {
  const map = new Map<string, number>();
  for (const w of water) map.set(w.date, (map.get(w.date) || 0) + w.ml);
  return rangeKeys(endDate, days).map((date) => ({ date, ml: map.has(date) ? map.get(date)! : null }));
}

export function sortedWeights(weights: WeightEntry[]): WeightEntry[] {
  return [...weights].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/** Change from the previous dated entry. */
export function changeFromPrevious(weights: WeightEntry[]): { kg: number; previousDate: string } | null {
  const s = sortedWeights(weights);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const prev = s[s.length - 2];
  return { kg: Math.round((last.kg - prev.kg) * 10) / 10, previousDate: prev.date };
}

/**
 * Change over a window, measured against the most recent entry at least `days` before the latest one.
 * Returns null when there isn't an entry far enough back — we don't extrapolate.
 */
export function changeOver(weights: WeightEntry[], days: number): number | null {
  const s = sortedWeights(weights);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const cutoff = addDays(last.date, -days);
  const candidates = s.filter((w) => w.date <= cutoff);
  if (!candidates.length) return null;
  const base = candidates[candidates.length - 1];
  if (daysBetween(base.date, last.date) > days * 2) return null; // too sparse to be meaningful
  return Math.round((last.kg - base.kg) * 10) / 10;
}

/** Average change per week using a least-squares fit over dated entries. Needs ≥ 3 entries spanning ≥ 7 days. */
export function weeklyTrend(weights: WeightEntry[]): number | null {
  const s = sortedWeights(weights);
  if (s.length < 3) return null;
  const t0 = s[0].date;
  const xs = s.map((w) => daysBetween(t0, w.date));
  if (xs[xs.length - 1] < 7) return null;
  const ys = s.map((w) => w.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return Math.round((num / den) * 7 * 100) / 100;
}

// ---------- Milestones ----------

export interface Milestone {
  id: string;
  title: string;
  date: string | null; // null = not reached yet
  detail?: string;
}

/** Last weigh-in per day, oldest first. */
function dailyWeights(weights: WeightEntry[]): WeightEntry[] {
  const byDay = new Map<string, WeightEntry>();
  for (const w of sortedWeights(weights)) byDay.set(w.date, w);
  return [...byDay.values()];
}

/**
 * Milestones worked out from the person's own records (nothing is stored).
 * Weight steps follow the goal direction; logging milestones count days with food logged.
 */
export function milestones(args: {
  weights: WeightEntry[];
  entries: FoodEntry[];
  goal: 'lose' | 'maintain' | 'gain';
  startKg?: number;
  goalKg?: number;
  stepKg: number;
  fmt: (kg: number) => string;
  today: string;
}): { reached: Milestone[]; next: Milestone[] } {
  const { goal, stepKg, fmt } = args;
  const reached: Milestone[] = [];
  const next: Milestone[] = [];
  const s = dailyWeights(args.weights);

  if (s.length) {
    reached.push({ id: 'first-weigh-in', title: 'First weigh-in', date: s[0].date });
    const dir = goal === 'lose' ? -1 : goal === 'gain' ? 1 : 0;
    const start = args.startKg ?? s[0].kg;
    const latest = s[s.length - 1].kg;
    const goalKg = args.goalKg != null && dir * (args.goalKg - start) > 0 ? args.goalKg : undefined;
    const crossed = (target: number) => s.find((w) => dir * (w.kg - target) >= -1e-9)?.date ?? null;
    const togo = (target: number) => `${fmt(Math.max(0, dir * (target - latest)))} to go`;
    const word = dir < 0 ? 'lost' : 'gained';
    const candidates: Array<{ m: Milestone; target: number }> = [];

    if (dir !== 0) {
      for (let k = 1; k <= 60; k++) {
        const target = start + dir * k * stepKg;
        if (goalKg != null && dir * (target - goalKg) >= -1e-9) break; // the goal itself is its own milestone
        const date = crossed(target);
        const m = { id: `step-${k}`, title: `${fmt(k * stepKg)} ${word}`, date };
        if (date) reached.push(m);
        else {
          candidates.push({ m: { ...m, detail: togo(target) }, target });
          break;
        }
      }
      if (goalKg != null) {
        const half = start + (goalKg - start) / 2;
        const halfDate = crossed(half);
        if (halfDate) reached.push({ id: 'halfway', title: 'Halfway to your goal weight', date: halfDate });
        else candidates.push({ m: { id: 'halfway', title: 'Halfway to your goal weight', date: null, detail: togo(half) }, target: half });
        const goalDate = crossed(goalKg);
        if (goalDate) reached.push({ id: 'goal', title: 'Goal weight reached', date: goalDate });
        else candidates.push({ m: { id: 'goal', title: 'Goal weight', date: null, detail: togo(goalKg) }, target: goalKg });
      }
      // The closest unreached weight milestone is "next".
      candidates.sort((a, b) => dir * a.target - dir * b.target); // smallest distance still to go first
      if (candidates.length) next.push(candidates[0].m);
    }
  }

  // Logging consistency: streaks of consecutive days with food logged, and total days logged.
  const days = [...new Set(args.entries.map((e) => e.date))].sort();
  let run = 0;
  let prev = '';
  const streakHit: Record<number, string> = {};
  days.forEach((d, i) => {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    for (const n of [7, 30]) if (run >= n && !streakHit[n]) streakHit[n] = d;
    if (i + 1 === 100) streakHit[100] = d;
  });
  if (days.length) reached.push({ id: 'first-log', title: 'First day logged', date: days[0] });
  if (streakHit[7]) reached.push({ id: 'streak-7', title: '7-day logging streak', date: streakHit[7] });
  if (streakHit[30]) reached.push({ id: 'streak-30', title: '30-day logging streak', date: streakHit[30] });
  if (streakHit[100]) reached.push({ id: 'days-100', title: '100 days logged', date: streakHit[100] });
  const current = loggingStreak(args.entries, args.today);
  if (!streakHit[7]) next.push({ id: 'streak-7', title: '7-day logging streak', date: null, detail: `${7 - Math.min(current, 6)} more day${7 - current === 1 ? '' : 's'} in a row` });
  else if (!streakHit[30]) next.push({ id: 'streak-30', title: '30-day logging streak', date: null, detail: `${30 - Math.min(current, 29)} more days in a row` });

  reached.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { reached, next };
}

/**
 * Group a run of days into weeks (the last week ends on the last day) and average the days
 * that have a value. A week with no records stays null — never zero.
 */
export function weeklyBuckets(days: Array<{ date: string; value: number | null }>): Array<{ date: string; value: number | null; days: number }> {
  const chunks: Array<typeof days> = [];
  for (let end = days.length; end > 0; end -= 7) chunks.unshift(days.slice(Math.max(0, end - 7), end));
  // A short leftover at the start (e.g. the 365th day of a year) joins the next week instead of standing alone.
  if (chunks.length > 1 && chunks[0].length < 4) chunks.splice(0, 2, [...chunks[0], ...chunks[1]]);
  return chunks.map((chunk) => {
    const vals = chunk.filter((d) => d.value != null).map((d) => d.value as number);
    return { date: chunk[0].date, value: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null, days: vals.length };
  });
}
