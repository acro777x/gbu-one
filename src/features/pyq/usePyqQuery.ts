/**
 * GBU One — PYQ papers query (offline-first).
 *
 * Approved papers come from Supabase; when the network or the backend is
 * unavailable the bundled seed keeps the screen usable.
 */
import { useQuery } from '@tanstack/react-query';
import { FULL_CATALOGUE_PAPERS, type PYQItem } from './pyqService';
import { listApprovedPapers, type PyqPaperRecord } from './pyqRepository';

export const PYQ_QUERY_KEY = ['pyq-papers'] as const;

/** Maps a database row to the shape the screen renders. */
export function paperRecordToItem(record: PyqPaperRecord): PYQItem {
  return {
    id: record.id,
    school: record.school,
    programme: record.programmeCode,
    semester: record.semester,
    subjectCode: record.subjectCode,
    subjectName: record.subjectName,
    year: record.year,
    examType: record.examType,
    downloads: record.downloads,
    status: record.status === 'approved' ? 'approved' : 'pending',
    fileUrl: record.fileUrl,
  };
}

export function usePyqQuery() {
  return useQuery<PYQItem[]>({
    queryKey: PYQ_QUERY_KEY,
    queryFn: async () => {
      const records = await listApprovedPapers();
      const liveItems = records.map(paperRecordToItem);
      if (liveItems.length === 0) return FULL_CATALOGUE_PAPERS;

      // Collect all subject codes that have live approved uploads
      const liveSubjectCodes = new Set(liveItems.map((p) => p.subjectCode.toUpperCase()));

      // Preserve all university subjects from the catalogue for subjects without live uploads
      const catalogueFallbacks = FULL_CATALOGUE_PAPERS.filter(
        (cat) => !liveSubjectCodes.has(cat.subjectCode.toUpperCase()),
      );

      // Return all live papers (every year, exam type, and upload) + catalogue subjects for complete coverage
      return [...liveItems, ...catalogueFallbacks];
    },
    // The seed paints instantly; the network refresh follows.
    initialData: FULL_CATALOGUE_PAPERS,
    // The seed must not count as fresh, or the query never fetches.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}

export default usePyqQuery;
