import {Platform} from 'react-native';
import notifee, {AndroidImportance, AuthorizationStatus} from '@notifee/react-native';

const HRMS_ALERTS_CHANNEL = 'hrms-alerts';

export const initializeNotifications = async () => {
  try {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: HRMS_ALERTS_CHANNEL,
        name: 'HRMS Alerts',
        importance: AndroidImportance.HIGH,
      });
    }
  } catch (error) {
    console.log('Notification init failed', error);
  }
};

export const requestNotificationPermission = async () => {
  try {
    const settings = await notifee.requestPermission();
    return (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.log('Notification permission failed', error);
    return false;
  }
};

export const showLocalNotification = async (title: string, body: string) => {
  try {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: HRMS_ALERTS_CHANNEL,
        smallIcon: 'ic_launcher',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (error) {
    console.log('Notification display failed', error);
  }
};
