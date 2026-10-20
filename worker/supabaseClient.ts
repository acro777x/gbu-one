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
