// FuelFlow Premium — fill these in when you set up subscriptions (see PREMIUM.md).
//
// Both values are safe to publish:
//  - revenueCatAppleKey / revenueCatGoogleKey are RevenueCat's *public* SDK keys
//    (Apple keys start with "appl_", Google keys with "goog_").
//    Never put the RevenueCat *secret* key (starts with "sk_") here — it belongs only on the
//    coach server (server/coach-worker.js) as a Cloudflare secret.
//  - coachUrl is the address of your deployed coach server.
//
// While the key for a platform is null, that app has no Premium screen and nothing can be
// bought there; the website shows what Premium includes and points people to the apps.

export interface PremiumConfig {
  revenueCatAppleKey: string | null;
  revenueCatGoogleKey: string | null;
  entitlement: string; // the entitlement identifier you create in RevenueCat
  coachUrl: string | null; // e.g. 'https://fuelflow-coach.yourname.workers.dev'
}

export const premiumConfig: PremiumConfig = {
  revenueCatAppleKey: null,
  revenueCatGoogleKey: null,
  entitlement: 'premium',
  coachUrl: null,
};
