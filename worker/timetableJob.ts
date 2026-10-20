/**
 * GBU One — Timetable Polling & Diff Worker Job
 * Polling via https://mygbu.in/schd/api.php?schd=39 & 40
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

import {
  Timetable,
  TimetableDiffItem,
  computeTimetableDiff,
  RawGBUTimetableItem,
  Slot,
  GBU_PERIOD_TIMES,
} from '../src/features/timetable/timetableProvider';
import { WORKER_CONFIG } from './sources.config';
import { fetchWithTlsTolerance } from './noticesJob';

export interface TimetableChangeRecord {
  id: string;
  classKey: string;
  semesterSessionId: string;
  diffCount: number;
  diffs: TimetableDiffItem[];
  notificationMessage: string;
  detectedAt: string;
}

export interface TimetableWorkerResult {
  sessionIds: string[];
  totalClassesScanned: number;
  changedClassesCount: number;
  changes: TimetableChangeRecord[];
  timestamp: string;
}

/**
 * Normalises raw timetable items into a canonical Timetable object for a section
 */
export function buildTimetableFromRawItems(
  classKey: string,
  rawItems: RawGBUTimetableItem[],
  semesterSessionId: string,
): Timetable {
  const filtered = rawItems.filter(
    (item) => item.SectionName && item.SectionName.trim().toUpperCase() === classKey.trim().toUpperCase(),
  );

  const slots: Slot[] = filtered.map((item) => {
    const periodNum = parseInt(item.TT_Period, 10) || 1;
    const timing = GBU_PERIOD_TIMES[periodNum] || { start: '08:30', end: '09:30' };
    const dayNum = (parseInt(item.TT_Day, 10) || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

    let actType: 'lecture' | 'lab' | 'tutorial' = 'lecture';
    const tagLower = (item.ActivityTag || '').toLowerCase();
    if (tagLower.includes('lab') || tagLower.includes('practical')) actType = 'lab';
    if (tagLower.includes('tut')) actType = 'tutorial';

    return {
      id: item.TimeTableId || `${item.TT_Day}-${item.TT_Period}-${item.Subject_Code}`,
      day: dayNum,
      period: periodNum,
      start: timing.start,
      end: timing.end,
      subject: item.subject_name ? item.subject_name.trim() : (item.Subject_Code || 'Class'),
      subjectCode: item.Subject_Code ? item.Subject_Code.trim() : '',
      faculty: item.TeacherName ? item.TeacherName.trim() : undefined,
      room: item.RoomName ? item.RoomName.trim() : undefined,
      type: actType,
    };
  });

  return {
    classKey,
    fetchedAt: new Date().toISOString(),
    semesterSessionId,
    slots,
  };
}

/**
 * Creates user-friendly notification message per docs/NOTIFICATIONS.md
 */
export function formatTimetableChangeNotification(
  classKey: string,
  diffs: TimetableDiffItem[],
): string {
  if (diffs.length === 0) return '';

  if (diffs.length === 1) {
    const diff = diffs[0];
    if (diff.type === 'moved') {
      return `${diff.slot.subject} moved to Day ${diff.slot.day} at ${diff.slot.start} (${diff.slot.room || 'Room TBD'})`;
    }
    if (diff.type === 'room_changed') {
      return `${diff.slot.subject} room changed to ${diff.slot.room} (${diff.slot.start})`;
    }
    if (diff.type === 'added') {
      return `New class added: ${diff.slot.subject} at ${diff.slot.start} (${diff.slot.room || 'Room TBD'})`;
    }
    if (diff.type === 'removed') {
      return `${diff.slot.subject} at ${diff.slot.start} was cancelled`;
    }
  }

  // Multiple diffs: group count and highlight top item
  const dayName = getDayName(diffs[0].slot.day);
  return `${classKey}: ${diffs.length} schedule updates on ${dayName}. Tap to view.`;
}

function getDayName(day: number): string {
  switch (day) {
    case 1:
      return 'Monday';
    case 2:
      return 'Tuesday';
    case 3:
      return 'Wednesday';
    case 4:
      return 'Thursday';
    case 5:
      return 'Friday';
    case 6:
      return 'Saturday';
    default:
      return 'Today';
  }
}

export class TimetablePollerJob {
  private previousSnapshots: Map<string, Timetable> = new Map();

  constructor(initialSnapshots?: Map<string, Timetable>) {
    if (initialSnapshots) {
      this.previousSnapshots = new Map(initialSnapshots);
    }
  }

  getSnapshot(classKey: string): Timetable | undefined {
    return this.previousSnapshots.get(classKey);
  }

  setSnapshot(classKey: string, timetable: Timetable): void {
    this.previousSnapshots.set(classKey, timetable);
  }

  /**
   * Fetches raw JSON data from GBU API for a given session
   */
  async fetchSessionData(sessionId: string): Promise<RawGBUTimetableItem[]> {
    const url = `${WORKER_CONFIG.sources.timetableApi.baseUrl}?schd=${sessionId}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WORKER_CONFIG.sources.timetableApi.timeoutMs);

    try {
      const response = await fetchWithTlsTolerance(url, {
        headers: {
          'User-Agent': WORKER_CONFIG.userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`GBU API responded with status ${response.status}`);
      }

      const json = await response.json();
      return Array.isArray(json) ? (json as RawGBUTimetableItem[]) : [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Runs the poller on provided raw items or by fetching directly
   */
  async pollAndComputeDiffs(
    sessionDataMap?: Record<string, RawGBUTimetableItem[]>,
  ): Promise<TimetableWorkerResult> {
    const sessionIds = WORKER_CONFIG.sources.timetableApi.activeSemesters;
    const allChanges: TimetableChangeRecord[] = [];
    let totalClassesScanned = 0;

    for (const sessionId of sessionIds) {
      let rawData: RawGBUTimetableItem[];
      if (sessionDataMap && sessionDataMap[sessionId]) {
        rawData = sessionDataMap[sessionId];
      } else {
        try {
          rawData = await this.fetchSessionData(sessionId);
        } catch (err) {
          console.warn(`Worker: Timetable fetch failed for session ${sessionId}:`, err);
          continue;
        }
      }

      // Group by SectionName
      const sections = new Set<string>();
      for (const item of rawData) {
        if (item.SectionName && item.SectionName.trim()) {
          sections.add(item.SectionName.trim());
        }
      }

      totalClassesScanned += sections.size;

      for (const section of sections) {
        const cacheKey = `${section}_${sessionId}`;
        const newTimetable = buildTimetableFromRawItems(section, rawData, sessionId);
        const oldTimetable = this.previousSnapshots.get(cacheKey);

        if (oldTimetable) {
          const diffs = computeTimetableDiff(oldTimetable, newTimetable);
          if (diffs.length > 0) {
            const message = formatTimetableChangeNotification(section, diffs);
            allChanges.push({
              id: `chg_${section}_${sessionId}_${Date.now()}`,
              classKey: section,
              semesterSessionId: sessionId,
              diffCount: diffs.length,
              diffs,
              notificationMessage: message,
              detectedAt: new Date().toISOString(),
            });
          }
        }

        // Update stored snapshot
        this.previousSnapshots.set(cacheKey, newTimetable);
      }
    }

    return {
      sessionIds,
      totalClassesScanned,
      changedClassesCount: allChanges.length,
      changes: allChanges,
      timestamp: new Date().toISOString(),
    };
  }
}
