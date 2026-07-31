// WebView Configuration
// Change the URL below to load your desired website

export const config = {
    //   webViewUrl: 'https://app.truckflow.nodemedia.in',
    webViewUrl: 'https://menteronics.tech',

    // Native pinch-to-zoom on the WebView (Android). Overwritten per build
    // by the dashboard's "Pinch to zoom" toggle — this default is only used
    // when running the template directly (e.g. `expo start`).
    pinchZoomEnabled: true,

    // Extra hostnames (besides the site's own, from webViewUrl) allowed to
    // load inline in the WebView — e.g. a payment gateway's domain. Anything
    // else opens in the system browser instead. Overwritten per build from
    // the dashboard's allowlist setting.
    allowedDomains: [],

    // Optional native bottom tab bar — each tab just navigates the WebView
    // to a fixed URL. Overwritten per build from the dashboard's "Bottom
    // Navigation" setting.
    bottomNav: {
        enabled: false,
        tabs: [],
        // tabs: [{ label: 'Home', url: 'https://menteronics.tech' }],
    },

    // Require Face/Fingerprint/device PIN before showing the app's content,
    // and again whenever the app returns from the background. Overwritten
    // per build from the dashboard's "App Lock" toggle.
    appLockEnabled: false,
};
