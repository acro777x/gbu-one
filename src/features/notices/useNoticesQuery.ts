import { useEffect } from 'react';
/**
 * GBU One â€” Notices query (offline-first: cache, then refresh).
 * Order of truth:
 *  1) Supabase `notices` table, when the project is configured.
 *  2) The live public GBU pages (gbu.ac.in and exams.gbu.ac.in), which need
 *     no account and no backend.
 *  3) The SQLite cache, so a screen that has been opened before paints
 *     instantly and still works offline.
 *  4) The bundled archive, clearly labelled, so a first launch without a
 *     network shows something instead of an empty screen.
 *
 * HONESTY RULES (docs/UI_SPEC.md, AGENTS.md):
 *  - The bundled archive is never presented as live university data. The
 *    status store says where the list came from and the screen says so.
 *  - A notice has ONE identity, no matter whether it arrived from the worker
 *    or from the on-device scrape, so it is never listed twice.
 *  - A broadcast payload is re-checked against the database before it is
 *    written to the cache or shown as an official notice.
 */
import { useQuery } from '@tanstack/react-query';
import {
  MOCK_NOTICES,
  NoticeItem,
  cleanNoticeTitle,
  detectNoticeAudience,
  extractNoticeDeadline,
  fileTypeForUrl,
  getCanonicalNoticeKey,
  generateCanonicalNoticeId,
  groupNoticeThreads,
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

/**
 * The identity of a notice inside the app.
 *
 * The worker writes a row with a uuid primary key and a `source_id` of
 * `src_<hash>`, the on-device scrape produces `lt_<source>_<hash>`, and the
 * admin console produces `admin_notice_<stamp>`. Those three ids describe the
 * same notice, so the app derives ONE canonical id from the notice itself
 * (source + document URL, or source + title + date) and uses it everywhere.
 * Admin notices keep their own id, because the admin console addresses them
 * by that id.
 */
function canonicalIdOf(notice: {
  source?: string;
  fileUrl?: string | null;
  title?: string | null;
  cleanTitle?: string | null;
  postedAt?: string | null;
}): string {
  return generateCanonicalNoticeId(notice);
}

/** The key a notice is merged on when its document URL is not identical. */
function topicKeyOf(notice: {
  title?: string | null;
  cleanTitle?: string | null;
  postedAt?: string | null;
}): string {
  const title = (notice.cleanTitle || notice.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  const date = (notice.postedAt || '').split('T')[0].trim();
  return `${title}|${date}`;
}

/** Only safe characters are allowed in a PostgREST filter value. */
function sanitiseFilterValue(value: string): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed.length > 128) return null;
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null;
}

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

  const source = (r.source as NoticeItem['source']) ?? 'main';
  const sourceId = String(r.source_id ?? '');
  const fileUrl = String(r.file_url ?? '');
  const postedAt = String(r.posted_at ?? new Date().toISOString());
  const canonicalId = canonicalIdOf({
    source,
    fileUrl,
    title,
    cleanTitle: String(r.clean_title ?? cleanNoticeTitle(title)),
    postedAt,
  });

  return {
    id: canonicalId,
    source,
    // The provider's own id is kept for provenance and for the admin
    // console's addressing, but it is never the app's identity.
    sourceId: sourceId || canonicalId,
    title,
    cleanTitle: String(r.clean_title ?? cleanNoticeTitle(title)),
    postedAt,
    fileUrl,
    fileType: fileTypeForUrl(fileUrl),
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
    // The app shows the archive instead, so say why in the log.
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

/**
 * The cache is keyed on `source_id`, so a notice is stored under the identity
 * the app uses. Without this the worker copy (`src_…`) and the device copy
 * (`lt_…`) would both sit in the cache and the notice would be listed twice
 * on the next cold start.
 */
function forCache(notice: NoticeItem): NoticeItem {
  return { ...notice, sourceId: notice.id };
}

/**
 * Removes the cached notices that the university no longer publishes, so a
 * withdrawn notice does not stay on the phone forever.
 *
 * Only university notices are pruned, and only after every source answered,
 * so a failed refresh can never wipe the cache.
 */
function pruneCachedNotices(liveIds: Set<string>): void {
  const cached = readCachedNotices();
  for (const notice of cached) {
    if (!notice?.id) continue;
    if (notice.source !== 'main' && notice.source !== 'exams') continue;
    if (liveIds.has(notice.id) || liveIds.has(notice.sourceId)) continue;
    deleteCachedNotice(notice.id);
    if (notice.sourceId !== notice.id) deleteCachedNotice(notice.sourceId);
  }
}

/**
 * The broadcasts that were checked against the database, newest last.
 *
 * A broadcast that arrives while a refresh is in flight is newer than what
 * that refresh reads, so it is applied again on top of the refresh result.
 */
const validatedBroadcasts = new Map<string, { notice: NoticeItem; at: number }>();

/**
 * Reads a notice straight from the database.
 *
 * A broadcast payload is only a claim: it could have been crafted by anyone
 * who found the channel name. The database is the only source that can
 * confirm that the notice really exists, so nothing is written to the cache
 * or shown as an official notice before this check.
 */
async function fetchNoticeFromDatabase(rawId: string): Promise<NoticeItem | null> {
  if (!isSupabaseConfigured) return null;
  const id = sanitiseFilterValue(rawId);
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .or(`id.eq.${id},source_id.eq.${id}`)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return rowToNotice((data as Record<string, unknown>[])[0]);
  } catch {
    return null;
  }
}

/**
 * True when the database still holds the notice. Used before a delete event
 * is honoured, so a forged broadcast cannot empty the student's cache.
 */
async function noticeStillInDatabase(rawId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const id = sanitiseFilterValue(rawId);
  if (!id) return false;
  try {
    const { data, error } = await supabase
      .from('notices')
      .select('id')
      .or(`id.eq.${id},source_id.eq.${id}`)
      .limit(1);
    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * How a broadcast is checked before it is believed.
 *
 * The default reader is the database. Tests can pass their own, which is how
 * this behaviour is verified without a live project.
 */
export type BroadcastNoticeReader = (rawId: string) => Promise<NoticeItem | null>;

/**
 * Turns a broadcast payload into a notice the app is willing to show.
 *
 * A payload is a claim, nothing more: it could have been written by anyone
 * who found the channel name. The notice is therefore read back from the
 * database, and the payload is only used for the lookup. When the database
 * does not confirm the notice, `null` comes back and nothing is written to
 * the cache and nothing is shown as an official notice.
 */
export async function resolveBroadcastNotice(
  payload: unknown,
  read: BroadcastNoticeReader = fetchNoticeFromDatabase,
): Promise<NoticeItem | null> {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as { id?: unknown; sourceId?: unknown };
  const rawId =
    typeof candidate.id === 'string' && candidate.id
      ? candidate.id
      : typeof candidate.sourceId === 'string' && candidate.sourceId
        ? candidate.sourceId
        : '';
  if (!rawId) return null;
  // A payload with an id that could change the meaning of the filter is
  // rejected before it reaches the database.
  if (!sanitiseFilterValue(rawId)) return null;
  return read(rawId);
}

/**
 * Gives a notice the app's own identity.
 *
 * The worker writes a uuid primary key and a `src_` id, the on-device scrape
 * writes an `lt_` id, and the admin console writes an `admin_notice_` id. For
 * everything the university published, the identity is derived from the
 * notice itself, so the two copies of one notice are one entry with one id.
 *
 * Admin notices keep their own id: the admin console addresses them by it.
 */
function withCanonicalIdentity(notice: NoticeItem): NoticeItem {
  if (notice.source === 'admin') return notice;
  const canonical = canonicalIdOf(notice);
  if (!canonical || canonical === notice.id) return notice;
  return { ...notice, id: canonical };
}

/**
 * Merges the notices of every source into one list.
 *
 * A notice that arrives from the worker and the same notice that arrives
 * from the on-device scrape are ONE notice: they are matched on the
 * canonical id, on the document key and on the title plus the date, so the
 * list never shows a notice twice.
 */
export function mergeNoticeList(
  notices: NoticeItem[],
  deletedIds: Iterable<string> = [],
): NoticeItem[] {
  const deletedSet = new Set(deletedIds);
  const canonicalMap = new Map<string, NoticeItem>();
  const idToCanonical = new Map<string, string>();
  const topicToCanonical = new Map<string, string>();

  const addOrMergeNotice = (n: NoticeItem) => {
    if (!n || !n.id) return;
    const canonical = canonicalIdOf(n);
    // A withdrawn notice is hidden by every id it can be known by.
    if (deletedSet.has(n.id) || deletedSet.has(n.sourceId) || deletedSet.has(canonical)) return;
    const key = getCanonicalNoticeKey(n);
    if (deletedSet.has(key)) return;

    const topicKey = topicKeyOf(n);
    let existingKey =
      idToCanonical.get(n.id) ??
      idToCanonical.get(n.sourceId) ??
      idToCanonical.get(canonical) ??
      (canonicalMap.has(key) ? key : undefined) ??
      (topicToCanonical.has(topicKey) ? topicToCanonical.get(topicKey) : undefined);

    if (existingKey !== undefined && canonicalMap.has(existingKey)) {
      canonicalMap.set(
        existingKey,
        withCanonicalIdentity(mergeNoticeItems(canonicalMap.get(existingKey)!, n)),
      );
    } else {
      existingKey = key;
      canonicalMap.set(key, withCanonicalIdentity(n));
    }

    idToCanonical.set(n.id, existingKey);
    idToCanonical.set(n.sourceId, existingKey);
    idToCanonical.set(canonical, existingKey);
    topicToCanonical.set(topicKey, existingKey);
  };

  for (const notice of notices) {
    addOrMergeNotice(notice);
  }

  return Array.from(canonicalMap.values()).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );
}

/**
 * The message the screen shows when the refresh did not reach the university.
 */
function failureReason(errors: string[]): string {
  if (errors.length === 0) return 'The university pages could not be reached.';
  return `The university pages could not be reached: ${errors.join('; ')}`;
}

/**
 * Loads the notices for the screen and says where they came from.
 *
 * The status is the honest signal: `live` when the university or the
 * database answered, `cache` when the phone shows its own copy, and `sample`
 * when the bundled archive is all that is left. The bundled archive is never
 * reported as live.
 */
export async function fetchNoticesForScreen(): Promise<NoticeItem[]> {
  const startedAt = Date.now();
  const setNoticesStatus = useNoticesStatusStore.getState().set;

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

  // 4. Combine all sources into one list
  const mergedNotices = mergeNoticeList(
    [
      ...cloudPayload.notices,
      ...(live ?? []),
      ...fromUniversity.notices,
    ],
    deletedSet,
  );

  // Ensure OCR rawText from SQLite cache is never dropped across sync intervals
  const cached = readCachedNotices();
  if (cached && cached.length > 0) {
    for (const c of cached) {
      if (!c?.rawText) continue;
      const cachedKey = getCanonicalNoticeKey(c);
      const match = mergedNotices.find(
        (n) =>
          n.id === c.id ||
          n.sourceId === c.sourceId ||
          getCanonicalNoticeKey(n) === cachedKey,
      );
      if (match && !match.rawText) {
        match.rawText = c.rawText;
      }
    }
  }

  // A broadcast that arrived while we were fetching is newer than what we
  // just read, so the newest payload wins.
  for (const entry of validatedBroadcasts.values()) {
    if (entry.at < startedAt) continue;
    const index = mergedNotices.findIndex(
      (n) => n.id === entry.notice.id || n.sourceId === entry.notice.id,
    );
    if (index >= 0) {
      mergedNotices[index] = mergeNoticeItems(mergedNotices[index], entry.notice);
    } else {
      mergedNotices.unshift(entry.notice);
    }
  }

  if (mergedNotices.length > 0) {
    writeCachedNotices(mergedNotices.map(forCache));
    // The university pages answered, so anything else the cache holds for
    // those sources has been withdrawn.
    if (fromUniversity.errors.length === 0) {
      pruneCachedNotices(new Set(mergedNotices.map((n) => n.id)));
    }
    setNoticesStatus({
      source: 'live',
      liveCount: mergedNotices.length,
      sources: fromUniversity.sources,
      reason: fromUniversity.errors.join('; ') || undefined,
    });
    return groupNoticeThreads(mergedNotices);
  }

  const filteredCached = cached.filter(
    (n) => n && n.id && !deletedSet.has(n.id) && !deletedSet.has(n.sourceId)
  );
  if (filteredCached.length > 0) {
    setNoticesStatus({
      source: 'cache',
      liveCount: filteredCached.length,
      reason: fromUniversity.errors.join('; '),
    });
    // The screen keeps showing the saved copy, but it also has to say that
    // the refresh failed, so the failure is raised as an error.
    queryClient.setQueryData<NoticeItem[]>(
      NOTICE_QUERY_KEY,
      groupNoticeThreads(filteredCached),
    );
    throw new Error(failureReason(fromUniversity.errors));
  }

  // Nothing live and nothing cached: the bundled archive is the last resort.
  // It is labelled as the archive, never as live university data.
  const filteredReal = MOCK_NOTICES.filter(
    (n) => n && n.id && !deletedSet.has(n.id) && !deletedSet.has(n.sourceId)
  );
  setNoticesStatus({
    source: 'sample',
    liveCount: filteredReal.length,
    reason: fromUniversity.errors.join('; '),
  });
  queryClient.setQueryData<NoticeItem[]>(
    NOTICE_QUERY_KEY,
    groupNoticeThreads(filteredReal),
  );
  throw new Error(failureReason(fromUniversity.errors));
}

export function useNoticesQuery() {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // The channel is private: only a moderator (a signed-in admin) can join
    // it and broadcast on it.
    const channel = supabase.channel(NOTICES_REALTIME_CHANNEL, {
      config: { private: true },
    });
    channel
      .on('broadcast', { event: 'notice_deleted' }, (msg) => {
        const id = msg?.payload?.id;
        if (!id) return;
        void (async () => {
          // Only honour the deletion when the database agrees that the
          // notice is really gone.
          if (await noticeStillInDatabase(String(id))) return;
          queryClient.setQueryData<NoticeItem[]>(NOTICE_QUERY_KEY, (old) =>
            (old ?? []).filter((n) => n.id !== id && n.sourceId !== id),
          );
          deleteCachedNotice(String(id));
          void getLocalDeletedNoticeIds().then((existing) => {
            if (!existing.includes(id)) {
              void setLocalDeletedNoticeIds([...existing, id]);
            }
          });
        })();
      })
      .on('broadcast', { event: 'notice_published' }, (msg) => {
        void (async () => {
          // The payload itself is never trusted: the notice is read back from
          // the database first, and only the confirmed notice is stored.
          const notice = await resolveBroadcastNotice(msg?.payload);
          if (!notice) return;
          validatedBroadcasts.set(notice.id, { notice, at: Date.now() });
          queryClient.setQueryData<NoticeItem[]>(NOTICE_QUERY_KEY, (old) => {
            const list = old ?? [];
            const filtered = list.filter((n) => n.id !== notice.id && n.sourceId !== notice.id);
            return [notice, ...filtered];
          });
          writeCachedNotices([forCache(notice)]);
        })();
      })
      .on('broadcast', { event: 'notice_updated' }, (msg) => {
        void (async () => {
          const notice = await resolveBroadcastNotice(msg?.payload);
          if (!notice) return;
          validatedBroadcasts.set(notice.id, { notice, at: Date.now() });
          queryClient.setQueryData<NoticeItem[]>(NOTICE_QUERY_KEY, (old) => {
            const list = old ?? [];
            const index = list.findIndex((n) => n.id === notice.id || n.sourceId === notice.id);
            if (index < 0) return [notice, ...list];
            const next = [...list];
            next[index] = mergeNoticeItems(next[index], notice);
            return next;
          });
          writeCachedNotices([forCache(notice)]);
        })();
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
    queryFn: fetchNoticesForScreen,
    // Instant paint: seed the cache synchronously at query creation.
    initialData: () => {
      const cached = readCachedNotices();
      const filtered = cached.filter((n) => n && n.id);
      return filtered.length > 0 ? filtered : MOCK_NOTICES;
    },
    // The seeded data is treated as stale from the start, so the query really
    // does fetch. Without this the seed counts as fresh for the whole
    // staleTime and the app would never ask the university for anything.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
    // The screen promises an update every 15 minutes, so the query does it.
    refetchInterval: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export default useNoticesQuery;
