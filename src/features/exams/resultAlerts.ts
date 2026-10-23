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
import { PUBLIC_RESULT_SHEETS } from './resultPortals';
import {
  RESULTS_WATCH_STORAGE_KEY,
  detectSheetChanges,
  nextWatchState,
  parseWatchState,
  resultAlertBody,
  resultAlertTitle,
  type ResultsWatchState,
  type SheetChange,
  type SheetFingerprint,
} from './resultsWatch';

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
    await AsyncStorage.getItem(RESULTS_WATCH_STORAGE_KEY).catch(() => null),
  );
  const changes = detectSheetChanges(stored, fingerprints);
  const next: ResultsWatchState = nextWatchState(stored, fingerprints);
  await AsyncStorage.setItem(RESULTS_WATCH_STORAGE_KEY, JSON.stringify(next)).catch(() => {});

  let notified = false;
  if (options.notify !== false && changes.length > 0) {
    notified = await notifyChanges(changes);
  }

  return { changes, checked: fingerprints.length, notified };
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