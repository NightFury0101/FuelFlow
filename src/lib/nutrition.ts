import type { Food, FoodEntry, Nutrients, RecipeIngredient, Serving } from './types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Scale a food's nutrients to an amount expressed in its base unit. */
export function scaleNutrients(food: Pick<Food, 'nutrients' | 'baseAmount'>, amount: number): Nutrients {
  if (!(amount > 0) || !(food.baseAmount > 0)) return { ...ZERO };
  const f = amount / food.baseAmount;
  const n = food.nutrients;
  const out: Nutrients = {
    kcal: Math.round(n.kcal * f),
    protein: r1(n.protein * f),
    carbs: r1(n.carbs * f),
    fat: r1(n.fat * f),
  };
  if (n.fiber != null) out.fiber = r1(n.fiber * f);
  return out;
}

/** The serving list always includes the raw base unit (e.g. "g") so users can weigh food. */
export function servingOptions(food: Food): Serving[] {
  const list = [...food.servings];
  if (food.baseUnit !== 'serving' && !list.some((s) => s.label === food.baseUnit)) {
    list.push({ label: food.baseUnit, amount: 1 });
  }
  if (list.length === 0) list.push({ label: '1 serving', amount: food.baseAmount });
  return list;
}

export function amountFor(serving: Serving, quantity: number): number {
  return Math.max(0, serving.amount * quantity);
}

export function sumNutrients(items: Array<{ nutrients: Nutrients }>): Nutrients {
  const t = items.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.nutrients.kcal || 0),
      protein: acc.protein + (e.nutrients.protein || 0),
      carbs: acc.carbs + (e.nutrients.carbs || 0),
      fat: acc.fat + (e.nutrients.fat || 0),
      fiber: (acc.fiber || 0) + (e.nutrients.fiber || 0),
    }),
    { ...ZERO },
  );
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), fiber: r1(t.fiber || 0) };
}

export function entriesForDay(entries: FoodEntry[], date: string): FoodEntry[] {
  return entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt);
}

/** Calories implied by macros. Used to sanity-check user-entered foods. */
export function kcalFromMacros(n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>): number {
  return Math.round(n.protein * 4 + n.carbs * 4 + n.fat * 9);
}

export function macroWarning(n: Nutrients): string | null {
  const implied = kcalFromMacros(n);
  if (n.kcal <= 0 && implied <= 0) return null;
  const diff = Math.abs(implied - n.kcal);
  if (diff > Math.max(40, n.kcal * 0.25)) {
    return `Macros add up to about ${implied} kcal, but calories are ${Math.round(n.kcal)}. Double-check the label.`;
  }
  return null;
}

export function formatAmount(entry: Pick<FoodEntry, 'quantity' | 'servingLabel' | 'food' | 'amount'>): string {
  const q = Math.round(entry.quantity * 100) / 100;
  const unit = entry.food.baseUnit;
  if (entry.servingLabel === unit) return `${q} ${unit}`;
  const label = q === 1 ? entry.servingLabel : `${q} × ${entry.servingLabel}`;
  // Skip the weight when it adds nothing ("1 serving (300 g)" already says it).
  const labelHasWeight = /\d\s?(g|ml)\b/.test(entry.servingLabel);
  const base = unit === 'serving' || (q === 1 && labelHasWeight) ? '' : ` · ${Math.round(entry.amount)} ${unit}`;
  return `${label}${base}`;
}

/** Strip recipe ingredient lists from a food snapshot (keeps diary entries small). */
export function snapshotFood(food: Food): Food {
  if (!food.recipe) return food;
  const { recipe: _r, ...rest } = food;
  return rest;
}

/**
 * Turn a recipe into a loggable food. Nutrition is the sum of the ingredients divided by servings.
 * When every ingredient is measured in grams, the recipe can also be logged by weight.
 */
export function buildRecipeFood(id: string, name: string, servings: number, ingredients: RecipeIngredient[], notes?: string): Food {
  const portions = Math.max(1, servings);
  const total = sumNutrients(ingredients.map((i) => ({ nutrients: scaleNutrients(i.food, i.amount) })));
  const allGrams = ingredients.length > 0 && ingredients.every((i) => i.food.baseUnit === 'g');
  const totalGrams = allGrams ? ingredients.reduce((s, i) => s + i.amount, 0) : 0;
  const perServing: Nutrients = {
    kcal: Math.round(total.kcal / portions),
    protein: Math.round((total.protein / portions) * 10) / 10,
    carbs: Math.round((total.carbs / portions) * 10) / 10,
    fat: Math.round((total.fat / portions) * 10) / 10,
    fiber: Math.round(((total.fiber || 0) / portions) * 10) / 10,
  };
  const recipe = { servings: portions, ingredients: ingredients.map((i) => ({ ...i, food: snapshotFood(i.food) })), ...(notes ? { notes } : {}) };
  if (allGrams && totalGrams > 0) {
    const portionGrams = Math.round(totalGrams / portions);
    return { id, name, source: 'recipe', baseUnit: 'g', baseAmount: portionGrams, nutrients: perServing, servings: [{ label: `1 serving (${portionGrams} g)`, amount: portionGrams }], recipe };
  }
  return { id, name, source: 'recipe', baseUnit: 'serving', baseAmount: 1, nutrients: perServing, servings: [{ label: '1 serving', amount: 1 }], recipe };
}
