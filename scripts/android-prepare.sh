#!/usr/bin/env bash
# Creates (or refreshes) the Android app project in android/ from the web build in dist/.
# Run after `npm run build`. Works on Windows (Git Bash), macOS or Linux with Android Studio /
# JDK 21 installed; the GitHub "Android app" workflow runs it too.
#   VERSION_CODE=12 npm run android:prepare   # Play Store needs a higher number for every upload
set -euo pipefail
cd "$(dirname "$0")/.."

test -f dist/index.html || { echo "Run 'npm run build' first."; exit 1; }
test -d node_modules/@capacitor/android || npm install --no-audit --no-fund

if [ ! -d android ]; then
  npx cap add android
fi

# App icon and launch screen from resources/ (dark background, lime logo).
npx --yes @capacitor/assets@latest generate --android \
  --iconBackgroundColor '#0b0d0c' --iconBackgroundColorDark '#0b0d0c' \
  --splashBackgroundColor '#0b0d0c' --splashBackgroundColorDark '#0b0d0c'

# Version shown in the Play Store (from package.json) and the upload number.
GRADLE=android/app/build.gradle
VERSION_NAME=$(node -p "require('./package.json').version")
if [ -f "$GRADLE" ]; then
  sed -i.bak -E "s/versionCode [0-9]+/versionCode ${VERSION_CODE:-1}/; s/versionName \"[^\"]*\"/versionName \"${VERSION_NAME}\"/" "$GRADLE" && rm -f "$GRADLE.bak"
fi

npx cap sync android
echo "Android project ready: open it in Android Studio (npx cap open android)"
