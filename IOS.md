# Putting FuelFlow on the App Store

FuelFlow's web code is wrapped as a real iPhone app with [Capacitor](https://capacitorjs.com).
The same code still runs the website; inside the app a few things change automatically
(`src/lib/platform.ts`):

- **Premium is hidden.** Apple only allows paid features sold through its own in-app purchases,
  and showing plans you can't buy can get an app rejected. Everything is free, so nothing is lost.
- **Backups use the share sheet** (Save to Files, AirDrop, email) instead of a browser download.
- **No service worker.** The app carries all its files, so it already works offline.

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
  > (Profile → AI nutrition coach); every other feature works without it. Nothing is sold in
  > the app.

## Avoiding "minimum functionality" rejections (guideline 4.2)

Apple rejects apps that are just a website in a frame. FuelFlow works fully offline, stores data
on the device and has a native share sheet, which helps. Adding daily reminder notifications
(`@capacitor/local-notifications`) would make the case stronger if a reviewer pushes back.
