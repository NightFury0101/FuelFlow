import type { Food } from './types';

// Generic reference foods so search works instantly and offline.
// Values are typical averages per 100 g based on USDA FoodData Central entries.
// They are labelled "Reference" in the app — individual products and recipes vary.

type Row = [id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, servings: Array<[string, number]>];

const ROWS: Row[] = [
  ['rice-white', 'White rice, cooked', 130, 2.7, 28.2, 0.3, 0.4, [['1 cup', 158], ['½ cup', 79]]],
  ['rice-brown', 'Brown rice, cooked', 123, 2.7, 25.6, 1.0, 1.6, [['1 cup', 195]]],
  ['pasta', 'Pasta, cooked', 158, 5.8, 30.9, 0.9, 1.8, [['1 cup', 140]]],
  ['oats', 'Rolled oats, dry', 379, 13.2, 67.7, 6.5, 10.1, [['½ cup', 40]]],
  ['bread-wholewheat', 'Whole-wheat bread', 252, 12.4, 42.7, 3.5, 6.0, [['1 slice', 32]]],
  ['bread-white', 'White bread', 266, 7.6, 50.6, 3.3, 2.4, [['1 slice', 25]]],
  ['potato-baked', 'Potato, baked with skin', 93, 2.5, 21.2, 0.1, 2.2, [['1 medium', 173]]],
  ['sweet-potato', 'Sweet potato, baked', 90, 2.0, 20.7, 0.2, 3.3, [['1 medium', 114]]],
  ['chicken-breast', 'Chicken breast, skinless, roasted', 165, 31.0, 0, 3.6, 0, [['1 palm-size piece', 120]]],
  ['tuna-skipjack', 'Tuna (skipjack), cooked', 132, 28.2, 0, 1.3, 0, [['1 fillet', 120]]],
  ['tuna-canned', 'Tuna, canned in water, drained', 116, 25.5, 0, 0.8, 0, [['1 small can, drained', 120]]],
  ['salmon', 'Salmon, Atlantic, cooked', 206, 22.1, 0, 12.4, 0, [['1 fillet', 150]]],
  ['shrimp', 'Shrimp, cooked', 99, 24.0, 0.2, 0.3, 0, [['10 large', 70]]],
  ['beef-90', 'Ground beef 90% lean, cooked', 217, 26.1, 0, 11.7, 0, [['1 patty', 85]]],
  ['egg', 'Egg, whole, boiled', 155, 12.6, 1.1, 10.6, 0, [['1 large egg', 50]]],
  ['egg-white', 'Egg white', 52, 10.9, 0.7, 0.2, 0, [['1 large egg white', 33]]],
  ['lentils', 'Lentils, boiled', 116, 9.0, 20.1, 0.4, 7.9, [['1 cup', 198]]],
  ['chickpeas', 'Chickpeas, boiled', 164, 8.9, 27.4, 2.6, 7.6, [['1 cup', 164]]],
  ['milk-whole', 'Milk, whole', 61, 3.2, 4.8, 3.3, 0, [['1 cup', 244]]],
  ['milk-skim', 'Milk, skim', 34, 3.4, 5.0, 0.1, 0, [['1 cup', 245]]],
  ['greek-yogurt', 'Greek yogurt, plain, non-fat', 59, 10.2, 3.6, 0.4, 0, [['1 pot', 170]]],
  ['cottage-cheese', 'Cottage cheese, 2% fat', 84, 11.0, 4.3, 2.3, 0, [['½ cup', 113]]],
  ['cheddar', 'Cheddar cheese', 403, 24.9, 1.3, 33.1, 0, [['1 slice', 28]]],
  ['banana', 'Banana', 89, 1.1, 22.8, 0.3, 2.6, [['1 medium', 118]]],
  ['apple', 'Apple, with skin', 52, 0.3, 13.8, 0.2, 2.4, [['1 medium', 182]]],
  ['orange', 'Orange', 47, 0.9, 11.8, 0.1, 2.4, [['1 medium', 131]]],
  ['mango', 'Mango', 60, 0.8, 15.0, 0.4, 1.6, [['1 cup pieces', 165]]],
  ['papaya', 'Papaya', 43, 0.5, 10.8, 0.3, 1.7, [['1 cup pieces', 145]]],
  ['coconut', 'Coconut meat, fresh', 354, 3.3, 15.2, 33.5, 9.0, [['1 cup grated', 80]]],
  ['avocado', 'Avocado', 160, 2.0, 8.5, 14.7, 6.7, [['½ avocado', 75]]],
  ['broccoli', 'Broccoli, raw', 34, 2.8, 6.6, 0.4, 2.6, [['1 cup chopped', 91]]],
  ['spinach', 'Spinach, raw', 23, 2.9, 3.6, 0.4, 2.2, [['1 cup', 30]]],
  ['carrot', 'Carrot, raw', 41, 0.9, 9.6, 0.2, 2.8, [['1 medium', 61]]],
  ['cucumber', 'Cucumber, with peel', 15, 0.7, 3.6, 0.1, 0.5, [['1 cup slices', 104]]],
  ['tomato', 'Tomato', 18, 0.9, 3.9, 0.2, 1.2, [['1 medium', 123]]],
  ['almonds', 'Almonds', 579, 21.2, 21.6, 49.9, 12.5, [['1 handful (28 g)', 28]]],
  ['peanut-butter', 'Peanut butter, smooth', 588, 25.1, 19.6, 50.4, 6.0, [['1 tbsp', 16]]],
  ['olive-oil', 'Olive oil', 884, 0, 0, 100, 0, [['1 tbsp', 13.5], ['1 tsp', 4.5]]],
  ['butter', 'Butter', 717, 0.9, 0.1, 81.1, 0, [['1 tbsp', 14]]],
  ['honey', 'Honey', 304, 0.3, 82.4, 0, 0.2, [['1 tbsp', 21]]],
  ['sugar', 'Sugar, white', 387, 0, 100, 0, 0, [['1 tsp', 4]]],
  ['dark-chocolate', 'Dark chocolate, 70–85%', 598, 7.8, 45.9, 42.6, 10.9, [['1 square', 10]]],
  ['orange-juice', 'Orange juice', 45, 0.7, 10.4, 0.2, 0.2, [['1 cup', 248]]],
  ['coffee-black', 'Coffee, black', 1, 0.1, 0, 0, 0, [['1 cup', 237]]],
];

export const REFERENCE_FOODS: Food[] = ROWS.map(([id, name, kcal, protein, carbs, fat, fiber, servings]) => ({
  id: `ref:${id}`,
  name,
  source: 'reference',
  baseUnit: 'g',
  baseAmount: 100,
  nutrients: { kcal, protein, carbs, fat, fiber },
  servings: [...servings.map(([label, amount]) => ({ label, amount })), { label: '100 g', amount: 100 }],
}));

export function searchReference(query: string, limit = 12): Food[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return REFERENCE_FOODS.map((f) => {
    const name = f.name.toLowerCase();
    if (!words.every((w) => name.includes(w))) return null;
    const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2;
    return { f, score };
  })
    .filter((x): x is { f: Food; score: number } => x !== null)
    .sort((a, b) => a.score - b.score || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => x.f);
}
