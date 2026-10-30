# FuelFlow

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
  - A weekly trend (needs at least 3 weigh-ins spread over a week or more).
  - Calorie, protein and water charts for 7 or 30 days, comparison with the previous period, and logging consistency.
  - Days you didn't log are shown as gaps, never as zero.
- **AI nutrition coach** – A chat screen for food questions: meal ideas that fit what's left of today's calories, weekly reviews, label reading, eating out and cravings. It covers food only, not workouts. It sees your food log **only if you allow it**, and then only a short summary built from your real records. Its rules rule out crash diets, diagnoses and pushing supplements, and steer medical situations to a professional. To connect it, go to **Profile → AI nutrition coach** and paste either a **free Gemini key** (from aistudio.google.com/apikey; daily limits apply, and Google may use free-tier conversations to improve its products) or a **Claude key** (pay as you go, usually under 1 cent per question). The key is stored only in that browser and is sent only to that AI provider. It is never included in backups or committed to GitHub. If one of Google's free models is retired, FuelFlow automatically tries the next one (`GEMINI_MODELS` in `src/lib/ai.ts`). If other people will use the app, the private-server option in [`server/`](./server/README.md) keeps the key off their phones instead. Everything else in FuelFlow works without the coach.
- **Accounts and sync** – Optional free account (email and password) with cloud backup and sync across phones, password reset and full account deletion. It's switched on once `src/firebaseConfig.ts` is filled in.
- **Profile** – Body and goal details with target recalculation, target editing, units, meals, coach setup, JSON backup and restore, diary and progress CSV export, and delete-all.
- **Premium** – A plan comparison page. Billing isn't connected, so no one can be charged and every feature stays free (see `src/lib/plans.ts`).

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

## Not built yet

These are planned for later stages:

- Reminders (push notifications through Firebase Cloud Messaging)
- Real billing (needs a payment provider that supports the Maldives)

FuelFlow gives estimates for general wellbeing. It is not medical advice.
