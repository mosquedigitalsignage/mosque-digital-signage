package com.mosquesignage.tv

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.activity.OnBackPressedCallback

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var webViewContainer: FrameLayout
    private lateinit var prefs: SharedPreferences

    // Wake lock for preventing sleep mode
    private var wakeLock: PowerManager.WakeLock? = null

    // Long-press back detection for mosque picker
    private var backPressStartTime: Long = 0
    private val longPressThresholdMs = 3000L

    companion object {
        private const val PREFS_NAME = "mosque_signage_prefs"
        private const val KEY_MOSQUE_ID = "selected_mosque_id"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Set up TV-optimized window
        setupTVWindow()

        // Acquire wake lock to prevent sleep mode
        acquireWakeLock()

        setContentView(R.layout.activity_main)

        webViewContainer = findViewById(R.id.webview_container)
        webView = findViewById(R.id.webview)

        // Configure WebView for TV
        setupWebView()

        // Load the appropriate URL
        loadDisplay()

        // Set up back press handling
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun loadDisplay() {
        val savedMosqueId = prefs.getString(KEY_MOSQUE_ID, null)
        val webUrl = BuildConfig.WEB_URL

        if (savedMosqueId != null) {
            // Load display for saved mosque
            val url = "${webUrl}?mosque=$savedMosqueId"
            println("Loading display for mosque: $savedMosqueId")
            webView.loadUrl(url)
        } else {
            // No mosque selected - load the selector screen
            println("No mosque selected, showing selector")
            webView.loadUrl(webUrl)
        }
    }

    /**
     * Show the mosque picker (called on first launch or long-press BACK)
     */
    private fun showMosquePicker() {
        // Clear saved mosque ID
        prefs.edit().remove(KEY_MOSQUE_ID).apply()
        // Load the selector (no ?mosque= param)
        val webUrl = BuildConfig.WEB_URL
        webView.loadUrl(webUrl)
    }

    private fun setupTVWindow() {
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun setupWebView() {
        val settings = webView.settings

        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "Mosque-Digital-Signage-TV/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectTVOptimizations()

                // If user selected a mosque from the selector, save it
                url?.let { saveMosqueIdFromUrl(it) }
            }
        }

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
    }

    /**
     * Extract and save mosque ID when a mosque is selected via the web selector
     */
    private fun saveMosqueIdFromUrl(url: String) {
        val uri = android.net.Uri.parse(url)
        val mosqueId = uri.getQueryParameter("mosque")
        if (mosqueId != null && mosqueId.isNotEmpty()) {
            val currentSaved = prefs.getString(KEY_MOSQUE_ID, null)
            if (currentSaved != mosqueId) {
                prefs.edit().putString(KEY_MOSQUE_ID, mosqueId).apply()
                println("Saved mosque ID: $mosqueId")
            }
        }
    }

    private fun injectTVOptimizations() {
        val css = """
            <style>
                *:focus {
                    outline: 3px solid #4CAF50 !important;
                    outline-offset: 2px !important;
                }
                button, a, input, select, textarea {
                    min-height: 48px !important;
                    min-width: 48px !important;
                }
                body {
                    font-size: 18px !important;
                    line-height: 1.6 !important;
                }
            </style>
        """.trimIndent()

        webView.evaluateJavascript("""
            (function() {
                var style = document.createElement('style');
                style.innerHTML = `$css`;
                document.head.appendChild(style);
            })();
        """.trimIndent(), null)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> {
                webView.evaluateJavascript("""
                    (function() {
                        var focused = document.activeElement;
                        if (focused && focused.click) {
                            focused.click();
                        }
                    })();
                """.trimIndent(), null)
                return true
            }
            KeyEvent.KEYCODE_BACK -> {
                // Track long-press start time
                if (event?.repeatCount == 0) {
                    backPressStartTime = System.currentTimeMillis()
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val pressDuration = System.currentTimeMillis() - backPressStartTime
            if (pressDuration >= longPressThresholdMs) {
                // Long-press BACK = show mosque picker
                showMosquePicker()
                return true
            }
            // Short press = normal back behavior
            if (webView.canGoBack()) {
                webView.goBack()
                return true
            }
        }
        return super.onKeyUp(keyCode, event)
    }

    // === SLEEP MODE PREVENTION ===

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            wakeLock = powerManager.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE,
                "MosqueSignage::WakeLock"
            )
            wakeLock?.acquire()

            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        } catch (e: Exception) {
            println("Failed to acquire wake lock: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let { lock ->
                if (lock.isHeld) {
                    lock.release()
                }
            }
            wakeLock = null
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } catch (e: Exception) {
            println("Error releasing wake lock: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        releaseWakeLock()
    }

    override fun onResume() {
        super.onResume()
        if (wakeLock?.isHeld == false) {
            acquireWakeLock()
        }
    }
}
