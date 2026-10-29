// FuelFlow AI nutrition coach — client side.
// The coach talks to Claude either directly with the user's own API key (kept on the device)
// or through the user's private server (server/coach-worker.js, POST /chat). Food-log data is only included when the user switches
// "Let the coach see my log" on, and only as a short summary built from real records.

import type { AppData, Profile } from './types';
import { AiError, callAi, type AiConfig } from './ai';
import { coachSystemWithContext } from './prompts';
import { addDays, todayKey } from './date';
import { entriesForDay, sumNutrients } from './nutrition';
import { dailyTotals, summarize, sortedWeights, changeOver } from './analytics';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  error?: boolean;
}

export const COACH_KEY = 'fuelflow:coach:v1';
export const MAX_HISTORY = 60;
export const MAX_SENT = 16; // messages sent per request
export const MAX_CHARS = 1500;

export function loadMessages(store: Pick<Storage, 'getItem'> | null): CoachMessage[] {
  try {
    const raw = JSON.parse(store?.getItem(COACH_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

export function saveMessages(store: Pick<Storage, 'setItem'> | null, msgs: CoachMessage[]) {
  try {
    store?.setItem(COACH_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch {
    /* storage full — chat still works for this session */
  }
}

/** Everything the coach is told about the user. Short, factual, and built only from stored records. */
export function buildContext(profile: Profile, data: AppData, shareLog: boolean, today = todayKey()): string {
  const lines: string[] = [];
  const goal = { lose: 'lose weight', maintain: 'maintain weight', gain: 'gain weight / build muscle' }[profile.goal];
  lines.push(`Goal: ${goal}.`);
  lines.push(`Daily targets: ${profile.targets.kcal} kcal, protein ${profile.targets.protein} g, carbs ${profile.targets.carbs} g, fat ${profile.targets.fat} g, water ${profile.targets.waterMl} ml.`);
  if (profile.diet.length) lines.push(`Dietary preferences: ${profile.diet.join(', ')}.`);
  lines.push(`Units: ${profile.units.weight}, ${profile.units.water === 'floz' ? 'fl oz' : 'ml'}.`);
  if (profile.special !== 'none') lines.push('The user has indicated a circumstance (pregnancy, breastfeeding or a medical condition) that needs professional nutrition advice.');

  if (!shareLog) {
    lines.push('The user has NOT shared their food log. You do not know what they ate. Do not guess.');
    return lines.join('\n');
  }

  const todayEntries = entriesForDay(data.entries, today);
  const t = sumNutrients(todayEntries);
  const hour = new Date().getHours();
  lines.push(`Local time: about ${hour}:00.`);
  if (todayEntries.length) {
    lines.push(`Logged today: ${t.kcal} kcal, protein ${t.protein} g, carbs ${t.carbs} g, fat ${t.fat} g.`);
    lines.push(`Remaining today: ${profile.targets.kcal - t.kcal} kcal, protein ${Math.round(profile.targets.protein - t.protein)} g.`);
    const meals = profile.meals
      .map((m) => {
        const list = todayEntries.filter((e) => e.meal === m.id);
        return list.length ? `${m.name}: ${list.map((e) => e.food.name).join(', ')}` : null;
      })
      .filter(Boolean);
    lines.push(`Foods logged today — ${meals.join('; ')}.`);
  } else {
    lines.push('Nothing logged yet today.');
  }
  const planToday = data.planned.filter((e) => e.date === today);
  if (planToday.length) {
    const p = sumNutrients(planToday);
    lines.push(`Planned but not yet eaten today (not counted above): ${planToday.map((e) => e.food.name).join(', ')} — about ${p.kcal} kcal.`);
  }

  const week = summarize(dailyTotals(data.entries, addDays(today, -1), 7), profile.targets);
  if (week.loggedDays) {
    lines.push(
      `Previous 7 days: logged ${week.loggedDays}/7 days; on logged days averaged ${week.avgKcal} kcal, protein ${week.avgProtein} g, carbs ${week.avgCarbs} g, fat ${week.avgFat} g; protein target met on ${week.proteinHitDays} days; within ±10% of calorie target on ${week.onTargetDays} days.`,
    );
  } else {
    lines.push('No food logged in the previous 7 days.');
  }
  const ws = sortedWeights(data.weights);
  if (ws.length) {
    const c = changeOver(ws, 30);
    lines.push(`Latest weight ${ws[ws.length - 1].kg} kg${c != null ? `, ${c > 0 ? '+' : ''}${c} kg over ~30 days` : ''}.`);
  }
  const water = data.water.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0);
  lines.push(`Water today: ${water} ml.`);
  return lines.join('\n');
}

export const STARTERS = [
  'What could I eat for dinner with what I have left today?',
  'How did my eating go this week?',
  'Give me 3 high-protein breakfast ideas',
  'Easy snacks under 200 kcal',
  'How much protein do I really need?',
  'Is fruit sugar bad for weight loss?',
];

export class CoachError extends Error {}

export async function askCoach(ai: AiConfig, history: CoachMessage[], context: string, signal?: AbortSignal): Promise<string> {
  const messages = history
    .filter((m) => !m.error)
    .slice(-MAX_SENT)
    .map((m) => ({ role: m.role, content: m.text.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();

  if (ai.kind === 'key') {
    try {
      const reply = await callAi(ai, { system: coachSystemWithContext(context.slice(0, 3000)), messages, maxTokens: 900, signal });
      if (!reply) throw new CoachError('The coach sent an empty answer. Try asking again.');
      return reply.slice(0, 6000);
    } catch (e) {
      if ((e as Error).name === 'AbortError' || e instanceof CoachError) throw e;
      throw new CoachError(e instanceof AiError ? e.message : 'Something went wrong. Try again.');
    }
  }

  let res: Response;
  try {
    res = await fetch(ai.url.replace(/\/$/, '') + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new CoachError('Couldn’t reach the coach. Check your connection and try again.');
  }
  if (res.status === 429) throw new CoachError('The coach is getting a lot of questions. Wait a minute and try again.');
  if (res.status === 404) throw new CoachError('Your server doesn’t have the coach yet. Update it with the latest server/coach-worker.js.');
  if (!res.ok) throw new CoachError(`The coach had a problem (error ${res.status}). Try again in a moment.`);
  const j = (await res.json().catch(() => null)) as { reply?: unknown } | null;
  const reply = typeof j?.reply === 'string' ? j.reply.trim() : '';
  if (!reply) throw new CoachError('The coach sent an empty answer. Try asking again.');
  return reply.slice(0, 6000);
}
