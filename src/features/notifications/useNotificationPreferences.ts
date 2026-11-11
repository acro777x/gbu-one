/**
 * GBU One - the class alarms the student has scheduled.
 *
 * The list is small and lives on the device, so it is kept in AsyncStorage
 * next to the rest of the student's preferences and read back on mount.
 *
 * The list is a *single shared store*. Two independent copies of it used to
 * exist - one in the root layout and one on the timetable screen - so a
 * dismissal in one place left the other showing "Alarm on" until the app was
 * reloaded. Every consumer now reads the same array through
 * `useSyncExternalStore`, and every write goes through one queue, so two
 * screens writing at the same time cannot lose a record.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CLASS_REMINDERS_STORAGE_KEY,
  advanceRepeatingReminders,
  parseStoredReminders,
  withRepeatMetadata,
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
  /** Changes the fields of one stored alarm, e.g. after a snooze. */
  updateReminder: (slotId: string, patch: Partial<ClassReminder>) => Promise<void>;
  /** The alarms that fire on a given calendar day. */
  remindersForDay: (day: Date) => ClassReminder[];
  /** The alarm set for one slot, if any. */
  remindersForSlot: (slotId: string) => ClassReminder | undefined;
  /** Reads the stored list again. */
  reload: () => Promise<void>;
}

/**
 * The store itself. It lives at module level so every hook instance sees
 * the same list, and it is written to AsyncStorage through a single queue so
 * a read-modify-write cannot overwrite a record another screen just added.
 */
type Listener = () => void;

let reminders: ClassReminder[] = [];
let isLoading = true;
const listeners = new Set<Listener>();
let loadPromise: Promise<void> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function emit(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others.
    }
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ClassReminder[] {
  return reminders;
}

function getLoadingSnapshot(): boolean {
  return isLoading;
}

/** Runs one write at a time, in the order the writes were requested. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Replaces the shared list and writes it to the device. */
async function write(next: ClassReminder[]): Promise<void> {
  reminders = next;
  emit();
  try {
    await AsyncStorage.setItem(CLASS_REMINDERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A failed write only means the alarm is not remembered next launch.
  }
}

async function loadFromStorage(): Promise<void> {
  const stored = await readStoredReminders();
  reminders = stored;
  isLoading = false;
  emit();
}

/** Reads the list once; every later caller waits for the same read. */
function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = enqueue(loadFromStorage);
  }
  return loadPromise;
}

/**
 * Clears the shared store. Only useful in tests, where every test file needs
 * a clean slate.
 */
export function __resetNotificationPreferencesStore(): void {
  reminders = [];
  isLoading = true;
  loadPromise = null;
  writeQueue = Promise.resolve();
  listeners.clear();
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function readStoredReminders(): Promise<ClassReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(CLASS_REMINDERS_STORAGE_KEY);
    return parseStoredReminders(raw);
  } catch {
    return [];
  }
}

/** Schedules an alarm, replacing any alarm already set for the same slot. */
export function addReminder(reminder: ClassReminder): Promise<void> {
  return ensureLoaded().then(() =>
    enqueue(async () => {
      const stored = await readStoredReminders();
      const enriched = withRepeatMetadata(reminder);
      const next = [...stored.filter((entry) => entry.slotId !== enriched.slotId), enriched];
      await write(next);
    }),
  );
}

/** Removes the alarm for one slot. */
export function removeReminder(slotId: string): Promise<void> {
  return ensureLoaded().then(() =>
    enqueue(async () => {
      const stored = await readStoredReminders();
      await write(stored.filter((entry) => entry.slotId !== slotId));
    }),
  );
}

/** Changes the fields of one stored alarm, e.g. after a snooze. */
export function updateReminder(
  slotId: string,
  patch: Partial<ClassReminder>,
): Promise<void> {
  return ensureLoaded().then(() =>
    enqueue(async () => {
      const stored = await readStoredReminders();
      const next = stored.map((entry) =>
        entry.slotId === slotId ? { ...entry, ...patch } : entry,
      );
      await write(next);
    }),
  );
}

/** Removes the alarm for one slot (kept for callers outside React). */
export function removeStoredReminder(slotId: string): Promise<void> {
  return removeReminder(slotId);
}

/** Removes every stored alarm (kept for callers outside React). */
export function clearAllStoredReminders(): Promise<void> {
  return ensureLoaded().then(() =>
    enqueue(async () => {
      try {
        await AsyncStorage.removeItem(CLASS_REMINDERS_STORAGE_KEY);
      } catch {
        // ignore
      }
      await write([]);
    }),
  );
}

/**
 * Moves every weekly alarm whose time has come on to its next occurrence.
 * Returns the list as it now stands.
 */
export function advanceStoredReminders(now: Date): Promise<ClassReminder[]> {
  return ensureLoaded().then(() =>
    enqueue(async () => {
      const stored = await readStoredReminders();
      const next = advanceRepeatingReminders(stored, now);
      if (next !== stored) await write(next);
      return next;
    }),
  );
}

/** Reads the stored list again. */
export function reload(): Promise<void> {
  return ensureLoaded().then(() =>
    enqueue(async () => {
      await loadFromStorage();
    }),
  );
}

export function useNotificationPreferences(): UseNotificationPreferences {
  const reminders = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isLoading = useSyncExternalStore(
    subscribe,
    getLoadingSnapshot,
    getLoadingSnapshot,
  );

  useEffect(() => {
    void ensureLoaded();
  }, []);

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
      updateReminder,
      remindersForDay,
      remindersForSlot,
      reload,
    }),
    [reminders, isLoading, remindersForDay, remindersForSlot],
  );
}

export default useNotificationPreferences;
