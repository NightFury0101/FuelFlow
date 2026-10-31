# FuelFlow on Android (Google Play)

The same FuelFlow code runs as an Android app through [Capacitor](https://capacitorjs.com),
just like the iPhone app. Inside the Android app:

- **Reminders** for meals, water and the weekly weigh-in (Profile → Reminders). Android 13+
  asks for permission to show notifications the first time they're switched on.
- **Premium** is sold through **Google Play billing** (RevenueCat) once
  `revenueCatGoogleKey` is set in `src/premiumConfig.ts` — see [PREMIUM.md](./PREMIUM.md).
- **Backups and trainer reports** open Android's share sheet (Drive, WhatsApp, Viber, email…).
- Everything works offline; accounts and sync use the same Firebase project as the website.

## Try it on your phone now (no Play account needed)

Every push to `main` runs **Actions → Android app** and builds a test app.

1. Open the latest run of **Android app** on GitHub (Actions tab) → **Artifacts** →
   **FuelFlow-android-test** and download it on your Android phone (or computer, then copy it).
2. Unzip it and open `app-debug.apk`. Android asks to allow installing from your browser or Files
   app — allow it for this install.
3. Open FuelFlow. This test build is signed with a development key, so it can't be updated from
   Google Play later — uninstall it before installing the Play Store version.

## Publish on Google Play

### 1. Google Play Console (one-time US$25)

Sign up at <https://play.google.com/console/signup> as an individual or organisation. New
**personal** accounts must run a **closed test with at least 12 testers for 14 days** before
Google lets you publish to everyone — gym members are perfect testers.

### 2. Create your upload key (once — keep it safe)

On any computer with Java installed (Android Studio includes it):

```bash
keytool -genkeypair -v -keystore fuelflow-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias fuelflow
```

Choose a strong password and write it down. **Back up `fuelflow-upload.jks` somewhere safe and
never commit it.** (Google Play App Signing keeps the real signing key; this upload key can be
reset through Google support if it's ever lost.)

### 3. Let GitHub build the signed bundle

GitHub → your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the key file as text: `base64 -w0 fuelflow-upload.jks` (macOS: `base64 -i fuelflow-upload.jks`; Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("fuelflow-upload.jks"))`) |
| `ANDROID_KEYSTORE_PASSWORD` | the password you chose |
| `ANDROID_KEY_ALIAS` | `fuelflow` |
| `ANDROID_KEY_PASSWORD` | the key password (same as above unless you set a different one) |

From the next push, **Actions → Android app → Artifacts** also has **FuelFlow-android-release**
— the signed `.aab` file to upload to Play. Each run uses a higher version code automatically.

### 4. Create the app in Play Console

- **App name:** FuelFlow: Calorie Counter · **Default language:** English · **App** · **Free**
- **Package name** comes from the first upload: `io.github.nightfury0101.fuelflow`
- **Testing → Closed testing → Create track**, upload the `.aab`, add testers' emails, roll out.
  After 14 days with 12+ testers, apply for **Production**.

### 5. Store listing

- **Short description** (80): `Track calories, protein & water with targets built for you, plus an AI coach.`
- **Full description:** use the App Store description in [IOS.md](./IOS.md#store-listing-text),
  replacing "Apple ID settings" with "Google Play subscriptions".
- **App icon** 512 × 512: `public/icon-512.png`
- **Feature graphic** 1024 × 500: `store/google-play-feature-graphic.png`
- **Phone screenshots** 1080 × 1920: `store/screenshots/google-play/` (upload in order)
- **Category:** Health & Fitness · **Contact email:** your support address
- **Privacy policy:** `https://nightfury0101.github.io/FuelFlow/#/privacy`

### 6. App content forms

- **Data safety:** *Collected* — Email address (account management, optional); Health and fitness
  info (app functionality, optional — only with an account); Purchase history (RevenueCat, app
  functionality); App activity → other user-generated content (AI coach questions, app
  functionality). *Shared:* none for advertising. *Encrypted in transit:* Yes. *Users can request
  deletion:* Yes (in the app: Profile → Delete my account).
- **Health apps declaration:** nutrition and weight tracking, not a medical device.
- **Ads:** No. **Target audience:** 18+ (or 13+ with the under-18 safeguards described in the
  privacy policy). **Content rating:** complete the questionnaire — expect "Everyone".
- **Account deletion URL:** `https://nightfury0101.github.io/FuelFlow/#/support` — it explains
  deleting in the app, or on the website (sign in, Profile → Delete my account) without the app.

### 7. Premium on Google Play

See the Android section of [PREMIUM.md](./PREMIUM.md#android-google-play).

## Building on your own computer (optional)

Install [Android Studio](https://developer.android.com/studio), then:

```bash
npm install
npm run build
npm run android:prepare
npm run android:open      # opens Android Studio — press ▶ to run on a phone or emulator
```
