/**
 * GBU One — Worker Supabase client (service-role) + persistence helpers.
 * Worker-only: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
 * All writes are idempotent on the deterministic `source_id` hash produced
 * by generateSourceId() (noticesJob.ts) — reruns never duplicate rows.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA_SQL } from '../supabase/schema';
import type { NoticeItem } from '../src/features/notices/noticeService';

let client: SupabaseClient | null = null;

export function getWorkerSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function isWorkerSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Creates missing tables; safe to call on every run (IF NOT EXISTS). */
export async function ensureSchema(): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc('exec_sql', { sql: SCHEMA_SQL });
    if (error) {
      console.warn('Worker: ensureSchema rpc unavailable:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Worker: ensureSchema failed:', err);
    return false;
  }
}

function toRow(n: NoticeItem): Record<string, unknown> {
  return {
    source: n.source,
    source_id: n.sourceId,
    title: n.title,
    clean_title: n.cleanTitle,
    posted_at: n.postedAt,
    file_url: n.fileUrl,
    file_type: n.fileType,
    raw_text: n.rawText ?? null,
    category: n.category,
    audience: n.audience ?? {},
    importance: n.importance,
    deadline_at: n.deadlineAt ?? null,
    thread_id: n.threadId ?? null,
    thread_update_count: n.threadUpdateCount ?? 0,
  };
}

/** Upserts notices keyed on source_id. Returns count of rows written. */
export async function upsertNotices(notices: NoticeItem[]): Promise<number> {
  const sb = getWorkerSupabase();
  if (!sb || notices.length === 0) return 0;
  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < notices.length; i += BATCH) {
    const batch = notices.slice(i, i + BATCH).map(toRow);
    try {
      const { error } = await sb
        .from('notices')
        .upsert(batch, { onConflict: 'source_id' });
      if (error) {
        console.warn('Worker: notices upsert failed:', error.message);
      } else {
        written += batch.length;
      }
    } catch (err) {
      console.warn('Worker: notices upsert threw:', err);
    }
  }
  return written;
}

/**
 * Parses a deadline found in the extracted text into an ISO timestamp.
 * Recognises the "31 Oct 2026", "31-10-2026" and "31/10/2026" shapes.
 */
export function parseDeadlineToIso(value: string): string | null {
  const cleaned = value.trim().replace(/[,\s]+$/, '');
  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];

  const named = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(cleaned);
  if (named) {
    const day = Number(named[1]);
    const month = monthNames.indexOf(named[2].slice(0, 3).toLowerCase());
    const year = Number(named[3]);
    if (month >= 0 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day, 23, 59, 0)).toISOString();
    }
  }

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(cleaned);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const year = Number(numeric[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day, 23, 59, 0)).toISOString();
    }
  }

  return null;
}

/**
 * Stores the extracted text for a notice.
 * `raw_text` is only written when it is not already populated, so a later
 * re-scan never overwrites a better extraction. A deadline revealed by the
 * document fills `deadline_at` when the title alone did not reveal one.
 */
export async function saveNoticeRawText(
  sourceId: string,
  rawText: string,
  extractedDeadlines: string[] = [],
): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb || !sourceId || !rawText) return false;

  try {
    // `raw_text` is only written when it is not already populated, so a later
    // re-scan never overwrites a better extraction.
    const { error } = await sb
      .from('notices')
      .update({ raw_text: rawText })
      .eq('source_id', sourceId)
      .is('raw_text', null);
    if (error) {
      console.warn('Worker: notice raw_text update failed:', error.message);
      return false;
    }
  } catch (err) {
    console.warn('Worker: notice raw_text update threw:', err);
    return false;
  }

  // A deadline revealed by the document fills `deadline_at` when the title
  // alone did not reveal one.
  const deadlineIso = extractedDeadlines
    .map((d) => parseDeadlineToIso(d))
    .find((d): d is string => d !== null);
  if (deadlineIso) {
    try {
      await sb
        .from('notices')
        .update({ deadline_at: deadlineIso })
        .eq('source_id', sourceId)
        .is('deadline_at', null);
    } catch (err) {
      console.warn('Worker: notice deadline update threw:', err);
    }
  }

  return true;
}

/**
 * Content-hash keys already processed. The same file is never downloaded or
 * OCR'd twice, even if it is attached to several notices.
 */
export async function fetchProcessedAttachmentHashes(limit = 20000): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const hashes = new Set<string>();
  if (!sb) return hashes;
  try {
    const { data } = await sb
      .from('notice_attachments')
      .select('content_hash')
      .limit(limit);
    for (const row of (data ?? []) as Array<{ content_hash: string }>) {
      if (row?.content_hash) hashes.add(row.content_hash);
    }
  } catch {
    // ignore
  }
  return hashes;
}

/**
 * Notice ids whose attachment was already downloaded and extracted.
 * The university is scraped politely, so a notice is fetched once and then
 * left alone.
 */
export async function fetchProcessedAttachmentSources(limit = 20000): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const sources = new Set<string>();
  if (!sb) return sources;
  try {
    const { data } = await sb
      .from('notice_attachments')
      .select('source_id')
      .limit(limit);
    for (const row of (data ?? []) as Array<{ source_id: string }>) {
      if (row?.source_id) sources.add(row.source_id);
    }
  } catch {
    // ignore
  }
  return sources;
}

/** Records a processed attachment so it is never processed again. */
export async function recordAttachmentProcessing(rows: Array<{
  contentHash: string;
  sourceId: string;
  fileUrl: string;
  fileName: string;
  kind: string;
  byteSize: number;
  provider: string;
  isScanned: boolean;
  extractedDeadlines: string[];
  rawTextLength: number;
}>): Promise<number> {
  const sb = getWorkerSupabase();
  if (!sb || rows.length === 0) return 0;
  const BATCH = 50;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      content_hash: r.contentHash,
      source_id: r.sourceId,
      file_url: r.fileUrl,
      file_name: r.fileName,
      kind: r.kind,
      byte_size: r.byteSize,
      provider: r.provider,
      is_scanned: r.isScanned,
      extracted_deadlines: r.extractedDeadlines,
      raw_text_length: r.rawTextLength,
      processed_at: new Date().toISOString(),
    }));
    try {
      const { error } = await sb
        .from('notice_attachments')
        .upsert(batch, { onConflict: 'content_hash' });
      if (error) {
        console.warn('Worker: attachment record upsert failed:', error.message);
      } else {
        written += batch.length;
      }
    } catch (err) {
      console.warn('Worker: attachment record upsert threw:', err);
    }
  }
  return written;
}


export async function recordWorkerRun(
  source: string,
  status: 'ok' | 'error',
  itemsFound: number,
  itemsNew: number,
  error?: string
): Promise<void> {
  const sb = getWorkerSupabase();
  if (!sb) return;
  try {
    await sb.from('worker_runs').insert({
      source,
      status,
      items_found: itemsFound,
      items_new: itemsNew,
      error: error ?? null,
    });
  } catch {
    // observability must never fail the run
  }
}

/** Known source_ids already stored — lets the job skip push for old items. */
export async function fetchKnownSourceIds(limit = 5000): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const known = new Set<string>();
  if (!sb) return known;
  try {
    const { data } = await sb.from('notices').select('source_id').limit(limit);
    for (const r of (data ?? []) as Array<{ source_id: string }>) {
      if (r?.source_id) known.add(r.source_id);
    }
  } catch {
    // ignore
  }
  return known;
}

export interface StoredTimetableSnapshot {
  classKey: string;
  hash: string;
  payload: unknown;
}

/**
 * Loads the last known timetable snapshot per class so the worker can diff
 * against the previous run (the worker itself is stateless between runs).
 */
export async function fetchTimetableSnapshots(
  limit = 2000,
): Promise<Map<string, StoredTimetableSnapshot>> {
  const sb = getWorkerSupabase();
  const out = new Map<string, StoredTimetableSnapshot>();
  if (!sb) return out;
  try {
    const { data } = await sb
      .from('timetable_snapshots')
      .select('class_key,hash,payload')
      .limit(limit);
    for (const r of (data ?? []) as Array<{ class_key: string; hash: string; payload: unknown }>) {
      if (!r?.class_key) continue;
      out.set(r.class_key, { classKey: r.class_key, hash: r.hash ?? '', payload: r.payload });
    }
  } catch {
    // ignore — treated as a cold start (baseline only, no diffs)
  }
  return out;
}

/** Upserts the latest snapshot per class (one row per class_key). */
export async function upsertTimetableSnapshots(
  rows: Array<{ classKey: string; hash: string; payload: unknown }>,
): Promise<number> {
  const sb = getWorkerSupabase();
  if (!sb || rows.length === 0) return 0;
  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((row) => ({
      class_key: row.classKey,
      hash: row.hash,
      payload: row.payload,
      fetched_at: new Date().toISOString(),
    }));
    try {
      const { error } = await sb
        .from('timetable_snapshots')
        .upsert(batch, { onConflict: 'class_key' });
      if (error) {
        console.warn('Worker: timetable snapshot upsert failed:', error.message);
      } else {
        written += batch.length;
      }
    } catch (err) {
      console.warn('Worker: timetable snapshot upsert threw:', err);
    }
  }
  return written;
}

/** Appends detected timetable changes to the change history. */
export async function recordTimetableChanges(
  changes: Array<{ classKey: string; diff: unknown }>,
): Promise<number> {
  const sb = getWorkerSupabase();
  if (!sb || changes.length === 0) return 0;
  const BATCH = 100;
  let written = 0;
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH).map((change) => ({
      class_key: change.classKey,
      diff: change.diff,
      detected_at: new Date().toISOString(),
    }));
    try {
      const { error } = await sb.from('timetable_changes').insert(batch);
      if (error) {
        console.warn('Worker: timetable change insert failed:', error.message);
      } else {
        written += batch.length;
      }
    } catch (err) {
      console.warn('Worker: timetable change insert threw:', err);
    }
  }
  return written;
}

/** Change keys already pushed — used to keep pushes one-per-change. */
export async function fetchPushedChangeKeys(limit = 5000): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const keys = new Set<string>();
  if (!sb) return keys;
  try {
    const { data } = await sb.from('timetable_push_log').select('change_key').limit(limit);
    for (const r of (data ?? []) as Array<{ change_key: string }>) {
      if (r?.change_key) keys.add(r.change_key);
    }
  } catch {
    // ignore
  }
  return keys;
}

/** Records a successful timetable push so it is never sent twice. */
export async function markTimetablePush(
  changeKey: string,
  classKey: string,
  semesterSessionId: string,
  recipients: number,
): Promise<void> {
  const sb = getWorkerSupabase();
  if (!sb) return;
  try {
    await sb.from('timetable_push_log').upsert(
      {
        change_key: changeKey,
        class_key: classKey,
        semester_session_id: semesterSessionId,
        recipients,
        pushed_at: new Date().toISOString(),
      },
      { onConflict: 'change_key' },
    );
  } catch {
    // observability must never fail the run
  }
}
