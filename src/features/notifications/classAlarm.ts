/**
 * GBU One - the class alarm.
 *
 * A class reminder is not a timetable change, so it gets its own Android
 * notification channel with its own sound. The sound is the alarm the owner
 * supplied (`assets/sounds/class_alarm.mp3`, 29 seconds), which the
 * `expo-notifications` config plugin copies into `res/raw/class_alarm.mp3`.
 *
 * The channel is created once per app run, so the phone keeps the student's
 * own channel settings - they can still silence it. Because an Android
 * channel cannot be changed after it exists, a channel that fails to carry
 * the sound is replaced by a second, differently named channel that does,
 * rather than leaving the student with a silent alarm.
 *
 * A class alarm repeats every week: the same class meets every week, so the
 * alarm is armed with a weekly trigger and the stored record keeps the
 * weekday and the wall-clock time it rings at.
 */
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

/** The Android channel that carries class alarms. */
export const CLASS_REMINDER_CHANNEL_ID = 'class_reminders';

/**
 * The second channel, used when the first one cannot be created with the
 * university alarm sound. Android channels are immutable, so a silent
 * channel can only be escaped by using a new id.
 */
export const CLASS_REMINDER_FALLBACK_CHANNEL_ID = 'class_reminders_fallback';

/** The raw resource name of the bundled alarm. */
export const CLASS_ALARM_SOUND = 'class_alarm';

/** The channel's name as the student sees it in Android settings. */
export const CLASS_REMINDER_CHANNEL_NAME = 'Class alarms';

/** The fallback channel's name as the student sees it in Android settings. */
export const CLASS_REMINDER_FALLBACK_CHANNEL_NAME = 'Class alarms (backup)';

/** The action the student taps to push the alarm back. */
export const SNOOZE_ACTION_ID = 'gbu.class.snooze';

/** How long a snooze pushes the alarm back. */
export const SNOOZE_MINUTES = 10;

/**
 * The action that opened the app from a class alarm.
 *
 * @deprecated The "Open Class" button was removed from the notification: no
 * route in the app opens one specific class, so the button only ever opened
 * the default route. Tapping the notification itself still opens the app.
 */
export const OPEN_ACTION_ID = 'gbu.class.open';

/** The action the student taps to dismiss the alarm from notification shade. */
export const DISMISS_ACTION_ID = 'gbu.class.dismiss';

/** The category identifier that binds interactive snooze/dismiss action buttons to the alarm notification. */
export const CLASS_ALARM_CATEGORY = 'gbu.class.alarm.category';

/** The `data.type` every class alarm carries, so it can be told apart. */
export const CLASS_ALARM_DATA_TYPE = 'class-reminder';

/**
 * How the alarm channel ended up.
 *
 * `primary`  - the normal channel, with the university sound.
 * `fallback` - the backup channel, also with the university sound.
 * `silent`   - no channel could be created; the alarm will be silent.
 */
export type ClassChannelVariant = 'primary' | 'fallback' | 'silent';

export interface ClassChannelStatus {
  /** The channel the alarm must be posted to. */
  channelId: string;
  /** The name of that channel, as the student sees it. */
  channelName: string;
  /** Which channel it is. */
  variant: ClassChannelVariant;
  /** True when the channel plays the university alarm sound. */
  hasSound: boolean;
  /** True when a channel was created (or already existed). */
  ok: boolean;
  /** Why it failed, when it did. */
  error?: string;
}

/**
 * Whether Android still allows this app to schedule exact alarms.
 *
 * `expo-notifications` 0.29 has no `canScheduleExactAlarmsAsync`, so the
 * capability is probed defensively: `granted`, `denied`, or `unknown` when
 * the running version cannot answer.
 */
export type ExactAlarmCapability = 'granted' | 'denied' | 'unknown';

let channelPromise: Promise<ClassChannelStatus> | null = null;
let activeChannelId: string = CLASS_REMINDER_CHANNEL_ID;

/** The channel the alarms are posted to right now. */
export function getClassAlarmChannelId(): string {
  return activeChannelId;
}

/**
 * A vibration that runs for about half a minute (the length of the
 * university alarm sound), so the alarm is felt for as long as it sounds.
 *
 * The pattern is read as wait, vibrate, wait, vibrate - one cycle is
 * 1300 ms, and 22 cycles make 28.6 seconds.
 */
export function longVibration(): number[] {
  const pattern: number[] = [];
  for (let cycle = 0; cycle < 22; cycle += 1) {
    pattern.push(0, 500, 300, 500);
  }
  return pattern;
}

/**
 * Creates the class-alarm channel once per app run and reports honestly
 * which channel ended up carrying the alarm.
 */
export function ensureClassReminderChannel(): Promise<ClassChannelStatus> {
  if (Platform.OS !== 'android') {
    return Promise.resolve({
      channelId: CLASS_REMINDER_CHANNEL_ID,
      channelName: CLASS_REMINDER_CHANNEL_NAME,
      variant: 'primary',
      hasSound: true,
      ok: true,
    });
  }
  if (!channelPromise) {
    channelPromise = (async () => {
      try {
        await Notifications.setNotificationCategoryAsync(CLASS_ALARM_CATEGORY, [
          {
            identifier: SNOOZE_ACTION_ID,
            buttonTitle: 'Snooze (+10m)',
            options: {
              opensAppToForeground: false,
            },
          },
          {
            identifier: DISMISS_ACTION_ID,
            buttonTitle: 'Dismiss',
            options: {
              isDestructive: true,
              opensAppToForeground: false,
            },
          },
        ]);
      } catch {
        // Platform or emulator without category support continues cleanly
      }

      try {
        await Notifications.setNotificationChannelAsync(
          CLASS_REMINDER_CHANNEL_ID,
          {
            name: CLASS_REMINDER_CHANNEL_NAME,
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: longVibration(),
            lightColor: '#C2410C',
            sound: CLASS_ALARM_SOUND,
            enableVibrate: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          },
        );
        activeChannelId = CLASS_REMINDER_CHANNEL_ID;
        return {
          channelId: CLASS_REMINDER_CHANNEL_ID,
          channelName: CLASS_REMINDER_CHANNEL_NAME,
          variant: 'primary',
          hasSound: true,
          ok: true,
        };
      } catch (primaryError) {
        // The first channel failed. It may already exist as a silent channel
        // (Android channels cannot be changed), so a second channel with the
        // sound is created instead of leaving the student with silence.
        try {
          await Notifications.setNotificationChannelAsync(
            CLASS_REMINDER_FALLBACK_CHANNEL_ID,
            {
              name: CLASS_REMINDER_FALLBACK_CHANNEL_NAME,
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: longVibration(),
              lightColor: '#C2410C',
              sound: CLASS_ALARM_SOUND,
              enableVibrate: true,
              showBadge: true,
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            },
          );
          activeChannelId = CLASS_REMINDER_FALLBACK_CHANNEL_ID;
          return {
            channelId: CLASS_REMINDER_FALLBACK_CHANNEL_ID,
            channelName: CLASS_REMINDER_FALLBACK_CHANNEL_NAME,
            variant: 'fallback',
            hasSound: true,
            ok: true,
            error:
              primaryError instanceof Error
                ? primaryError.message
                : 'The primary alarm channel could not be created',
          };
        } catch (fallbackError) {
          activeChannelId = CLASS_REMINDER_CHANNEL_ID;
          return {
            channelId: CLASS_REMINDER_CHANNEL_ID,
            channelName: CLASS_REMINDER_CHANNEL_NAME,
            variant: 'silent',
            hasSound: false,
            ok: false,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : 'No alarm channel could be created',
          };
        }
      }
    })();
  }
  return channelPromise;
}

/**
 * Whether the OS still lets the app schedule exact alarms.
 *
 * On Android 12+ the permission can be revoked by the student, and on
 * Android 14 it is not granted to apps that are not alarm clocks, so an
 * alarm can silently degrade into an inexact one.
 */
export async function getExactAlarmCapability(): Promise<ExactAlarmCapability> {
  if (Platform.OS !== 'android') return 'granted';
  const probe = (
    Notifications as unknown as {
      canScheduleExactAlarmsAsync?: () => Promise<boolean>;
    }
  ).canScheduleExactAlarmsAsync;
  if (typeof probe !== 'function') return 'unknown';
  try {
    return (await probe()) ? 'granted' : 'denied';
  } catch {
    return 'unknown';
  }
}

/**
 * Opens the app's page in the system settings.
 *
 * React Native has no API for the "Alarms & reminders" screen, so the app
 * settings page is opened and the student is told which screen to pick.
 */
export async function openAlarmSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
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
 * The payload every class alarm carries.
 *
 * The title and the body travel with the notification, so a snooze can
 * rebuild exactly the same alarm instead of a generic "Class reminder".
 */
export function buildClassAlarmData(
  request: ClassAlarmRequest,
): Record<string, string> {
  return {
    ...(request.data ?? {}),
    type: CLASS_ALARM_DATA_TYPE,
    title: request.title,
    body: request.body,
    fireAt: request.fireAt.toISOString(),
  };
}

/**
 * Schedules a class alarm on the class-alarm channel, with a snooze button
 * and a dismiss button. Returns the notification identifier so the caller can
 * cancel it later.
 */
export async function scheduleClassAlarm(
  request: ClassAlarmRequest,
): Promise<string> {
  const channel = await ensureClassReminderChannel();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: request.title,
      body: request.body,
      data: buildClassAlarmData(request),
      sound: CLASS_ALARM_SOUND,
      categoryIdentifier: CLASS_ALARM_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: request.fireAt,
      channelId: channel.channelId,
    },
  });
}

/** How an alarm is repeated by the OS. */
export type ClassAlarmMode = 'weekly' | 'once';

export interface ClassAlarmSchedule {
  /** The OS notification identifier. */
  identifier: string;
  /** `weekly` when the OS repeats the alarm by itself, `once` otherwise. */
  mode: ClassAlarmMode;
  /** The channel the alarm was posted to. */
  channelId: string;
}

/**
 * Schedules an alarm that repeats every week at the same wall-clock time.
 *
 * The weekly trigger is what makes a class alarm survive the semester: the
 * OS fires it every week without the app having to run. When the running
 * Android version refuses the weekly trigger, the alarm falls back to a
 * single alarm, which the app re-arms on every start.
 */
export async function scheduleRepeatingClassAlarm(
  request: ClassAlarmRequest,
): Promise<ClassAlarmSchedule> {
  const channel = await ensureClassReminderChannel();
  const content = {
    title: request.title,
    body: request.body,
    data: buildClassAlarmData(request),
    sound: CLASS_ALARM_SOUND,
    categoryIdentifier: CLASS_ALARM_CATEGORY,
  };

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        // expo counts the week from 1 = Sunday; JavaScript from 0 = Sunday.
        weekday: request.fireAt.getDay() + 1,
        hour: request.fireAt.getHours(),
        minute: request.fireAt.getMinutes(),
        channelId: channel.channelId,
      },
    });
    return { identifier, mode: 'weekly', channelId: channel.channelId };
  } catch {
    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.fireAt,
        channelId: channel.channelId,
      },
    });
    return { identifier, mode: 'once', channelId: channel.channelId };
  }
}

/** Schedules an immediate test alarm for testing sound and banner (defaults to 5 seconds). */
export async function scheduleTestAlarm(secondsFromNow = 5): Promise<string> {
  const channel = await ensureClassReminderChannel();
  const content = {
    title: 'GBU One Class Alarm Test',
    body: 'Your class reminder is ringing with the official GBU alarm sound!',
    data: { type: 'test-alarm' },
    sound: CLASS_ALARM_SOUND,
    categoryIdentifier: CLASS_ALARM_CATEGORY,
    priority: Notifications.AndroidNotificationPriority.MAX,
  };
  if (secondsFromNow <= 0) {
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        channelId: channel.channelId,
      },
    });
  }
  const fireAt = new Date(Date.now() + secondsFromNow * 1000);
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: channel.channelId,
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
  /** The moment the alarm was due, kept so a snooze can be re-armed. */
  fireAt?: string;
  /** True when the alarm is a snooze of an earlier alarm. */
  snoozed?: string;
  /** The OS notification identifier. */
  notificationId?: string;
}

/** Schedules the same alarm again, ten minutes later. */
export async function snoozeClassAlarm(data: ClassAlarmData): Promise<string> {
  const fireAt = new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000);
  return scheduleClassAlarm({
    title: data.title ?? 'Class reminder',
    body: data.body ?? 'The class is starting soon.',
    fireAt,
    data: {
      type: CLASS_ALARM_DATA_TYPE,
      slotId: data.slotId ?? '',
      subject: data.subject ?? '',
      start: data.start ?? '',
      leadMinutes: data.leadMinutes ?? '',
      snoozed: 'true',
    },
  });
}

/** One alarm the OS still has scheduled. */
export interface ScheduledClassAlarm {
  identifier: string;
  /** 'weekly' when the OS repeats it by itself. */
  mode: ClassAlarmMode;
  /** True when the alarm is a snooze rather than the class alarm itself. */
  snoozed: boolean;
}

function alarmDataOf(
  notification: { content?: { data?: Record<string, unknown> } },
): Record<string, unknown> {
  return (notification.content?.data ?? {}) as Record<string, unknown>;
}

/** True when the notification is one of this app's class alarms. */
export function isClassAlarmNotification(notification: {
  content?: { data?: Record<string, unknown> };
}): boolean {
  const data = alarmDataOf(notification);
  return data.type === CLASS_ALARM_DATA_TYPE;
}

function triggerModeOf(trigger: unknown): ClassAlarmMode {
  const type = (trigger as { type?: string } | undefined)?.type;
  return type === 'weekly' ? 'weekly' : 'once';
}

/** The alarms the OS still has scheduled for one slot. */
export async function getScheduledClassAlarmsForSlot(
  slotId: string,
): Promise<ScheduledClassAlarm[]> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled
      .filter((notification) => {
        const data = alarmDataOf(notification);
        const stored = data.slotId;
        return typeof stored === 'string' && stored === slotId;
      })
      .map((notification) => {
        const data = alarmDataOf(notification);
        return {
          identifier: notification.identifier,
          mode: triggerModeOf(notification.trigger),
          snoozed: data.snoozed === 'true',
        };
      });
  } catch {
    return [];
  }
}

/** Cancels every scheduled notification that carries the given slot id. */
export async function cancelClassAlarmsForSlot(slotId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled.filter((notification) => {
      const data = alarmDataOf(notification);
      const stored = data.slotId;
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
 * Cancels the class alarms whose time has already passed.
 *
 * Android delivers an alarm whose trigger has gone by as soon as the app
 * process is alive again, so a reminder left over from yesterday would ring
 * the moment the student opens the app. Sweeping them on start is what stops
 * that.
 *
 * Only this app's class alarms are touched: a pending test alarm, or any
 * other feature's notification, is none of this sweep's business.
 */
export async function cancelAlarmsThatHavePassed(): Promise<string[]> {
  const now = Date.now();
  const cleared: string[] = [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (!isClassAlarmNotification(notification)) continue;
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
