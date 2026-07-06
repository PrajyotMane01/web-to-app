import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import * as Linking from 'expo-linking';
import { config } from './config';
import { useNotifications } from './notifications';
import { handleCameraRequest } from './camera';
import { handleMicrophoneRequest } from './microphone';
import { handleLocationRequest } from './location';

export default function App() {
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(config.webViewUrl);
  const webViewRef = useRef(null);
  const { notificationUrl } = useNotifications();

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

  const webViewUrl = config.webViewUrl;

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
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Prevent default behavior (exit app)
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('WebView error: ', nativeEvent);
    setError(nativeEvent.description || 'Failed to load page');
  };

  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading page:</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorUrl}>{webViewUrl}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="auto" />
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          onPermissionRequest={handleWebViewPermission}
          geolocationEnabled={true}
          style={styles.webview}
          onError={handleError}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          mixedContentMode="always"
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorUrl: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
