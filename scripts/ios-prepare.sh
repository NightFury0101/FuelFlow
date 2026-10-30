#!/usr/bin/env bash
# Creates (or refreshes) the iPhone app project in ios/ from the web build in dist/.
# Run after `npm run build`. Works on a Mac; the GitHub "iOS app check" runs it too.
set -euo pipefail
cd "$(dirname "$0")/.."

test -f dist/index.html || { echo "Run 'npm run build' first."; exit 1; }

# Capacitor wraps the web app in a native iPhone shell.
npm install --no-save --no-audit --no-fund @capacitor/core@latest @capacitor/cli@latest @capacitor/ios@latest

if [ ! -d ios ]; then
  npx cap add ios --packagemanager SPM
fi

# App icon and launch screen from resources/ (dark background, lime logo).
npx --yes @capacitor/assets@latest generate --ios \
  --iconBackgroundColor '#0b0d0c' --iconBackgroundColorDark '#0b0d0c' \
  --splashBackgroundColor '#0b0d0c' --splashBackgroundColorDark '#0b0d0c'

PLIST=ios/App/App/Info.plist
if [ -f "$PLIST" ] && command -v /usr/libexec/PlistBuddy >/dev/null; then
  # FuelFlow only uses standard HTTPS, so it's exempt from export-compliance paperwork.
  /usr/libexec/PlistBuddy -c "Delete :ITSAppUsesNonExemptEncryption" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"
  # Display name under the icon.
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName FuelFlow" "$PLIST" 2>/dev/null || true
fi

npx cap sync ios
echo "iPhone project ready: open ios/App/App.xcodeproj in Xcode (or run: npx cap open ios)"
