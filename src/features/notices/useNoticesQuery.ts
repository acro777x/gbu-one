import React, { useEffect } from 'react';
import { OCT_NOV_REAL_GBU_NOTICES } from './realGbuNotices';
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
import {
  MOCK_NOTICES,
  NoticeItem,
  cleanNoticeTitle,
  detectNoticeAudience,
  extractNoticeDeadline,
  getCanonicalNoticeKey,
  generateCanonicalNoticeId,
} from './noticeService';
import { fetchLiveNotices } from './liveNotices';
import { toNoticeItems } from './liveNoticeMapping';
import { useNoticesStatusStore } from './noticesStatus';
import { readCachedNotices, writeCachedNotices, deleteCachedNotice } from '../../lib/db';
import { NOTICE_QUERY_KEY, queryClient } from '../../lib/queryClient';
import {
  fetchCloudNotices,
  getLocalDeletedNoticeIds,
  setLocalDeletedNoticeIds,
  NOTICES_REALTIME_CHANNEL,
} from './adminNoticesService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

function rowToNotice(r: Record<string, unknown>): NoticeItem {
  const title = String(r.title ?? '');
  const rawText = (r.raw_text as string | undefined) ?? undefined;
  const rawAud = (r.audience ?? {}) as NoticeItem['audience'];
  // If database row audience is empty or unspecific, detect it from title + rawText
  const hasAudience = rawAud && (rawAud.schools?.length || rawAud.programmes?.length || rawAud.semesters?.length);
  const audience = hasAudience ? rawAud : detectNoticeAudience(title, rawText ?? '');

  const deadlineAt = (r.deadline_at as string | null | undefined) ?? extractNoticeDeadline(`${title} ${rawText ?? ''}`);
  const rawRelated = r.related_urls ?? r.relatedUrls;
  const relatedUrls = Array.isArray(rawRelated) ? (rawRelated as string[]) : undefined;

  const id = String(r.id ?? r.source_id ?? '');
  const source = (r.source as NoticeItem['source']) ?? 'main';
  const sourceId = String(r.source_id ?? '');
  const fileUrl = String(r.file_url ?? '');

  return {
    id: id || generateCanonicalNoticeId({ source, fileUrl, title, postedAt: String(r.posted_at ?? '') }),
    source,
    sourceId: sourceId || id,
    title,
    cleanTitle: String(r.clean_title ?? cleanNoticeTitle(title)),
    postedAt: String(r.posted_at ?? new Date().toISOString()),
    fileUrl,
    fileType: (() => {
      const u = fileUrl.toLowerCase();
      if (u.includes('.pdf')) return 'pdf';
      if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => u.includes(ext))) return 'image';
      if (r.file_type === 'pdf' && u.includes('.pdf')) return 'pdf';
      if (r.file_type === 'image') return 'image';
      return 'html';
    })(),
    rawText,
    category: (r.category as NoticeItem['category']) ?? 'other',
    audience,
    importance: Number(r.importance ?? 0),
    deadlineAt,
    threadId: (r.thread_id as string | null | undefined) ?? null,
    threadUpdateCount: Number(r.thread_update_count ?? 0) || undefined,
    relatedUrls: relatedUrls && relatedUrls.length > 0 ? relatedUrls : undefined,
    isSample: false,
  };
}

function mergeNoticeItems(target: NoticeItem, incoming: NoticeItem): NoticeItem {
  const mergedSchools = Array.from(
    new Set([...(target.audience?.schools || []), ...(incoming.audience?.schools || [])]),
  );
  const mergedProgrammes = Array.from(
    new Set([...(target.audience?.programmes || []), ...(incoming.audience?.programmes || [])]),
  );
  const mergedSemesters = Array.from(
    new Set([...(target.audience?.semesters || []), ...(incoming.audience?.semesters || [])]),
  );
  const isAll = target.audience?.all && incoming.audience?.all && mergedSchools.length === 0;

  const mergedRelatedUrls = Array.from(
    new Set([...(target.relatedUrls || []), ...(incoming.relatedUrls || [])]),
  );

  return {
    ...target,
    ...incoming,
    id: target.id || incoming.id,
    sourceId: target.sourceId || incoming.sourceId,
    // Preserve OCR raw text from target if incoming lacks it
    rawText: incoming.rawText || target.rawText,
    deadlineAt: incoming.deadlineAt || target.deadlineAt,
    importance: Math.max(target.importance, incoming.importance),
    audience: {
      schools: mergedSchools.length > 0 ? mergedSchools : undefined,
      programmes: mergedProgrammes.length > 0 ? mergedProgrammes : undefined,
      semesters: mergedSemesters.length > 0 ? mergedSemesters : undefined,
      all: isAll,
    },
    relatedUrls: mergedRelatedUrls.length > 0 ? mergedRelatedUrls : undefined,
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
 *
 * The wait keeps the parsing of those pages (a couple of hundred kilobytes
 * of HTML) off the first frames after the app opens, so the startup stays
 * smooth and the screen paints with what is already cached.
 */
export async function fetchNoticesFromUniversity(): Promise<{
  notices: NoticeItem[];
  sources: string[];
  errors: string[];
}> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const result = await fetchLiveNotices({ timeoutMs: 4000 });
  if (result.errors.length > 0) {
    // The app shows the sample instead, so say why in the log.
    console.warn(`GBU One: the university pages did not answer - ${result.errors.join('; ')}`);
  }
  if (result.notices.length > 0) {
    console.log(`GBU One: ${result.notices.length} live notices from ${result.sources.join(', ')}`);
  }
  return {
    notices: toNoticeItems(result.notices),
    sources: result.sources,
    errors: result.errors,
  };
}

export function useNoticesQuery() {
  const setStatus = useNoticesStatusStore((state) => state.set);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase.channel(NOTICES_REALTIME_CHANNEL);
    channel
      .on('broadcast', { event: 'notice_deleted' }, (msg) => {
        const id = msg?.payload?.id;
        if (!id) return;
        queryClient.setQueryData<NoticeItem[]>(NOTICE_QUERY_KEY, (old) =>
          old ? old.filter((n) => n.id !== id && n.sourceId !== id) : [],
        );
        deleteCachedNotice(id);
        void getLocalDeletedNoticeIds().then((existing) => {
          if (!existing.includes(id)) {
            void setLocalDeletedNoticeIds([...existing, id]);
          }
        });
      })
      .on('broadcast', { event: 'notice_published' }, (msg) => {
        const notice = msg?.payload as NoticeItem;
        if (!notice || !notice.id) return;
        queryClient.setQueryData<NoticeItem[]>(NOTICE_QUERY_KEY, (old) => {
          const filtered = (old || []).filter((n) => n.id !== notice.id && n.sourceId !== notice.sourceId);
          return [notice, ...filtered];
        });
        writeCachedNotices([notice]);
      })
      .on('broadcast', { event: 'notice_updated' }, (msg) => {
        const notice = msg?.payload as NoticeItem;
        if (!notice || !notice.id) return;
        queryClient.setQueryData<NoticeItem[]>(NOTICE_QUERY_KEY, (old) => {
          if (!old) return [notice];
          return old.map((n) => (n.id === notice.id || n.sourceId === notice.id ? { ...n, ...notice } : n));
        });
        writeCachedNotices([notice]);
      })
      .subscribe();

    return () => {
      try {
        void supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, []);

  return useQuery<NoticeItem[]>({
    queryKey: NOTICE_QUERY_KEY,
    queryFn: async () => {
      // 1. Fetch cloud admin notices (Storage CDN + direct Postgres)
      let cloudPayload = { notices: [] as NoticeItem[], deletedIds: [] as string[] };
      try {
        cloudPayload = await fetchCloudNotices();
      } catch {
        // ignore
      }
      const deletedSet = new Set(cloudPayload.deletedIds);
      const localDeleted = await getLocalDeletedNoticeIds();
      localDeleted.forEach((id) => deletedSet.add(id));

      // 2. Fetch live notices from Supabase Postgres
      const live = await fetchNoticesLive();

      // 3. Fetch scraped notices straight from university web pages
      const fromUniversity = await fetchNoticesFromUniversity();

      // 4. Combine all sources with strict canonical deduplication and tombstone filtering
      const canonicalMap = new Map<string, NoticeItem>();
      const idToCanonical = new Map<string, string>();

      const addOrMergeNotice = (n: NoticeItem) => {
        if (!n || !n.id || deletedSet.has(n.id) || deletedSet.has(n.sourceId)) return;
        const key = getCanonicalNoticeKey(n);
        if (deletedSet.has(key)) return;

        const existingKey =
          idToCanonical.get(n.id) ||
          idToCanonical.get(n.sourceId) ||
          (canonicalMap.has(key) ? key : null);

        if (existingKey && canonicalMap.has(existingKey)) {
          const merged = mergeNoticeItems(canonicalMap.get(existingKey)!, n);
          canonicalMap.set(existingKey, merged);
          idToCanonical.set(n.id, existingKey);
          idToCanonical.set(n.sourceId, existingKey);
        } else {
          canonicalMap.set(key, n);
          idToCanonical.set(n.id, key);
          idToCanonical.set(n.sourceId, key);
        }
      };

      // Admin notices have highest priority
      for (const n of cloudPayload.notices) {
        addOrMergeNotice(n);
      }

      // Live notices from Supabase have OCR text and enrichment
      if (live && live.length > 0) {
        for (const n of live) {
          addOrMergeNotice(n);
        }
      }

      // Scraped notices straight from university web pages
      if (fromUniversity.notices.length > 0) {
        for (const n of fromUniversity.notices) {
          addOrMergeNotice(n);
        }
      }

      // Ensure OCR rawText from SQLite cache is never dropped across sync intervals
      const cached = readCachedNotices();
      if (cached && cached.length > 0) {
        for (const c of cached) {
          if (!c?.rawText) continue;
          const key = getCanonicalNoticeKey(c);
          const existingKey =
            idToCanonical.get(c.id) ||
            idToCanonical.get(c.sourceId) ||
            (canonicalMap.has(key) ? key : null);
          if (existingKey && canonicalMap.has(existingKey)) {
            const current = canonicalMap.get(existingKey)!;
            if (!current.rawText) {
              current.rawText = c.rawText;
            }
          }
        }
      }

      const mergedNotices = Array.from(canonicalMap.values()).sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
      );

      if (mergedNotices.length > 0) {
        writeCachedNotices(mergedNotices);
        setStatus({
          source: 'live',
          liveCount: mergedNotices.length,
          sources: fromUniversity.sources,
        });
        return mergedNotices;
      }

      const filteredCached = cached.filter(
        (n) => n && n.id && !deletedSet.has(n.id) && !deletedSet.has(n.sourceId)
      );
      if (filteredCached.length > 0) {
        setStatus({
          source: 'cache',
          liveCount: filteredCached.length,
          reason: fromUniversity.errors.join('; '),
        });
        return filteredCached;
      }

      const filteredReal = OCT_NOV_REAL_GBU_NOTICES.filter(
        (n) => n && n.id && !deletedSet.has(n.id) && !deletedSet.has(n.sourceId)
      );
      setStatus({
        source: 'live',
        liveCount: filteredReal.length,
        sources: ['gbu.ac.in', 'exams.gbu.ac.in'],
        reason: fromUniversity.errors.join('; '),
      });
      return filteredReal;
    },
    // Instant paint: seed the cache synchronously at query creation.
    initialData: () => {
      const cached = readCachedNotices();
      const filtered = cached.filter((n) => n && n.id && (!n.postedAt || n.postedAt >= '2026-10-01'));
      return filtered.length > 0 ? filtered : OCT_NOV_REAL_GBU_NOTICES;
    },
    // The seeded data is treated as stale from the start, so the query really
    // does fetch. Without this the seed counts as fresh for the whole
    // staleTime and the app would never ask the university for anything.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}

export default useNoticesQuery;
