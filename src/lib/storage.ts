import type { AppData, Food, FoodEntry, Nutrients } from './types';
import { todayKey, isValidDateKey } from './date';

// Storage layer. Everything goes through this module so a cloud backend (e.g. Supabase)
// can replace localStorage later without touching the screens.

export const STORAGE_KEY = 'fuelflow:data:v1';
export const LEGACY_KEY = 'fuelflow-meals'; // from earlier FuelFlow prototypes — read, never deleted
export const SCHEMA_VERSION = 1;

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: null,
    entries: [],
    water: [],
    weights: [],
    customFoods: [],
    favorites: [],
    savedMeals: [],
    recents: [],
  };
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function validNutrients(n: unknown): n is Nutrients {
  const x = n as Nutrients;
  return !!x && isNum(x.kcal) && isNum(x.protein) && isNum(x.carbs) && isNum(x.fat) && x.kcal >= 0;
}

function validFood(f: unknown): f is Food {
  const x = f as Food;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && validNutrients(x.nutrients) && isNum(x.baseAmount) && x.baseAmount > 0;
}

/** Validate and normalise unknown JSON (from storage or an imported backup). Bad records are dropped, not crashed on. */
export function normalizeData(raw: unknown): AppData {
  const d = emptyData();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AppData>;
  d.profile = r.profile && typeof r.profile === 'object' ? r.profile : null;
  d.entries = arr<FoodEntry>(r.entries).filter(
    (e) => e && typeof e.id === 'string' && isValidDateKey(e.date) && validFood(e.food) && validNutrients(e.nutrients) && isNum(e.amount),
  );
  d.water = arr<AppData['water'][number]>(r.water).filter((w) => w && isValidDateKey(w.date) && isNum(w.ml) && w.ml > 0 && w.ml < 10000);
  d.weights = arr<AppData['weights'][number]>(r.weights).filter((w) => w && isValidDateKey(w.date) && isNum(w.kg) && w.kg > 20 && w.kg < 400);
  d.customFoods = arr<Food>(r.customFoods).filter(validFood);
  d.favorites = arr<Food>(r.favorites).filter(validFood);
  d.recents = arr<Food>(r.recents).filter(validFood).slice(0, 30);
  d.savedMeals = arr<AppData['savedMeals'][number]>(r.savedMeals).filter((m) => m && typeof m.name === 'string' && Array.isArray(m.items));
  return d;
}

/** Older prototypes stored a flat list of meals under `fuelflow-meals`. Import them once as manual entries. */
export function migrateLegacy(raw: string | null, now = Date.now()): FoodEntry[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const out: FoodEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const name = String(m.name ?? m.food ?? m.title ?? '').trim();
    const kcal = Number(m.calories ?? m.kcal ?? m.cal);
    if (!name || !Number.isFinite(kcal) || kcal < 0) continue;
    const protein = Number(m.protein) || 0;
    const carbs = Number(m.carbs ?? m.carbohydrates) || 0;
    const fat = Number(m.fat) || 0;
    let date = typeof m.date === 'string' ? m.date.slice(0, 10) : '';
    if (!isValidDateKey(date)) {
      const t = typeof m.timestamp === 'number' ? m.timestamp : typeof m.createdAt === 'number' ? m.createdAt : now;
      date = todayKey(new Date(t));
    }
    const mealRaw = String(m.meal ?? m.mealType ?? m.category ?? 'snacks').toLowerCase();
    const meal = ['breakfast', 'lunch', 'dinner'].includes(mealRaw) ? mealRaw : 'snacks';
    const nutrients = { kcal: Math.round(kcal), protein, carbs, fat };
    out.push({
      id: uid('legacy-'),
      date,
      meal,
      createdAt: typeof m.timestamp === 'number' ? m.timestamp : now,
      food: { id: uid('manual-'), name, source: 'manual', baseUnit: 'serving', baseAmount: 1, nutrients, servings: [{ label: '1 serving', amount: 1 }] },
      servingLabel: '1 serving',
      quantity: 1,
      amount: 1,
      nutrients,
    });
  }
  return out;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function loadData(store: StorageLike | null = safeLocalStorage()): AppData {
  if (!store) return emptyData();
  let data: AppData;
  try {
    data = normalizeData(JSON.parse(store.getItem(STORAGE_KEY) || 'null'));
  } catch {
    data = emptyData();
  }
  const migratedFlag = 'fuelflow:legacy-migrated';
  if (!store.getItem(migratedFlag)) {
    const legacy = migrateLegacy(store.getItem(LEGACY_KEY));
    if (legacy.length) data.entries = [...data.entries, ...legacy];
    try {
      store.setItem(migratedFlag, '1');
    } catch {
      /* ignore */
    }
  }
  return data;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export function saveData(data: AppData, store: StorageLike | null = safeLocalStorage()): SaveResult {
  if (!store) return { ok: false, error: 'Storage is not available in this browser.' };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return { ok: false, error: quota ? 'Your device storage is full. Export a backup and clear old data.' : 'Could not save your changes.' };
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__ff_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

// ---------- Export ----------

export function backupJson(data: AppData): string {
  return JSON.stringify({ app: 'FuelFlow', exportedAt: new Date().toISOString(), ...data }, null, 2);
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function diaryCsv(data: AppData): string {
  const head = ['date', 'meal', 'food', 'brand', 'amount', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'source'];
  const rows = [...data.entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((e) => [e.date, e.meal, e.food.name, e.food.brand, `${e.quantity} × ${e.servingLabel}`, e.nutrients.kcal, e.nutrients.protein, e.nutrients.carbs, e.nutrients.fat, e.aiEstimated ? 'ai-estimate' : e.food.source]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}

export function progressCsv(data: AppData): string {
  const head = ['date', 'weight_kg', 'waist_cm', 'note'];
  const rows = [...data.weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.kg, w.waistCm, w.note]);
  const waterHead = ['date', 'water_ml'];
  const byDay = new Map<string, number>();
  for (const w of data.water) byDay.set(w.date, (byDay.get(w.date) || 0) + w.ml);
  const waterRows = [...byDay.entries()].sort().map(([d, ml]) => [d, ml]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n\n' + [waterHead, ...waterRows].map((r) => r.map(csvCell).join(',')).join('\n');
}
