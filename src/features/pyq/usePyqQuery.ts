/**
 * GBU One — PYQ papers query (offline-first).
 *
 * Approved papers come from Supabase; when the network or the backend is
 * unavailable the bundled seed keeps the screen usable.
 */
import { useQuery } from '@tanstack/react-query';
import { MOCK_PAPERS, type PYQItem } from './pyqService';
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
      if (records.length > 0) return records.map(paperRecordToItem);
      return MOCK_PAPERS;
    },
    // The seed paints instantly; the network refresh follows.
    initialData: MOCK_PAPERS,
    // The seed must not count as fresh, or the query never fetches.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}

export default usePyqQuery;
