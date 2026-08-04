import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, BackHandler, ToastAndroid, PanResponder, Animated, ActivityIndicator, TouchableOpacity, useColorScheme, AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useCallback } from 'react';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { config } from './config';
import { useNotifications } from './notifications';
import { handleCameraRequest } from './camera';
import { handleMicrophoneRequest } from './microphone';
import { handleLocationRequest } from './location';

// ── App lock ───────────────────────────────────────────────────────
// Requires Face/Fingerprint/device PIN before showing the app's content,
// and again whenever the app returns from the background — re-checked on
// every AppState transition rather than once at cold start.
//
// Below this grace period, a return to 'active' is treated as a brief
// hand-off rather than the user actually leaving — e.g. a password
// manager opening as its own app to autofill a field, or approving a
// Google 2FA prompt via "yes it's me" on the same device. Both of those
// pause this app's Activity just like switching away for real does, so
// without a grace window every such hand-off would re-lock the app mid
// login flow.
const LOCK_GRACE_PERIOD_MS = 15000;

function useAppLock(enabled) {
  const [locked, setLocked] = useState(enabled);
  const [checking, setChecking] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const inFlightRef = useRef(false);
  const backgroundedAtRef = useRef(null);

  const tryUnlock = useCallback(async () => {
    // Android can fire a spurious AppState 'change' event right at cold
    // start (before appStateRef's initial value has settled to 'active'),
    // which would otherwise trigger a second, overlapping authenticateAsync()
    // call while the first (from the mount effect) is still pending —
    // calling it twice concurrently can throw natively and crash the app.
    if (!enabled || inFlightRef.current) return;
    inFlightRef.current = true;
    setChecking(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        // No biometrics/PIN set up on this device — fail open rather than
        // permanently locking the user out of an app they can't unlock.
        setLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock to continue',
        disableDeviceFallback: false,
      });
      setLocked(!result.success);
    } finally {
      setChecking(false);
      inFlightRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) tryUnlock();
  }, [enabled, tryUnlock]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const awayMs = backgroundedAtRef.current ? Date.now() - backgroundedAtRef.current : Infinity;
        if (awayMs > LOCK_GRACE_PERIOD_MS) {
          setLocked(true);
          tryUnlock();
        }
        backgroundedAtRef.current = null;
      } else if (nextState.match(/inactive|background/)) {
        backgroundedAtRef.current = Date.now();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [enabled, tryUnlock]);

  return { locked, checking, tryUnlock };
}

export default function App() {
  const { locked, checking, tryUnlock } = useAppLock(config.appLockEnabled);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(config.webViewUrl);
  const webViewRef = useRef(null);
  const canGoBackRef = useRef(false);
  const exitPressedOnceRef = useRef(false);
  const { notificationUrl } = useNotifications();
  // Sites that ship their own prefers-color-scheme CSS pick this up for
  // free once app.json's userInterfaceStyle is "automatic" (Android's
  // WebView reads the OS night-mode setting the Activity is configured
  // with). forceDarkOn below is the fallback for sites with no dark CSS
  // of their own — Android algorithmically darkens the page instead of
  // leaving a jarring white flash inside an otherwise dark app shell.
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // ── Bottom navigation ─────────────────────────────────────────────
  // Optional native tab bar — each tab just points the WebView at a fixed
  // URL. Independent of the WebView's own back/forward history; tapping a
  // tab always starts a fresh navigation to that tab's URL.
  const bottomNav = config.bottomNav || { enabled: false, tabs: [] };
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleTabPress = (index, url) => {
    setActiveTabIndex(index);
    setCurrentUrl(url);
  };

  // ── Pull-to-refresh ──────────────────────────────────────────────
  // react-native-webview only wires up the native pull-to-refresh spinner
  // (`pullToRefreshEnabled`) on iOS — there's no Android equivalent, so we
  // build a minimal one: a PanResponder that only *captures* the touch
  // stream away from the WebView when the page is already scrolled to the
  // very top and the gesture starts moving downward. Anywhere else, touches
  // pass straight through to the WebView as normal.
  const scrollYRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistance = useRef(new Animated.Value(0)).current;
  const PULL_TRIGGER_THRESHOLD = 70;
  const PULL_MAX = 100;

  const handleRefresh = () => {
    setRefreshing(true);
    webViewRef.current?.reload();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetResponderCapture: () => false,
      onMoveShouldSetResponderCapture: () => false,
      // Only take over the gesture once it's clearly a downward pull
      // starting from the top of the page — never on first touch.
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        scrollYRef.current <= 0 && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_evt, gesture) => {
        const capped = Math.min(Math.max(gesture.dy, 0), PULL_MAX);
        pullDistance.setValue(capped);
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy >= PULL_TRIGGER_THRESHOLD) {
          Animated.spring(pullDistance, { toValue: 40, useNativeDriver: true }).start();
          handleRefresh();
        } else {
          Animated.spring(pullDistance, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(pullDistance, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (!refreshing) {
      Animated.spring(pullDistance, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [refreshing]);

  const handleWebViewPermission = async (request) => {
    const granted = (await Promise.all([
      handleCameraRequest(request.resources),
      handleMicrophoneRequest(request.resources),
      handleLocationRequest(request.resources),
    ])).flat();
    granted.length > 0 ? request.grant(granted) : request.deny();
  };

  useEffect(() => {
    if (notificationUrl) setCurrentUrl(notificationUrl);
  }, [notificationUrl]);

  // ── External link handling ───────────────────────────────────────
  // The site's own domain always loads inside the WebView. Anything else
  // (payment gateways, social logins, docs, etc.) only loads inline if the
  // dashboard owner explicitly added it to the allowlist — otherwise it
  // opens in the system browser instead, so e.g. a random outbound link
  // doesn't silently trap the user inside the app's WebView.
  const allowedHostsRef = useRef(
    (() => {
      const hosts = [...(config.allowedDomains || [])];
      try {
        hosts.push(new URL(config.webViewUrl).hostname);
      } catch {
        // config.webViewUrl is expected to be a valid absolute URL; if it
        // somehow isn't, fall back to only the configured allowlist.
      }
      return hosts.map((h) => h.toLowerCase());
    })()
  );

  const isAllowedHost = (hostname) => {
    const host = hostname.toLowerCase();
    return allowedHostsRef.current.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  };

  const handleShouldStartLoadWithRequest = (request) => {
    let hostname;
    try {
      hostname = new URL(request.url).hostname;
    } catch {
      // Non-http(s) schemes (mailto:, tel:, intent:, etc.) — hand off to
      // the OS instead of letting the WebView try and fail to load them.
      Linking.openURL(request.url).catch(() => {});
      return false;
    }

    if (isAllowedHost(hostname)) return true;

    Linking.openURL(request.url).catch(() => {});
    return false;
  };

  useEffect(() => {
    // Handle deep links when app is opened from a link
    const handleDeepLink = (event) => {
      const url = event.url;
      if (url) {
        setCurrentUrl(url);
      }
    };

    // Get initial URL if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        setCurrentUrl(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent default behavior (exit app)
      }

      // No more WebView history — require a second back press to exit,
      // so a single accidental press doesn't kick the user out.
      if (exitPressedOnceRef.current) {
        return false; // let the default action (exit app) proceed
      }

      exitPressedOnceRef.current = true;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      setTimeout(() => {
        exitPressedOnceRef.current = false;
      }, 2000);
      return true; // swallow this press, wait for the confirming one
    });

    return () => backHandler.remove();
  }, []);

  // Chromium net-error codes (nativeEvent.code, Android) that mean "couldn't
  // reach the network at all" as opposed to a real page/server error — used
  // to tell "you're offline" apart from "this specific page is broken".
  const CONNECTIVITY_ERROR_CODES = new Set([
    -2, -6, -7, -21, -100, -101, -102, -105, -106, -109, -118,
  ]);

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('WebView error: ', nativeEvent);
    setError({
      offline: CONNECTIVITY_ERROR_CODES.has(nativeEvent.code),
      description: nativeEvent.description || 'Failed to load page',
    });
  };

  const handleRetry = () => {
    setError(null);
  };

  const handleLoadEnd = () => {
    if (refreshing) setRefreshing(false);
  };

  // Rendered as an overlay (below) rather than swapping it in as the whole
  // tree, so the WebView underneath stays mounted through a lock — losing
  // it here would nuke any in-progress page state (e.g. a mid-flow Google
  // login/2FA) and dump the user back at the start URL on unlock.
  const lockOverlay = locked && (
    <View style={styles.lockOverlay}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorIcon}>🔒</Text>
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>Locked</Text>
          <Text style={[styles.errorMessage, isDark && styles.errorMessageDark]}>
            Authenticate to continue.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={tryUnlock} disabled={checking}>
            <Text style={styles.retryButtonText}>{checking ? 'Checking…' : 'Unlock'}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    </View>
  );

  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.errorContainer, isDark && styles.errorContainerDark]}>
          <Text style={styles.errorIcon}>{error.offline ? '📡' : '⚠️'}</Text>
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            {error.offline ? "You're offline" : "Couldn't load this page"}
          </Text>
          <Text style={[styles.errorMessage, isDark && styles.errorMessageDark]}>
            {error.offline
              ? 'Check your internet connection and try again.'
              : error.description}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
        {lockOverlay}
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top']}>
        <StatusBar style="auto" />
        <View style={styles.webviewContainer} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.pullIndicator,
              {
                opacity: pullDistance.interpolate({
                  inputRange: [0, PULL_TRIGGER_THRESHOLD],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateY: pullDistance.interpolate({
                      inputRange: [0, PULL_MAX],
                      outputRange: [-40, 20],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <ActivityIndicator size="small" color="#666" animating={refreshing} />
          </Animated.View>

          <Animated.View
            style={[styles.webview, { transform: [{ translateY: pullDistance }] }]}
          >
            <WebView
              ref={webViewRef}
              source={{ uri: currentUrl }}
              onPermissionRequest={handleWebViewPermission}
              geolocationEnabled={true}
              style={styles.webview}
              onError={handleError}
              onLoadEnd={handleLoadEnd}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              onNavigationStateChange={(navState) => {
                canGoBackRef.current = navState.canGoBack;
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
              forceDarkOn={isDark}
              setBuiltInZoomControls={config.pinchZoomEnabled}
              setDisplayZoomControls={false}
              mixedContentMode="always"
              userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
            />
          </Animated.View>
        </View>

        {bottomNav.enabled && bottomNav.tabs.length > 0 && (
          <View style={[styles.bottomNav, isDark && styles.bottomNavDark]}>
            {bottomNav.tabs.map((tab, index) => {
              const active = index === activeTabIndex;
              return (
                <TouchableOpacity
                  key={`${tab.label}-${index}`}
                  style={styles.bottomNavTab}
                  onPress={() => handleTabPress(index, tab.url)}
                >
                  <Text
                    style={[
                      styles.bottomNavLabel,
                      isDark && styles.bottomNavLabelDark,
                      active && (isDark ? styles.bottomNavLabelActiveDark : styles.bottomNavLabelActive),
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </SafeAreaView>
      {lockOverlay}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#000',
  },
  webviewContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  pullIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorContainerDark: {
    backgroundColor: '#000',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorTextDark: {
    color: '#eee',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorMessageDark: {
    color: '#aaa',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  bottomNavDark: {
    borderTopColor: '#333',
    backgroundColor: '#111',
  },
  bottomNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  bottomNavLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  bottomNavLabelDark: {
    color: '#999',
  },
  bottomNavLabelActive: {
    color: '#222',
    fontWeight: '700',
  },
  bottomNavLabelActiveDark: {
    color: '#fff',
    fontWeight: '700',
  },
});
