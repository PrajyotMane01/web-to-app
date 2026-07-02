# Deep Linking Setup Guide

Deep linking has been configured to redirect users from your website to the app.

## What's Been Configured

1. **App Configuration** (`app.json`):
   - Custom URL scheme: `truckflow://`
   - Bundle ID: `com.truckflow.app`
   - Intent filters for Android to handle `https://app.truckflow.nodemedia.in`
   - Associated domains for iOS

2. **Code Changes** (`App.js`):
   - Added `expo-linking` package
   - Handles deep links when app is opened or running
   - Dynamically loads URLs from deep links

## Server Setup Required

To complete deep linking setup, you need to host these files on your web server:

### For Android:
Host the file `.well-known/assetlinks.json` at:
```
https://app.truckflow.nodemedia.in/.well-known/assetlinks.json
```

**Before uploading:**
1. Get your app's SHA256 fingerprint by running:
   ```bash
   cd webview-template/android
   ./gradlew signingReport
   ```
   Or for release builds:
   ```bash
   keytool -list -v -keystore your-release-key.keystore
   ```

2. Replace `YOUR_APP_SHA256_FINGERPRINT_HERE` in `assetlinks.json` with your actual SHA256 fingerprint

### For iOS:
Host the file `.well-known/apple-app-site-association` at:
```
https://app.truckflow.nodemedia.in/.well-known/apple-app-site-association
```

**Before uploading:**
Replace `TEAM_ID` with your Apple Developer Team ID (found in Apple Developer Console)

### Important Server Requirements:
- Files must be served over HTTPS
- Content-Type should be `application/json`
- Files should be accessible without authentication
- No redirects should occur when accessing these files

## Testing Deep Links

### Test with custom scheme:
```bash
# Android
adb shell am start -a android.intent.action.VIEW -d "truckflow://app.truckflow.nodemedia.in"

# iOS (in simulator)
xcrun simctl openurl booted "truckflow://app.truckflow.nodemedia.in"
```

### Test with HTTPS (after server setup):
Just open `https://app.truckflow.nodemedia.in` in the device browser, and it should prompt to open the app.

## Build the App

After making these changes, rebuild your app:
```bash
# Development build
npx expo run:android
npx expo run:ios

# Production build with EAS
eas build --platform android
eas build --platform ios
```

## Verification

1. **Android**: Use the [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) to verify your `assetlinks.json`
2. **iOS**: Verify your `apple-app-site-association` with Apple's [App Site Association Validator](https://search.developer.apple.com/appsearch-validation-tool/)

## How It Works

1. User clicks a link to `https://app.truckflow.nodemedia.in` (in email, SMS, browser, etc.)
2. The OS checks if an app is registered for this domain
3. If your app is installed, it opens with that URL
4. The WebView loads the URL directly
5. If the app isn't installed, the browser opens the URL normally
