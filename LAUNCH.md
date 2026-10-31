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
| Store screenshots & graphics | ✅ In `store/` |
| Premium (built-in AI coach, paid) | ⏸ Off until keys are added — optional for launch (step 5) |

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

## 5. Premium — launch with it, or add it in an update

**Simplest path:** launch 1.0 free. Premium stays hidden (nothing broken shows), and the AI
coach still works for anyone who pastes a free Gemini key. Add Premium as version 1.1 once the
apps are approved — reviews go faster with fewer moving parts.

When you're ready, [PREMIUM.md](./PREMIUM.md) covers it in order:

- [ ] Paid-apps agreement + bank details (Apple), payments profile (Google).
- [ ] Create the subscriptions in both stores.
- [ ] RevenueCat project, `premium` entitlement, copy the `appl_` and `goog_` public keys.
- [ ] Deploy the coach server on Cloudflare with your AI key and RevenueCat secret key.
- [ ] Fill in `src/premiumConfig.ts` (both keys + coach URL), push, test with sandbox/test accounts.

## 6. Before you press Publish

- [ ] Read the privacy policy and terms once more (`#/privacy`, `#/terms`) — they describe
      exactly what the app does today. If you add anything that collects new data, update them.
- [ ] Install the store test build on a real phone and do one full day: onboarding, log meals,
      water, weigh-in, reminders, backup, trainer report.

## After launch

- Trainer dashboard for gyms (members' progress with their permission) — the next feature.
- Watch the support inbox and the GitHub Issues page.
