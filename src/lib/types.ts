// Core domain types for FuelFlow.
// Internal units are always metric: kg, cm, ml, grams. Conversion happens only at display time.

export interface Nutrients {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber?: number; // g
}

/** Where a food's numbers came from. Shown to the user so estimates are never mistaken for database values. */
export type NutritionSource =
  | 'reference' // bundled generic reference values (USDA-based averages)
  | 'openfoodfacts' // Open Food Facts community database
  | 'custom' // food the user created
  | 'recipe' // calculated from the user's own ingredients
  | 'ai-estimate' // estimated by the AI scanner, confirmed by the user
  | 'manual'; // quick-add numbers typed by the user

export type BaseUnit = 'g' | 'ml' | 'serving';

export interface Serving {
  label: string; // "1 cup", "1 slice", "100 g"
  amount: number; // amount in the food's baseUnit
}

/** A food as it exists in a catalogue (reference list, search result, custom food). */
export interface Food {
  id: string;
  name: string;
  brand?: string;
  source: NutritionSource;
  baseUnit: BaseUnit;
  baseAmount: number; // nutrients describe this many baseUnits (usually 100 g/ml, or 1 serving)
  nutrients: Nutrients;
  servings: Serving[];
}

export type MealId = string; // 'breakfast' | 'lunch' | 'dinner' | 'snacks' | user-defined

export interface MealSlot {
  id: MealId;
  name: string;
}

/** A logged diary entry. Keeps a snapshot of the food so history never changes if a database does. */
export interface FoodEntry {
  id: string;
  date: string; // local YYYY-MM-DD
  meal: MealId;
  createdAt: number;
  food: Food; // snapshot
  servingLabel: string;
  quantity: number; // number of servings (or grams when servingLabel is the base unit)
  amount: number; // total amount in food.baseUnit
  nutrients: Nutrients; // computed for `amount`, stored for consistency
  aiEstimated?: boolean;
}

export interface WaterEntry {
  id: string;
  date: string;
  ml: number;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
  waistCm?: number;
  note?: string;
  createdAt: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: Array<Pick<FoodEntry, 'food' | 'servingLabel' | 'quantity' | 'amount'>>;
  createdAt: number;
}

export type Sex = 'female' | 'male' | 'unspecified';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type SpecialCircumstance = 'none' | 'pregnant' | 'breastfeeding' | 'medical';

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

export interface UnitPrefs {
  weight: 'kg' | 'lb';
  height: 'cm' | 'ftin';
  water: 'ml' | 'floz';
}

export interface Profile {
  name: string;
  sex: Sex;
  birthDate?: string; // YYYY-MM-DD
  heightCm?: number;
  startWeightKg?: number;
  goalWeightKg?: number;
  activity: Activity;
  goal: Goal;
  special: SpecialCircumstance;
  diet: string[];
  units: UnitPrefs;
  targets: Targets;
  targetsCustomized: boolean;
  meals: MealSlot[];
  onboarded: boolean;
  setupIncomplete: boolean; // user skipped body details
  scannerEndpoint?: string; // the user's private AI server (scanner + coach)
  coachShareLog?: boolean; // opt-in: let the coach see a summary of the food log
  waterQuickAdds: number[]; // ml
  createdAt: number;
}

export interface AppData {
  schemaVersion: number;
  profile: Profile | null;
  entries: FoodEntry[];
  water: WaterEntry[];
  weights: WeightEntry[];
  customFoods: Food[];
  favorites: Food[];
  savedMeals: SavedMeal[];
  recents: Food[];
}
