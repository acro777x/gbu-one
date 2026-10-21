/**
 * GBU One — Notices query (offline-first: cache, then refresh).
 * Order of truth:
 *  1) Supabase `notices` table, when the project is configured.
 *  2) The live public GBU pages (gbu.ac.in and exams.gbu.ac.in), which need
 *     no account and no backend.
 *  3) The SQLite cache, so a screen that has been opened before paints
 *     instantly and still works offline.
 *  4) The bundled sample, clearly labelled as a sample, so a first launch
 *     without a network shows something instead of an empty screen.
 */
import { useQuery } from '@tanstack/react-query';
import { MOCK_NOTICES, NoticeItem } from './noticeService';
import { fetchLiveNotices } from './liveNotices';
import { toNoticeItems } from './liveNoticeMapping';
import { readCachedNotices, writeCachedNotices } from '../../lib/db';
import { NOTICE_QUERY_KEY } from '../../lib/queryClient';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

function rowToNotice(r: Record<string, unknown>): NoticeItem {
  const aud = (r.audience ?? {}) as NoticeItem['audience'];
  return {
    id: String(r.id ?? r.source_id ?? ''),
    source: (r.source as NoticeItem['source']) ?? 'main',
    sourceId: String(r.source_id ?? ''),
    title: String(r.title ?? ''),
    cleanTitle: String(r.clean_title ?? r.title ?? ''),
    postedAt: String(r.posted_at ?? new Date().toISOString()),
    fileUrl: String(r.file_url ?? ''),
    fileType: (r.file_type as NoticeItem['fileType']) ?? 'pdf',
    rawText: (r.raw_text as string | undefined) ?? undefined,
    category: (r.category as NoticeItem['category']) ?? 'other',
    audience: aud && typeof aud === 'object' ? aud : {},
    importance: Number(r.importance ?? 0),
    deadlineAt: (r.deadline_at as string | null | undefined) ?? null,
    threadId: (r.thread_id as string | null | undefined) ?? null,
    threadUpdateCount: Number(r.thread_update_count ?? 0) || undefined,
    isSample: false,
  };
}

async function fetchNoticesLive(): Promise<NoticeItem[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(300);
    if (error || !data || data.length === 0) return null;
    return (data as Record<string, unknown>[]).map(rowToNotice);
  } catch {
    return null;
  }
}

/**
 * Fetches the real notices straight from the university's public pages. They
 * are plain server-rendered HTML, so no account or backend is needed.
 */
export async function fetchNoticesFromUniversity(): Promise<NoticeItem[]> {
  const result = await fetchLiveNotices({ timeoutMs: 15000 });
  return toNoticeItems(result.notices);
}

export function useNoticesQuery() {
  return useQuery<NoticeItem[]>({
    queryKey: NOTICE_QUERY_KEY,
    queryFn: async () => {
      const live = await fetchNoticesLive();
      if (live && live.length > 0) {
        writeCachedNotices(live);
        return live;
      }

      // No backend yet, so read the university's own pages.
      const fromUniversity = await fetchNoticesFromUniversity();
      if (fromUniversity.length > 0) {
        writeCachedNotices(fromUniversity);
        return fromUniversity;
      }

      const cached = readCachedNotices();
      if (cached.length > 0) return cached;
      return MOCK_NOTICES;
    },
    // Instant paint: seed the cache synchronously at query creation.
    initialData: () => {
      const cached = readCachedNotices();
      return cached.length > 0 ? cached : MOCK_NOTICES;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default useNoticesQuery;
