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
