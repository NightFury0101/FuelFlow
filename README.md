# FuelFlow

> **Launching?** Follow [LAUNCH.md](./LAUNCH.md).

**Eat Smarter. Track Better. Become Stronger.**

FuelFlow is a mobile-first calorie counter, nutrition tracker and AI nutrition coach. It is built with React and TypeScript and hosted on GitHub Pages.

## What's in this version

- **Onboarding** – Calculates calorie, macro and water targets using the Mifflin–St Jeor equation. Deficits are moderate and never go below estimated resting needs. People under 18 and people who are pregnant, breastfeeding or have a medical condition get maintenance targets and are pointed to professional advice. Every target can be adjusted, and body details can be skipped and filled in later.
- **Home** – A calorie ring, protein/carb/fat bars, kind daily insights, quick actions, today's meals, water and weight. Every number is calculated from your logged records.
- **Log button** – The **+** in the middle of the bottom bar opens food search from any screen, already set to the meal that fits the time of day.
- **Diary**
  - A day picker with a week strip.
  - Search across about 45 built-in reference foods (USDA-based averages) and live packaged products from **Open Food Facts** (free, no key needed).
  - Log by serving or in grams, add several foods in a row, and edit, delete or duplicate entries.
  - Copy a meal from the day before, save a meal to reuse, create custom foods, mark favourites and use quick-add calories.
  - Customisable meal names.
- **Recipes** – Build a recipe from any foods (built-in, packaged or your own), set how many servings it makes, and FuelFlow works out the nutrition per serving. When every ingredient is weighed in grams, you can also log a recipe by weight. Recipes live in *My foods* and are searchable like any other food. Editing a recipe never changes days you've already logged.
- **Meal planning** – Move the diary forward up to 14 days to plan meals. You can also use a meal's menu to *Plan food for later today*. Planned food appears in purple and is **never counted** in your totals until you tick it as eaten. You can copy the previous day into a plan, tick off items one by one or all at once, and save a planned meal for reuse.
- **Water** – Quick-add buttons, custom amounts, edit or delete with undo, and ml or fl oz.
- **Progress**
  - Weight chart plotted on real dates, with start, current and goal values and changes over 7 and 30 days.
  - Optional body measurements on any weigh-in (waist, hips, chest, upper arm, thigh, body fat %) with change since the first record. Lengths show in cm or inches.
  - Milestones worked out from your own records: every 2 kg (or 5 lb) toward the goal, halfway, goal reached, first log, and 7-day and 30-day logging streaks, plus what's next.
  - A weekly trend (needs at least 3 weigh-ins spread over a week or more).
  - Calorie, protein and water charts for 7 days, 30 days, 3 months or 1 year. Longer periods show weekly averages. Each period is compared with the one before, and logging consistency is shown.
  - Days you didn't log are shown as gaps, never as zero.
- **AI nutrition coach** – A chat screen for food questions: meal ideas that fit what's left of today's calories, weekly reviews, label reading, eating out and cravings. It covers food only, not workouts. It sees your food log **only if you allow it**, and then only a short summary built from your real records. Its rules rule out crash diets, diagnoses and pushing supplements, and steer medical situations to a professional. To connect it, go to **Profile → AI nutrition coach** and paste either a **free Gemini key** (from aistudio.google.com/apikey; daily limits apply, and Google may use free-tier conversations to improve its products) or a **Claude key** (pay as you go, usually under 1 cent per question). The key is stored only in that browser and is sent only to that AI provider. It is never included in backups or committed to GitHub. If one of Google's free models is retired, FuelFlow automatically tries the next one (`GEMINI_MODELS` in `src/lib/ai.ts`). If other people will use the app, the private-server option in [`server/`](./server/README.md) keeps the key off their phones instead. Everything else in FuelFlow works without the coach.
- **Accounts and sync** – Optional free account (email and password) with cloud backup and sync across phones, password reset and full account deletion. It's switched on once `src/firebaseConfig.ts` is filled in.
- **Profile** – Body and goal details with target recalculation, target editing, units, meals, coach setup, JSON backup and restore, diary and progress CSV export, and delete-all.
- **Appearance** – Dark by default, with a Light option or *Match phone*. The choice is saved in the profile, so it syncs with the account.
- **Works offline** – A service worker (`src/sw-template.js`, filled in by `build.mjs`) saves the app on the first visit, so it opens and works without a connection. Account data, food searches and AI requests always go to the network.
- **Privacy policy and terms** – In-app pages (`#/privacy`, `#/terms`) linked from onboarding, sign-up and Profile. They describe exactly how the app handles data, and should be reviewed before a public launch.
- **Premium** – An optional subscription sold in the iPhone app through Apple in-app purchase (RevenueCat). It adds the AI coach built in, with no key. The purchase screen shows price, period, trial and auto-renew terms, with Restore purchases and Manage subscription. The coach server checks the subscription with RevenueCat before answering. Switched on once `src/premiumConfig.ts` is filled in — see [PREMIUM.md](./PREMIUM.md). The website only explains Premium.
- **iPhone and Android apps** – Capacitor wraps the same code; daily meal, water and weigh-in reminders; native share sheet. App Store guide in [IOS.md](./IOS.md), Google Play guide in [ANDROID.md](./ANDROID.md), store screenshots and graphics in `store/`. GitHub builds both apps on every push; the Android run includes an installable test app.
- **Share with your trainer** – Progress → *Share with your trainer* makes a one-page report (weight trend, calories, protein, consistency, water, measurements) for the last 7 or 30 days, as an image or text. Nothing is sent until the member chooses where.

## Where your data lives

- **Without an account:** everything stays in that browser (`localStorage`). Clearing browser data erases it, which is why Profile → *Download full backup* exists.
- **With a free account (Firebase):** the phone still keeps its own copy, so the app is instant and works offline. Changes are also backed up to the person's private Firestore account and kept in sync on every phone they sign in on.
  - Changes made offline are queued and uploaded when the connection returns.
  - Signing in on a phone that already has data keeps both sides.
  - Signing out removes the data from that phone.
  - *Delete my account* removes everything.
  - Setup steps are in [FIREBASE.md](./FIREBASE.md), and the security rules are in [firestore.rules](./firestore.rules).

AI coach keys and chat history are never synced; they stay on the phone.

If an older FuelFlow prototype stored meals under `fuelflow-meals`, they are imported once and the original key is left untouched.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for nutrition, targets, dates, analytics, import/export
npm run build      # outputs to dist/
npm run typecheck
```

## Deploy (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` tests and builds on every push to `main`, then publishes the result to the `gh-pages` branch. GitHub Pages serves that branch (**Settings → Pages → Deploy from a branch → `gh-pages` / root**).

## Project layout

```
src/
  lib/          pure logic: types, nutrition and recipe maths, targets, analytics, storage, food search, AI coach client
  components/   UI building blocks: sheets, charts, food search, recipe editor, serving editor, water, weight
  pages/        Onboarding, Home, Diary (incl. meal plan), Progress, Coach, Profile, Premium
server/         optional Cloudflare Worker for the AI coach + setup guide
tests/          unit tests and a mock coach server for local testing
```

## Status

**Version 1.0 is feature-complete.** What's left before it's in the stores is account setup only you can do — see **[LAUNCH.md](./LAUNCH.md)** for the steps in order.

Planned after launch:

- A trainer dashboard where gyms see members' progress (with the member's permission)

FuelFlow gives estimates for general wellbeing. It is not medical advice.
