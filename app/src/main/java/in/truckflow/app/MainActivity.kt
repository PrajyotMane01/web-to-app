package `in`.truckflow.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

// Every install subscribes to this one FCM topic — the dashboard sends
// broadcast pushes straight to it, no per-device token registration.
// Matches webview-template/notifications.js.
private const val FCM_TOPIC = "all"

private const val TAG = "CapsuleTest"
private const val BASE_URL = "https://app.capsule.nodemedia.in/"

// Per-build customization (in the real pipeline these come from the
// dashboard's app config, like webview-template/config.js). Edit directly
// here for this test app — e.g. try:
//   CUSTOM_CSS = "body { background: #111 !important; }"
//   CUSTOM_JS  = "document.title = 'Hello from Capsule';"
private const val CUSTOM_CSS = ""
private const val CUSTOM_JS = ""

private const val CUSTOM_CSS_ELEMENT_ID = "capsule-custom-css"

// Builds/updates a <style> tag rather than just appending one each time, so
// re-running this on every navigation doesn't pile up duplicate tags.
private fun cssInjectionScript(css: String): String {
    val json = JSONObject().put("css", css).put("id", CUSTOM_CSS_ELEMENT_ID)
    return """
        (function () {
          var d = ${json};
          var el = document.getElementById(d.id);
          if (!el) {
            el = document.createElement('style');
            el.id = d.id;
            (document.head || document.documentElement).appendChild(el);
          }
          el.textContent = d.css;
        })();
    """.trimIndent()
}

// Everything else loads inline with no allowlist — these are the
// exceptions. Matched domains (and their subdomains) never load in this
// WebView; they're handed to the phone's normal browser instead.
private val BLOCKED_HOSTS = setOf(
    "instagram.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
)

private fun isBlockedHost(host: String): Boolean =
    BLOCKED_HOSTS.any { host == it || host.endsWith(".$it") }

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var errorContainer: View
    private lateinit var swipeRefresh: androidx.swiperefreshlayout.widget.SwipeRefreshLayout

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op either way */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        applyStatusBarStyle()
        requestNotificationPermissionIfNeeded()
        FirebaseMessaging.getInstance().subscribeToTopic(FCM_TOPIC)

        CookieManager.getInstance().setAcceptCookie(true)

        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.setSupportMultipleWindows(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        errorContainer = findViewById(R.id.error_container)
        findViewById<android.widget.Button>(R.id.retry_button).setOnClickListener {
            webView.reload()
        }

        // Only fires when the WebView is scrolled to the very top already —
        // SwipeRefreshLayout checks that itself via the child's own scroll
        // position, so this never fights with normal in-page scrolling.
        swipeRefresh = findViewById(R.id.swipe_refresh)
        swipeRefresh.setOnRefreshListener { webView.reload() }

        // Runs before the page's own scripts/first paint, on every
        // navigation this WebView makes — avoids a flash of unstyled
        // content for the custom CSS. Injected directly into the JS engine
        // rather than as a page-parsed <script> tag, so it isn't subject
        // to the site's own Content-Security-Policy either way.
        if (CUSTOM_CSS.isNotEmpty() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, cssInjectionScript(CUSTOM_CSS), setOf("*"))
        }

        // Everything, including Google login, loads inline in this WebView —
        // no Custom Tabs, no external popup. http(s) links stay inline;
        // anything else (tel:, mailto:, intent://, upi:, whatsapp:, ...)
        // gets handed to whatever app on the device can open it.
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                if (uri.scheme == "http" || uri.scheme == "https") {
                    if (isBlockedHost(uri.host ?: "")) {
                        openExternally(uri)
                        return true
                    }
                    return false
                }
                openExternally(uri)
                return true
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                // Every new navigation attempt (including a retry) starts
                // clean — if it fails again, onReceivedError below will
                // show the error screen again.
                showError(false)
            }

            // Only fires for network/protocol-level failures on an actual
            // request (DNS failure, connection refused, timeout, no
            // internet) — an HTTP 404/500 from a page that *did* load goes
            // through onReceivedHttpError instead and is left to the site's
            // own error page, not this offline screen.
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) showError(true)
                swipeRefresh.isRefreshing = false
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
                // Re-apply CSS here too — belt-and-suspenders for WebView
                // builds without document-start-script support, and covers
                // SPA client-side navigations that don't reload the
                // document (so the start-script injection wouldn't rerun).
                if (CUSTOM_CSS.isNotEmpty()) view.evaluateJavascript(cssInjectionScript(CUSTOM_CSS), null)
                if (CUSTOM_JS.isNotEmpty()) view.evaluateJavascript(CUSTOM_JS, null)
            }
        }

        // target="_blank" / window.open() links have no WebView to render
        // into by default — without this they're silently dropped. Load
        // them in the same WebView instead of spawning a second window.
        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message
            ): Boolean {
                val transport = resultMsg.obj as? WebView.WebViewTransport
                val newWebView = WebView(view.context).apply {
                    layoutParams = ViewGroup.LayoutParams(0, 0)
                }
                newWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        v: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        val uri = request.url
                        val isWeb = uri.scheme == "http" || uri.scheme == "https"
                        if (isWeb && !isBlockedHost(uri.host ?: "")) {
                            webView.loadUrl(uri.toString())
                        } else {
                            openExternally(uri)
                        }
                        return true
                    }
                }
                transport?.webView = newWebView
                resultMsg.sendToTarget()
                return true
            }
        }

        webView.loadUrl(deepLinkUrl(intent) ?: notificationUrl(intent) ?: BASE_URL)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // App already running — either a notification was tapped
        // (CapsuleFcmService's system-built notification puts the FCM data
        // payload straight into extras) or a deep link was opened.
        (deepLinkUrl(intent) ?: notificationUrl(intent))?.let { webView.loadUrl(it) }
    }

    private fun notificationUrl(intent: Intent?): String? = intent?.getStringExtra("url")

    // https://app.capsule.nodemedia.in/... (a verified App Link) loads as-is.
    // truckflow://anything/path?query (the custom scheme) is remapped onto
    // our own origin — the scheme's own host isn't trusted, only the
    // path/query are kept, so a crafted truckflow://evil.com/x link still
    // only ever lands on our real domain.
    private fun deepLinkUrl(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        return when (uri.scheme) {
            "http", "https" -> uri.toString()
            "truckflow" -> Uri.parse(BASE_URL).buildUpon()
                .encodedPath(uri.path ?: "/")
                .encodedQuery(uri.query)
                .build()
                .toString()
            else -> null
        }
    }

    private fun showError(show: Boolean) {
        errorContainer.visibility = if (show) View.VISIBLE else View.GONE
        webView.visibility = if (show) View.GONE else View.VISIBLE
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun applyStatusBarStyle() {
        val isDarkMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        val barColor = if (isDarkMode) Color.BLACK else Color.WHITE

        // On API 35+ (targetSdk here) edge-to-edge is enforced and
        // Window.statusBarColor is ignored, so the status bar's own
        // background is whatever's drawn behind it — paint the decor view
        // directly so the inset area (reserved by fitsSystemWindows on the
        // root layout) shows the right color either way.
        window.statusBarColor = barColor
        window.decorView.setBackgroundColor(barColor)

        // Dark icons/text on a light bar in light mode; light icons on the
        // black bar in dark mode.
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars =
            !isDarkMode
    }

    private fun openExternally(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            Log.w(TAG, "No app found to handle $uri")
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
