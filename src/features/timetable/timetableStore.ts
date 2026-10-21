/**
 * GBU One - Centralized Timetable Store & Caching Layer
 * Implements in-flight request deduplication, single provider singleton,
 * 6-hour AsyncStorage caching per Section 6.1, and change detection that
 * marks the slots the university actually changed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SamayTimetableProvider,
  Timetable,
  ClassRef,
  TimetableDiffItem,
  applyDiffsToTimetable,
  computeTimetableDiff,
} from './timetableProvider';
import { readCachedTimetable, writeCachedTimetable } from '../../lib/db';

// Single shared provider instance for the entire application
export const sharedTimetableProvider = new SamayTimetableProvider();

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const KEY = (section: string, sem: string) => `@gbu_one_tt_${sem}_${section.trim().toUpperCase()}`;
const CHANGES_KEY = (section: string, sem: string) =>
  `@gbu_one_tt_changes_${sem}_${section.trim().toUpperCase()}`;

const inflight = new Map<string, Promise<Timetable>>();
const changesCache = new Map<string, TimetableDiffItem[]>();
let cachedClassesList: ClassRef[] | null = null;

/** The last class list the university published, kept for offline use. */
const CLASSES_KEY = '@gbu_one_class_list';

/**
 * The changes the university published for a class since the last snapshot.
 * These are what make the "Changed" chips and the change banner real.
 */
export async function getTimetableChanges(
  section: string,
  sem = '39',
): Promise<TimetableDiffItem[]> {
  const key = CHANGES_KEY(section, sem);
  const memo = changesCache.get(key);
  if (memo) return memo;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TimetableDiffItem[];
    if (!Array.isArray(parsed)) return [];
    changesCache.set(key, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeTimetableChanges(
  section: string,
  sem: string,
  diffs: TimetableDiffItem[],
): Promise<void> {
  const key = CHANGES_KEY(section, sem);
  changesCache.set(key, diffs);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(diffs));
  } catch {
    // Change history is a convenience; the timetable still renders without it.
  }
}

/**
 * Compares the freshly fetched timetable with the cached snapshot.
 * The first snapshot of a class never reports changes, and mock data is
 * never compared against live data (see computeTimetableDiff).
 */
function diffAgainstSnapshot(cached: Timetable | null, fresh: Timetable): TimetableDiffItem[] {
  if (!cached || !Array.isArray(cached.slots) || cached.slots.length === 0) return [];
  return computeTimetableDiff(cached, fresh);
}

export async function getSectionTimetable(
  section: string,
  sem = '39',
  forceRefresh = false,
): Promise<Timetable> {
  const normSection = section.trim().toUpperCase();
  const k = `${sem}|${normSection}`;

  if (!forceRefresh && inflight.has(k)) {
    return inflight.get(k)!;
  }

  const p = (async () => {
    // 1. SQLite cache first (instant, survives restarts, works offline).
    //    It is also the snapshot the fresh timetable is compared against, so
    //    it is read even when the caller forces a refresh.
    let cached: Timetable | null = null;
    let cachedAt = 0;

    const sqliteHit = readCachedTimetable(normSection, sem);
    if (sqliteHit && Array.isArray(sqliteHit.slots)) {
      cached = sqliteHit;
      cachedAt = new Date(sqliteHit.fetchedAt).getTime();
    }
    try {
      const raw = await AsyncStorage.getItem(KEY(normSection, sem));
      if (raw) {
        const { at, data } = JSON.parse(raw) as { at: number; data: Timetable };
        if (data && Array.isArray(data.slots) && (!cached || at > cachedAt)) {
          cached = data;
          cachedAt = at;
        }
      }
    } catch {
      // Ignore cache read failures and proceed to fetch
    }

    if (
      !forceRefresh &&
      cached &&
      Number.isFinite(cachedAt) &&
      Date.now() - cachedAt < TTL_MS
    ) {
      const changes = await getTimetableChanges(normSection, sem);
      return applyDiffsToTimetable(cached, changes);
    }

    // 2. Fetch fresh timetable (live -> mock fallback inside provider)
    const fresh = await sharedTimetableProvider.getTimetable(normSection, sem);

    // 3. Compare with the cached snapshot so "Changed" markers are real
    const changes = diffAgainstSnapshot(cached, fresh);
    await writeTimetableChanges(normSection, sem, changes);

    // 4. Persist the clean live timetable (change markers are not cached)
    if (fresh.slots.length > 0) {
      writeCachedTimetable(normSection, sem, fresh);
      try {
        await AsyncStorage.setItem(
          KEY(normSection, sem),
          JSON.stringify({ at: Date.now(), data: fresh }),
        );
      } catch {
        // Cache write errors ignored
      }
    }

    return applyDiffsToTimetable(fresh, changes);
  })().finally(() => {
    inflight.delete(k);
  });

  inflight.set(k, p);
  return p;
}

/**
 * The classes the university currently runs.
 *
 * The list is what the class picker is built from, so it has to be the live
 * one: the university adds and removes sections between sessions. It is also
 * written to storage, so the picker still works when the network does not.
 */
export async function getAvailableClassesList(
  forceRefresh = false,
): Promise<ClassRef[]> {
  if (!forceRefresh && cachedClassesList && cachedClassesList.length > 0) {
    return cachedClassesList;
  }
  const classes = await sharedTimetableProvider.listClasses();
  cachedClassesList = classes;
  if (classes.length > 0) {
    try {
      await AsyncStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
    } catch {
      // The saved list is a convenience; the live list is already in hand.
    }
  }
  return classes;
}

/**
 * The last class list that was fetched, without touching the network.
 * Empty when the app has never reached the university.
 */
export async function getCachedClassesList(): Promise<ClassRef[]> {
  try {
    const raw = await AsyncStorage.getItem(CLASSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClassRef[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) => entry && typeof entry.section === 'string' && entry.section.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export default getSectionTimetable;
