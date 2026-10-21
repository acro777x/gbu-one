/**
 * GBU One - the class alarms the student has scheduled.
 *
 * The list is small and lives on the device, so it is kept in AsyncStorage
 * next to the rest of the student's preferences and read back on mount.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CLASS_REMINDERS_STORAGE_KEY,
  parseStoredReminders,
  type ClassReminder,
} from './notificationPreferences';

export interface UseNotificationPreferences {
  /** Every scheduled alarm. */
  reminders: ClassReminder[];
  /** True until the stored list has been read once. */
  isLoading: boolean;
  /** Schedules an alarm, replacing any alarm already set for the same slot. */
  addReminder: (reminder: ClassReminder) => Promise<void>;
  /** Removes the alarm for one slot. */
  removeReminder: (slotId: string) => Promise<void>;
  /** The alarms that fire on a given calendar day. */
  remindersForDay: (day: Date) => ClassReminder[];
  /** The alarm set for one slot, if any. */
  remindersForSlot: (slotId: string) => ClassReminder | undefined;
  /** Reads the stored list again. */
  reload: () => Promise<void>;
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readStoredReminders(): Promise<ClassReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(CLASS_REMINDERS_STORAGE_KEY);
    return parseStoredReminders(raw);
  } catch {
    return [];
  }
}

export function useNotificationPreferences(): UseNotificationPreferences {
  const [reminders, setReminders] = useState<ClassReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (next: ClassReminder[]) => {
    setReminders(next);
    try {
      await AsyncStorage.setItem(CLASS_REMINDERS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A failed write only means the alarm is not remembered next launch.
    }
  }, []);

  const reload = useCallback(async () => {
    const stored = await readStoredReminders();
    setReminders(stored);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await readStoredReminders();
      if (!active) return;
      setReminders(stored);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const addReminder = useCallback(
    async (reminder: ClassReminder) => {
      const stored = await readStoredReminders();
      const next = [...stored.filter((entry) => entry.slotId !== reminder.slotId), reminder];
      await persist(next);
    },
    [persist],
  );

  const removeReminder = useCallback(
    async (slotId: string) => {
      const stored = await readStoredReminders();
      await persist(stored.filter((entry) => entry.slotId !== slotId));
    },
    [persist],
  );

  const remindersForDay = useCallback(
    (day: Date): ClassReminder[] => {
      const wanted = dayKey(day);
      return reminders.filter((reminder) => {
        const fired = new Date(reminder.fireAt);
        if (Number.isNaN(fired.getTime())) return false;
        return dayKey(fired) === wanted;
      });
    },
    [reminders],
  );

  const remindersForSlot = useCallback(
    (slotId: string): ClassReminder | undefined =>
      reminders.find((reminder) => reminder.slotId === slotId),
    [reminders],
  );

  return useMemo(
    () => ({
      reminders,
      isLoading,
      addReminder,
      removeReminder,
      remindersForDay,
      remindersForSlot,
      reload,
    }),
    [
      reminders,
      isLoading,
      addReminder,
      removeReminder,
      remindersForDay,
      remindersForSlot,
      reload,
    ],
  );
}

export default useNotificationPreferences;
