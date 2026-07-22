import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { useEffect, useState } from 'react';

function getUrlFromMessage(remoteMessage) {
  return remoteMessage?.data?.url || null;
}

async function requestPermission() {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }
  } else {
    await messaging().requestPermission();
  }
}

export function useNotifications() {
  const [notificationUrl, setNotificationUrl] = useState(null);

  useEffect(() => {
    requestPermission()
      .then(() => console.log('[FCM] Notification permission requested'))
      .catch((err) => console.log('[FCM] requestPermission failed:', err?.message || err));

    // Every install joins one broadcast topic — the dashboard sends pushes
    // to this topic directly via the FCM v1 API, so there's no per-device
    // token registry to keep in sync.
    messaging()
      .subscribeToTopic('all')
      .then(() => console.log('[FCM] Subscribed to topic: all'))
      .catch((err) => console.log('[FCM] subscribeToTopic failed:', err?.message || err));

    messaging()
      .getToken()
      .then((token) => console.log('[FCM] Token:', token))
      .catch((err) => console.log('[FCM] getToken failed:', err?.message || err));

    // App in background → user tapped notification
    const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      const url = getUrlFromMessage(remoteMessage);
      if (url) setNotificationUrl(url);
    });

    // App quit → user tapped notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          const url = getUrlFromMessage(remoteMessage);
          if (url) setNotificationUrl(url);
        }
      });

    // Foreground: do nothing (option B)
    const unsubscribeForeground = messaging().onMessage(() => {});

    return () => {
      unsubscribeOpened();
      unsubscribeForeground();
    };
  }, []);

  return { notificationUrl };
}
