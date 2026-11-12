/**
 * The life cycle of the class alarms.
 *
 * These tests cover the promises the app makes to the student:
 *
 *  1. Tapping "Dismiss" in the notification shade really dismisses the
 *     alarm - the stored record goes and the prompt does not come back.
 *  2. The answer the student gave while the app was dead is picked up on
 *     the next start.
 *  3. A class alarm repeats: it is armed again for the following week.
 *  4. A snooze moves the alarm instead of stacking a second one.
 *  5. The title and the body survive a round trip through storage.
 *  6. The sweep that clears stale alarms only touches class alarms.
 *  7. No client file reads a service-role credential.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  CLASS_ALARM_DATA_TYPE,
  CLASS_REMINDER_CHANNEL_ID,
  DISMISS_ACTION_ID,
  SNOOZE_ACTION_ID,
  cancelAlarmsThatHavePassed,
  ensureClassReminderChannel,
  getClassAlarmChannelStatus,
} from '../src/features/notifications/classAlarm';
import {
  ensureRepeatingAlarms,
  handleDismissAction,
  handleSnoozeAction,
  readLastNotificationResponse,
  routeNotificationResponse,
  type AlarmActionStore,
} from '../src/features/notifications/useClassAlarmLifecycle';
import {
  nextWeeklyFireAt,
  parseStoredReminders,
  reminderState,
  type ClassReminder,
} from '../src/features/notifications/notificationPreferences';
import {
  __resetNotificationPreferencesStore,
  addReminder,
  readStoredReminders,
} from '../src/features/notifications/useNotificationPreferences';

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications> & {
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  dismissNotificationAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
};

const NOW = new Date('2026-11-09T09:00:00.000Z');

function makeReminder(overrides: Partial<ClassReminder> = {}): ClassReminder {
  return {
    leadMinutes: 30,
    slotId: 'mock-BCS-II B-1-1',
    subject: 'Data Structures',
    start: '08:30',
    fireAt: '2026-11-09T08:00:00.000Z',
    channelId: CLASS_REMINDER_CHANNEL_ID,
    title: 'Data Structures starts in 30 minutes',
    body: 'The class starts in 30 minutes - 08:30',
    repeatsWeekly: true,
    weekday: 0,
    fireTime: '08:00',
    ...overrides,
  };
}

/** A store that keeps the records in memory, so a test can inspect them. */
function makeStore(records: ClassReminder[]): {
  list: ClassReminder[];
  store: AlarmActionStore;
} {
  const list = [...records];
  return {
    list,
    store: {
      getReminder: async (slotId: string) => list.find((entry) => entry.slotId === slotId),
      updateReminder: async (slotId: string, patch: Partial<ClassReminder>) => {
        const index = list.findIndex((entry) => entry.slotId === slotId);
        if (index >= 0) list[index] = { ...list[index], ...patch };
      },
      removeReminder: async (slotId: string) => {
        const index = list.findIndex((entry) => entry.slotId === slotId);
        if (index >= 0) list.splice(index, 1);
      },
    },
  };
}

function shadeResponse(actionIdentifier: string, data: Record<string, string>) {
  return {
    actionIdentifier,
    notification: {
      request: {
        identifier: 'os-notification-1',
        content: { data, title: 'Class alarm', body: 'The class starts soon.' },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetNotificationPreferencesStore();
  mockedNotifications.scheduleNotificationAsync.mockReset();
  mockedNotifications.scheduleNotificationAsync.mockResolvedValue('os-notification-new');
  mockedNotifications.cancelScheduledNotificationAsync.mockReset();
  mockedNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  mockedNotifications.dismissNotificationAsync.mockReset();
  mockedNotifications.dismissNotificationAsync.mockResolvedValue(undefined);
  mockedNotifications.getAllScheduledNotificationsAsync.mockReset();
  mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  mockedNotifications.getLastNotificationResponseAsync.mockReset();
  mockedNotifications.getLastNotificationResponseAsync.mockResolvedValue(null);
  mockedNotifications.setNotificationChannelAsync.mockReset();
  mockedNotifications.setNotificationChannelAsync.mockResolvedValue(undefined);
});

describe('dismissing an alarm from the notification shade', () => {
  it('removes the stored reminder so the prompt cannot come back', async () => {
    const { list, store } = makeStore([makeReminder({ fireAt: '2026-11-09T08:59:00.000Z' })]);

    const response = shadeResponse(DISMISS_ACTION_ID, {
      type: CLASS_ALARM_DATA_TYPE,
      slotId: 'mock-BCS-II B-1-1',
      subject: 'Data Structures',
    });

    const result = await routeNotificationResponse(response, store);

    expect(result?.ok).toBe(true);
    // The record is gone, so there is nothing left that could ring.
    expect(list).toHaveLength(0);
    expect(list.some((entry) => reminderState(entry, NOW) === 'ringing')).toBe(false);
  });

  it('takes the notification out of the shade as well', async () => {
    const { store } = makeStore([makeReminder()]);

    await routeNotificationResponse(
      shadeResponse(DISMISS_ACTION_ID, {
        type: CLASS_ALARM_DATA_TYPE,
        slotId: 'mock-BCS-II B-1-1',
      }),
      store,
    );

    expect(mockedNotifications.dismissNotificationAsync).toHaveBeenCalledWith(
      'os-notification-1',
    );
  });

  it('cancels the OS alarms of that slot', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'os-alarm-1',
        content: { data: { type: CLASS_ALARM_DATA_TYPE, slotId: 'mock-BCS-II B-1-1' } },
        trigger: { type: 'date', date: new Date(NOW.getTime() + 60_000) },
      },
    ]);
    const { store } = makeStore([makeReminder()]);

    await routeNotificationResponse(
      shadeResponse(DISMISS_ACTION_ID, {
        type: CLASS_ALARM_DATA_TYPE,
        slotId: 'mock-BCS-II B-1-1',
      }),
      store,
    );

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'os-alarm-1',
    );
  });

  it('never re-opens the prompt: the record is gone before the prompt is', async () => {
    const { list, store } = makeStore([makeReminder({ fireAt: '2026-11-09T08:59:00.000Z' })]);

    await handleDismissAction(
      {
        type: CLASS_ALARM_DATA_TYPE,
        slotId: 'mock-BCS-II B-1-1',
      },
      store,
    );

    // The "just rang" matcher looks at the STORED list. With the record
    // removed there is nothing to match, so the prompt cannot come back.
    expect(list).toHaveLength(0);
  });
});

describe('the answer the student gave while the app was dead', () => {
  it('is read back on the next start', async () => {
    const response = shadeResponse(SNOOZE_ACTION_ID, {
      type: CLASS_ALARM_DATA_TYPE,
      slotId: 'mock-BCS-II B-1-1',
    });
    mockedNotifications.getLastNotificationResponseAsync.mockResolvedValue(response);

    const last = await readLastNotificationResponse();

    expect(last).toBe(response);
    expect(mockedNotifications.getLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('is routed through the same handler as the live listener', async () => {
    const { list, store } = makeStore([makeReminder()]);
    const response = shadeResponse(SNOOZE_ACTION_ID, {
      type: CLASS_ALARM_DATA_TYPE,
      slotId: 'mock-BCS-II B-1-1',
    });

    const result = await routeNotificationResponse(response, store);

    expect(result?.ok).toBe(true);
    // The same effect as a snooze pressed inside the app: the record is
    // kept and its time is moved.
    expect(list).toHaveLength(1);
  });

  it('is ignored when it is not an alarm action', async () => {
    const response = shadeResponse('gbu.something.else', {
      type: CLASS_ALARM_DATA_TYPE,
      slotId: 'mock-BCS-II B-1-1',
    });
    expect(await routeNotificationResponse(response)).toBeNull();
  });
});

describe('a class alarm repeats every week', () => {
  it('is armed again with a weekly trigger', async () => {
    const reminder = makeReminder({
      weekday: 1, // Monday
      fireTime: '08:00',
      fireAt: '2026-11-09T08:00:00.000Z',
    });

    const report = await ensureRepeatingAlarms([reminder], NOW);

    expect(report.armed).toEqual(['mock-BCS-II B-1-1']);
    expect(report.skipped).toEqual([]);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.trigger.type).toBe(Notifications.SchedulableTriggerInputTypes.WEEKLY);
    // expo counts the week from 1 = Sunday, so a Monday is 2.
    expect(call.trigger.weekday).toBe(2);
    expect(call.trigger.hour).toBe(8);
    expect(call.trigger.minute).toBe(0);
  });

  it('knows the following week even after the alarm of this week has passed', () => {
    const reminder = makeReminder({
      weekday: 1,
      fireTime: '08:00',
      fireAt: '2026-11-09T08:00:00.000Z',
    });

    const next = nextWeeklyFireAt(reminder, NOW);
    expect(next).not.toBeNull();
    const following = new Date(next!.getTime());
    following.setDate(following.getDate() + 7);
    // The next occurrence is the same wall-clock time seven days later.
    expect(following.getDay()).toBe(reminder.weekday);
    expect(following.getHours()).toBe(8);
    expect(following.getMinutes()).toBe(0);
    expect(next!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('does not arm a second alarm when a weekly one is already there', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'os-weekly',
        content: { data: { type: CLASS_ALARM_DATA_TYPE, slotId: 'mock-BCS-II B-1-1' } },
        trigger: { type: 'weekly' },
      },
    ]);

    const report = await ensureRepeatingAlarms([makeReminder()], NOW);

    expect(report.armed).toEqual([]);
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports an alarm it could not arm instead of failing silently', async () => {
    mockedNotifications.scheduleNotificationAsync.mockRejectedValue(new Error('no channel'));

    const report = await ensureRepeatingAlarms([makeReminder()], NOW);

    expect(report.armed).toEqual([]);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0].slotId).toBe('mock-BCS-II B-1-1');
    expect(report.skipped[0].reason).toContain('no channel');
  });
});

describe('snoozing an alarm', () => {
  it('moves the stored alarm instead of stacking a second one', async () => {
    const { list, store } = makeStore([
      makeReminder({ notificationId: 'os-notification-old' }),
    ]);

    const result = await handleSnoozeAction(
      {
        type: CLASS_ALARM_DATA_TYPE,
        slotId: 'mock-BCS-II B-1-1',
        subject: 'Data Structures',
        start: '08:30',
        leadMinutes: '30',
        title: 'Data Structures starts in 30 minutes',
        body: 'The class starts in 30 minutes - 08:30',
      },
      store,
      NOW,
    );

    expect(result.ok).toBe(true);
    // ONE new alarm, not two.
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    // The previous alarm is cancelled, so the two cannot both ring.
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'os-notification-old',
    );
    // The record is kept and moved to the new time.
    expect(list).toHaveLength(1);
    expect(list[0].fireAt).toBe(new Date(NOW.getTime() + 10 * 60 * 1000).toISOString());
    expect(list[0].notificationId).toBe('os-notification-new');
  });

  it('keeps the title and the body of the alarm it rebuilds', async () => {
    const { list, store } = makeStore([makeReminder()]);

    await handleSnoozeAction(
      {
        type: CLASS_ALARM_DATA_TYPE,
        slotId: 'mock-BCS-II B-1-1',
        subject: 'Data Structures',
        start: '08:30',
        leadMinutes: '30',
      },
      store,
      NOW,
    );

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.title).toBe('Data Structures starts in 30 minutes');
    expect(call.content.body).toBe('The class starts in 30 minutes - 08:30');
    expect(call.content.data.title).toBe('Data Structures starts in 30 minutes');
    expect(call.content.data.body).toBe('The class starts in 30 minutes - 08:30');
    expect(list[0].title).toBe('Data Structures starts in 30 minutes');
  });

  it('reports a failure instead of throwing', async () => {
    mockedNotifications.scheduleNotificationAsync.mockRejectedValue(new Error('refused'));
    const { store } = makeStore([makeReminder()]);

    const result = await handleSnoozeAction(
      { type: CLASS_ALARM_DATA_TYPE, slotId: 'mock-BCS-II B-1-1' },
      store,
      NOW,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('refused');
  });
});

describe('the stored alarm', () => {
  it('keeps its title and its body through a round trip', async () => {
    const reminder = makeReminder();
    await addReminder(reminder);

    const stored = await readStoredReminders();

    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Data Structures starts in 30 minutes');
    expect(stored[0].body).toBe('The class starts in 30 minutes - 08:30');
    expect(stored[0].slotId).toBe('mock-BCS-II B-1-1');
  });

  it('reads a record that carries a title and a body', () => {
    const raw = JSON.stringify([
      {
        leadMinutes: 30,
        slotId: 'mock-BCS-II B-1-1',
        subject: 'Data Structures',
        start: '08:30',
        fireAt: '2026-11-09T08:00:00.000Z',
        channelId: CLASS_REMINDER_CHANNEL_ID,
        title: 'A title',
        body: 'A body',
      },
    ]);

    const parsed = parseStoredReminders(raw);
    expect(parsed[0].title).toBe('A title');
    expect(parsed[0].body).toBe('A body');
  });

  it('drops a record whose fire time cannot be read', () => {
    const raw = JSON.stringify([
      {
        leadMinutes: 30,
        slotId: 'broken',
        subject: 'Data Structures',
        start: '08:30',
        fireAt: 'not-a-date',
        channelId: CLASS_REMINDER_CHANNEL_ID,
      },
    ]);
    expect(parseStoredReminders(raw)).toEqual([]);
  });
});

describe('the stale alarm sweep', () => {
  it('only cancels this app\'s class alarms', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'class-1',
        content: { data: { type: CLASS_ALARM_DATA_TYPE, slotId: 'a' } },
        trigger: { type: 'date', date: new Date(NOW.getTime() - 1000) },
      },
      {
        identifier: 'test-1',
        content: { data: { type: 'test-alarm' } },
        trigger: { type: 'date', date: new Date(NOW.getTime() - 1000) },
      },
      {
        identifier: 'notice-1',
        content: { data: { type: 'timetable_change' } },
        trigger: { type: 'date', date: new Date(NOW.getTime() - 1000) },
      },
    ]);

    const cleared = await cancelAlarmsThatHavePassed();

    expect(cleared).toEqual(['class-1']);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'class-1',
    );
  });

  it('leaves an alarm that is still to come alone', async () => {
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'class-1',
        content: { data: { type: CLASS_ALARM_DATA_TYPE, slotId: 'a' } },
        trigger: { type: 'date', date: new Date(Date.now() + 60_000) },
      },
    ]);

    expect(await cancelAlarmsThatHavePassed()).toEqual([]);
    expect(mockedNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('the alarm channel', () => {
  it('reports the channel that was really created', async () => {
    const status = await ensureClassReminderChannel();
    expect(status.ok).toBe(true);
    expect(status.hasSound).toBe(true);
    expect(status.variant).toBe('primary');
    expect(getClassAlarmChannelStatus()?.channelId).toBe(status.channelId);
  });

  it('falls back to a second channel, with the sound, when the first fails', async () => {
    /*
     * The channel is created once per module instance, so this test needs a
     * fresh one. The mocks are taken from the SAME registry, otherwise the
     * module under test would be talking to a different mock.
     */
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const notifications = require('expo-notifications');
    notifications.setNotificationChannelAsync
      .mockRejectedValueOnce(new Error('channel refused'))
      .mockResolvedValueOnce(undefined);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const classAlarm = require('../src/features/notifications/classAlarm');

    const status = await classAlarm.ensureClassReminderChannel();

    expect(status.variant).toBe('fallback');
    expect(status.hasSound).toBe(true);
    expect(status.channelId).not.toBe(CLASS_REMINDER_CHANNEL_ID);
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
  });
});

describe('the client bundle', () => {
  it('reads no service-role credential', () => {
    const root = join(__dirname, '..');

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.git', 'dist', 'apk', '.expo'].includes(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(name)) out.push(full);
      }
      return out;
    };

    const forbidden = [
      /process\.env\.EXPO_PUBLIC_ADMIN_SERVICE_ROLE_KEY/,
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
      /process\.env\.EXPO_PUBLIC_ADMIN_PIN/,
      /process\.env\.EXPO_PUBLIC_ADMIN_PASSWORD/,
      /process\.env\.EXPO_PUBLIC_ADMIN_EMAIL/,
    ];

    const offenders: string[] = [];
    for (const file of [...walk(join(root, 'src')), ...walk(join(root, 'app'))]) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) {
          offenders.push(`${relative(root, file).replace(/\\/g, '/')} ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
