/**
 * GBU One - the life cycle of the class alarms.
 *
 * Four jobs:
 *
 *  1. **Stop a stale alarm from ringing.** Android hands over an alarm whose
 *     time has already passed as soon as the app process is alive again, so a
 *     reminder left over from yesterday would ring the moment the student
 *     opens the app. On start the alarms that have gone by are cancelled and
 *     dropped from the stored list.
 *
 *  2. **Offer a snooze.** When the alarm rings while the app is closed, the
 *     app opens on a prompt that offers to push it back ten minutes. If the
 *     app was open, the same prompt appears over the app.
 *
 *  3. **Handle the shade buttons.** Snooze and Dismiss are answered from the
 *     notification itself, which the OS delivers to a background or killed
 *     app. The action is therefore read back on the next start with
 *     `getLastNotificationResponseAsync()` and routed through exactly the
 *     same handler the in-app prompt uses.
 *
 *  4. **Repeat the alarm.** A class meets every week, so the alarm is armed
 *     with a weekly trigger and the stored record is moved on to its next
 *     occurrence after every answer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  readStoredReminders,
  removeReminder,
  updateReminder,
  useNotificationPreferences,
} from './useNotificationPreferences';
import {
  cancelAlarmsThatHavePassed,
  cancelClassAlarmsForSlot,
  dismissNotification,
  getScheduledClassAlarmsForSlot,
  scheduleRepeatingClassAlarm,
  snoozeClassAlarm,
  SNOOZE_ACTION_ID,
  DISMISS_ACTION_ID,
  SNOOZE_MINUTES,
  CLASS_ALARM_DATA_TYPE,
  type ClassAlarmData,
} from './classAlarm';
import {
  RINGED_WINDOW_MINUTES,
  advanceRepeatingReminders,
  nextWeeklyFireAt,
  reminderBody,
  reminderState,
  reminderTitle,
  type ClassReminder,
} from './notificationPreferences';

export { RINGED_WINDOW_MINUTES };

export interface RingedAlarm {
  reminder: ClassReminder;
  subject: string;
  /**
   * True when the app saw the alarm arrive. False means only the clock says
   * the alarm was due - the student is told that honestly.
   */
  delivered: boolean;
}

/** An alarm whose time came and that nobody answered. */
export interface MissedAlarm {
  reminder: ClassReminder;
  subject: string;
}

export interface ClassAlarmLifecycle {
  /** The alarm that rang, if the student has not answered it yet. */
  ringedAlarm: RingedAlarm | null;
  /** The alarms that were due and were never answered. */
  missedAlarms: MissedAlarm[];
  /** The last thing that went wrong, e.g. a snooze that could not be armed. */
  error: string | null;
  /** Pushes the alarm back ten minutes. */
  snooze: () => Promise<void>;
  /** Clears the alarm. */
  dismiss: () => Promise<void>;
  /** Acknowledges a missed alarm; the weekly repeat carries on. */
  acknowledgeMissed: (slotId: string) => Promise<void>;
  /** Clears the error message. */
  clearError: () => void;
}

/** What an alarm action needs from the stored alarms. */
export interface AlarmActionStore {
  /** The stored alarm for a slot, if any. */
  getReminder: (slotId: string) => Promise<ClassReminder | undefined> | ClassReminder | undefined;
  /** Changes a stored alarm. */
  updateReminder: (slotId: string, patch: Partial<ClassReminder>) => Promise<void>;
  /** Removes a stored alarm. */
  removeReminder: (slotId: string) => Promise<void>;
}

/** The outcome of an alarm action. It never throws. */
export interface AlarmActionResult {
  ok: boolean;
  error?: string;
}

/**
 * The store the alarm actions work on. It is a module level object on
 * purpose: the functions it holds are stable, so the mount effect can run
 * once without re-handling the same notification response.
 */
const alarmStore: AlarmActionStore = {
  getReminder: async (slotId: string) => {
    const list = await readStoredReminders();
    return list.find((entry) => entry.slotId === slotId);
  },
  updateReminder,
  removeReminder,
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Pushes an alarm back ten minutes.
 *
 * The same handler answers the in-app prompt and the shade button, so the
 * two can never drift apart: the alarm is scheduled once, the stored record
 * is moved to the new time, and the alarm that just rang is taken out of
 * the shade. Nothing is stacked - the previous snooze is cancelled first.
 */
export async function handleSnoozeAction(
  data: ClassAlarmData,
  store: AlarmActionStore = alarmStore,
  now: Date = new Date(),
): Promise<AlarmActionResult> {
  const slotId = (data.slotId ?? '').trim();
  const reminder = slotId ? await store.getReminder(slotId) : undefined;

  const title =
    data.title?.trim() ||
    reminder?.title ||
    reminderTitle(data.subject || reminder?.subject || 'Your class', Number(data.leadMinutes ?? reminder?.leadMinutes ?? 0));
  const body =
    data.body?.trim() ||
    reminder?.body ||
    reminderBody(data.start || reminder?.start || '', undefined, Number(data.leadMinutes ?? reminder?.leadMinutes ?? 0));

  const fireAt = new Date(now.getTime() + SNOOZE_MINUTES * 60 * 1000);

  try {
    // The snooze that is already pending is cancelled first, so tapping
    // snooze twice does not leave two alarms behind.
    const pending = reminder?.notificationId;
    if (pending) {
      await cancelScheduledNotification(pending);
      await dismissNotification(pending);
    }

    const identifier = await snoozeClassAlarm({
      ...data,
      type: CLASS_ALARM_DATA_TYPE,
      slotId: slotId || (data.slotId ?? ''),
      subject: data.subject ?? reminder?.subject ?? '',
      start: data.start ?? reminder?.start ?? '',
      leadMinutes: data.leadMinutes ?? String(reminder?.leadMinutes ?? 0),
      title,
      body,
    });

    // The alarm that rang is taken out of the shade; its weekly repeat is
    // left alone, so the class still rings next week.
    const delivered = data.notificationId ?? reminder?.notificationId;
    if (delivered && delivered !== pending) {
      await dismissNotification(delivered);
    }

    if (slotId) {
      await store.updateReminder(slotId, {
        fireAt: fireAt.toISOString(),
        notificationId: identifier,
        firedAt: undefined,
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'The alarm could not be snoozed') };
  }
}

/**
 * Clears an alarm the student does not want.
 *
 * The stored record and the OS alarm are both removed *before* the prompt
 * is released, so the prompt cannot come straight back.
 */
export async function handleDismissAction(
  data: ClassAlarmData,
  store: AlarmActionStore = alarmStore,
): Promise<AlarmActionResult> {
  const slotId = (data.slotId ?? '').trim();
  const reminder = slotId ? await store.getReminder(slotId) : undefined;
  try {
    if (slotId) {
      await cancelClassAlarmsForSlot(slotId);
      await store.removeReminder(slotId);
    }
    const delivered = data.notificationId ?? reminder?.notificationId;
    if (delivered) await dismissNotification(delivered);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'The alarm could not be cleared') };
  }
}

/** Cancels one scheduled notification, ignoring a missing one. */
async function cancelScheduledNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // The alarm may already be gone; the stored record is what matters.
  }
}

/** Reads the response the OS delivered while the app was not running. */
export async function readLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}

/**
 * Routes a notification response to the right alarm action.
 *
 * The same function answers the live listener and the response the OS left
 * behind while the app was dead, so the two paths behave identically.
 */
export async function routeNotificationResponse(
  response: Notifications.NotificationResponse,
  store: AlarmActionStore = alarmStore,
  now: Date = new Date(),
): Promise<AlarmActionResult | null> {
  const action = response.actionIdentifier;
  if (action !== SNOOZE_ACTION_ID && action !== DISMISS_ACTION_ID) return null;

  const request = response.notification?.request;
  const raw = (request?.content?.data ?? {}) as ClassAlarmData & {
    notificationId?: string;
  };
  const data: ClassAlarmData & { notificationId?: string } = {
    ...raw,
    notificationId: request?.identifier ?? raw.notificationId,
  };

  if (action === SNOOZE_ACTION_ID) {
    return handleSnoozeAction(data, store, now);
  }
  return handleDismissAction(data, store);
}

/** A short key that identifies one notification response. */
function responseKey(response: Notifications.NotificationResponse): string {
  return `${response.actionIdentifier}:${response.notification?.request?.identifier ?? ''}`;
}

/**
 * Makes sure every stored alarm has an OS alarm that repeats.
 *
 * The timetable arms a single alarm for the next class; this replaces it
 * with a weekly one, so the alarm survives the whole semester.
 */
export async function ensureRepeatingAlarms(
  list: ClassReminder[],
  now: Date = new Date(),
): Promise<void> {
  for (const reminder of list) {
    if (!reminder.repeatsWeekly) continue;
    const scheduled = await getScheduledClassAlarmsForSlot(reminder.slotId);
    if (scheduled.some((alarm) => alarm.mode === 'weekly' && !alarm.snoozed)) {
      continue;
    }

    // The one-off alarm is replaced, but a pending snooze is left alone.
    for (const alarm of scheduled) {
      if (alarm.snoozed) continue;
      await cancelScheduledNotification(alarm.identifier);
    }

    const fireAt =
      nextWeeklyFireAt(reminder, now) ?? new Date(reminder.fireAt);
    const schedule = await scheduleRepeatingClassAlarm({
      title:
        reminder.title ||
        reminderTitle(reminder.subject, reminder.leadMinutes),
      body:
        reminder.body ||
        reminderBody(reminder.start, undefined, reminder.leadMinutes),
      fireAt,
      data: {
        slotId: reminder.slotId,
        subject: reminder.subject,
        start: reminder.start,
        leadMinutes: String(reminder.leadMinutes),
      },
    });
    await updateReminder(reminder.slotId, { notificationId: schedule.identifier });
  }
}

export function useClassAlarmLifecycle(): ClassAlarmLifecycle {
  const { reminders } = useNotificationPreferences();
  const [queue, setQueue] = useState<RingedAlarm[]>([]);
  const [missedAlarms, setMissedAlarms] = useState<MissedAlarm[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The queue is read from a ref inside the effect, so answering an alarm
  // never re-runs the effect that put it on screen.
  const queueRef = useRef<RingedAlarm[]>([]);
  const handledResponses = useRef<Set<string>>(new Set());

  const ringedAlarm = queue.length > 0 ? queue[0] : null;

  // Sweep the alarms that have gone by, notice the ones that rang, and move
  // the weekly alarms on to their next occurrence.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // The sweep runs even when nothing is stored: an alarm whose record
        // was lost would otherwise ring the moment the app opens.
        await cancelAlarmsThatHavePassed();

        const now = new Date();
        const ringing: RingedAlarm[] = [];
        const missed: MissedAlarm[] = [];
        for (const reminder of reminders) {
          const state = reminderState(reminder, now);
          if (state === 'ringing') {
            ringing.push({
              reminder,
              subject: reminder.subject || 'Your class',
              delivered: Boolean(reminder.firedAt),
            });
          } else if (state === 'missed') {
            missed.push({
              reminder,
              subject: reminder.subject || 'Your class',
            });
          }
        }

        if (cancelled) return;

        // Keep the alarms that are still on screen, add the new ones and
        // drop the ones the student has answered.
        const answering = new Set(queueRef.current.map((alarm) => alarm.reminder.slotId));
        setQueue((current) => {
          const merged = new Map<string, RingedAlarm>();
          for (const alarm of current) merged.set(alarm.reminder.slotId, alarm);
          for (const alarm of ringing) {
            if (!merged.has(alarm.reminder.slotId)) {
              merged.set(alarm.reminder.slotId, alarm);
            }
          }
          for (const slotId of Array.from(merged.keys())) {
            const record = reminders.find((entry) => entry.slotId === slotId);
            if (!record || reminderState(record, now) !== 'ringing') {
              merged.delete(slotId);
            }
          }
          return Array.from(merged.values());
        });

        setMissedAlarms((current) => {
          const known = new Set(current.map((alarm) => alarm.reminder.slotId));
          const next = [...current];
          for (const alarm of missed) {
            if (known.has(alarm.reminder.slotId)) continue;
            next.push(alarm);
          }
          return next;
        });

        // The alarms that are still on screen keep their time; the rest move
        // on to their next weekly occurrence.
        const toAdvance = reminders.filter(
          (reminder) => !answering.has(reminder.slotId),
        );
        const advanced = advanceRepeatingReminders(toAdvance, now);
        if (advanced !== toAdvance) {
          await advanceStored(toAdvance, advanced);
        }

        if (!cancelled) {
          await ensureRepeatingAlarms(reminders, now);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'The class alarms could not be checked'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reminders]);

  // Keep the ref in step with the state, for the effect above.
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // The alarm was delivered while the app was alive: remember that, so the
  // prompt can tell the student the alarm really rang.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const request = notification.request;
        const data = (request?.content?.data ?? {}) as ClassAlarmData;
        if (data.type !== CLASS_ALARM_DATA_TYPE) return;
        const slotId = (data.slotId ?? '').trim();
        if (!slotId) return;
        void updateReminder(slotId, {
          firedAt: new Date().toISOString(),
          notificationId: request.identifier,
          title: request.content.title ?? data.title,
          body: request.content.body ?? data.body,
        }).catch(() => undefined);
      },
    );
    return () => subscription.remove();
  }, []);

  // Answer the shade buttons while the app is running.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const key = responseKey(response);
        if (handledResponses.current.has(key)) return;
        handledResponses.current.add(key);
        void routeNotificationResponse(response, alarmStore)
          .then((result) => {
            if (result && !result.ok) setError(result.error ?? 'The alarm action failed');
          })
          .catch(() => undefined);
      },
    );
    return () => subscription.remove();
  }, []);

  // Answer the shade buttons that were pressed while the app was not
  // running: the OS left the response behind for us.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await readLastNotificationResponse();
      if (cancelled || !response) return;
      const key = responseKey(response);
      if (handledResponses.current.has(key)) return;
      handledResponses.current.add(key);
      const result = await routeNotificationResponse(response, alarmStore);
      if (!cancelled && result && !result.ok) {
        setError(result.error ?? 'The alarm action failed');
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const snooze = useCallback(async () => {
    const alarm = queueRef.current[0] ?? null;
    if (!alarm) return;
    const reminder = alarm.reminder;
    const result = await handleSnoozeAction(
      {
        slotId: reminder.slotId,
        subject: reminder.subject,
        start: reminder.start,
        leadMinutes: String(reminder.leadMinutes),
        title: reminder.title,
        body: reminder.body,
      },
      alarmStore,
    );
    if (!result.ok) {
      setError(result.error ?? 'The alarm could not be snoozed');
      return;
    }
    setQueue((current) =>
      current.filter((entry) => entry.reminder.slotId !== reminder.slotId),
    );
  }, []);

  const dismiss = useCallback(async () => {
    const alarm = queueRef.current[0] ?? null;
    if (!alarm) return;
    const reminder = alarm.reminder;
    const result = await handleDismissAction(
      {
        slotId: reminder.slotId,
        subject: reminder.subject,
        start: reminder.start,
        leadMinutes: String(reminder.leadMinutes),
        title: reminder.title,
        body: reminder.body,
      },
      alarmStore,
    );
    if (!result.ok) {
      setError(result.error ?? 'The alarm could not be cleared');
      return;
    }
    setQueue((current) =>
      current.filter((entry) => entry.reminder.slotId !== reminder.slotId),
    );
  }, []);

  const acknowledgeMissed = useCallback(async (slotId: string) => {
    setMissedAlarms((current) =>
      current.filter((entry) => entry.reminder.slotId !== slotId),
    );
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      ringedAlarm,
      missedAlarms,
      error,
      snooze,
      dismiss,
      acknowledgeMissed,
      clearError,
    }),
    [ringedAlarm, missedAlarms, error, snooze, dismiss, acknowledgeMissed, clearError],
  );
}

/**
 * Writes the advanced records back to the store.
 *
 * The advance is done outside the store so it can be tested on its own; the
 * store is only asked to swap the list it already holds.
 */
async function advanceStored(
  before: ClassReminder[],
  after: ClassReminder[],
): Promise<void> {
  for (const reminder of after) {
    const previous = before.find((entry) => entry.slotId === reminder.slotId);
    if (!previous || previous.fireAt === reminder.fireAt) continue;
    await updateReminder(reminder.slotId, {
      fireAt: reminder.fireAt,
      firedAt: undefined,
    });
  }
}

export default useClassAlarmLifecycle;
