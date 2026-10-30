import type { UnitPrefs, WeightEntry } from './types';
import { sortedWeights } from './analytics';

export type MeasureKey = 'waistCm' | 'hipsCm' | 'chestCm' | 'armCm' | 'thighCm' | 'bodyFatPct';

export interface Measure {
  key: MeasureKey;
  label: string;
  kind: 'length' | 'percent';
  min: number; // stored unit (cm or %)
  max: number;
  hint?: string;
}

export const MEASURES: Measure[] = [
  { key: 'waistCm', label: 'Waist', kind: 'length', min: 30, max: 300, hint: 'At the belly button' },
  { key: 'hipsCm', label: 'Hips', kind: 'length', min: 40, max: 300, hint: 'Widest point' },
  { key: 'chestCm', label: 'Chest', kind: 'length', min: 40, max: 300 },
  { key: 'armCm', label: 'Upper arm', kind: 'length', min: 10, max: 100, hint: 'Relaxed, mid-arm' },
  { key: 'thighCm', label: 'Thigh', kind: 'length', min: 20, max: 150 },
  { key: 'bodyFatPct', label: 'Body fat', kind: 'percent', min: 2, max: 75, hint: 'From a scale or caliper, if you have one' },
];

export const lengthUnit = (units: UnitPrefs) => (units.height === 'ftin' ? 'in' : 'cm');
export const unitFor = (m: Measure, units: UnitPrefs) => (m.kind === 'percent' ? '%' : lengthUnit(units));

/** Stored value → number shown to the user (cm or inches, 1 decimal). */
export function toDisplay(m: Measure, stored: number, units: UnitPrefs): number {
  const v = m.kind === 'length' && lengthUnit(units) === 'in' ? stored / 2.54 : stored;
  return Math.round(v * 10) / 10;
}

/** Number typed by the user → stored value (cm or %). */
export function fromDisplay(m: Measure, shown: number, units: UnitPrefs): number {
  const v = m.kind === 'length' && lengthUnit(units) === 'in' ? shown * 2.54 : shown;
  return Math.round(v * 10) / 10;
}

export interface MeasureSummary {
  measure: Measure;
  latest: { value: number; date: string };
  first: { value: number; date: string };
  count: number;
}

/** For each measurement with at least one record: the first and latest dated values. */
export function summarizeMeasures(weights: WeightEntry[]): MeasureSummary[] {
  const s = sortedWeights(weights);
  const out: MeasureSummary[] = [];
  for (const m of MEASURES) {
    const rows = s.filter((w) => typeof w[m.key] === 'number');
    if (!rows.length) continue;
    const f = rows[0];
    const l = rows[rows.length - 1];
    out.push({ measure: m, first: { value: f[m.key]!, date: f.date }, latest: { value: l[m.key]!, date: l.date }, count: rows.length });
  }
  return out;
}
