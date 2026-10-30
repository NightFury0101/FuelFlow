// FuelFlow Premium — fill these in when you set up subscriptions (see PREMIUM.md).
//
// Both values are safe to publish:
//  - revenueCatAppleKey is RevenueCat's *public* Apple SDK key (starts with "appl_").
//    Never put the RevenueCat *secret* key (starts with "sk_") here — it belongs only on the
//    coach server (server/coach-worker.js) as a Cloudflare secret.
//  - coachUrl is the address of your deployed coach server.
//
// While revenueCatAppleKey is null the iPhone app has no Premium screen and nothing can be
// bought; the website shows what Premium includes and points people to the app.

export interface PremiumConfig {
  revenueCatAppleKey: string | null;
  entitlement: string; // the entitlement identifier you create in RevenueCat
  coachUrl: string | null; // e.g. 'https://fuelflow-coach.yourname.workers.dev'
}

export const premiumConfig: PremiumConfig = {
  revenueCatAppleKey: null,
  entitlement: 'premium',
  coachUrl: null,
};
