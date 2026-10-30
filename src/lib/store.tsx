import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Food, FoodEntry, MealId, Nutrients, Profile, SavedMeal, WaterEntry, WeightEntry } from './types';
import { loadData, normalizeData, saveData, STORAGE_KEY, uid } from './storage';
import { scaleNutrients, snapshotFood } from './nutrition';
import { todayKey } from './date';
import { useCloud, type CloudApi } from './cloud/useCloud';

export const DEFAULT_MEALS = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'dinner', name: 'Dinner' },
  { id: 'snacks', name: 'Snacks' },
];

/** The meal that best fits the current time of day. */
export function mealForNow(meals: Array<{ id: string }>, hour = new Date().getHours()): string {
  const pick = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'snacks';
  return meals.some((m) => m.id === pick) ? pick : meals[0]?.id ?? 'snacks';
}

export interface NewEntryInput {
  date: string;
  meal: MealId;
  food: Food;
  servingLabel: string;
  quantity: number;
  amount: number;
  aiEstimated?: boolean;
  nutrientsOverride?: Nutrients; // e.g. user-corrected AI estimate
}

interface Store {
  data: AppData;
  cloud: CloudApi;
  profile: Profile | null;
  saveError: string | null;
  toast: { id: number; text: string; undo?: () => void } | null;
  showToast(text: string, undo?: () => void): void;
  dismissToast(): void;
  setProfile(p: Profile): void;
  updateProfile(patch: Partial<Profile>): void;
  addEntries(items: NewEntryInput[]): FoodEntry[];
  updateEntry(id: string, patch: Partial<Pick<FoodEntry, 'meal' | 'date' | 'quantity' | 'servingLabel' | 'amount'>> & { nutrients?: Nutrients }): void;
  deleteEntry(id: string): void;
  restoreEntries(entries: FoodEntry[]): void;
  addPlanned(items: NewEntryInput[]): FoodEntry[];
  deletePlanned(id: string): void;
  restorePlanned(entries: FoodEntry[]): void;
  /** Move planned items into the diary as eaten. Returns the new diary entries. */
  eatPlanned(ids: string[]): FoodEntry[];
  addWater(ml: number, date?: string): WaterEntry;
  updateWater(id: string, ml: number): void;
  deleteWater(id: string): void;
  addWeight(w: Omit<WeightEntry, 'id' | 'createdAt'>): void;
  updateWeight(id: string, patch: Partial<WeightEntry>): void;
  deleteWeight(id: string): void;
  saveCustomFood(f: Food): void;
  deleteCustomFood(id: string): void;
  toggleFavorite(f: Food): void;
  isFavorite(id: string): boolean;
  saveMeal(name: string, entries: FoodEntry[]): void;
  deleteSavedMeal(id: string): void;
  importData(raw: unknown): { ok: boolean; message: string };
  resetAll(): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<Store['toast']>(null);
  const skipSave = useRef(false);
  const remoteBase = useRef<AppData | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const prevRef = useRef(data);

  // Data that arrives from the cloud replaces the local copy without being sent back.
  const replaceData = useCallback((d: AppData) => {
    remoteBase.current = d;
    setData(d);
  }, []);
  const cloud = useCloud(dataRef, replaceData);

  // Persist after every change, and queue it for the cloud when signed in.
  useEffect(() => {
    // Compare against the cloud copy when one just arrived, so only real local edits are queued
    // (even if a local edit landed in the same render as the cloud data).
    const base = remoteBase.current ?? prevRef.current;
    remoteBase.current = null;
    prevRef.current = data;
    if (skipSave.current) {
      skipSave.current = false; // another tab saved it (and queued it) already
      return;
    }
    const r = saveData(data);
    setSaveError(r.ok ? null : r.error);
    if (data !== base) cloud.onLocalChange(base, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        skipSave.current = true;
        setData(normalizeData(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 2600);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const makeEntries = (items: NewEntryInput[], prefix: string): FoodEntry[] => {
    const now = Date.now();
    return items.map((it, i) => {
      const food = snapshotFood(it.food);
      return {
        id: uid(prefix),
        date: it.date,
        meal: it.meal,
        createdAt: now + i,
        food,
        servingLabel: it.servingLabel,
        quantity: it.quantity,
        amount: it.amount,
        nutrients: it.nutrientsOverride ?? scaleNutrients(food, it.amount),
        ...(it.aiEstimated ? { aiEstimated: true } : {}),
      };
    });
  };

  const pushRecent = (recents: Food[], foods: Food[]) => {
    const ids = new Set(foods.map((f) => f.id));
    return [...foods.filter((f) => f.source !== 'ai-estimate' && f.source !== 'manual'), ...recents.filter((r) => !ids.has(r.id))].slice(0, 30);
  };

  const store = useMemo<Store>(() => {
    const isFav = (id: string) => data.favorites.some((f) => f.id === id);
    return {
      data,
      cloud,
      profile: data.profile,
      saveError,
      toast,
      showToast,
      dismissToast,
      setProfile: (p) => setData((d) => ({ ...d, profile: p })),
      updateProfile: (patch) => setData((d) => (d.profile ? { ...d, profile: { ...d.profile, ...patch } } : d)),
      addEntries: (items) => {
        const created = makeEntries(items, 'e-');
        setData((d) => ({ ...d, entries: [...d.entries, ...created], recents: pushRecent(d.recents, items.map((i) => snapshotFood(i.food))) }));
        return created;
      },
      addPlanned: (items) => {
        const created = makeEntries(items, 'p-');
        setData((d) => ({ ...d, planned: [...d.planned, ...created] }));
        return created;
      },
      deletePlanned: (id) => setData((d) => ({ ...d, planned: d.planned.filter((e) => e.id !== id) })),
      restorePlanned: (entries) => setData((d) => ({ ...d, planned: [...d.planned.filter((e) => !entries.some((x) => x.id === e.id)), ...entries] })),
      eatPlanned: (ids) => {
        const now = Date.now();
        const moving = data.planned.filter((p) => ids.includes(p.id));
        const eaten = moving.map((p, i) => ({ ...p, id: uid('e-'), createdAt: now + i }));
        setData((d) => ({ ...d, planned: d.planned.filter((p) => !ids.includes(p.id)), entries: [...d.entries, ...eaten] }));
        return eaten;
      },
      updateEntry: (id, patch) =>
        setData((d) => ({
          ...d,
          entries: d.entries.map((e) => {
            if (e.id !== id) return e;
            const next = { ...e, ...patch };
            if (!patch.nutrients && patch.amount != null) next.nutrients = scaleNutrients(e.food, patch.amount);
            return next;
          }),
        })),
      deleteEntry: (id) => setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) })),
      restoreEntries: (entries) => setData((d) => ({ ...d, entries: [...d.entries.filter((e) => !entries.some((x) => x.id === e.id)), ...entries] })),
      addWater: (ml, date = todayKey()) => {
        const w: WaterEntry = { id: uid('w-'), date, ml: Math.round(ml), createdAt: Date.now() };
        setData((d) => ({ ...d, water: [...d.water, w] }));
        return w;
      },
      updateWater: (id, ml) => setData((d) => ({ ...d, water: d.water.map((w) => (w.id === id ? { ...w, ml: Math.round(ml) } : w)) })),
      deleteWater: (id) => setData((d) => ({ ...d, water: d.water.filter((w) => w.id !== id) })),
      addWeight: (w) => setData((d) => ({ ...d, weights: [...d.weights, { ...w, id: uid('kg-'), createdAt: Date.now() }] })),
      updateWeight: (id, patch) => setData((d) => ({ ...d, weights: d.weights.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      deleteWeight: (id) => setData((d) => ({ ...d, weights: d.weights.filter((w) => w.id !== id) })),
      saveCustomFood: (f) =>
        setData((d) => ({
          ...d,
          customFoods: d.customFoods.some((c) => c.id === f.id) ? d.customFoods.map((c) => (c.id === f.id ? f : c)) : [f, ...d.customFoods],
          favorites: d.favorites.map((x) => (x.id === f.id ? f : x)),
        })),
      deleteCustomFood: (id) => setData((d) => ({ ...d, customFoods: d.customFoods.filter((c) => c.id !== id), favorites: d.favorites.filter((c) => c.id !== id) })),
      toggleFavorite: (f) => setData((d) => ({ ...d, favorites: d.favorites.some((x) => x.id === f.id) ? d.favorites.filter((x) => x.id !== f.id) : [f, ...d.favorites] })),
      isFavorite: isFav,
      saveMeal: (name, entries) => {
        const meal: SavedMeal = {
          id: uid('m-'),
          name: name.trim() || 'Saved meal',
          createdAt: Date.now(),
          items: entries.map((e) => ({ food: e.food, servingLabel: e.servingLabel, quantity: e.quantity, amount: e.amount })),
        };
        setData((d) => ({ ...d, savedMeals: [meal, ...d.savedMeals] }));
      },
      deleteSavedMeal: (id) => setData((d) => ({ ...d, savedMeals: d.savedMeals.filter((m) => m.id !== id) })),
      importData: (raw) => {
        const r = raw as Record<string, unknown> | null;
        if (!r || typeof r !== 'object' || (r.app !== 'FuelFlow' && !('entries' in r))) {
          return { ok: false, message: 'That file isn’t a FuelFlow backup.' };
        }
        const next = normalizeData(raw);
        if (!next.profile) return { ok: false, message: 'The backup has no profile, so it wasn’t imported.' };
        setData(next);
        return { ok: true, message: `Restored ${next.entries.length} food entries, ${next.weights.length} weigh-ins.` };
      },
      resetAll: () => {
        try {
          // Also forget the AI key and coach chat kept outside the main data.
          const ls = window.localStorage;
          ls.removeItem('fuelflow:anthropic-key');
          ls.removeItem('fuelflow:gemini-key');
          ls.removeItem('fuelflow:ai-provider');
          ls.removeItem('fuelflow:coach:v1');
          window.dispatchEvent(new Event('fuelflow:ai-changed'));
        } catch {
          /* ignore */
        }
        setData({ ...normalizeData(null) });
      },
    };
  }, [data, cloud, saveError, toast, showToast, dismissToast]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

/** Convenience hook: profile is guaranteed after onboarding. */
export function useProfile(): Profile {
  const { profile } = useStore();
  if (!profile) throw new Error('Profile missing');
  return profile;
}
