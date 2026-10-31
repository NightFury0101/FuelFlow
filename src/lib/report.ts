// A one-page progress report a member can send to their trainer — built only from their own
// records, for the last 7 or 30 days. The member chooses to create and share it; nothing is sent
// automatically.

import type { AppData, Profile, UnitPrefs } from './types';
import { addDays, parseDateKey } from './date';
import { dailyTotals, loggingStreak, sortedWeights, summarize } from './analytics';
import { MEASURES, toDisplay, unitFor } from './measurements';
import { displayWater, weightValue } from './units';

export interface ReportMeasure {
  label: string;
  unit: string;
  from: number | null; // display units; null when only one value exists
  to: number;
}

export interface ProgressReport {
  name: string;
  from: string; // YYYY-MM-DD
  to: string;
  days: number;
  goal: Profile['goal'];
  loggedDays: number;
  streak: number;
  avgKcal: number | null;
  kcalTarget: number;
  onTargetDays: number;
  avgProtein: number | null;
  proteinTarget: number;
  proteinHitDays: number;
  avgWaterMl: number | null;
  waterTargetMl: number;
  /** Weigh-ins used for the report: the last one before the period (as a baseline) plus those inside it. */
  weights: Array<{ date: string; kg: number }>;
  startKg: number | null;
  endKg: number | null;
  changeKg: number | null;
  goalKg: number | null;
  measures: ReportMeasure[];
}

export function buildReport(args: { data: AppData; profile: Profile; days: number; today: string }): ProgressReport {
  const { data, profile, days, today } = args;
  const from = addDays(today, -(days - 1));
  const totals = dailyTotals(data.entries, today, days);
  const sum = summarize(totals, profile.targets);

  const waterByDay = new Map<string, number>();
  for (const w of data.water) if (w.date >= from && w.date <= today) waterByDay.set(w.date, (waterByDay.get(w.date) || 0) + w.ml);
  const waterDays = [...waterByDay.values()];
  const avgWaterMl = waterDays.length ? Math.round(waterDays.reduce((a, b) => a + b, 0) / waterDays.length) : null;

  // Last weigh-in per day; baseline = latest one before the period, so "change" covers the whole period.
  const perDay = new Map<string, { date: string; kg: number }>();
  for (const w of sortedWeights(data.weights)) if (w.date <= today) perDay.set(w.date, { date: w.date, kg: w.kg });
  const all = [...perDay.values()];
  const before = all.filter((w) => w.date < from).at(-1);
  const inside = all.filter((w) => w.date >= from);
  const weights = before && inside.length ? [before, ...inside] : inside;
  const startKg = weights.length ? weights[0].kg : null;
  const endKg = weights.length ? weights[weights.length - 1].kg : null;
  const changeKg = weights.length >= 2 ? Math.round((endKg! - startKg!) * 10) / 10 : null;

  const measures: ReportMeasure[] = [];
  const s = sortedWeights(data.weights).filter((w) => w.date <= today);
  for (const m of MEASURES) {
    const rows = s.filter((w) => typeof w[m.key] === 'number');
    const base = rows.filter((w) => w.date < from).at(-1);
    const win = rows.filter((w) => w.date >= from);
    if (!win.length) continue;
    const first = base ?? win[0];
    const last = win[win.length - 1];
    measures.push({
      label: m.label,
      unit: unitFor(m, profile.units),
      from: first === last ? null : toDisplay(m, first[m.key]!, profile.units),
      to: toDisplay(m, last[m.key]!, profile.units),
    });
  }

  return {
    name: profile.name?.trim() || 'FuelFlow member',
    from,
    to: today,
    days,
    goal: profile.goal,
    loggedDays: sum.loggedDays,
    streak: loggingStreak(data.entries, today),
    avgKcal: sum.avgKcal,
    kcalTarget: profile.targets.kcal,
    onTargetDays: sum.onTargetDays,
    avgProtein: sum.avgProtein == null ? null : Math.round(sum.avgProtein),
    proteinTarget: profile.targets.protein,
    proteinHitDays: sum.proteinHitDays,
    avgWaterMl,
    waterTargetMl: profile.targets.waterMl,
    weights,
    startKg,
    endKg,
    changeKg,
    goalKg: profile.goalWeightKg ?? null,
    measures,
  };
}

// ---------- Formatting ----------

const fmtN = (n: number) => Math.round(n).toLocaleString('en-US');

export function dateRange(r: ProgressReport): string {
  const a = parseDateKey(r.from);
  const b = parseDateKey(r.to);
  const sameYear = a.getFullYear() === b.getFullYear();
  const d = (x: Date, year: boolean) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  return `${d(a, !sameYear)} – ${d(b, true)}`;
}

export function signed(n: number, unit: string): string {
  const v = Math.round(Math.abs(n) * 10) / 10;
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${v} ${unit}`;
}

/** Plain-text version for messaging apps. */
export function reportText(r: ProgressReport, units: UnitPrefs): string {
  const w = (kg: number) => `${weightValue(kg, units)} ${units.weight}`;
  const lines = [`FuelFlow progress — ${r.name}`, `${dateRange(r)} (${r.days} days)`, ''];
  if (r.startKg != null && r.endKg != null && r.changeKg != null) lines.push(`Weight: ${w(r.startKg)} → ${w(r.endKg)} (${signed(weightValue(r.changeKg, units), units.weight)})`);
  else if (r.endKg != null) lines.push(`Weight: ${w(r.endKg)}`);
  if (r.avgKcal != null) lines.push(`Calories: ${fmtN(r.avgKcal)} kcal/day on average (target ${fmtN(r.kcalTarget)}) · on target ${r.onTargetDays} of ${r.loggedDays} logged days`);
  if (r.avgProtein != null) lines.push(`Protein: ${r.avgProtein} g/day on average (target ${r.proteinTarget} g) · target reached ${r.proteinHitDays} days`);
  if (r.avgWaterMl != null) lines.push(`Water: ${displayWater(r.avgWaterMl, units)}/day on average (goal ${displayWater(r.waterTargetMl, units)})`);
  lines.push(`Food logged ${r.loggedDays} of ${r.days} days · current streak ${r.streak} day${r.streak === 1 ? '' : 's'}`);
  for (const m of r.measures) lines.push(m.from == null ? `${m.label}: ${m.to} ${m.unit}` : `${m.label}: ${m.from} → ${m.to} ${m.unit} (${signed(m.to - m.from, m.unit)})`);
  lines.push('', 'From my own FuelFlow logs — estimates, not medical advice.');
  return lines.join('\n');
}
