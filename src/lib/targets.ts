import type { Activity, Goal, Sex, SpecialCircumstance, Targets } from './types';

export const ACTIVITY: Record<Activity, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', hint: 'Desk job, little exercise' },
  light: { factor: 1.375, label: 'Lightly active', hint: 'Exercise 1–3 days a week' },
  moderate: { factor: 1.55, label: 'Moderately active', hint: 'Exercise 3–5 days a week' },
  active: { factor: 1.725, label: 'Very active', hint: 'Hard training 6–7 days a week' },
  'very-active': { factor: 1.9, label: 'Athlete', hint: 'Physical job plus daily training' },
};

export interface TargetInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activity: Activity;
  goal: Goal;
  special: SpecialCircumstance;
}

export interface TargetResult {
  targets: Targets;
  bmr: number;
  tdee: number;
  adjustment: number; // kcal added (+) or removed (-) from maintenance
  appliedGoal: Goal; // may differ from requested goal for safety reasons
  needsProfessional: boolean;
  notes: string[];
}

/** Mifflin–St Jeor resting energy estimate. For "unspecified" we use the midpoint of the two constants. */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const c = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return base + c;
}

const round10 = (n: number) => Math.round(n / 10) * 10;
const round250 = (n: number) => Math.round(n / 250) * 250;

export function calculateTargets(input: TargetInput): TargetResult {
  const notes: string[] = [];
  const bmr = bmrMifflin(input.sex, input.weightKg, input.heightCm, input.age);
  const tdee = bmr * ACTIVITY[input.activity].factor;

  let appliedGoal: Goal = input.goal;
  let needsProfessional = false;

  if (input.age < 18) {
    needsProfessional = true;
    if (input.goal !== 'maintain') appliedGoal = 'maintain';
    notes.push(
      'Because you are under 18, FuelFlow uses an estimated maintenance intake instead of a weight-change target. Growing bodies have different needs — a doctor or registered dietitian can give you personal advice.',
    );
  } else if (input.special === 'pregnant' || input.special === 'breastfeeding' || input.special === 'medical') {
    needsProfessional = true;
    if (input.goal !== 'maintain') appliedGoal = 'maintain';
    const what =
      input.special === 'pregnant' ? 'pregnancy' : input.special === 'breastfeeding' ? 'breastfeeding' : 'your medical situation';
    notes.push(
      `Standard weight-loss formulas don't account for ${what}. FuelFlow shows an estimated baseline only — please set your targets with your doctor or a registered dietitian.`,
    );
  }

  let adjustment = 0;
  if (appliedGoal === 'lose') {
    // Moderate deficit: at most 500 kcal or 20% of maintenance, never below estimated resting needs.
    const floor = Math.max(bmr, input.sex === 'male' ? 1500 : input.sex === 'female' ? 1200 : 1350);
    const wanted = Math.min(500, tdee * 0.2);
    const kcal = Math.max(tdee - wanted, floor);
    adjustment = kcal - tdee;
    if (adjustment > -wanted + 1) {
      notes.push('Your deficit is smaller than usual so your target stays above your estimated resting energy needs.');
    }
    notes.push('A moderate deficit like this typically means losing roughly 0.25–0.5 kg per week. Real results vary.');
  } else if (appliedGoal === 'gain') {
    adjustment = Math.min(300, tdee * 0.1);
    notes.push('A small surplus supports muscle gain while limiting fat gain, especially alongside strength training.');
  } else {
    notes.push('This is an estimate of the energy you need to keep your current weight.');
  }

  const kcal = Math.max(1000, round10(tdee + adjustment));

  // Protein: grams per kg body weight. When losing, use goal weight if it is lower, to avoid inflated targets.
  let refKg = input.weightKg;
  if (appliedGoal === 'lose' && input.goalWeightKg && input.goalWeightKg < input.weightKg) {
    refKg = Math.max(input.goalWeightKg, input.weightKg * 0.85);
  }
  const gPerKg = needsProfessional ? 1.1 : appliedGoal === 'maintain' ? 1.2 : 1.6;
  let protein = Math.round(refKg * gPerKg);
  protein = Math.min(protein, Math.round((kcal * 0.35) / 4));

  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  const waterMl = Math.min(4000, Math.max(1500, round250(input.weightKg * 35)));

  notes.push(
    `Based on the Mifflin–St Jeor equation: about ${Math.round(bmr)} kcal at rest × ${ACTIVITY[input.activity].factor} for your activity level ≈ ${Math.round(tdee)} kcal per day.`,
  );

  return {
    targets: { kcal, protein, carbs, fat, waterMl },
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    adjustment: Math.round(adjustment),
    appliedGoal,
    needsProfessional,
    notes,
  };
}

export const DEFAULT_TARGETS: Targets = { kcal: 2000, protein: 100, carbs: 230, fat: 65, waterMl: 2000 };

/** Recompute carbs so the three macros add up to the calorie target. */
export function balanceCarbs(t: Pick<Targets, 'kcal' | 'protein' | 'fat'>): number {
  return Math.max(0, Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4));
}
