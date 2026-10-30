# Putting FuelFlow on the App Store

FuelFlow's web code is wrapped as a real iPhone app with [Capacitor](https://capacitorjs.com).
The same code still runs the website; inside the app a few things change automatically
(`src/lib/platform.ts`):

- **Premium is hidden.** Apple only allows paid features sold through its own in-app purchases,
  and showing plans you can't buy can get an app rejected. Everything is free, so nothing is lost.
- **Backups use the share sheet** (Save to Files, AirDrop, email) instead of a browser download.
- **No service worker.** The app carries all its files, so it already works offline.
- **Daily reminders** (Profile → Reminders, app only): meals, water and a weekly weigh-in. They
  skip a meal you've already logged and stop water reminders once the day's goal is met. Tapping
  one opens the right screen.

Every push to `main` runs **Actions → iOS app check**, which builds the iPhone app on a cloud Mac.
A green tick means it compiles for iPhone. The run's *Artifacts* section has the ready Xcode
project (`FuelFlow-ios-project`).

## Apple's checklist

| Requirement | FuelFlow |
|---|---|
| Apple Developer Program (US$99/year) | **You** — enrol at developer.apple.com/programs |
| Sign in with Apple | Not required: it's only needed when an app offers Google/Facebook-style logins. FuelFlow uses email + password, and an account is optional. |
| Delete account inside the app | Done — Profile → Account & sync → Delete my account |
| Explain camera / microphone use | Not needed — FuelFlow uses neither |
| Be clear about paid features | Done — nothing is sold; Premium is hidden in the app |
| Support, privacy and terms web pages | Done — see URLs below. Add a support email in `src/pages/Legal.tsx` (`SUPPORT_EMAIL`). |
| Health disclaimer | Done — targets are labelled as estimates, with advice to see a doctor for under-18s, pregnancy and medical conditions |

## URLs for App Store Connect

- Support URL: `https://nightfury0101.github.io/FuelFlow/#/support`
- Privacy policy URL: `https://nightfury0101.github.io/FuelFlow/#/privacy`
- Terms (put in the description or the EULA field): `https://nightfury0101.github.io/FuelFlow/#/terms`

## Building and uploading (needs a Mac with Xcode)

```bash
git clone https://github.com/NightFury0101/FuelFlow.git && cd FuelFlow
npm install
npm run build
npm run ios:prepare      # creates ios/, app icon and launch screen
npm run ios:open         # opens Xcode
```

In Xcode:

1. Select **App** in the left panel → **Signing & Capabilities** → tick *Automatically manage
   signing* and choose your team. If the bundle ID `io.github.nightfury0101.fuelflow` is taken,
   change it here and in `capacitor.config.json`.
2. Pick **Any iOS Device** at the top, then **Product → Archive**.
3. In the Organizer window: **Distribute App → App Store Connect → Upload**.

After any change to the app: `npm run build && npx cap sync ios`, raise the build number in
Xcode, archive and upload again. Commit the `ios/` folder after the first `ios:prepare`.

No Mac? Rent a cloud Mac by the hour (e.g. MacinCloud), or use a build service such as
Codemagic or Ionic Appflow that signs and uploads for you.

## App Store Connect answers

- **Category:** Health & Fitness. **Price:** Free. **In-app purchases:** none.
- **Age rating:** answer "None" to every question → 4+.
- **App Privacy** ("nutrition label"):
  - *Without an account* nothing leaves the phone except what's listed next.
  - *Contact info → Email address* — linked to the user, used for App Functionality (accounts).
  - *Health & Fitness → Health / Fitness* (food diary, weight, measurements) — linked to the
    user, App Functionality (only stored when someone creates an account).
  - *User Content → Other* — questions sent to the AI coach go to Google or Anthropic using the
    person's own key; not linked to identity by FuelFlow, App Functionality.
  - Tracking: **No**. Data used for ads: **No**.
- **Export compliance:** already answered in the app (standard HTTPS only).
- **Review notes** (paste this):
  > No login is needed — tap Get started and finish the short setup. Creating an account is
  > optional (Profile → Account & sync). Account deletion: Profile → Account & sync → Delete my
  > account. The optional AI nutrition coach needs the user's own free Google Gemini key
  > (Profile → AI nutrition coach); every other feature works without it. Daily reminders
  > (Profile → Reminders) use iPhone notifications. Nothing is sold in the app.

## Avoiding "minimum functionality" rejections (guideline 4.2)

Apple rejects apps that are just a website in a frame. FuelFlow works fully offline, stores data
on the device, uses the native share sheet and sends smart daily reminders through iPhone
notifications — mention the reminders in the review notes.

## Store listing text

Copy these into App Store Connect (limits in brackets).

**Name** (30): `FuelFlow: Calorie Counter`

**Subtitle** (30): `Calories, protein & water`

**Promotional text** (170):
> Know exactly what's left today. Log meals in seconds, hit your protein, drink enough water and
> see real progress — free, with no ads.

**Keywords** (100, comma-separated, no spaces needed):
`calorie,counter,tracker,macro,protein,diet,nutrition,meal,planner,food,diary,water,weight,fitness`

**Description** (4000):

> FuelFlow makes calorie and nutrition tracking simple. Get daily targets built for your body and
> goal, log food in seconds, and see how your week is really going.
>
> YOUR TARGETS, BUILT FOR YOU
> • Calorie, protein, carbs, fat and water targets from your age, height, weight, activity and goal
> • A safe pace for losing or gaining weight — or change any target yourself
>
> LOG IN SECONDS
> • Search thousands of foods, or add your own
> • Save your home recipes once and log a portion any time
> • Plan meals up to two weeks ahead, then mark them as eaten
> • Quick-add water with one tap
>
> SEE YOUR PROGRESS
> • Calories and macros by day, week, month or year
> • Weight trend, body measurements and milestones you've reached
> • Logging streaks to keep you going
>
> AI NUTRITION COACH
> • Ask anything about food, protein or your targets
> • Uses your own free Google Gemini key (or Claude) — your key stays on your phone
> • The coach only sees your food log if you switch that on
>
> REMINDERS THAT KNOW YOU
> • Meal, water and weekly weigh-in reminders at the times you choose
> • Skips a meal you've already logged and stops water reminders once you hit your goal
>
> PRIVATE BY DESIGN
> • Works offline — your diary lives on your phone
> • Optional account to back up and sync between devices
> • Export everything any time, or delete your account in the app
> • No ads. Nothing to buy.
>
> FuelFlow gives estimates for general wellbeing, not medical advice. If you're under 18,
> pregnant or have a medical condition, talk to a doctor before changing your diet.

**What's New** (first version): `First release. Eat smarter. Track better. Become stronger.`

**Screenshots:** `store/screenshots/` has ready-made sets for 6.9-inch (1320 × 2868) and
6.5-inch (1284 × 2778) iPhones. Upload them in order.
