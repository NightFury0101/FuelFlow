# Setting up FuelFlow Premium

Premium is an optional subscription in the **iPhone app**. It adds the AI nutrition coach built
in — no key, no setup. Everything else stays free.

How it fits together:

```
iPhone app ──buy──▶ Apple (takes payment, keeps 15% on the Small Business Program)
    │                  │
    │                  ▼
    │              RevenueCat (checks the receipt, knows who is subscribed)
    │                  ▲
    ▼                  │ "is this person Premium?"
Coach server (Cloudflare Worker, server/coach-worker.js) ──▶ Gemini or Claude
```

The code is all in place. Until `src/premiumConfig.ts` is filled in, the iPhone app shows no
Premium screen and nothing can be bought; the website only explains Premium.

---

## 1. Apple (needs your developer account)

1. **App Store Connect → Business:** accept the **Paid Apps agreement**, then add your bank
   account and tax forms. Apple pays out monthly.
2. Apply for the **App Store Small Business Program** (developer.apple.com/app-store/small-business-program)
   so Apple keeps 15% instead of 30%.
3. **Your app → Monetization → Subscriptions → create a group** called `FuelFlow Premium`, with
   two auto-renewable subscriptions:

   | Reference name | Product ID | Duration | Suggested price |
   |---|---|---|---|
   | Premium Monthly | `fuelflow.premium.monthly` | 1 month | US$2.99 |
   | Premium Yearly | `fuelflow.premium.yearly` | 1 year | US$19.99 |

   For each: add a display name ("FuelFlow Premium") and description ("Built-in AI nutrition
   coach — no key needed"), and a review screenshot of the Premium screen.
   Optional: on the yearly plan add an **introductory offer → free trial, 1 week**. The app
   shows "Try 1 week free, then …" automatically.
4. **Users and Access → Integrations → In-App Purchase → generate a key** and download the `.p8`
   file (RevenueCat needs it in the next step).

## 2. RevenueCat (free until you earn a meaningful amount)

1. Sign up at revenuecat.com → **Create project** "FuelFlow".
2. **Add app → App Store**: bundle ID `io.github.nightfury0101.fuelflow` (or whatever you chose
   in Xcode), upload the `.p8` key from step 1.4 with its Key ID and Issuer ID.
3. **Products:** import the two product IDs above.
4. **Entitlements → New:** identifier **`premium`**, attach both products.
5. **Offerings:** create `default`, add a **Monthly** package (`$rc_monthly`) with the monthly
   product and an **Annual** package (`$rc_annual`) with the yearly product. Make it *Current*.
6. **API keys:** copy the **public Apple SDK key** (starts `appl_`) — that goes in the app.
   Also create a **secret key** (starts `sk_`) — that goes **only** in the coach server.

## 3. The coach server (Cloudflare, free plan is enough to start)

Deploy `server/coach-worker.js` as in [server/README.md](./server/README.md), with these settings:

| Name | Type | Value |
|---|---|---|
| `GEMINI_API_KEY` *or* `ANTHROPIC_API_KEY` | Secret | your AI key (for a paid service use a **paid-tier** Gemini key — Google may use free-tier chats to improve its products) |
| `ALLOWED_ORIGIN` | Text | `https://nightfury0101.github.io,capacitor://localhost` |
| `REVENUECAT_SECRET_KEY` | Secret | the `sk_…` key from step 2.6 — this switches on the subscription check |
| `DAILY_LIMIT` | Text | `40` (questions per subscriber per day) |

Open `https://<your-worker>/health` — it should show `"configured":true,"premium":true`.

## 4. Switch it on in the app

Edit `src/premiumConfig.ts` (or send me the two values and I'll do it):

```ts
export const premiumConfig = {
  revenueCatAppleKey: 'appl_XXXXXXXXXXXXXXXXXXXX',
  revenueCatGoogleKey: null, // 'goog_…' once Google Play is set up
  entitlement: 'premium',
  coachUrl: 'https://fuelflow-coach.yourname.workers.dev',
  coachProvider: 'claude', // must match the server: open <coachUrl>/health and copy "provider"
};
```

Premium stays hidden until **both** a store key and `coachUrl` are filled in, so the app never
sells a coach that isn't running. `coachProvider` is the AI company named on the coach's
permission screen (Apple guideline 5.1.2(i)) — if it doesn't match the server, reviewers can
reject the app, so check `/health` after any change to the server's `PROVIDER`.

For a public service use **Claude** or a **paid** Gemini key: on Gemini's free tier Google may
use conversations to improve its products, which you'd then have to tell every subscriber.

Push to GitHub. Then on the Mac: `npm install && npm run build && npx cap sync ios`, and in
Xcode → **App → Signing & Capabilities → + Capability → In-App Purchase**. Archive and upload as
in IOS.md. Submit the subscriptions **together with the app version** for review.

## Apple review checklist for Premium

Apple checks these on every subscription app (guidelines 3.1.1, 3.1.2 and 5.1.2). FuelFlow's
code already does each one; the ✋ items are yours in App Store Connect.

- [x] Bought only through Apple in-app purchase; no links or prices pointing to other ways to pay.
- [x] Before buying: plan name, price, billing period, trial length, auto-renew wording,
      **Restore purchases**, and working **Terms of use** and **Privacy policy** links.
- [x] Manage / cancel link for subscribers; account deletion says the subscription must be
      cancelled separately.
- [x] Premium screen hidden until purchases and the coach server both work (no dead paywall).
- [x] Before the first coach question, a permission screen names the AI company, lists what is
      sent, keeps the food log off by default, and can be withdrawn in Profile.
- [ ] ✋ App description ends with: `Terms of use: https://nightfury0101.github.io/FuelFlow/#/terms`
      (or paste the terms into App Store Connect → App Information → License Agreement).
- [ ] ✋ Privacy policy URL set (see IOS.md).
- [ ] ✋ Each subscription has a display name, description and **review screenshot**, and is
      submitted **with** the app version (Apple won't review them separately the first time).
- [ ] ✋ Review notes say how to reach Premium and that a Sandbox account works (text in IOS.md).

## 5. Test before release

1. **App Store Connect → Users and Access → Sandbox → add a tester** (use a new email address).
2. On your iPhone: **Settings → App Store → Sandbox Account** → sign in with the tester.
3. Run the app from Xcode (or TestFlight) → Profile → FuelFlow Premium → buy. Sandbox renewals
   happen every few minutes, so you can watch a renewal and an expiry quickly.
4. Check: the coach answers with no key; **Restore purchases** works after reinstalling; after
   cancelling in Settings, Premium ends at the end of the period.

## Money in, money out

At US$2.99/month you receive about US$2.54 (after Apple's 15%); yearly US$19.99 → about US$16.99.
AI cost per subscriber depends on the model and how much they ask: a typical user asking a few
questions a day costs cents a month on a paid Gemini Flash model, and up to a few dollars on
Claude. The `DAILY_LIMIT` keeps heavy use in check. Watch usage in the AI provider's console
and set a monthly spending cap there.

## What the app does (for reference)

- `src/lib/billing.ts` — talks to RevenueCat's plugin (prices, buy, restore, status).
- `src/lib/premium.tsx` — keeps the Premium status; re-checks when the app returns to the front;
  remembers the status offline until the subscription's end date.
- `src/pages/Premium.tsx` — plan choice, trial wording, auto-renew terms, Restore purchases,
  Manage subscription.
- The coach sends RevenueCat's random user ID in `X-FuelFlow-User`; the server asks RevenueCat
  whether that ID has an active `premium` entitlement before answering.

## Android (Google Play)

Same idea, with Google Play instead of Apple. You need the Play Console account from
[ANDROID.md](./ANDROID.md) and at least one upload of the app (closed testing is fine).

1. **Play Console → your app → Monetize → Products → Subscriptions → Create subscription**:
   product ID `fuelflow_premium` (Play IDs can't contain dots in some places — underscores are safe),
   name "FuelFlow Premium". Add two **base plans**: `monthly` (auto-renewing, 1 month, US$2.99) and
   `yearly` (auto-renewing, 1 year, US$19.99). Optional: a free-trial **offer** on `yearly`.
   Activate both.
2. **Play Console → Setup → Payments profile:** set up your merchant account and bank details so
   Google can pay you. Google keeps 15% of subscriptions.
3. **RevenueCat → your project → Add app → Google Play**: package `io.github.nightfury0101.fuelflow`,
   and follow RevenueCat's guide to create a **service account** in Google Cloud and invite it in
   Play Console (it lets RevenueCat check purchases). Import the products, attach both
   `fuelflow_premium:monthly` and `fuelflow_premium:yearly` to the **premium** entitlement, and add
   them to the `default` offering as the Monthly and Annual packages.
4. Copy the **public Google SDK key** (starts `goog_`) into `src/premiumConfig.ts` →
   `revenueCatGoogleKey`, push, and the next **Android app** build includes Premium.
5. **Test:** Play Console → Settings → **License testing** → add your Google account. Purchases
   from that account are free test purchases, and renewals happen every few minutes.

The same coach server and RevenueCat secret key serve both apps — nothing changes there.
