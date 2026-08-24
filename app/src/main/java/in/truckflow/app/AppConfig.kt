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

    // The custom URL scheme this build's AndroidManifest.xml registers for
    // deep links (truckflow://...). Must match the manifest exactly — CI
    // patches both from the same package_name input, since a package name
    // is already guaranteed unique and doubles fine as a URI scheme.
    const val DEEP_LINK_SCHEME = "truckflow"
}
