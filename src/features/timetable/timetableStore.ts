/**
 * GBU One — Centralized Timetable Store & Caching Layer
 * Implements in-flight request deduplication, single provider singleton,
 * and 6-hour AsyncStorage caching per Section 6.1.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SamayTimetableProvider, Timetable, ClassRef } from './timetableProvider';
import { readCachedTimetable, writeCachedTimetable } from '../../lib/db';

// Single shared provider instance for the entire application
export const sharedTimetableProvider = new SamayTimetableProvider();

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const KEY = (section: string, sem: string) => `@gbu_one_tt_${sem}_${section.trim().toUpperCase()}`;

const inflight = new Map<string, Promise<Timetable>>();
let cachedClassesList: ClassRef[] | null = null;

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
    // 1. SQLite cache first (instant, survives restarts, works offline)
    if (!forceRefresh) {
      const sqliteHit = readCachedTimetable(normSection, sem);
      if (sqliteHit && Array.isArray(sqliteHit.slots)) {
        const age = Date.now() - new Date(sqliteHit.fetchedAt).getTime();
        if (Number.isFinite(age) && age < TTL_MS) return sqliteHit;
      }
      try {
        const raw = await AsyncStorage.getItem(KEY(normSection, sem));
        if (raw) {
          const { at, data } = JSON.parse(raw) as { at: number; data: Timetable };
          if (Date.now() - at < TTL_MS && data && Array.isArray(data.slots)) {
            writeCachedTimetable(normSection, sem, data);
            return data;
          }
        }
      } catch {
        // Ignore cache read failures and proceed to fetch
      }
    }

    // 2. Fetch fresh timetable (live -> mock fallback inside provider)
    const fresh = await sharedTimetableProvider.getTimetable(normSection, sem);

    // 3. Persist live timetable data
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

    return fresh;
  })().finally(() => {
    inflight.delete(k);
  });

  inflight.set(k, p);
  return p;
}

export async function getAvailableClassesList(): Promise<ClassRef[]> {
  if (cachedClassesList && cachedClassesList.length > 0) {
    return cachedClassesList;
  }
  const classes = await sharedTimetableProvider.listClasses();
  cachedClassesList = classes;
  return classes;
}

export default getSectionTimetable;
