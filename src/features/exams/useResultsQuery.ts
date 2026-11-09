/**
 * GBU One — Declared Results Query (offline-first).
 *
 * Scraped and confirmed results come from Supabase (`results`);
 * bundled seed data keeps the exam hub usable when offline or unconfigured.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const RESULTS_QUERY_KEY = ['declared-results'] as const;

export interface DeclaredResultItem {
  id: string;
  programme: string;
  semester: string;
  academicYear: string;
  title: string;
  fileUrl: string;
  postedAt: string;
}

export const SEED_DECLARED_RESULTS: DeclaredResultItem[] = [
  {
    id: 'res_btech_cse_4',
    programme: 'B.Tech CSE',
    semester: 'IV',
    academicYear: '2025-26',
    title: 'Result of B.Tech (CSE) IV Semester (EVEN SEM 2026)',
    fileUrl: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
    postedAt: '2026-10-15T00:00:00.000Z',
  },
  {
    id: 'res_btech_ece_6',
    programme: 'B.Tech ECE',
    semester: 'VI',
    academicYear: '2025-26',
    title: 'Declaration of Result of B.Tech (ECE) VI Semester (EVEN SEM 2026)',
    fileUrl: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
    postedAt: '2026-10-12T00:00:00.000Z',
  },
  {
    id: 'res_mba_2',
    programme: 'MBA',
    semester: 'II',
    academicYear: '2025-26',
    title: 'Result of MBA II Semester (EVEN SEM 2026) Declared',
    fileUrl: 'https://exams.gbu.ac.in/uploads/results/som.pdf',
    postedAt: '2026-10-10T00:00:00.000Z',
  },
  {
    id: 'res_mca_4',
    programme: 'MCA',
    semester: 'IV',
    academicYear: '2025-26',
    title: 'Grade Card & Result Declaration of MCA IV Semester',
    fileUrl: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
    postedAt: '2026-09-28T00:00:00.000Z',
  },
  {
    id: 'res_ballb_8',
    programme: 'B.A. LL.B',
    semester: 'VIII',
    academicYear: '2025-26',
    title: 'Result of B.A. LL.B VIII Semester (EVEN SEM 2026)',
    fileUrl: 'https://exams.gbu.ac.in/uploads/results/soljg.pdf',
    postedAt: '2026-09-20T00:00:00.000Z',
  },
  {
    id: 'res_mtech_cse_2',
    programme: 'M.Tech',
    semester: 'II',
    academicYear: '2025-26',
    title: 'Result of M.Tech (CSE) II Semester Declared',
    fileUrl: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
    postedAt: '2026-09-15T00:00:00.000Z',
  },
];

interface ResultDbRow {
  id?: unknown;
  programme?: unknown;
  semester?: unknown;
  academic_year?: unknown;
  title?: unknown;
  file_url?: unknown;
  posted_at?: unknown;
}

/** Loads declared results from Supabase */
export async function listDeclaredResults(): Promise<DeclaredResultItem[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('results')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(40);

    if (error || !data || data.length === 0) return [];

    return (data as ResultDbRow[]).map((r) => ({
      id: String(r.id ?? ''),
      programme: String(r.programme ?? 'All Programmes'),
      semester: String(r.semester ?? ''),
      academicYear: String(r.academic_year ?? ''),
      title: String(r.title ?? `${r.programme} Result`),
      fileUrl: String(r.file_url ?? ''),
      postedAt: String(r.posted_at ?? ''),
    }));
  } catch {
    return [];
  }
}

export function useResultsQuery() {
  return useQuery<DeclaredResultItem[]>({
    queryKey: RESULTS_QUERY_KEY,
    queryFn: async () => {
      const live = await listDeclaredResults();
      return live.length > 0 ? live : SEED_DECLARED_RESULTS;
    },
    initialData: SEED_DECLARED_RESULTS,
    initialDataUpdatedAt: 0,
    staleTime: 15 * 60 * 1000,
  });
}

export default useResultsQuery;
