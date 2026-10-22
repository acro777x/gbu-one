/**
 * GBU One - the class alarm.
 *
 * A class reminder is not a timetable change, so it gets its own Android
 * notification channel with its own sound. The sound is the alarm the owner
 * supplied (`assets/sounds/class_alarm.mp3`, 29 seconds), which the
 * `expo-notifications` config plugin copies into `res/raw/class_alarm.mp3`.
 *
 * The channel is created once per app run, so the phone keeps the student's
 * own channel settings - they can still silence it.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** The Android channel that carries class alarms. */
export const CLASS_REMINDER_CHANNEL_ID = 'class_reminders';

/** The raw resource name of the bundled alarm. */
export const CLASS_ALARM_SOUND = 'class_alarm';

/** The channel's name as the student sees it in Android settings. */
export const CLASS_REMINDER_CHANNEL_NAME = 'Class alarms';

/** The action the student taps to push the alarm back. */
export const SNOOZE_ACTION_ID = 'gbu.class.snooze';

/** How long a snooze pushes the alarm back. */
export const SNOOZE_MINUTES = 10;

/** The action that simply opens the app. */
export const OPEN_ACTION_ID = 'gbu.class.open';

let channelReady: Promise<void> | null = null;

/**
 * A vibration that runs for about half a minute, so the alarm is felt for
 * as long as it sounds.
 */
function longVibration(): number[] {
  const pattern: number[] = [];
  for (let cycle = 0; cycle < 10; cycle += 1) {
    pattern.push(0, 500, 300, 500);
  }
  return pattern;
}

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
        vibrationPattern: longVibration(),
        lightColor: '#C2410C',
        sound: CLASS_ALARM_SOUND,
      },
    )
      .then(() => undefined)
      .catch(() => {
        // A device that refuses the custom sound still gets the channel, so
        // the alarm is delivered with the system sound rather than not at all.
        channelReady = Notifications.setNotificationChannelAsync(
          CLASS_REMINDER_CHANNEL_ID,
          {
            name: CLASS_REMINDER_CHANNEL_NAME,
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: longVibration(),
            lightColor: '#C2410C',
          },
        )
          .then(() => undefined)
          .catch(() => undefined);
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
 * Schedules a class alarm on the class-alarm channel, with a snooze button
 * and an open button. Returns the notification identifier so the caller can
 * cancel it later.
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

/** The data a snoozed alarm carries, so it can be scheduled again. */
export interface ClassAlarmData {
  type?: string;
  slotId?: string;
  subject?: string;
  start?: string;
  leadMinutes?: string;
  /** The title and body, kept so a snooze can rebuild the notification. */
  title?: string;
  body?: string;
}

/** Schedules the same alarm again, ten minutes later. */
export async function snoozeClassAlarm(data: ClassAlarmData): Promise<string | null> {
  const fireAt = new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000);
  return scheduleClassAlarm({
    title: data.title ?? 'Class reminder',
    body: data.body ?? 'The class is starting soon.',
    fireAt,
    data: {
      type: 'class-reminder',
      slotId: data.slotId ?? '',
      subject: data.subject ?? '',
      start: data.start ?? '',
      leadMinutes: data.leadMinutes ?? '',
      snoozed: 'true',
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

/**
 * Cancels the alarms whose time has already passed.
 *
 * Android delivers an alarm whose trigger has gone by as soon as the app
 * process is alive again, so a reminder left over from yesterday would ring
 * the moment the student opens the app. Sweeping them on start is what stops
 * that.
 */
export async function cancelAlarmsThatHavePassed(): Promise<string[]> {
  const now = Date.now();
  const cleared: string[] = [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      const trigger = notification.trigger as { date?: Date | number } | undefined;
      const date = trigger?.date;
      const when = date instanceof Date ? date.getTime() : Number(date);
      if (!when || Number.isNaN(when)) continue;
      if (when > now) continue;
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      cleared.push(notification.identifier);
    }
  } catch {
    // The OS may not report scheduled notifications; nothing to clear then.
  }
  return cleared;
}

/** Removes a notification that has already been shown, from the shade. */
export async function dismissNotification(identifier: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(identifier);
  } catch {
    // Nothing to dismiss.
  }
}
