/**
 * GBU One - the life cycle of the class alarms.
 *
 * Three jobs:
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
 *  3. **Handle the snooze button**, for the devices and versions where the
 *     notification itself carries the action.
 */
import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useNotificationPreferences } from './useNotificationPreferences';
import {
  cancelAlarmsThatHavePassed,
  scheduleClassAlarm,
  snoozeClassAlarm,
  SNOOZE_ACTION_ID,
  DISMISS_ACTION_ID,
  type ClassAlarmData,
} from './classAlarm';
import type { ClassReminder } from './notificationPreferences';

/** How long after the alarm a snooze is still offered. */
const RINGED_WINDOW_MINUTES = 30;

export interface RingedAlarm {
  reminder: ClassReminder;
  subject: string;
}

export interface ClassAlarmLifecycle {
  /** The alarm that rang, if the student has not answered it yet. */
  ringedAlarm: RingedAlarm | null;
  /** Pushes the alarm back ten minutes. */
  snooze: () => Promise<void>;
  /** Clears the alarm. */
  dismiss: () => Promise<void>;
}

export function useClassAlarmLifecycle(): ClassAlarmLifecycle {
  const { reminders, removeReminder, reload } = useNotificationPreferences();
  const [ringedAlarm, setRingedAlarm] = useState<RingedAlarm | null>(null);

  // Sweep the alarms that have gone by, and notice the one that rang.
  useEffect(() => {
    if (reminders.length === 0) return;
    const now = Date.now();
    const window = RINGED_WINDOW_MINUTES * 60 * 1000;

    const stale = reminders.filter((reminder) => {
      const fireAt = new Date(reminder.fireAt).getTime();
      return Number.isNaN(fireAt) || fireAt <= now - window;
    });
    const justRang = reminders.filter((reminder) => {
      const fireAt = new Date(reminder.fireAt).getTime();
      return fireAt <= now && fireAt > now - window;
    });

    let active = true;
    void (async () => {
      if (stale.length > 0) {
        await cancelAlarmsThatHavePassed();
        for (const reminder of stale) {
          await removeReminder(reminder.slotId);
        }
        if (active) await reload();
      }
      if (active && justRang.length > 0 && !ringedAlarm) {
        setRingedAlarm({
          reminder: justRang[0],
          subject: justRang[0].subject || 'Your class',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [reminders, removeReminder, reload, ringedAlarm]);

  // Action buttons on the notification (Snooze and Dismiss)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const action = response.actionIdentifier;
        if (action === SNOOZE_ACTION_ID) {
          const data = (response.notification.request.content.data ?? {}) as ClassAlarmData;
          void snoozeClassAlarm(data);
          setRingedAlarm(null);
        } else if (action === DISMISS_ACTION_ID) {
          setRingedAlarm(null);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  const snooze = useCallback(async () => {
    const alarm = ringedAlarm;
    if (!alarm) return;
    const reminder = alarm.reminder;
    const fireAt = new Date(Date.now() + 10 * 60 * 1000);
    await scheduleClassAlarm({
      title: reminder.title || `${reminder.subject} starts soon`,
      body: reminder.body ?? 'Snoozed for ten minutes.',
      fireAt,
      data: {
        type: 'class-reminder',
        slotId: reminder.slotId,
        subject: reminder.subject,
        start: reminder.start,
        leadMinutes: String(reminder.leadMinutes),
        title: reminder.title ?? reminder.subject,
        body: reminder.body ?? reminder.subject,
        snoozed: 'true',
      },
    });
    await removeReminder(reminder.slotId);
    setRingedAlarm(null);
  }, [ringedAlarm, removeReminder]);

  const dismiss = useCallback(async () => {
    const alarm = ringedAlarm;
    if (!alarm) return;
    await removeReminder(alarm.reminder.slotId);
    setRingedAlarm(null);
  }, [ringedAlarm, removeReminder]);

  return { ringedAlarm, snooze, dismiss };
}

export default useClassAlarmLifecycle;
