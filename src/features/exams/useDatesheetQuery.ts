/**
 * GBU One — Exam datesheet query (offline-first).
 *
 * Queries live class-wise date slots from Supabase (`exam_date_slots`)
 * with fallback to `exam_datesheets` and the bundled sample per classKey.
 *
 * The class filter is pushed down to the server: the table holds a slot for
 * every class of every school, so pulling the whole table and filtering it
 * in JavaScript would download the entire examination schedule to show one
 * student's own rows.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getClassDatesheet,
  type DatesheetEntry,
} from './examService';
import {
  matchClassKey,
  buildClassKey,
  buildCanonicalClassKey,
  baseClassKeyOf,
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

/** Where the rows on screen came from. */
export type DatesheetSource = 'live' | 'sample';

/** The exam type the phase stands for in the database. */
export function examTypeForPhase(
  phase: 'end' | 'practicals' | 'back' | 'mid',
): 'mid_sem' | 'end_sem' | 'practical' | null {
  if (phase === 'mid') return 'mid_sem';
  if (phase === 'end') return 'end_sem';
  if (phase === 'practicals') return 'practical';
  // Back papers are end-semester papers, so the type is not narrowed down
  // any further here; the back-paper flag does that.
  return null;
}

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
    isSample: false,
  };
}

/** The result of one date-sheet lookup, with the origin of the rows. */
export interface DatesheetResult {
  entries: DatesheetEntry[];
  source: DatesheetSource;
}

/**
 * The class key of a student: the programme, the semester, the batch and the
 * section. The base key (without batch and section) is what the database is
 * filtered on.
 */
export function classKeysForStudent(
  programmeCode: string,
  semester: string,
  enrolledClassKey?: string,
): { canonical: string; base: string } {
  const canonical = enrolledClassKey
    ? enrolledClassKey.trim().toLowerCase()
    : buildCanonicalClassKey(programmeCode, semester);
  return { canonical, base: baseClassKeyOf(canonical) || buildClassKey(programmeCode, semester) };
}

/** Loads the date sheet for a programme/class from the backend or local cache. */
export async function listDatesheet(
  programmeCode: string,
  semester: string,
  enrolledClassKey?: string,
  phase: 'end' | 'practicals' | 'back' | 'mid' = 'end',
): Promise<DatesheetEntry[]> {
  const { entries } = await fetchDatesheet(programmeCode, semester, enrolledClassKey, phase);
  return entries;
}

/**
 * Loads the date sheet and says where it came from, so the screen can label
 * the bundled sample instead of passing it off as the official schedule.
 */
export async function fetchDatesheet(
  programmeCode: string,
  semester: string,
  enrolledClassKey?: string,
  phase: 'end' | 'practicals' | 'back' | 'mid' = 'end',
): Promise<DatesheetResult> {
  const { canonical, base } = classKeysForStudent(programmeCode, semester, enrolledClassKey);
  const fallback = getClassDatesheet(canonical, phase);

  try {
    let rows: DateSlotRow[] = [];

    // 1. Try querying rich exam_date_slots table if Supabase is configured.
    //    The filters are pushed down: only this student's class and this
    //    exam type come back.
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('exam_date_slots')
          .select('*')
          .or(`class_key.eq.${base},class_key.like.${base}*`)
          .order('exam_date', { ascending: true })
          .limit(500);
        const examType = examTypeForPhase(phase);
        if (examType) query = query.eq('exam_type', examType);

        const { data: slotData, error: slotErr } = await query;

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
        const matchesClass = matchClassKey(canonical, r.class_key || buildClassKey(r.programme));
        if (!matchesClass) return false;

        // Filter by phase if applicable
        if (phase === 'mid' && r.exam_type !== 'mid_sem') return false;
        if (phase === 'end' && r.exam_type !== 'end_sem') return false;
        if (phase === 'practicals' && r.exam_type !== 'practical') return false;
        if (phase === 'back' && !r.is_back_paper) return false;

        return true;
      });

      if (matched.length > 0) {
        const entries = dedupeSlots(matched).map((r) => examSlotToDatesheetEntry(rowToExamSlot(r)));
        return { entries: entries.map((entry) => ({ ...entry, isSample: false })), source: 'live' };
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
        return {
          entries: (data as DatesheetRow[]).map((row) =>
            datesheetRowToEntry(row, programmeCode, semester),
          ),
          source: 'live',
        };
      }
    }

    return { entries: fallback, source: 'sample' };
  } catch {
    return { entries: fallback, source: 'sample' };
  }
}

/**
 * Removes the rows the worker left behind from an earlier run.
 *
 * The slot key carries the batch, so a re-run with a corrected batch writes
 * new rows and the old ones stay in the table. Two rows that describe the
 * same exam for the same class are one row for the student.
 */
function dedupeSlots(rows: DateSlotRow[]): DateSlotRow[] {
  const seen = new Set<string>();
  const unique: DateSlotRow[] = [];
  for (const row of rows) {
    const key = [
      row.class_key ?? '',
      row.exam_date,
      row.slot,
      row.subject_code,
      row.exam_type ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

export function useDatesheetQuery(
  programmeCode: string,
  semester: string,
  enrolledClassKey?: string,
  phase: 'end' | 'practicals' | 'back' | 'mid' = 'end',
) {
  const key = classKeysForStudent(programmeCode, semester, enrolledClassKey).canonical;
  return useQuery<DatesheetEntry[]>({
    queryKey: [...DATESHEET_QUERY_KEY, programmeCode, semester, key, phase],
    queryFn: async () => {
      const { entries } = await fetchDatesheet(programmeCode, semester, key, phase);
      return entries.length > 0 ? entries : getClassDatesheet(key, phase);
    },
    initialData: getClassDatesheet(key, phase),
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60 * 1000,
  });
}

export default useDatesheetQuery;
