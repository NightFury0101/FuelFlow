// What Free and Premium include. Keep this honest: everything that's free today stays free,
// and Premium only lists things a subscriber actually gets now.
// Premium is sold only inside the store apps (Apple in-app purchase via RevenueCat, see
// lib/billing.ts); whether someone is Premium is decided by RevenueCat, never by the app alone.

export interface PlanFeature {
  label: string;
  free: string | boolean;
  premium: string | boolean;
}

export const PLAN_TABLE: PlanFeature[] = [
  { label: 'Food diary, recipes & meal planning', free: true, premium: true },
  { label: 'Calories, macros, water & weight', free: true, premium: true },
  { label: 'Progress charts & milestones', free: true, premium: true },
  { label: 'Reminders, backup & offline use', free: true, premium: true },
  { label: 'AI nutrition coach', free: 'With your own free key', premium: 'Built in — just ask' },
  { label: 'No ads, ever', free: true, premium: true },
];

/** The one-line pitch used on Premium buttons and cards. */
export const PREMIUM_PITCH = 'The AI nutrition coach, built in — no key, no setup. Ask anything, any time.';
