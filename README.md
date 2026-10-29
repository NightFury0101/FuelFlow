# FuelFlow

**Eat Smarter. Track Better. Become Stronger.**

FuelFlow is a mobile-first calorie counter, nutrition tracker and AI meal scanner. It is built with React and TypeScript and hosted on GitHub Pages.

## What's in this version

- **Onboarding** – Calculates calorie, macro and water targets using the Mifflin–St Jeor equation. Deficits are moderate and never go below estimated resting needs. People under 18 and people who are pregnant, breastfeeding or have a medical condition get maintenance targets and are pointed to professional advice. Every target can be adjusted, and body details can be skipped and filled in later.
- **Home** – A calorie ring, protein/carb/fat bars, kind daily insights, quick actions, today's meals, water and weight. Every number is calculated from your logged records.
- **Diary**
  - A day picker with a week strip.
  - Search across about 45 built-in reference foods (USDA-based averages) and live packaged products from **Open Food Facts** (free, no key needed).
  - Log by serving or in grams, add several foods in a row, and edit, delete or duplicate entries.
  - Copy a meal from the day before, save a meal to reuse, create custom foods, mark favourites and use quick-add calories.
  - Customisable meal names.
- **Water** – Quick-add buttons, custom amounts, edit or delete with undo, and ml or fl oz.
- **Progress**
  - Weight chart plotted on real dates, with start, current and goal values and changes over 7 and 30 days.
  - A weekly trend (needs at least 3 weigh-ins spread over a week or more).
  - Calorie, protein and water charts for 7 or 30 days, comparison with the previous period, and logging consistency.
  - Days you didn't log are shown as gaps, never as zero.
- **AI scanner** – Take or upload a photo, review the estimated items with confidence labels, change portion sizes (macros scale with them), add missing items, answer clarifying questions and rescan, then save. Nothing is saved without your confirmation. The scanner needs the private server in [`server/`](./server/README.md); until that is set up, the screen says so and offers manual logging.
- **Profile** – Body and goal details with target recalculation, target editing, units, meals, scanner setup, JSON backup and restore, diary and progress CSV export, and delete-all.
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

The workflow in `.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`. To turn it on, go to **Settings → Pages → Source: GitHub Actions** once in the repo.

## Project layout

```
src/
  lib/          pure logic: types, nutrition maths, targets, analytics, storage, food search, scanner client
  components/   UI building blocks: sheets, charts, food search, serving editor, water, weight
  pages/        Onboarding, Home, Diary, Scan, Progress, Profile, Premium
server/         Cloudflare Worker for the AI scanner + setup guide
tests/          unit tests and a mock scanner for local testing
```

## Not built yet

These are planned for later stages:

- Recipes with multiple ingredients
- Meal planning
- AI nutrition coach
- Reminders (they need push notifications and a backend)
- Cloud accounts and sync
- Real billing

FuelFlow gives estimates for general wellbeing. It is not medical advice.
