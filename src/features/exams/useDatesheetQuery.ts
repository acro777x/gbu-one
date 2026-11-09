/**
 * GBU One — Exam datesheet query (offline-first).
 *
 * Queries live class-wise date slots from Supabase (`exam_date_slots`)
 * with fallback to `exam_datesheets` and authentic bundled seeds per classKey.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getClassDatesheet,
  type DatesheetEntry,
} from './examService';
import {
  matchClassKey,
  buildClassKey,
  rowToExamSlot,
  examSlotToDatesheetEntry,
  type DateSlotRow,
} from './examDateSheetParser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { LOCAL_ADMIN_DATE_SLOTS_KEY } from './adminDateSheetService';

export const DATESHEET_QUERY_KEY = ['exam-datesheet'] as const;

interface DatesheetRow {
  id?: unknown;
  school?: unknown;
  programme_code?: unknown;
  semester?: unknown;
  file_url?: unknown;
  version?: unknown;
  posted_at?: unknown;
}

const SHIFTS: DatesheetEntry['shift'][] = ['Morning', 'Evening'];

/** Maps a legacy database row to the shape the exam hub renders. */
export function datesheetRowToEntry(
  row: DatesheetRow,
  programmeCode: string,
  semester: string,
): DatesheetEntry {
  const shift = SHIFTS[(Number(row.version ?? 1) - 1) % SHIFTS.length];
  return {
    id: String(row.id ?? ''),
    programmeCode: String(row.programme_code ?? programmeCode),
    semester: String(row.semester ?? semester),
    subjectCode: 'DATASHEET',
    subjectName: `Official date sheet v${Number(row.version ?? 1)}`,
    examDate: String(row.posted_at ?? ''),
    examTime: 'See the official date sheet',
    shift,
    roomBlock: String(row.school ?? ''),
  };
}

/** Loads the date sheet for a programme/class from the backend or local cache. */
export async function listDatesheet(
  programmeCode: string,
  semester: string,
  enrolledClassKey?: string,
  phase: 'end' | 'practicals' | 'back' | 'mid' = 'end',
): Promise<DatesheetEntry[]> {
  const classKey = enrolledClassKey || buildClassKey(programmeCode, semester);
  const fallback = getClassDatesheet(classKey, phase);

  try {
    let rows: DateSlotRow[] = [];

    // 1. Try querying rich exam_date_slots table if Supabase is configured
    if (isSupabaseConfigured) {
      try {
        const { data: slotData, error: slotErr } = await supabase
          .from('exam_date_slots')
          .select('*')
          .order('exam_date', { ascending: true })
          .limit(500);

        if (!slotErr && slotData && slotData.length > 0) {
          rows = slotData as DateSlotRow[];
        }
      } catch {
        // ignore
      }
    }

    // 2. Fallback: check storage CDN
    if (rows.length === 0) {
      try {
        const cdnRes = await fetch(
          `https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/campus-events/exam_date_slots.json?t=${Date.now()}`,
        );
        if (cdnRes.ok) {
          const cdnData = await cdnRes.json();
          if (Array.isArray(cdnData)) {
            rows = cdnData;
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Fallback: check local admin-seeded/uploaded AsyncStorage slots
    if (rows.length === 0) {
      try {
        const rawLocal = await AsyncStorage.getItem(LOCAL_ADMIN_DATE_SLOTS_KEY);
        if (rawLocal) {
          const localData = JSON.parse(rawLocal);
          if (Array.isArray(localData)) {
            rows = localData;
          }
        }
      } catch {
        // ignore
      }
    }

    if (rows.length > 0) {
      const matched = rows.filter((r) => {
        const matchesClass = matchClassKey(classKey, r.class_key || buildClassKey(r.programme));
        if (!matchesClass) return false;

        // Filter by phase if applicable
        if (phase === 'mid' && r.exam_type !== 'mid_sem') return false;
        if (phase === 'end' && r.exam_type !== 'end_sem') return false;
        if (phase === 'practicals' && r.exam_type !== 'practical') return false;
        if (phase === 'back' && !r.is_back_paper) return false;

        return true;
      });

      if (matched.length > 0) {
        return matched.map((r) => examSlotToDatesheetEntry(rowToExamSlot(r)));
      }
    }

    // 4. Try legacy exam_datesheets table
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('exam_datesheets')
        .select('*')
        .eq('programme_code', programmeCode)
        .eq('semester', semester)
        .order('version', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return (data as DatesheetRow[]).map((row) =>
          datesheetRowToEntry(row, programmeCode, semester),
        );
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function useDatesheetQuery(
  programmeCode: string,
  semester: string,
  enrolledClassKey?: string,
  phase: 'end' | 'practicals' | 'back' | 'mid' = 'end',
) {
  const key = enrolledClassKey || buildClassKey(programmeCode, semester);
  return useQuery<DatesheetEntry[]>({
    queryKey: [...DATESHEET_QUERY_KEY, programmeCode, semester, key, phase],
    queryFn: async () => {
      const entries = await listDatesheet(programmeCode, semester, key, phase);
      return entries.length > 0 ? entries : getClassDatesheet(key, phase);
    },
    initialData: getClassDatesheet(key, phase),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60 * 1000,
  });
}

export default useDatesheetQuery;
