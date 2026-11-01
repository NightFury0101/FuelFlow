# Launching FuelFlow 1.0

The app itself is finished: the website is live, and every push builds the iPhone and Android
apps on GitHub (all green). Everything below needs **your** accounts, money or decisions, so it
can't be done from the code. Work through it top to bottom and tick as you go.

## Where things stand

| Piece | Status |
|---|---|
| Website — nightfury0101.github.io/FuelFlow | ✅ Live |
| Accounts & sync (Firebase) | ✅ Config filled in — verify in step 2 |
| iPhone app build | ✅ Builds on every push (Actions → iOS app check) |
| Android app build | ✅ Builds on every push, with an installable test app |
| Privacy, terms, support pages | ✅ Live — support email still missing (step 1) |
| Apple rules (subscriptions, account deletion, AI data permission 5.1.2(i)) | ✅ Done in the app |
| Store screenshots & graphics | ✅ In `store/` |
| Premium (built-in AI coach, paid) | ✅ Code finished and Apple-checked — switches on when keys are added (step 5) |

---

## 1. Support email — today, free

Both stores require a contact address, and you wanted one separate from your personal email.

- [ ] Create a new address, e.g. `fuelflow.app.support@gmail.com` (any free provider is fine).
- [ ] Put it in `src/pages/Legal.tsx`: `export const SUPPORT_EMAIL: string | null = 'your-address';`
      (or send it to Claude and it'll make the change and push). It then appears on the
      Help & support page.
- [ ] Use the same address as the contact email in App Store Connect and Play Console.

## 2. Check accounts work on the live site — 5 minutes

- [ ] Firebase console → Authentication → **Email/Password is enabled**, and
      **Settings → Authorized domains** includes `nightfury0101.github.io` ([FIREBASE.md](./FIREBASE.md) step 3).
- [ ] Firestore → **Rules** match `firestore.rules` and are published (step 4).
- [ ] On the website: Profile → create an account, log a food, open the site on another phone,
      sign in, check the food is there. Then Profile → **Delete my account** to clean up.

## 3. Start Android first — the 14-day clock

New personal Play accounts must run a **closed test with 12+ testers for 14 days** before going
public, so starting this early saves the most time. Gym members make good testers.

- [ ] Pay the one-time US$25 at play.google.com/console/signup.
- [ ] Create the upload key and add the 4 GitHub secrets ([ANDROID.md](./ANDROID.md) steps 2–3).
- [ ] Push anything (or re-run **Actions → Android app**) → download **FuelFlow-android-release** (`.aab`).
- [ ] Create the app, start a **closed test**, upload the `.aab`, add 12+ testers' emails (step 4).
- [ ] Fill in the store listing and app content forms — all text and answers are in [ANDROID.md](./ANDROID.md) steps 5–6.
- [ ] After 14 days: apply for **Production**.

## 4. iPhone — in parallel

- [ ] Enrol in the Apple Developer Program (US$99/year). Approval can take a few days.
- [ ] Get Mac access: your own, a rented cloud Mac (MacinCloud), or a build service (Codemagic).
- [ ] Follow **Building and uploading** in [IOS.md](./IOS.md) → upload the first build.
- [ ] App Store Connect: listing text from [IOS.md](./IOS.md#store-listing-text), screenshots
      from `store/screenshots/6.9-inch` and `6.5-inch`, support and privacy URLs from IOS.md.
- [ ] Test it through **TestFlight**, then **Submit for review**.

## 5. Premium — switch it on before you submit the iPhone app

All of Premium's code is finished and checked against Apple's subscription and AI-data rules
(checklist in [PREMIUM.md](./PREMIUM.md#apple-review-checklist-for-premium)). It needs your
accounts to come alive, in this order — each step's details are in PREMIUM.md:

- [ ] **Apple:** Paid Apps agreement + bank and tax details; apply for the Small Business Program (15% fee).
- [ ] **Apple:** create the `FuelFlow Premium` group with `fuelflow.premium.monthly` and
      `fuelflow.premium.yearly` (display name, description, review screenshot each).
- [ ] **Apple:** generate the In-App Purchase key (`.p8`) for RevenueCat.
- [ ] **RevenueCat:** project, iOS app, import the 2 products, entitlement `premium`, offering
      `default`; copy the public `appl_` key and the secret `sk_` key.
- [ ] **AI key for the server:** a Claude key (console.anthropic.com) with a small monthly spend limit.
- [ ] **Cloudflare:** deploy `server/coach-worker.js` with `ANTHROPIC_API_KEY`,
      `REVENUECAT_SECRET_KEY` and `ALLOWED_ORIGIN`; open `<worker>/health` → `"configured":true,"premium":true,"provider":"claude"`.
- [ ] **Send Claude the `appl_` key and the worker URL** (never the `sk_` key) — it fills in
      `src/premiumConfig.ts` and pushes. Or edit it yourself.
- [ ] **Test with a Sandbox account** (PREMIUM.md step 5): buy, coach answers with no key,
      Restore after reinstall, cancel.
- [ ] Submit the subscriptions **together with** the app version.
- [ ] Later, for Android: payments profile, Play subscriptions, `goog_` key (PREMIUM.md → Android).

## 6. Before you press Publish

- [ ] Read the privacy policy and terms once more (`#/privacy`, `#/terms`) — they describe
      exactly what the app does today. If you add anything that collects new data, update them.
- [ ] Install the store test build on a real phone and do one full day: onboarding, log meals,
      water, weigh-in, reminders, backup, trainer report.

## After launch

- Trainer dashboard for gyms (members' progress with their permission) — the next feature.
- Watch the support inbox and the GitHub Issues page.
