// Premium plan configuration.
// FuelFlow is currently an on-device app with no billing provider, so nobody can be charged and
// no paid entitlement can be verified. Until billing is connected through a trusted backend,
// `BILLING_ENABLED` stays false and every feature remains available on the free plan.
// Never flip a user to premium from the browser alone.

export const BILLING_ENABLED = false;

export type Feature = 'ai-coach' | 'advanced-analytics' | 'meal-planning' | 'custom-reports' | 'recipes';

export interface PlanFeature {
  label: string;
  free: string | boolean;
  premium: string | boolean;
}

export const PLAN_TABLE: PlanFeature[] = [
  { label: 'Food diary & manual logging', free: true, premium: true },
  { label: 'Calories & macros', free: true, premium: true },
  { label: 'Water & weight tracking', free: true, premium: true },
  { label: 'AI nutrition coach', free: '10 questions / day', premium: 'Unlimited*' },
  { label: 'Analytics history', free: '30 days', premium: 'Full history' },
  { label: 'Meal planning', free: false, premium: true },
  { label: 'Recipes & custom reports', free: false, premium: true },
];

export const PRICING = { monthly: null as string | null, yearly: null as string | null }; // set when billing launches

export function hasFeature(_feature: Feature): boolean {
  // With billing disabled there is no paid tier to enforce; everything is available.
  // When billing launches, this must check an entitlement verified by the server.
  return !BILLING_ENABLED;
}
