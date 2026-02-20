import { config } from '../config';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationsService {
  private _token: string | null = null;

  get isEnabled(): boolean {
    return config.features.pushNotifications;
  }

  // ─── REGISTER FOR PUSH ────────────────────────────────────────
  async register(): Promise<string | null> {
    if (!this.isEnabled) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses app.json expo.extra.eas.projectId
    });
    this._token = tokenData.data;

    // Register with backend
    if (config.mode === 'managed') {
      await fetch(`${config.appforgeApiUrl}/sdk/${config.appId}/notifications/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this._token, platform: Platform.OS }),
      });
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return this._token;
  }

  // ─── LOCAL NOTIFICATION ───────────────────────────────────────
  async scheduleLocal(title: string, body: string, trigger?: Notifications.NotificationTriggerInput): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: trigger || null,
    });
  }

  // ─── SCHEDULE REMINDER ────────────────────────────────────────
  async scheduleReminder(title: string, body: string, date: Date): Promise<string> {
    return this.scheduleLocal(title, body, { type: Notifications.SchedulableTriggerInputTypes.DATE, date });
  }

  // ─── CANCEL ALL ───────────────────────────────────────────────
  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // ─── LISTENERS ────────────────────────────────────────────────
  onNotification(callback: (notification: Notifications.Notification) => void): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  onNotificationResponse(callback: (response: Notifications.NotificationResponse) => void): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

export const notifications = new NotificationsService();
