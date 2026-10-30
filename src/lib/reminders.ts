// Daily reminders for the store apps (meals, water, weekly weigh-in).
// Settings live on this device only — notifications belong to a phone, not an account.
// Instead of fixed repeating alarms we plan the next few days each time the app is used,
// so a meal reminder is skipped once that meal is already logged and water stops nagging
// after the day's goal is reached.

import type { FoodEntry, MealSlot, WaterEntry } from './types';
import { addDays, parseDateKey, todayKey } from './date';

export type ReminderKind = 'meal' | 'water' | 'weigh';

export interface ReminderItem {
  id: string; // stable: 'meal:lunch', 'water:1', 'weigh'
  kind: ReminderKind;
  meal?: string;
  time: string; // 'HH:MM', local time
  on: boolean;
  weekday?: number; // weigh-in only: 0 = Sunday … 6 = Saturday
}

export interface ReminderSettings {
  enabled: boolean;
  items: ReminderItem[];
}

export interface PlannedReminder {
  id: number; // numeric id the phone uses; unique within a plan
  at: Date;
  title: string;
  body: string;
  route: string; // screen to open when tapped
}

export const REMINDER_KEY = 'fuelflow:reminders:v1';
export const REMINDER_EVENT = 'fuelflow:reminders';
export const PLAN_DAYS = 7;
export const MAX_PENDING = 60;

const MEAL_TIMES: Record<string, string> = { breakfast: '08:00', lunch: '12:30', dinner: '19:00', snacks: '16:00' };

export function defaultReminders(meals: MealSlot[]): ReminderSettings {
  const items: ReminderItem[] = meals.map((m) => ({
    id: `meal:${m.id}`,
    kind: 'meal',
    meal: m.id,
    time: MEAL_TIMES[m.id] ?? '12:00',
    on: m.id !== 'snacks' && m.id in MEAL_TIMES,
  }));
  items.push({ id: 'water:1', kind: 'water', time: '11:00', on: true });
  items.push({ id: 'water:2', kind: 'water', time: '15:30', on: true });
  items.push({ id: 'weigh', kind: 'weigh', time: '07:30', on: false, weekday: 1 });
  return { enabled: false, items };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Bring saved settings in line with the current meals (new meals added, removed meals dropped). */
export function reconcile(saved: ReminderSettings | null, meals: MealSlot[]): ReminderSettings {
  const base = defaultReminders(meals);
  if (!saved || !Array.isArray(saved.items)) return base;
  const byId = new Map(saved.items.map((i) => [i.id, i]));
  return {
    enabled: saved.enabled === true,
    items: base.items.map((d) => {
      const s = byId.get(d.id);
      if (!s) return d;
      return {
        ...d,
        on: s.on === true,
        time: typeof s.time === 'string' && TIME_RE.test(s.time) ? s.time : d.time,
        weekday: d.kind === 'weigh' && Number.isInteger(s.weekday) && s.weekday! >= 0 && s.weekday! <= 6 ? s.weekday : d.weekday,
      };
    }),
  };
}

export function loadReminders(meals: MealSlot[]): ReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    return reconcile(raw ? (JSON.parse(raw) as ReminderSettings) : null, meals);
  } catch {
    return defaultReminders(meals);
  }
}

export function saveReminders(s: ReminderSettings): void {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — reminders just won't persist */
  }
  try {
    window.dispatchEvent(new Event(REMINDER_EVENT));
  } catch {
    /* not in a browser */
  }
}

function atTime(dateKey: string, time: string): Date {
  const d = parseDateKey(dateKey);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function text(item: ReminderItem, mealName: string): Pick<PlannedReminder, 'title' | 'body' | 'route'> {
  if (item.kind === 'meal') {
    const lower = mealName.toLowerCase();
    return { title: `Log your ${lower}`, body: `Takes a few seconds and keeps today’s numbers right.`, route: '/diary' };
  }
  if (item.kind === 'water') return { title: 'Time for some water', body: 'A glass now keeps you on track for today’s goal.', route: '/' };
  return { title: 'Weekly weigh-in', body: 'Weigh yourself before breakfast so the numbers compare fairly.', route: '/progress' };
}

/**
 * The notifications to schedule from `now` for the next `days` days.
 * Today's meal reminders are skipped for meals that already have food logged, and today's
 * water reminders once the water goal is met.
 */
export function planReminders(args: {
  settings: ReminderSettings;
  meals: MealSlot[];
  entries: FoodEntry[];
  water: WaterEntry[];
  waterGoalMl: number;
  now?: Date;
  days?: number;
}): PlannedReminder[] {
  const { settings, meals } = args;
  if (!settings.enabled) return [];
  const now = args.now ?? new Date();
  const today = todayKey(now);
  const days = args.days ?? PLAN_DAYS;
  const loggedToday = new Set(args.entries.filter((e) => e.date === today).map((e) => e.meal));
  const waterToday = args.water.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0);
  const waterDone = args.waterGoalMl > 0 && waterToday >= args.waterGoalMl;
  const names = new Map(meals.map((m) => [m.id, m.name]));

  const out: PlannedReminder[] = [];
  for (let d = 0; d < days; d++) {
    const key = addDays(today, d);
    settings.items.forEach((item, i) => {
      if (!item.on || !TIME_RE.test(item.time)) return;
      if (item.kind === 'meal' && (!item.meal || !names.has(item.meal))) return;
      const at = atTime(key, item.time);
      if (at.getTime() <= now.getTime() + 30_000) return; // already past (or about to be)
      if (item.kind === 'weigh' && at.getDay() !== (item.weekday ?? 1)) return;
      if (d === 0 && item.kind === 'meal' && loggedToday.has(item.meal!)) return;
      if (d === 0 && item.kind === 'water' && waterDone) return;
      out.push({ id: 1000 + d * 50 + i, at, ...text(item, names.get(item.meal ?? '') ?? '') });
    });
  }
  // The iPhone keeps at most 64 pending notifications; keep the soonest.
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_PENDING);
}
