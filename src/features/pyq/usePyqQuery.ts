/**
 * GBU One — PYQ papers query (offline-first).
 *
 * The papers come from Supabase. When the network or the backend is
 * unavailable the papers that were seen last are served from the local
 * cache and the query reports the failure, so a student can tell a dead
 * backend from an empty library.
 */
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '../../lib/queryClient';
import { FULL_CATALOGUE_PAPERS, normalizeSemester, type PYQItem } from './pyqService';
import { listApprovedPapers, type PyqPaperRecord } from './pyqRepository';

export const PYQ_QUERY_KEY = ['pyq-papers'] as const;

/**
 * The offline cache of the live papers.
 *
 * PYQ had no local cache at all: after a restart the student only ever saw
 * the bundled catalogue, while notices, timetable and events all render
 * from a local cache first. This key follows the same AsyncStorage pattern
 * as the upload queue.
 *
 * The SQLite table this cache should eventually live in is reported in the
 * handover notes; `src/lib/db.ts` is not part of this change.
 */
export const PYQ_PAPERS_CACHE_KEY = '@gbu_one_pyq_papers_cache';

/** Maps a database row to the shape the screen renders. */
export function paperRecordToItem(record: PyqPaperRecord): PYQItem {
  return {
    id: record.id,
    school: record.school,
    programme: record.programmeCode,
    semester: normalizeSemester(record.semester),
    subjectCode: record.subjectCode,
    subjectName: record.subjectName,
    year: record.year,
    examType: record.examType,
    downloads: record.downloads,
    status: record.status === 'approved' ? 'approved' : 'pending',
    fileUrl: record.fileUrl,
    hasFile: Boolean(record.fileUrl && record.fileUrl.startsWith('http')),
  };
}

/**
 * Reads the papers that were saved on this phone.
 */
export async function readCachedPapers(): Promise<PYQItem[]> {
  try {
    const raw = await AsyncStorage.getItem(PYQ_PAPERS_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PYQItem =>
        Boolean(item) && typeof (item as PYQItem).id === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Saves the papers that were just fetched, so the next launch is not empty.
 */
export async function writeCachedPapers(papers: PYQItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PYQ_PAPERS_CACHE_KEY, JSON.stringify(papers));
  } catch {
    // A failed cache write only costs one offline launch.
  }
}

/**
 * Keeps the university catalogue (every subject, so the browse is
 * complete) and prefers the live uploads for the subjects that have one.
 */
export function mergeWithCatalogue(liveItems: PYQItem[]): PYQItem[] {
  if (liveItems.length === 0) return FULL_CATALOGUE_PAPERS;

  const liveSubjectCodes = new Set(liveItems.map((p) => p.subjectCode.toUpperCase()));
  const catalogueFallbacks = FULL_CATALOGUE_PAPERS.filter(
    (cat) => !liveSubjectCodes.has(cat.subjectCode.toUpperCase()),
  );

  return [...liveItems, ...catalogueFallbacks];
}

export function usePyqQuery() {
  return useQuery<PYQItem[]>({
    queryKey: PYQ_QUERY_KEY,
    queryFn: async () => {
      const cached = await readCachedPapers();
      try {
        const records = await listApprovedPapers();
        const liveItems = records.map(paperRecordToItem);
        await writeCachedPapers(liveItems);
        return mergeWithCatalogue(liveItems);
      } catch (err) {
        // The backend is unreachable. The papers that were seen last are
        // put on screen and the failure is reported, so the student knows
        // the list is not fresh.
        if (cached.length > 0) {
          queryClient.setQueryData(PYQ_QUERY_KEY, mergeWithCatalogue(cached));
        }
        throw err;
      }
    },
    // The seed paints instantly; the network refresh follows.
    initialData: FULL_CATALOGUE_PAPERS,
    // The seed must not count as fresh, or the query never fetches.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}

export default usePyqQuery;
