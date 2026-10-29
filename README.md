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
- **AI nutrition coach** – A chat screen for food questions: meal ideas that fit what's left of today's calories, weekly reviews, label reading, eating out and cravings. It covers food only, not workouts. It sees your food log **only if you allow it**, and then only a short summary built from your real records. Its rules rule out crash diets, diagnoses and pushing supplements, and steer medical situations to a professional. To connect it, paste your own Claude API key in **Profile → AI nutrition coach**. The key is stored only in that browser, and requests go straight to Anthropic; it is never included in backups or committed to GitHub. If other people will use the app, the private-server option in [`server/`](./server/README.md) keeps the key off their phones instead. Everything else in FuelFlow works without the coach.
- **Profile** – Body and goal details with target recalculation, target editing, units, meals, coach setup, JSON backup and restore, diary and progress CSV export, and delete-all.
- **Premium** – A plan comparison page. Billing isn't connected, so no one can be charged and every feature stays free (see `src/lib/plans.ts`).

## Where your data lives

All data is stored **only in this browser** (`localStorage`), so there are no accounts and no sync between devices. Clearing browser data erases it, which is why Profile → *Download full backup* exists.

Every read and write goes through `src/lib/storage.ts` and `src/lib/store.tsx`. That means a cloud backend such as Supabase can be added later without changing the screens.

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

- Reminders (they need push notifications and a backend)
- Cloud accounts and sync
- Real billing

FuelFlow gives estimates for general wellbeing. It is not medical advice.
