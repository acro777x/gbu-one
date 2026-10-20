/**
 * GBU One — Exam datesheet query (offline-first).
 *
 * The date sheet comes from Supabase (`exam_datesheets`); the bundled seed
 * keeps the exam hub usable when the backend is not reachable.
 */
import { useQuery } from '@tanstack/react-query';
import { MOCK_DATESHEET, type DatesheetEntry } from './examService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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

/** Maps a database row to the shape the exam hub renders. */
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

/** Loads the date sheet for a programme from the backend. */
export async function listDatesheet(
  programmeCode: string,
  semester: string,
): Promise<DatesheetEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('exam_datesheets')
      .select('*')
      .eq('programme_code', programmeCode)
      .eq('semester', semester)
      .order('version', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as DatesheetRow[]).map((row) =>
      datesheetRowToEntry(row, programmeCode, semester),
    );
  } catch {
    return [];
  }
}

export function useDatesheetQuery(programmeCode: string, semester: string) {
  return useQuery<DatesheetEntry[]>({
    queryKey: [...DATESHEET_QUERY_KEY, programmeCode, semester],
    queryFn: async () => {
      const entries = await listDatesheet(programmeCode, semester);
      return entries.length > 0 ? entries : MOCK_DATESHEET;
    },
    initialData: MOCK_DATESHEET,
    staleTime: 30 * 60 * 1000,
  });
}

export default useDatesheetQuery;
