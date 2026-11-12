/**
 * GBU One — Admin Notices Service & Cloud Sync Pipeline
 *
 * Dual write (Supabase Postgres + Supabase Storage) with tombstone deletion
 * tracking, offline caching and instant delivery to every student device.
 *
 * HOW THE WRITES ARE AUTHORISED
 *
 * Every write goes out with the SIGNED-IN moderator's session token, never
 * with a service-role key. The database policies only let a moderator write
 * to `notices` and to the `campus-events` bucket, and the client must never
 * hold a secret that could bypass them. A write that the server refuses is
 * reported as a failure - the admin console must never claim that a notice
 * was published when it was not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoticeItem, cleanNoticeTitle } from './noticeService';
import { writeCachedNotices, deleteCachedNotice } from '../../lib/db';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const ADMIN_NOTICES_STORAGE_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/campus-events/notices.json';
export const ADMIN_NOTICES_PUBLIC_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/campus-events/notices.json';
export const LOCAL_ADMIN_NOTICES_KEY = '@gbu_one_admin_notices';
export const LOCAL_DELETED_NOTICES_KEY = '@gbu_one_deleted_notices';
export const NOTICES_REALTIME_CHANNEL = 'gbu_notices';

export function broadcastNoticeEvent(
  event: 'notice_published' | 'notice_updated' | 'notice_deleted',
  payload: any,
): void {
  if (!isSupabaseConfigured) return;
  try {
    // The channel is private: only a signed-in moderator may join it. The
    // realtime client carries that moderator's own token, so the broadcast is
    // authorised as the moderator and not as the public anon key.
    const channel = supabase.channel(NOTICES_REALTIME_CHANNEL, {
      config: { private: true },
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel
          .send({
            type: 'broadcast',
            event,
            payload,
          })
          .catch((err) => {
            console.warn('Realtime notice broadcast warning:', err);
          })
          .finally(() => {
            setTimeout(() => {
              void supabase.removeChannel(channel);
            }, 1000);
          });
      }
    });
  } catch (err) {
    console.warn('Realtime notice broadcast warning:', err);
  }
}

const SUPABASE_REST_NOTICES_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/rest/v1/notices';

/**
 * The public (read-only) key of the project. It identifies the project; it
 * does not authorise a write.
 */
function getAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
}

/**
 * The headers every cloud write uses.
 *
 * The bearer token is the signed-in moderator's own access token, so the
 * database's moderator-only policies decide whether the write is allowed.
 * The client never reads a service-role key.
 */
async function getWriteAuthHeaders(): Promise<Record<string, string>> {
  const anonKey = getAnonKey();
  let accessToken = '';
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token ?? '';
  } catch {
    // No session: the write will be refused by the server, which is the
    // correct answer for a moderator-only table.
  }
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Only safe characters may appear in a PostgREST filter value. Anything else
 * could change the meaning of the filter, so it is rejected outright.
 */
export function sanitisePostgrestValue(raw: string): string | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > 128) return null;
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

/** The reason a failed response gives, in a form the admin console can show. */
async function describeFailure(res: Response, what: string): Promise<string> {
  let detail = '';
  try {
    const body = await res.text();
    if (body) {
      try {
        const parsed = JSON.parse(body) as { message?: string; error?: string };
        detail = parsed.message || parsed.error || body.slice(0, 200);
      } catch {
        detail = body.slice(0, 200);
      }
    }
  } catch {
    // ignore
  }
  return `${what} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`;
}

export interface CloudNoticesPayload {
  notices: NoticeItem[];
  deletedIds: string[];
  updatedAt?: string;
}

export async function getLocalDeletedNoticeIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_DELETED_NOTICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setLocalDeletedNoticeIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_DELETED_NOTICES_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export async function getLocalAdminNotices(): Promise<NoticeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ADMIN_NOTICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setLocalAdminNotices(notices: NoticeItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_ADMIN_NOTICES_KEY, JSON.stringify(notices));
  } catch {
    // ignore
  }
}

/**
 * Fetches all published notices from the Cloud Storage CDN and Supabase Postgres.
 * Tombstoned notices (in deletedIds) are strictly filtered out.
 */
export async function fetchCloudNotices(): Promise<{
  notices: NoticeItem[];
  deletedIds: string[];
}> {
  const cloudPayload: CloudNoticesPayload = { notices: [], deletedIds: [] };
  const localDeleted = await getLocalDeletedNoticeIds();
  const allDeletedIds = new Set<string>(localDeleted);

  // 1. Fetch from Public Storage CDN (fast, unauthenticated, never blocked)
  try {
    const res = await fetch(`${ADMIN_NOTICES_PUBLIC_URL}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        if (Array.isArray(data.notices)) {
          cloudPayload.notices = data.notices;
        }
        if (Array.isArray(data.deletedIds)) {
          cloudPayload.deletedIds = data.deletedIds;
          data.deletedIds.forEach((id: string) => allDeletedIds.add(id));
        }
      }
    }
  } catch {
    // ignore network error
  }

  // 2. Fetch from Supabase Postgres notices table with the project key.
  //    Reads are allowed for everybody; a signed-in moderator simply sees the
  //    same rows.
  let pgNotices: NoticeItem[] = [];
  try {
    const headers = await getWriteAuthHeaders();
    // Match either source=admin or source_id like admin_notice_* so custom portal sources pushed by admin are not excluded
    const pgRes = await fetch(
      `${SUPABASE_REST_NOTICES_URL}?or=(source.eq.admin,source_id.like.admin_notice_*)&select=*&order=posted_at.desc&limit=50`,
      { headers }
    );
    if (pgRes.ok) {
      const rows = await pgRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        pgNotices = rows.map((r: Record<string, unknown>) => ({
          id: String(r.id || r.source_id || ''),
          source: (r.source as NoticeItem['source']) || 'admin',
          sourceId: String(r.source_id || r.id || ''),
          title: String(r.title || ''),
          cleanTitle: String(r.clean_title || r.title || ''),
          postedAt: String(r.posted_at || new Date().toISOString()),
          fileUrl: String(r.file_url || ''),
          fileType: (() => {
            const u = String(r.file_url || '').toLowerCase();
            if (u.includes('.pdf')) return 'pdf';
            if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => u.includes(ext))) return 'image';
            return 'html';
          })(),
          category: (r.category as NoticeItem['category']) || 'other',
          audience: (r.audience as NoticeItem['audience']) || { all: true },
          importance: Number(r.importance || 4),
          deadlineAt: (r.deadline_at as string | null) || null,
          isSample: false,
        }));
      }
    }
  } catch {
    // ignore
  }

  // Fallback to Supabase JS client if REST returned nothing and Supabase is configured
  if (pgNotices.length === 0 && isSupabaseConfigured) {
    try {
      const { data: rows } = await supabase
        .from('notices')
        .select('*')
        .or('source.eq.admin,source_id.like.admin_notice_*')
        .order('posted_at', { ascending: false })
        .limit(50);
      if (Array.isArray(rows) && rows.length > 0) {
        pgNotices = rows.map((r: Record<string, unknown>) => ({
          id: String(r.id || r.source_id || ''),
          source: (r.source as NoticeItem['source']) || 'admin',
          sourceId: String(r.source_id || r.id || ''),
          title: String(r.title || ''),
          cleanTitle: String(r.clean_title || r.title || ''),
          postedAt: String(r.posted_at || new Date().toISOString()),
          fileUrl: String(r.file_url || ''),
          fileType: (() => {
            const u = String(r.file_url || '').toLowerCase();
            if (u.includes('.pdf')) return 'pdf';
            if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => u.includes(ext))) return 'image';
            return 'html';
          })(),
          category: (r.category as NoticeItem['category']) || 'other',
          audience: (r.audience as NoticeItem['audience']) || { all: true },
          importance: Number(r.importance || 4),
          deadlineAt: (r.deadline_at as string | null) || null,
          isSample: false,
        }));
      }
    } catch {
      // ignore
    }
  }

  // 3. Fetch local admin notices from AsyncStorage
  let localNotices: NoticeItem[] = [];
  try {
    localNotices = await getLocalAdminNotices();
  } catch {
    // ignore
  }

  // Combine and deduplicate
  const map = new Map<string, NoticeItem>();
  for (const n of [...cloudPayload.notices, ...pgNotices, ...localNotices]) {
    if (!n || !n.id) continue;
    if (allDeletedIds.has(n.id) || allDeletedIds.has(n.sourceId)) continue;
    map.set(n.id, n);
  }

  const activeNotices = Array.from(map.values()).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  // Sync tombstones locally
  if (cloudPayload.deletedIds.length > 0) {
    void setLocalDeletedNoticeIds(Array.from(allDeletedIds));
  }

  return {
    notices: activeNotices,
    deletedIds: Array.from(allDeletedIds),
  };
}

/**
 * Publishes an official notice to both Supabase Storage and Supabase Postgres,
 * writing to local SQLite and AsyncStorage.
 *
 * The result reports the truth: a notice is only "published" when at least
 * one cloud sink accepted it. A local-only write (the copy on the publishing
 * device) is NOT a publication, and the function says so.
 */
export async function publishNoticeToCampus(params: {
  title: string;
  category: NoticeItem['category'];
  source?: NoticeItem['source'];
  importance?: number;
  fileUrl?: string;
  deadlineAt?: string | null;
}): Promise<{ ok: boolean; notice?: NoticeItem; error?: string }> {
  const trimmed = params.title.trim();
  if (!trimmed) {
    return { ok: false, error: 'Notice title is required.' };
  }

  const noticeId = `admin_notice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const cleanTitle = cleanNoticeTitle(trimmed);
  const fileUrl = params.fileUrl?.trim() || 'https://www.gbu.ac.in';
  const isPdf = fileUrl.toLowerCase().includes('.pdf');
  const isImg = ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => fileUrl.toLowerCase().includes(ext));
  const fileType: NoticeItem['fileType'] = isPdf ? 'pdf' : isImg ? 'image' : 'html';

  const newNotice: NoticeItem = {
    id: noticeId,
    source: 'admin',
    sourceId: noticeId,
    title: trimmed,
    cleanTitle,
    postedAt: new Date().toISOString(),
    fileUrl,
    fileType,
    category: params.category || 'other',
    audience: { all: true },
    importance: params.importance ?? 4,
    deadlineAt: params.deadlineAt ? new Date(params.deadlineAt).toISOString() : null,
    isSample: false,
  };

  // 1. Remove this ID from local tombstones if it was ever deleted
  const localDeleted = await getLocalDeletedNoticeIds();
  if (localDeleted.includes(noticeId)) {
    const updatedDeleted = localDeleted.filter((id) => id !== noticeId);
    await setLocalDeletedNoticeIds(updatedDeleted);
  }

  const authHeaders = await getWriteAuthHeaders();
  const failures: string[] = [];
  let storageWritten = false;

  // 2. Dual Write to Cloud Storage CDN (campus-events/notices.json)
  try {
    let existingNotices: NoticeItem[] = [];
    let existingDeleted: string[] = [];

    const getRes = await fetch(`${ADMIN_NOTICES_PUBLIC_URL}?t=${Date.now()}`);
    if (getRes.ok) {
      const data = await getRes.json();
      if (data && typeof data === 'object') {
        if (Array.isArray(data.notices)) existingNotices = data.notices;
        if (Array.isArray(data.deletedIds)) existingDeleted = data.deletedIds;
      }
    }

    const filtered = existingNotices.filter((n) => n.id !== noticeId && n.sourceId !== noticeId);
    const updatedNotices = [newNotice, ...filtered].slice(0, 100);
    const updatedDeletedIds = existingDeleted.filter((id) => id !== noticeId);

    const payload: CloudNoticesPayload = {
      notices: updatedNotices,
      deletedIds: updatedDeletedIds,
      updatedAt: new Date().toISOString(),
    };

    const putRes = await fetch(ADMIN_NOTICES_STORAGE_URL, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    if (putRes.ok) {
      storageWritten = true;
    } else if (putRes.status === 404) {
      // The object does not exist yet, so it has to be created.
      const postRes = await fetch(ADMIN_NOTICES_STORAGE_URL, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (postRes.ok) {
        storageWritten = true;
      } else {
        failures.push(await describeFailure(postRes, 'Storage upload'));
      }
    } else {
      failures.push(await describeFailure(putRes, 'Storage upload'));
    }
  } catch (err) {
    failures.push(`Storage upload failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Write to Supabase Postgres notices table via REST
  let postgresWritten = false;
  try {
    const pgPayload = {
      source: 'admin',
      source_id: noticeId,
      title: trimmed,
      clean_title: cleanTitle,
      posted_at: newNotice.postedAt,
      file_url: fileUrl,
      file_type: fileType,
      category: params.category || 'other',
      audience: { all: true },
      importance: newNotice.importance,
      deadline_at: newNotice.deadlineAt,
    };

    const pgRes = await fetch(SUPABASE_REST_NOTICES_URL, {
      method: 'POST',
      headers: { ...authHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(pgPayload),
    });
    if (pgRes.ok) {
      postgresWritten = true;
    } else {
      failures.push(await describeFailure(pgRes, 'Database insert'));
    }
  } catch (err) {
    failures.push(`Database insert failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Save to local AsyncStorage and SQLite
  try {
    const local = await getLocalAdminNotices();
    const updatedLocal = [newNotice, ...local.filter((n) => n.id !== noticeId)];
    await setLocalAdminNotices(updatedLocal);
    writeCachedNotices([newNotice]);
  } catch {
    // ignore
  }

  // 5. Broadcast instant creation to all student devices
  if (storageWritten || postgresWritten) {
    broadcastNoticeEvent('notice_published', newNotice);
  }

  if (!storageWritten && !postgresWritten) {
    return {
      ok: false,
      notice: newNotice,
      error:
        failures.length > 0
          ? `The notice was not published. ${failures.join(' ')}`
          : 'The notice was not published: no cloud sink accepted it.',
    };
  }

  if (failures.length > 0) {
    // One sink worked, so the notice IS out there, but the admin console has
    // to know that the other one did not.
    return {
      ok: true,
      notice: newNotice,
      error: `Published with warnings. ${failures.join(' ')}`,
    };
  }

  return { ok: true, notice: newNotice };
}

/**
 * Updates an existing notice on Cloud Storage, Supabase Postgres, and local cache,
 * and broadcasts the updated payload to all student devices over Supabase Realtime.
 */
export interface UpdateNoticeParams {
  title?: string;
  category?: NoticeItem['category'];
  importance?: number;
  fileUrl?: string;
  deadlineAt?: string | null;
}

export async function updateNoticeOnCampus(
  id: string,
  params: UpdateNoticeParams,
): Promise<{ ok: boolean; notice?: NoticeItem; error?: string }> {
  const safeId = sanitisePostgrestValue(id);
  if (!safeId) {
    return { ok: false, error: 'That notice id is not a valid notice identifier.' };
  }
  try {
    const authHeaders = await getWriteAuthHeaders();
    const failures: string[] = [];
    let written = false;
    let existingNotices: NoticeItem[] = [];
    let existingDeleted: string[] = [];

    // 1. Fetch current list from Storage CDN
    try {
      const getRes = await fetch(`${ADMIN_NOTICES_PUBLIC_URL}?t=${Date.now()}`);
      if (getRes.ok) {
        const data = await getRes.json();
        if (data && typeof data === 'object') {
          if (Array.isArray(data.notices)) existingNotices = data.notices;
          if (Array.isArray(data.deletedIds)) existingDeleted = data.deletedIds;
        }
      }
    } catch {
      // fallback
    }

    if (existingNotices.length === 0) {
      existingNotices = await getLocalAdminNotices();
    }

    const targetIdx = existingNotices.findIndex((n) => n.id === id || n.sourceId === id);
    const existingTarget = targetIdx >= 0 ? existingNotices[targetIdx] : null;

    const target: NoticeItem = existingTarget ?? {
      id,
      source: 'admin',
      sourceId: id,
      title: params.title || 'Updated Notice',
      cleanTitle: cleanNoticeTitle(params.title || 'Updated Notice'),
      postedAt: new Date().toISOString(),
      fileUrl: params.fileUrl || '',
      fileType: 'pdf',
      category: params.category || 'other',
      audience: { all: true },
      importance: params.importance ?? 4,
      isSample: false,
    };

    const updatedTitle = params.title !== undefined ? params.title.trim() : target.title;
    const cleanTitle = cleanNoticeTitle(updatedTitle);
    const updatedFileUrl = params.fileUrl !== undefined ? params.fileUrl : target.fileUrl;
    const fileType = (() => {
      const u = (updatedFileUrl || '').toLowerCase();
      if (u.includes('.pdf')) return 'pdf';
      if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => u.includes(ext))) return 'image';
      return 'html';
    })();

    const updatedNotice: NoticeItem = {
      ...target,
      title: updatedTitle,
      cleanTitle,
      category: params.category ?? target.category,
      importance: params.importance ?? target.importance,
      fileUrl: updatedFileUrl,
      fileType,
      deadlineAt: params.deadlineAt !== undefined ? params.deadlineAt : target.deadlineAt,
    };

    const updatedNotices =
      targetIdx >= 0
        ? existingNotices.map((n, idx) => (idx === targetIdx ? updatedNotice : n))
        : [updatedNotice, ...existingNotices];

    // 2. Dual Write to Cloud Storage CDN
    const payload: CloudNoticesPayload = {
      notices: updatedNotices.slice(0, 100),
      deletedIds: existingDeleted,
      updatedAt: new Date().toISOString(),
    };

    const putRes = await fetch(ADMIN_NOTICES_STORAGE_URL, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    if (putRes.ok) {
      written = true;
    } else {
      failures.push(await describeFailure(putRes, 'Storage upload'));
    }

    // 3. Update in Supabase Postgres notices table via REST.
    //    The admin notice is addressed by `source_id`, which IS the admin id
    //    (the uuid primary key is the database's own).
    try {
      const pgPayload = {
        title: updatedNotice.title,
        clean_title: updatedNotice.cleanTitle,
        category: updatedNotice.category,
        importance: updatedNotice.importance,
        file_url: updatedNotice.fileUrl,
        file_type: updatedNotice.fileType,
        deadline_at: updatedNotice.deadlineAt,
      };
      const pgRes = await fetch(`${SUPABASE_REST_NOTICES_URL}?source_id=eq.${safeId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(pgPayload),
      });
      if (pgRes.ok) {
        written = true;
      } else {
        failures.push(await describeFailure(pgRes, 'Database update'));
      }
    } catch (err) {
      failures.push(`Database update failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Update local storage and cache
    try {
      const local = await getLocalAdminNotices();
      const updatedLocal = local.map((n) => (n.id === id || n.sourceId === id ? updatedNotice : n));
      await setLocalAdminNotices(updatedLocal);
      writeCachedNotices([updatedNotice]);
    } catch {
      // ignore
    }

    if (!written) {
      return {
        ok: false,
        notice: updatedNotice,
        error: `The notice was not updated. ${failures.join(' ')}`.trim(),
      };
    }

    // 5. Instant Realtime broadcast to all student devices
    broadcastNoticeEvent('notice_updated', updatedNotice);

    return {
      ok: true,
      notice: updatedNotice,
      error: failures.length > 0 ? `Updated with warnings. ${failures.join(' ')}` : undefined,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Permanently deletes a notice from all cloud and local stores with tombstone tracking.
 */
export async function deleteNoticeFromCampus(id: string): Promise<{ ok: boolean; error?: string }> {
  const safeId = sanitisePostgrestValue(id);
  if (!safeId) {
    return { ok: false, error: 'That notice id is not a valid notice identifier.' };
  }

  // 1. Add to local tombstones
  const localDeleted = await getLocalDeletedNoticeIds();
  if (!localDeleted.includes(id)) {
    await setLocalDeletedNoticeIds([...localDeleted, id]);
  }

  // 2. Remove from local AsyncStorage and SQLite
  try {
    const local = await getLocalAdminNotices();
    const targetNotice = local.find((n) => n.id === id || n.sourceId === id);
    await setLocalAdminNotices(local.filter((n) => n.id !== id && n.sourceId !== id));
    deleteCachedNotice(id);
    if (targetNotice?.sourceId && targetNotice.sourceId !== id) {
      deleteCachedNotice(targetNotice.sourceId);
    }
  } catch {
    // ignore
  }

  const authHeaders = await getWriteAuthHeaders();
  const failures: string[] = [];
  let deleted = false;

  // 3. Update Cloud Storage CDN tombstones
  try {
    let existingNotices: NoticeItem[] = [];
    let existingDeleted: string[] = [];

    const getRes = await fetch(`${ADMIN_NOTICES_PUBLIC_URL}?t=${Date.now()}`);
    if (getRes.ok) {
      const data = await getRes.json();
      if (data && typeof data === 'object') {
        if (Array.isArray(data.notices)) existingNotices = data.notices;
        if (Array.isArray(data.deletedIds)) existingDeleted = data.deletedIds;
      }
    }

    const updatedNotices = existingNotices.filter((n) => n.id !== id && n.sourceId !== id);
    const updatedDeleted = Array.from(new Set([...existingDeleted, id]));

    const payload: CloudNoticesPayload = {
      notices: updatedNotices,
      deletedIds: updatedDeleted,
      updatedAt: new Date().toISOString(),
    };

    const putRes = await fetch(ADMIN_NOTICES_STORAGE_URL, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    if (putRes.ok) {
      deleted = true;
    } else {
      failures.push(await describeFailure(putRes, 'Storage upload'));
    }
  } catch (err) {
    failures.push(`Storage upload failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Delete from Supabase Postgres notices table via REST.
  //    The admin notice lives under `source_id`; filtering on the uuid
  //    primary key would never match, because the admin id is not a uuid.
  try {
    const delRes = await fetch(`${SUPABASE_REST_NOTICES_URL}?source_id=eq.${safeId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (delRes.ok) {
      deleted = true;
    } else {
      failures.push(await describeFailure(delRes, 'Database delete'));
    }
  } catch (err) {
    failures.push(`Database delete failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4b. Purge via the Supabase JS client, using the sanitised id.
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('notices').delete().eq('source_id', safeId);
      if (!error) {
        deleted = true;
      } else {
        failures.push(`Database delete failed: ${error.message}`);
      }
    } catch (err) {
      failures.push(`Database delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 5. Broadcast instant deletion to all connected devices
  if (deleted) {
    broadcastNoticeEvent('notice_deleted', { id });
  }

  if (!deleted) {
    return {
      ok: false,
      error: `The notice was not deleted. ${failures.join(' ')}`.trim(),
    };
  }

  return { ok: true, error: failures.length > 0 ? `Deleted with warnings. ${failures.join(' ')}` : undefined };
}

/**
 * Reverts / recalls a broadcast notice from campus in real-time.
 * Calls deleteNoticeFromCampus(noticeId) to purge from cloud storage,
 * postgres, and local caches, triggers realtime student deletion,
 * and logs the recall event.
 */
export async function revertNoticeBroadcast(
  noticeId: string,
): Promise<{ ok: boolean; error?: string }> {
  console.log(`[AdminNoticeBroadcast] Recalling broadcast notice: ${noticeId}`);
  const result = await deleteNoticeFromCampus(noticeId);
  if (result.ok) {
    console.log(`[AdminNoticeBroadcast] Recall successful for notice: ${noticeId}`);
  } else {
    console.warn(`[AdminNoticeBroadcast] Recall failed for notice ${noticeId}:`, result.error);
  }
  return result;
}

