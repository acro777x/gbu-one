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
import {
  readCachedPyqPapers,
  writeCachedPyqPapers,
  type PyqPaperCacheRow,
} from '../../lib/db';
import { FULL_CATALOGUE_PAPERS, normalizeSemester, type PYQItem } from './pyqService';
import { listApprovedPapers, type PyqPaperRecord } from './pyqRepository';

export const PYQ_QUERY_KEY = ['pyq-papers'] as const;

/**
 * The offline cache of the live papers.
 *
 * The cache lives in SQLite (`src/lib/db.ts`), like the notices, the
 * timetable and the events. It used to live in AsyncStorage, which is
 * unindexed, unpruned and not transactional - so after a restart the
 * student only ever saw the bundled catalogue, and a student on a patchy
 * connection in the library building saw nothing at all.
 *
 * The AsyncStorage key is kept as a MIRROR, so a build that upgrades
 * mid-session still has the papers it had, and so the very first paint can
 * read something synchronously.
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

/** Maps a cached row back to the shape the screen renders. */
export function cacheRowToItem(row: PyqPaperCacheRow): PYQItem {
  return {
    id: row.id,
    school: row.school,
    programme: row.programmeCode,
    semester: normalizeSemester(row.semester),
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    year: row.year,
    examType: (row.examType || 'End Sem') as PYQItem['examType'],
    downloads: row.downloads,
    status: row.status === 'pending' ? 'pending' : 'approved',
    fileUrl: row.fileUrl,
    hasFile: Boolean(row.fileUrl && row.fileUrl.startsWith('http')),
  };
}

/** Maps a paper to the row the cache stores. */
export function itemToCacheRow(item: PYQItem, cachedAt: number): PyqPaperCacheRow {
  return {
    id: item.id,
    school: item.school,
    programmeCode: item.programme,
    semester: item.semester,
    subjectCode: item.subjectCode,
    subjectName: item.subjectName,
    year: item.year,
    examType: item.examType,
    downloads: item.downloads,
    status: item.status,
    fileUrl: item.fileUrl ?? '',
    uploaderStudentId: '',
    uploaderName: '',
    cachedAt,
  };
}

/**
 * Reads the papers that were saved on this phone.
 *
 * SQLite is the store. The AsyncStorage mirror is read only when SQLite has
 * nothing, and is then migrated into it, so a device that upgrades keeps
 * its papers.
 */
export async function readCachedPapers(): Promise<PYQItem[]> {
  const fromSqlite = readCachedPyqPapers().map(cacheRowToItem);
  if (fromSqlite.length > 0) return fromSqlite;

  try {
    const raw = await AsyncStorage.getItem(PYQ_PAPERS_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items = parsed.filter(
      (item): item is PYQItem =>
        Boolean(item) && typeof (item as PYQItem).id === 'string',
    );
    // Migrate the old cache into SQLite so it is only read once.
    if (items.length > 0) {
      writeCachedPyqPapers(items.map((item) => itemToCacheRow(item, Date.now())));
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Saves the papers that were just fetched, so the next launch is not empty.
 */
export async function writeCachedPapers(papers: PYQItem[]): Promise<void> {
  const now = Date.now();
  writeCachedPyqPapers(papers.map((paper) => itemToCacheRow(paper, now)));
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
