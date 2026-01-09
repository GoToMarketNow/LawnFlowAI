import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { analytics } from '../analytics';

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }
  return true; // Android doesn't require explicit permission pre-13
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}

export function setupListeners() {
  // Foreground message handler
  messaging().onMessage(async (remoteMessage) => {
    console.log('Foreground notification:', remoteMessage);
    analytics.track('notification_received_foreground', {
      id: remoteMessage.messageId,
      type: remoteMessage.data?.type,
    });
  });

  // Background/quit notification tapped
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened app:', remoteMessage);
    analytics.track('notification_opened', {
      id: remoteMessage.messageId,
      deepLink: remoteMessage.data?.deepLink,
    });
  });

  // App opened from notification (killed state)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('App opened from notification (quit):', remoteMessage);
        analytics.track('notification_opened_from_quit', {
          id: remoteMessage.messageId,
          deepLink: remoteMessage.data?.deepLink,
        });
      }
    });
}
