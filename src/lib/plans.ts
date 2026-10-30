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

// What each plan includes. Free = available to everyone today. Premium = planned; nothing in this
// column is sold or promised until billing launches.
export const PLAN_TABLE: PlanFeature[] = [
  { label: 'Food diary, recipes & meal planning', free: true, premium: true },
  { label: 'Calories, macros, water & weight', free: true, premium: true },
  { label: 'Progress charts', free: 'Up to 1 year', premium: 'Up to 1 year' },
  { label: 'Cloud backup & sync', free: true, premium: true },
  { label: 'AI nutrition coach', free: 'With your own free key', premium: 'Built in, no key' },
  { label: 'Share progress with your trainer', free: false, premium: 'Planned' },
  { label: 'Custom reports', free: false, premium: 'Planned' },
];

export const PRICING = { monthly: null as string | null, yearly: null as string | null }; // set when billing launches

export function hasFeature(_feature: Feature): boolean {
  // With billing disabled there is no paid tier to enforce; everything is available.
  // When billing launches, this must check an entitlement verified by the server.
  return !BILLING_ENABLED;
}
