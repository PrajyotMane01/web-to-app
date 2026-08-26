package `in`.truckflow.app

// Per-build values. Rewritten in full by CI on every build (see
// .github/workflows/build-apk.yml, "Generate AppConfig.kt") — this file's
// checked-in content is only the default used when building this repo
// directly (e.g. `./gradlew assembleDebug` locally).
object AppConfig {
    const val WEB_VIEW_URL = "https://app.capsule.nodemedia.in/"
    const val PINCH_ZOOM_ENABLED = true
    const val CUSTOM_CSS = ""
    const val CUSTOM_JS = ""

    // Driven by the dashboard's per-app permissions selection. Gates
    // runtime behavior only — unlike the old Expo pipeline, nothing is
    // stripped from the build itself, so an app with these off is a few
    // KB larger but never asks for a permission or touches a device
    // feature it doesn't need.
    const val CAMERA_ENABLED = false
    const val MICROPHONE_ENABLED = false
    const val LOCATION_ENABLED = false
    const val NOTIFICATIONS_ENABLED = false
    const val STORAGE_ENABLED = false

    // The custom URL scheme this build's AndroidManifest.xml registers for
    // deep links (truckflow://...). Must match the manifest exactly — CI
    // patches both from the same package_name input, since a package name
    // is already guaranteed unique and doubles fine as a URI scheme.
    // Splash screen shown while the site's first page loads. "auto" is a
    // solid background (light/dark picked by SPLASH_BG_LIGHT/DARK) with the
    // app icon centered; "custom" shows the dashboard-uploaded splash image
    // full-bleed instead (see drawable/splash_image, baked in by CI — falls
    // back to "auto" if that drawable isn't present).
    const val SPLASH_TYPE = "auto"
    const val SPLASH_BG_LIGHT = "#ffffff"
    const val SPLASH_BG_DARK = "#000000"

    const val DEEP_LINK_SCHEME = "truckflow"

    // Extra hostnames this app's dashboard owner chose to block, on top of
    // the fixed set MainActivity.kt always blocks (instagram/facebook/etc).
    val BLOCKED_DOMAINS: List<String> = emptyList()

    // Native bottom tab bar — each tab just points the WebView at a fixed
    // URL (label to URL). Hidden entirely unless enabled and non-empty.
    const val BOTTOM_NAV_ENABLED = false
    val BOTTOM_NAV_TABS: List<Pair<String, String>> = emptyList()

    // Face/Fingerprint/device PIN gate shown before the app's content, on
    // every foregrounding (see MainActivity's onStart/onStop). Silently
    // skipped on a device with no biometric or PIN/pattern/password set up
    // at all — there's nothing to authenticate against.
    const val APP_LOCK_ENABLED = false
}
