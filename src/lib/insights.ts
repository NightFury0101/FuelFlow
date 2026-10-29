import type { Nutrients, Targets } from './types';

export interface Insight {
  id: string;
  tone: 'neutral' | 'positive' | 'heads-up';
  text: string;
}

/** Short, kind, factual observations about today. At most three. Never shaming, never medical. */
export function dailyInsights(args: {
  totals: Nutrients;
  targets: Targets;
  waterMl: number;
  entryCount: number;
  hour: number;
  streak: number;
}): Insight[] {
  const { totals, targets, waterMl, entryCount, hour, streak } = args;
  const out: Insight[] = [];

  if (entryCount === 0) {
    out.push({
      id: 'start',
      tone: 'neutral',
      text: hour < 11 ? 'Nothing logged yet. Start with breakfast — even a quick estimate is useful.' : 'Nothing logged yet today. Add what you remember so far; estimates are fine.',
    });
  } else {
    const remaining = targets.kcal - totals.kcal;
    if (remaining < -targets.kcal * 0.05) {
      out.push({ id: 'over', tone: 'heads-up', text: `You're ${Math.abs(Math.round(remaining))} kcal over today's target. That's fine — one day is a small part of your week.` });
    } else if (Math.abs(remaining) <= targets.kcal * 0.05) {
      out.push({ id: 'on', tone: 'positive', text: 'Right on your calorie target for today.' });
    }

    const proteinLeft = Math.round(targets.protein - totals.protein);
    if (proteinLeft >= 25 && hour >= 15) {
      out.push({ id: 'protein', tone: 'neutral', text: `${proteinLeft} g of protein to go. Fish, chicken, eggs, Greek yogurt or lentils can help close the gap.` });
    } else if (proteinLeft <= 0) {
      out.push({ id: 'protein-hit', tone: 'positive', text: 'Protein target reached for today.' });
    }
  }

  if (targets.waterMl > 0 && hour >= 14 && waterMl < targets.waterMl * 0.4) {
    out.push({ id: 'water', tone: 'neutral', text: 'Water is under halfway for the day. A glass now is an easy win.' });
  }

  if (streak >= 3 && out.length < 3) {
    out.push({ id: 'streak', tone: 'positive', text: `${streak}-day logging streak. Consistency matters more than perfection.` });
  }

  return out.slice(0, 3);
}
