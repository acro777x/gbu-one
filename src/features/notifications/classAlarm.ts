/**
 * GBU One - the class alarm.
 *
 * A class reminder is not a timetable change, so it gets its own Android
 * notification channel with its own chime. The channel is created once with
 * the bundled sound (`assets/sounds/class_alarm.wav`, copied into
 * `res/raw/class_alarm.wav` by the `expo-notifications` config plugin) and
 * reused afterwards, so the phone keeps the student's own channel settings
 * (they can still silence it).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** The Android channel that carries class alarms. */
export const CLASS_REMINDER_CHANNEL_ID = 'class_reminders';

/** The raw resource name of the bundled chime. */
export const CLASS_ALARM_SOUND = 'class_alarm';

/** The channel's name as the student sees it in Android settings. */
export const CLASS_REMINDER_CHANNEL_NAME = 'Class alarms';

let channelReady: Promise<void> | null = null;

/**
 * Creates the class-alarm channel once per app run. The promise is cached so
 * a second call does not hit the platform again.
 */
export function ensureClassReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(
      CLASS_REMINDER_CHANNEL_ID,
      {
        name: CLASS_REMINDER_CHANNEL_NAME,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 250, 400],
        lightColor: '#C2410C',
        sound: CLASS_ALARM_SOUND,
      },
    ).then(() => undefined).catch(() => {
      // A device that refuses the custom sound still gets the channel, so the
      // alarm is delivered with the system sound rather than not at all.
      channelReady = Notifications.setNotificationChannelAsync(
        CLASS_REMINDER_CHANNEL_ID,
        {
          name: CLASS_REMINDER_CHANNEL_NAME,
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 400, 250, 400],
          lightColor: '#C2410C',
        },
      ).then(() => undefined).catch(() => undefined);
    });
  }
  return channelReady;
}

export interface ClassAlarmRequest {
  title: string;
  body: string;
  /** When the alarm should ring. */
  fireAt: Date;
  /** Extra data carried with the notification, used to open the class. */
  data?: Record<string, string>;
}

/**
 * Schedules a class alarm on the class-alarm channel. Returns the
 * notification identifier so the caller can cancel it later.
 */
export async function scheduleClassAlarm(
  request: ClassAlarmRequest,
): Promise<string> {
  await ensureClassReminderChannel();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: request.title,
      body: request.body,
      data: request.data ?? {},
      sound: CLASS_ALARM_SOUND,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: request.fireAt,
      channelId: CLASS_REMINDER_CHANNEL_ID,
    },
  });
}

/** Cancels every scheduled notification that carries the given slot id. */
export async function cancelClassAlarmsForSlot(slotId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled.filter((notification) => {
      const data = notification.content.data as Record<string, unknown> | undefined;
      const stored = data?.slotId;
      return typeof stored === 'string' && stored === slotId;
    });
    await Promise.all(
      targets.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
    );
  } catch {
    // The OS may not report scheduled notifications; the stored list stands.
  }
}
