/**
 * The device half of the results watch (src/features/exams/resultsWatch.ts).
 *
 * One polite HEAD per sheet the student's school publishes, compared with the
 * revision stored on the phone, then a local notification when it moved. No
 * account, no credential and no server of ours is involved: the check runs on
 * the device against the public PDF and the notification is scheduled locally,
 * so this keeps working for guests too (docs/NOTIFICATIONS.md, "New result PDF
 * posted for the user's programme").
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { kvStorage } from '../../lib/storage';
import { PUBLIC_RESULT_SHEETS } from './resultPortals';
import {
  RESULTS_WATCH_STORAGE_KEY,
  RESULTS_WATCH_PREFS_KEY,
  detectSheetChanges,
  nextWatchState,
  parseWatchState,
  resultAlertBody,
  resultAlertTitle,
  type ResultsWatchState,
  type SheetChange,
  type SheetFingerprint,
} from './resultsWatch';

export { RESULTS_WATCH_PREFS_KEY };

/** The Android channel that carries result alerts (docs/NOTIFICATIONS.md). */
export const RESULTS_CHANNEL_ID = 'results';

/** The channel's name as the student sees it in Android settings. */
export const RESULTS_CHANNEL_NAME = 'Results and exam notices';

let channelReady: Promise<void> | null = null;

/** Creates the results channel once per app run. */
export function ensureResultsChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(RESULTS_CHANNEL_ID, {
      name: RESULTS_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.DEFAULT,
    })
      .then(() => undefined)
      .catch(() => undefined);
  }
  return channelReady;
}

/**
 * The sheet's revision as the server reports it. A sheet that is not published
 * yet (404) or that answers without a `Last-Modified` comes back with a null
 * revision, and the comparison then deliberately reports "no change" rather
 * than inventing one.
 */
export async function fingerprintSheet(
  code: string,
  school: string,
  url: string,
): Promise<SheetFingerprint> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      return { code, school, url, lastModified: null, bytes: null };
    }
    const lastModified = response.headers.get('last-modified');
    const contentLength = response.headers.get('content-length');
    const bytes = contentLength ? Number(contentLength) : null;
    return {
      code,
      school,
      url,
      lastModified,
      bytes: Number.isFinite(bytes) ? bytes : null,
    };
  } catch {
    return { code, school, url, lastModified: null, bytes: null };
  }
}

export interface ResultsWatchResult {
  changes: SheetChange[];
  /** How many sheets were actually inspected. */
  checked: number;
  /** True when a notification permission let the alert through. */
  notified: boolean;
}

/**
 * Checks the sheets for one school and alerts on a moved revision.
 * Pass `notify: false` to only refresh the stored revision.
 */
export async function checkSchoolResults(
  school: string | undefined | null,
  options: { notify?: boolean } = {},
): Promise<ResultsWatchResult> {
  const wanted = (school ?? '').trim().toUpperCase();
  if (!wanted) return { changes: [], checked: 0, notified: false };

  const sheets = PUBLIC_RESULT_SHEETS.filter(
    (sheet) => sheet.school === wanted && !sheet.special,
  );
  if (sheets.length === 0) return { changes: [], checked: 0, notified: false };

  const fingerprints: SheetFingerprint[] = [];
  for (const sheet of sheets) {
    fingerprints.push(await fingerprintSheet(sheet.code, sheet.school, sheet.url));
  }

  const stored = parseWatchState(
    (await kvStorage.getAsync(RESULTS_WATCH_STORAGE_KEY)) ||
    (await AsyncStorage.getItem(RESULTS_WATCH_STORAGE_KEY).catch(() => null)),
  );
  const changes = detectSheetChanges(stored, fingerprints);
  const next: ResultsWatchState = nextWatchState(stored, fingerprints);
  const serialized = JSON.stringify(next);
  kvStorage.set(RESULTS_WATCH_STORAGE_KEY, serialized);
  await AsyncStorage.setItem(RESULTS_WATCH_STORAGE_KEY, serialized).catch(() => {});

  let notified = false;
  if (options.notify !== false && changes.length > 0) {
    notified = await notifyChanges(changes);
  }

  return { changes, checked: fingerprints.length, notified };
}

/**
 * Persists school watch preference into MMKV/AsyncStorage so watch state
 * survives app cold restart.
 */
export async function saveSchoolWatchPreference(
  school: string | undefined | null,
  enabled: boolean,
): Promise<void> {
  const normSchool = (school ?? '').trim().toUpperCase();
  let prefs: { enabled: boolean; schools: Record<string, boolean>; lastChecked?: string } = {
    enabled,
    schools: {},
  };
  try {
    const raw =
      (await kvStorage.getAsync(RESULTS_WATCH_PREFS_KEY)) ||
      (await AsyncStorage.getItem(RESULTS_WATCH_PREFS_KEY).catch(() => null));
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          prefs = {
            ...parsed,
            enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : enabled,
            schools: { ...(parsed.schools || {}) },
          };
        }
      } catch {
        // non-JSON fallback
      }
    }
  } catch {
    // ignore
  }

  prefs.enabled = enabled;
  if (normSchool) {
    prefs.schools[normSchool] = enabled;
  }
  const serialized = JSON.stringify(prefs);
  kvStorage.set(RESULTS_WATCH_PREFS_KEY, serialized);
  await AsyncStorage.setItem(RESULTS_WATCH_PREFS_KEY, serialized).catch(() => {});
}

/**
 * Reads persisted school watch preference from MMKV/AsyncStorage.
 */
export async function loadSchoolWatchPreference(
  school?: string | null,
): Promise<boolean> {
  const normSchool = (school ?? '').trim().toUpperCase();
  try {
    const raw =
      (await kvStorage.getAsync(RESULTS_WATCH_PREFS_KEY)) ||
      (await AsyncStorage.getItem(RESULTS_WATCH_PREFS_KEY).catch(() => null));
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'boolean') return parsed;
      if (typeof parsed === 'object' && parsed !== null) {
        if (normSchool && parsed.schools && typeof parsed.schools === 'object') {
          if (typeof parsed.schools[normSchool] === 'boolean') {
            return parsed.schools[normSchool];
          }
          return false;
        }
        if (typeof parsed.enabled === 'boolean') {
          return parsed.enabled;
        }
      }
    } catch {
      return raw === 'true';
    }
  } catch {
    return false;
  }
  return false;
}

let periodicTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Schedules a periodic check for school results.
 * Returns a teardown function that cancels the schedule.
 */
export function schedulePeriodicResultsCheck(
  school: string | undefined | null,
  intervalMs = 15 * 60 * 1000,
): () => void {
  stopPeriodicResultsCheck();
  const targetSchool = (school ?? '').trim().toUpperCase();
  if (!targetSchool) return () => {};

  periodicTimer = setInterval(() => {
    void checkSchoolResults(targetSchool, { notify: true });
  }, intervalMs);

  return () => {
    stopPeriodicResultsCheck();
  };
}

/**
 * Stops any currently running periodic results check.
 */
export function stopPeriodicResultsCheck(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
}

/**
 * Checks if a periodic results check is currently scheduled.
 */
export function isPeriodicResultsCheckScheduled(): boolean {
  return periodicTimer !== null;
}

/** Raises one local notification per changed sheet, if the phone allows it. */
async function notifyChanges(changes: SheetChange[]): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    await ensureResultsChannel();
    for (const change of changes) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: resultAlertTitle(change),
          body: resultAlertBody(change),
          data: { type: 'result-sheet', sheet: change.code, url: change.url },
        },
        trigger: null,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Storage key for batch result alerts toggle */
export const BATCH_WATCH_STORAGE_KEY = '@gbu_one_batch_result_watch';

/** Raises an instant local notification for a declared batch result */
export async function notifyBatchResultDeclared(item: {
  programme: string;
  semester?: string;
  title: string;
  fileUrl: string;
}): Promise<boolean> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;
    await ensureResultsChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'GBU One — Results Declared',
        body:
          item.title ||
          `Result declared for ${item.programme} (${item.semester ? `Sem ${item.semester}` : 'Latest'}). Tap to view.`,
        data: {
          type: 'batch_result',
          programme: item.programme,
          semester: item.semester,
          url: item.fileUrl,
        },
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}