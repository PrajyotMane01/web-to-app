import messaging from '@react-native-firebase/messaging';
import { useEffect, useState } from 'react';

function getUrlFromMessage(remoteMessage) {
  return remoteMessage?.data?.url || null;
}

export function useNotifications() {
  const [notificationUrl, setNotificationUrl] = useState(null);

  useEffect(() => {
    messaging().requestPermission().catch(() => {});

    messaging()
      .getToken()
      .then((token) => console.log('[FCM] Token:', token))
      .catch(() => {});

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
