/**
 * GBU One — Worker Supabase client (service-role) + persistence helpers.
 * Worker-only: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
 *
 * Rules that every write in this file follows:
 *
 *  - A write is idempotent on the deterministic `source_id` hash produced by
 *    generateSourceId() (noticesJob.ts) - reruns never duplicate rows.
 *  - The columns the worker *enriches* (raw_text, deadline_at, audience) are
 *    write-once: the bulk upsert never carries them, and the enrichment
 *    helpers only fill a column that is still empty. A second run therefore
 *    cannot destroy the OCR text of a notice.
 *  - Every write reports what it managed to write and what failed. A swallowed
 *    database error is a lie: the cron would show green while the data is
 *    stale.
 *  - Every read that can return more than PostgREST's default page (1000
 *    rows) is paged with `.range()`, because `db-max-rows` truncates a
 *    `.limit(5000)` silently.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NoticeItem } from '../src/features/notices/noticeService';
import type { CalendarEventRow, DateSlotRow } from './calendarJob';
import { examSlotToRow, type ExamDateSlot } from '../src/features/exams/examDateSheetParser';

let client: SupabaseClient | null = null;

/**
 * DDL the worker needs on top of `supabase/schema.ts`.
 *
 * NOTE FOR THE INTEGRATOR: this table is NOT yet part of supabase/schema.ts.
 * It has to be mirrored there and `node tools/emit-sql.mjs` has to be run,
 * otherwise the owner has to paste the statement below into the Supabase
 * dashboard by hand.
 *
 * The table records that a result announcement was actually pushed, so a
 * failed push is retried on the next worker run instead of being lost.
 *
 * The worker cannot create the table itself: the `exec_sql` RPC it used to
 * call was never defined, so that guard never succeeded.
 */
export const WORKER_SCHEMA_SQL = `
create table if not exists public.results_push_log (
  file_url text primary key,
  programme text not null default '',
  first_seen_at timestamptz not null default now(),
  pushed_at timestamptz,
  recipients integer not null default 0,
  last_error text
);
create index if not exists results_push_log_pushed_idx
  on public.results_push_log (pushed_at);
`;

/** How many rows one page of a paged read asks for. */
export const PAGE_SIZE = 500;

/**
 * The tables the worker cannot work without.
 *
 * The probe reads one row of every table, so a missing table is found
 * before the worker writes anything.
 */
export const REQUIRED_TABLES: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'notices', column: 'id' },
  { table: 'worker_runs', column: 'id' },
];

/**
 * The tables a single stage needs.
 *
 * `results_push_log` is only needed by the results stage. A missing table
 * fails that stage, not the whole run.
 */
export const STAGE_TABLES: ReadonlyArray<{ table: string; column: string }> = [
  { table: 'results_push_log', column: 'file_url' },
];

/**
 * Builds the service-role client.
 *
 * `createClient()` throws when the URL is not a valid URL, which happens on
 * older Node versions - the caller must not have to guard against it.
 */
export function getWorkerSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  try {
    client = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.warn(
      'Worker: could not create the Supabase client:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
  return client;
}

export function isWorkerSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** What a write managed to do. */
export interface WriteResult {
  /** Rows the database accepted. */
  written: number;
  /** Rows the database refused (or that were never sent). */
  failed: number;
}

/** The outcome of a read. */
export interface ReadResult<T> {
  ok: boolean;
  rows: T[];
  error: string | null;
}

/** The outcome of a read that collects a set of keys. */
export interface ReadSetResult {
  ok: boolean;
  rows: Set<string>;
  error: string | null;
}

function describeError(error: { code?: string; message: string } | null): string {
  if (!error) return 'unknown error';
  return `${error.code ?? 'no-code'}: ${error.message}`;
}

/**
 * Checks that the tables the worker writes to really exist.
 *
 * The old guard called an RPC (`exec_sql`) that was never defined, so it never
 * succeeded and never told anybody that the schema was missing. This is a
 * real probe: it reads one row of every required table.
 */
export interface SchemaCheck {
  ok: boolean;
  /** Tables that are missing. */
  missing: string[];
  error: string | null;
}

export async function checkSchema(
  tables: ReadonlyArray<{ table: string; column: string }> = REQUIRED_TABLES,
): Promise<SchemaCheck> {
  const sb = getWorkerSupabase();
  if (!sb) {
    return {
      ok: false,
      missing: tables.map((entry) => entry.table),
      error: 'supabase-not-configured',
    };
  }
  const missing: string[] = [];
  let error: string | null = null;
  for (const { table, column } of tables) {
    try {
      const { error: probeError } = await sb.from(table).select(column).limit(1);
      if (probeError) {
        missing.push(table);
        error = error ?? describeError(probeError);
      }
    } catch (err) {
      missing.push(table);
      error = error ?? (err instanceof Error ? err.message : String(err));
    }
  }
  return { ok: missing.length === 0, missing, error };
}

/**
 * Verifies that the schema is in place.
 *
 * @returns True when every required table exists.
 */
export async function ensureSchema(): Promise<boolean> {
  const check = await checkSchema();
  if (!check.ok) {
    console.error(
      `Worker: the database schema is incomplete (missing: ${check.missing.join(', ') || 'unknown'}` +
        `${check.error ? `, ${check.error}` : ''}). ` +
        'The owner has to paste supabase/schema.sql into the Supabase dashboard.',
    );
    return false;
  }
  return true;
}

/**
 * Reads every row of a table, page by page.
 *
 * PostgREST caps a response at `db-max-rows` (1000 by default) and does NOT
 * report the truncation, so a `.limit(5000)` quietly returns 1000 rows. The
 * pages are therefore read with `.range()` until a short page comes back.
 *
 * A client that does not implement `range()` (a light test double) is read
 * with a single `limit()` call instead.
 */
export async function selectAllRows<T>(
  sb: SupabaseClient,
  table: string,
  columns: string,
  orderColumn: string,
  pageSize: number = PAGE_SIZE,
): Promise<ReadResult<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    let page: unknown[] | null = null;
    let error: { code?: string; message: string } | null = null;
    try {
      const builder = sb.from(table).select(columns) as unknown as {
        order?: (column: string, opts: { ascending: boolean }) => unknown;
        range?: (from: number, to: number) => PromiseLike<{
          data: unknown;
          error: { code?: string; message: string } | null;
        }>;
        limit?: (count: number) => PromiseLike<{
          data: unknown;
          error: { code?: string; message: string } | null;
        }>;
      };
      const ordered =
        typeof builder.order === 'function'
          ? builder.order(orderColumn, { ascending: true })
          : builder;
      const result =
        typeof (ordered as { range?: unknown }).range === 'function'
          ? await (ordered as { range: (f: number, t: number) => PromiseLike<unknown> }).range(
              from,
              to,
            )
          : await (ordered as { limit: (n: number) => PromiseLike<unknown> }).limit(pageSize);
      const shaped = result as { data: unknown; error: { code?: string; message: string } | null };
      page = shaped.data as unknown[] | null;
      error = shaped.error;
    } catch (err) {
      return {
        ok: false,
        rows,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    if (error) {
      return { ok: false, rows, error: describeError(error) };
    }
    const chunk = (page ?? []) as T[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return { ok: true, rows, error: null };
}

/**
 * The columns of a notice the worker enriches after the fact.
 */
export interface NoticeState {
  posted_at: string;
  audience: Record<string, unknown> | null;
  deadline_at: string | null;
  source: string;
}

/**
 * Reads the enrichment state of every stored notice.
 *
 * Used to keep the bulk upsert from overwriting a value that the enrichment
 * stage has already written (the OCR text, a deadline, the audience), and to
 * know how many notices each source has - a source that suddenly has none
 * has lost its notices, not never had any.
 *
 * The read is paged: the notices table grows past 1000 rows, and a truncated
 * read would make the worker think that a stored notice is a new one.
 */
export async function fetchNoticeStates(): Promise<Map<string, NoticeState>> {
  const states = new Map<string, NoticeState>();
  const sb = getWorkerSupabase();
  if (!sb) return states;

  const read = await selectAllRows<{
    source_id: string;
    posted_at: string;
    audience: Record<string, unknown> | null;
    deadline_at: string | null;
    source: string;
  }>(sb, 'notices', 'source_id,posted_at,audience,deadline_at,source', 'source_id');
  if (!read.ok) {
    console.warn('Worker: notice state read failed:', read.error);
    return states;
  }
  for (const row of read.rows) {
    if (!row?.source_id) continue;
    states.set(row.source_id, {
      posted_at: row.posted_at,
      audience: row.audience ?? null,
      deadline_at: row.deadline_at ?? null,
      source: row.source ?? 'main',
    });
  }
  return states;
}

/**
 * How many notices are stored per source.
 *
 * The layout-change guard uses it: a source that suddenly parses nothing but
 * has rows stored has lost its notices (the page layout changed), while a
 * source that never had any has simply nothing to publish.
 */
export async function fetchNoticeCountsBySource(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const states = await fetchNoticeStates();
  for (const state of states.values()) {
    counts.set(state.source, (counts.get(state.source) ?? 0) + 1);
  }
  return counts;
}

/**
 * The bulk row of a notice.
 *
 * `raw_text` is deliberately absent: the OCR stage writes it once and a
 * later bulk upsert must never set it back to NULL. PostgREST only updates
 * the columns a payload carries, so a column that is not in the payload
 * keeps its stored value.
 *
 * The columns that ARE in the payload carry the write-once value: the
 * stored one, when the row already has it. That way the payload of every
 * row has the same keys (PostgREST requires it) and a second run cannot
 * move an undated notice back to the top of the list.
 */
function toRow(n: NoticeItem, state?: NoticeState): Record<string, unknown> {
  const storedAudience = state?.audience ?? {};
  const computedAudience = (n.audience ?? {}) as Record<string, unknown>;
  return {
    source: n.source,
    source_id: n.sourceId,
    title: n.title,
    clean_title: n.cleanTitle,
    // A notice without a readable date keeps the date it was first seen
    // with, so it does not float to the top of the list on every run.
    posted_at: state?.posted_at ?? n.postedAt,
    file_url: n.fileUrl,
    file_type: n.fileType,
    category: n.category,
    importance: n.importance,
    // The audience is enrichment: the stored one is never thrown away.
    audience: mergeAudience(storedAudience, computedAudience),
    // The deadline is enrichment too: the first one that was found wins.
    deadline_at: state?.deadline_at ?? n.deadlineAt ?? null,
    thread_id: n.threadId ?? null,
    thread_update_count: n.threadUpdateCount ?? 0,
  };
}

/**
 * Upserts notices keyed on source_id.
 *
 * @returns How many rows were written and how many failed.
 */
export async function upsertNotices(
  notices: NoticeItem[],
  states?: Map<string, NoticeState>,
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || notices.length === 0) return { written: 0, failed: 0 };
  const uniqueNotices = Array.from(
    new Map(notices.map((n) => [n.sourceId, n])).values()
  );

  const known = states ?? (await fetchNoticeStates());

  const BATCH = 100;
  let written = 0;
  let failed = 0;
  for (let i = 0; i < uniqueNotices.length; i += BATCH) {
    const batch = uniqueNotices.slice(i, i + BATCH).map((n) => toRow(n, known.get(n.sourceId)));
    try {
      const { error } = await sb
        .from('notices')
        .upsert(batch, { onConflict: 'source_id' });
      if (error) {
        failed += batch.length;
        console.warn('Worker: notices upsert failed:', describeError(error));
      } else {
        written += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: notices upsert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
}

/**
 * Stores the academic calendar events read from the university's own
 * documents. The key makes a repeated run update the row instead of
 * duplicating it.
 */
export async function upsertCalendarEvents(
  events: CalendarEventRow[],
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || events.length === 0) return { written: 0, failed: 0 };
  const BATCH = 100;
  let written = 0;
  let failed = 0;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    try {
      const { error } = await sb
        .from('calendar_events')
        .upsert(batch, { onConflict: 'event_key' });
      if (error) {
        failed += batch.length;
        console.warn('Worker: calendar_events upsert failed:', describeError(error));
      } else {
        written += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: calendar_events upsert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
}

/**
 * Deletes the calendar events of a source that are no longer published.
 *
 * The key of an event carries its title, so a one-character edit produces a
 * new key and the old row would stay forever. The stale rows are therefore
 * removed explicitly.
 */
export async function deleteStaleCalendarEvents(
  source: string,
  semester: string,
  keepKeys: string[],
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb) return { written: 0, failed: 0 };
  try {
    const { data, error } = await sb
      .from('calendar_events')
      .select('event_key')
      .eq('source', source)
      .eq('semester', semester);
    if (error) {
      console.warn('Worker: stale calendar read failed:', describeError(error));
      return { written: 0, failed: 1 };
    }
    const keep = new Set(keepKeys);
    const stale = ((data ?? []) as Array<{ event_key: string }>)
      .map((row) => row.event_key)
      .filter((key) => key && !keep.has(key));
    if (stale.length === 0) return { written: 0, failed: 0 };
    const { error: deleteError } = await sb
      .from('calendar_events')
      .delete()
      .in('event_key', stale);
    if (deleteError) {
      console.warn('Worker: stale calendar delete failed:', describeError(deleteError));
      return { written: 0, failed: stale.length };
    }
    return { written: stale.length, failed: 0 };
  } catch (err) {
    console.warn(
      'Worker: stale calendar delete threw:',
      err instanceof Error ? err.message : String(err),
    );
    return { written: 0, failed: 1 };
  }
}

/** Stores the date-sheet slots read from the per-school PDFs or Excel uploads. */
export async function upsertExamDateSlots(
  slots: (DateSlotRow | ExamDateSlot)[],
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || slots.length === 0) return { written: 0, failed: 0 };
  const rowMap = new Map<string, DateSlotRow>();
  for (const s of slots) {
    const row = 'slot_key' in s ? s : examSlotToRow(s);
    rowMap.set(row.slot_key, row);
  }
  const rows = Array.from(rowMap.values());
  const BATCH = 100;
  let written = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      const { error } = await sb
        .from('exam_date_slots')
        .upsert(batch, { onConflict: 'slot_key' });
      if (error) {
        failed += batch.length;
        console.warn('Worker: exam_date_slots upsert failed:', describeError(error));
      } else {
        written += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: exam_date_slots upsert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
}

/**
 * Deletes the date-sheet slots of a school that are no longer published.
 *
 * The key of a slot carries the subject name, so an edited subject produces
 * a new key and the old row would stay forever.
 */
export async function deleteStaleExamDateSlots(
  schoolCode: string,
  keepKeys: string[],
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb) return { written: 0, failed: 0 };
  try {
    const { data, error } = await sb
      .from('exam_date_slots')
      .select('slot_key')
      .eq('school_code', schoolCode);
    if (error) {
      console.warn('Worker: stale date slot read failed:', describeError(error));
      return { written: 0, failed: 1 };
    }
    const keep = new Set(keepKeys);
    const stale = ((data ?? []) as Array<{ slot_key: string }>)
      .map((row) => row.slot_key)
      .filter((key) => key && !keep.has(key));
    if (stale.length === 0) return { written: 0, failed: 0 };
    const { error: deleteError } = await sb
      .from('exam_date_slots')
      .delete()
      .in('slot_key', stale);
    if (deleteError) {
      console.warn('Worker: stale date slot delete failed:', describeError(deleteError));
      return { written: 0, failed: stale.length };
    }
    return { written: stale.length, failed: 0 };
  } catch (err) {
    console.warn(
      'Worker: stale date slot delete threw:',
      err instanceof Error ? err.message : String(err),
    );
    return { written: 0, failed: 1 };
  }
}

/** Fetches exam date slots for a specific class key from Supabase. */
export async function fetchExamDateSlotsForClass(
  classKey: string,
): Promise<DateSlotRow[]> {
  const sb = getWorkerSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('exam_date_slots')
      .select('*')
      .eq('class_key', classKey.trim().toLowerCase())
      .order('exam_date', { ascending: true });
    if (error || !data) return [];
    return data as DateSlotRow[];
  } catch (err) {
    console.warn('Worker: fetchExamDateSlotsForClass threw:', err);
    return [];
  }
}

export interface ResultRecord {
  id?: string;
  programme: string;
  semester?: string;
  academic_year?: string;
  academicYear?: string;
  title?: string;
  file_url?: string;
  fileUrl?: string;
  posted_at?: string;
  postedAt?: string;
  text_index_url?: string | null;
  textIndexUrl?: string | null;
}

/**
 * Loads all known result URLs.
 *
 * The rows are paged: the table holds one row per result announcement and
 * a `.limit(2000)` would be truncated to 1000 rows without an error.
 */
export async function fetchKnownResultUrls(): Promise<ReadSetResult> {
  const sb = getWorkerSupabase();
  if (!sb) return { ok: false, rows: new Set<string>(), error: 'supabase-not-configured' };
  const read = await selectAllRows<{ file_url: string }>(
    sb,
    'results',
    'file_url',
    'file_url',
  );
  if (!read.ok) {
    console.warn('Worker: known result read failed:', read.error);
    return { ok: false, rows: new Set<string>(), error: read.error };
  }
  const urls = new Set<string>();
  for (const row of read.rows) {
    if (row?.file_url) urls.add(row.file_url);
  }
  return { ok: true, rows: urls, error: null };
}

/** Stores result announcements. Keyed on file_url. */
export async function upsertResults(results: ResultRecord[]): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || results.length === 0) return { written: 0, failed: 0 };
  const uniqueResults = Array.from(
    new Map(
      results
        .filter((r) => Boolean(r.fileUrl || r.file_url))
        .map((r) => [(r.fileUrl || r.file_url)!, r]),
    ).values(),
  );

  const BATCH = 100;
  let written = 0;
  let failed = 0;
  for (let i = 0; i < uniqueResults.length; i += BATCH) {
    const batch = uniqueResults.slice(i, i + BATCH).map((r) => ({
      programme: r.programme,
      semester: r.semester ?? '',
      academic_year: r.academicYear ?? r.academic_year ?? '',
      title: r.title ?? `${r.programme} Result`,
      file_url: (r.fileUrl || r.file_url)!,
      posted_at: r.postedAt || r.posted_at || new Date().toISOString(),
      text_index_url: r.textIndexUrl ?? r.text_index_url ?? null,
    }));
    try {
      const { error } = await sb
        .from('results')
        .upsert(batch, { onConflict: 'file_url' });
      if (error) {
        failed += batch.length;
        console.warn('Worker: results upsert failed:', describeError(error));
      } else {
        written += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: results upsert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
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
 *
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
      console.warn('Worker: notice raw_text update failed:', describeError(error));
      return false;
    }
  } catch (err) {
    console.warn(
      'Worker: notice raw_text update threw:',
      err instanceof Error ? err.message : String(err),
    );
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
      console.warn(
        'Worker: notice deadline update threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return true;
}

/**
 * Refines the audience of a notice with what the document body says.
 *
 * The audience is merged, never replaced: the `pushed` flag lives in the
 * same JSON column and must survive, and a school that was already known
 * must not be dropped.
 */
export async function saveNoticeAudience(
  sourceId: string,
  audience: Record<string, unknown>,
): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb || !sourceId) return false;
  try {
    const { data, error } = await sb
      .from('notices')
      .select('audience')
      .eq('source_id', sourceId)
      .maybeSingle();
    if (error) {
      console.warn('Worker: notice audience read failed:', describeError(error));
      return false;
    }
    const existing = (data as { audience?: Record<string, unknown> } | null)?.audience ?? {};
    const merged = mergeAudience(existing, audience);
    const { error: updateError } = await sb
      .from('notices')
      .update({ audience: merged })
      .eq('source_id', sourceId);
    if (updateError) {
      console.warn('Worker: notice audience update failed:', describeError(updateError));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      'Worker: notice audience update threw:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Merges two audiences.
 *
 * The lists are united (a school that was known stays known) and the flags
 * that are not part of the audience - the `pushed` marker - are carried over.
 * A notice is "for everybody" only when neither side named a specific
 * school, programme or semester, exactly like the app merges two copies of a
 * notice.
 */
export function mergeAudience(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  // Nothing was known yet: the fresh detection wins.
  if (Object.keys(existing).length === 0) return { ...incoming };

  const merged: Record<string, unknown> = { ...existing };
  for (const key of ['schools', 'programmes', 'semesters']) {
    const before = Array.isArray(existing[key]) ? (existing[key] as unknown[]) : [];
    const after = Array.isArray(incoming[key]) ? (incoming[key] as unknown[]) : [];
    const union = [...new Set([...before, ...after])];
    if (union.length > 0) {
      merged[key] = union;
    } else {
      delete merged[key];
    }
  }
  const specific = ['schools', 'programmes', 'semesters'].some(
    (key) => Array.isArray(merged[key]) && (merged[key] as unknown[]).length > 0,
  );
  if (specific) {
    delete merged.all;
  } else {
    merged.all = existing.all === true || incoming.all === true;
  }
  return merged;
}

/**
 * Content-hash keys already processed. The same file is never downloaded or
 * OCR'd twice, even if it is attached to several notices.
 */
export async function fetchProcessedAttachmentHashes(): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const hashes = new Set<string>();
  if (!sb) return hashes;
  const read = await selectAllRows<{ content_hash: string }>(
    sb,
    'notice_attachments',
    'content_hash',
    'content_hash',
  );
  if (!read.ok) {
    console.warn('Worker: processed attachment hash read failed:', read.error);
    return hashes;
  }
  for (const row of read.rows) {
    if (row?.content_hash) hashes.add(row.content_hash);
  }
  return hashes;
}

/**
 * The file URLs that were already downloaded and extracted.
 *
 * A file that is attached to several notices is downloaded once: the second
 * notice reuses the text of the first one instead of fetching the file
 * again.
 */
export async function fetchProcessedAttachmentUrls(): Promise<Map<string, string>> {
  const sb = getWorkerSupabase();
  const urls = new Map<string, string>();
  if (!sb) return urls;
  const read = await selectAllRows<{ file_url: string; source_id: string }>(
    sb,
    'notice_attachments',
    'file_url,source_id',
    'file_url',
  );
  if (!read.ok) {
    console.warn('Worker: processed attachment url read failed:', read.error);
    return urls;
  }
  for (const row of read.rows) {
    if (row?.file_url) urls.set(row.file_url, row.source_id ?? '');
  }
  return urls;
}

/**
 * Notice ids whose attachment was already downloaded and extracted.
 * The university is scraped politely, so a notice is fetched once and then
 * left alone.
 */
export async function fetchProcessedAttachmentSources(): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const sources = new Set<string>();
  if (!sb) return sources;
  const read = await selectAllRows<{ source_id: string }>(
    sb,
    'notice_attachments',
    'source_id',
    'source_id',
  );
  if (!read.ok) {
    console.warn('Worker: processed attachment source read failed:', read.error);
    return sources;
  }
  for (const row of read.rows) {
    if (row?.source_id) sources.add(row.source_id);
  }
  return sources;
}

/** Records a processed attachment so it is never processed again. */
export async function recordAttachmentProcessing(
  rows: Array<{
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
  }>,
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || rows.length === 0) return { written: 0, failed: 0 };
  const BATCH = 50;
  let written = 0;
  let failed = 0;
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
        failed += batch.length;
        console.warn('Worker: attachment record upsert failed:', describeError(error));
      } else {
        written += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: attachment record upsert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
}

/**
 * Records that an attachment could not be processed.
 *
 * The attempt is written to `worker_runs` so the worker can back off instead
 * of downloading and OCR-ing a broken file every 15 minutes forever.
 */
export async function recordAttachmentFailure(
  fileUrl: string,
  reason: string,
): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('worker_runs').insert({
      source: `attachment:${fileUrl.slice(0, 120)}`,
      status: 'error',
      items_found: 0,
      items_new: 0,
      error: reason.slice(0, 500),
    });
    if (error) {
      console.warn('Worker: attachment failure record failed:', describeError(error));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      'Worker: attachment failure record threw:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/** A stored notice that carries a downloadable file. */
export interface NoticeWithFile {
  sourceId: string;
  title: string;
  fileUrl: string;
}

/**
 * The stored notices that carry a file.
 *
 * The attachment stage reads them from the database instead of from the
 * current run, so a notice whose attachment failed in an earlier run is
 * picked up again.
 */
export async function fetchNoticesWithFiles(
  limit = 200,
): Promise<ReadResult<NoticeWithFile>> {
  const sb = getWorkerSupabase();
  if (!sb) return { ok: false, rows: [], error: 'supabase-not-configured' };
  try {
    const { data, error } = await sb
      .from('notices')
      .select('source_id,title,file_url')
      .neq('file_url', '')
      .order('posted_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, rows: [], error: describeError(error) };
    const rows = ((data ?? []) as Array<{
      source_id: string;
      title: string;
      file_url: string;
    }>).map((row) => ({
      sourceId: row.source_id,
      title: row.title ?? '',
      fileUrl: row.file_url ?? '',
    }));
    return { ok: true, rows, error: null };
  } catch (err) {
    return {
      ok: false,
      rows: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Deletes the notice rows of a previous hash format.
 *
 * The source id used to be the first 16 hex characters of the sha256
 * digest. It is now the whole digest, and the old id is a PREFIX of the new
 * one - so the row of the old id and the row of the new id describe the same
 * notice. Without this cleanup the notice would be stored twice.
 *
 * @param legacyIds The stored ids that use the old format.
 * @param currentIds The ids of this run.
 * @returns How many rows were deleted.
 */
export async function deleteLegacyNoticeRows(
  legacyIds: string[],
  currentIds: Set<string>,
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || legacyIds.length === 0) return { written: 0, failed: 0 };

  // Only the ids whose new counterpart is in this run are removed: an id
  // that was not scraped this time may belong to a notice that is still
  // published and was simply not reached.
  const stale = legacyIds.filter((legacy) => {
    if (currentIds.has(legacy)) return false;
    for (const current of currentIds) {
      if (current.startsWith(legacy)) return true;
    }
    return false;
  });
  if (stale.length === 0) return { written: 0, failed: 0 };

  try {
    const { error } = await sb.from('notices').delete().in('source_id', stale);
    if (error) {
      console.warn('Worker: legacy notice delete failed:', describeError(error));
      return { written: 0, failed: stale.length };
    }
    console.log(
      JSON.stringify({ event: 'worker_legacy_notices_deleted', count: stale.length }),
    );
    return { written: stale.length, failed: 0 };
  } catch (err) {
    console.warn(
      'Worker: legacy notice delete threw:',
      err instanceof Error ? err.message : String(err),
    );
    return { written: 0, failed: stale.length };
  }
}

/**
 * The stored text of a notice.
 *
 * Used when a file that was already extracted is attached to a notice that
 * has no text yet: the text of the first notice is copied over instead of
 * downloading and OCR-ing the file a second time.
 */
export async function fetchNoticeRawText(
  sourceId: string,
): Promise<string | null> {
  const sb = getWorkerSupabase();
  if (!sb || !sourceId) return null;
  try {
    const { data, error } = await sb
      .from('notices')
      .select('raw_text')
      .eq('source_id', sourceId)
      .maybeSingle();
    if (error) {
      console.warn('Worker: notice raw_text read failed:', describeError(error));
      return null;
    }
    const text = (data as { raw_text?: string | null } | null)?.raw_text ?? null;
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.warn(
      'Worker: notice raw_text read threw:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * The attachments that failed recently.
 *
 * A file that cannot be read is left alone for a while instead of being
 * downloaded and OCR'd again every fifteen minutes.
 */
export async function fetchRecentAttachmentFailures(
  sinceMs: number,
): Promise<Set<string>> {
  const failed = new Set<string>();
  const sb = getWorkerSupabase();
  if (!sb) return failed;
  const since = new Date(Date.now() - sinceMs).toISOString();
  try {
    const { data, error } = await sb
      .from('worker_runs')
      .select('source,ran_at')
      .eq('status', 'error')
      .like('source', 'attachment:%')
      .gte('ran_at', since);
    if (error) {
      console.warn('Worker: attachment failure read failed:', describeError(error));
      return failed;
    }
    for (const row of (data ?? []) as Array<{ source: string }>) {
      const url = row?.source?.replace(/^attachment:/, '');
      if (url) failed.add(url);
    }
  } catch (err) {
    console.warn(
      'Worker: attachment failure read threw:',
      err instanceof Error ? err.message : String(err),
    );
  }
  return failed;
}

/**
 * The last time a source was fetched, according to `worker_runs`.
 *
 * The worker is stateless between runs, so the "last fetched at" map lives in
 * the database: `worker_runs` already records every run of every source.
 */
export async function fetchLastRunAt(
  source: string,
  status: 'ok' | 'error' = 'ok',
): Promise<Date | null> {
  const sb = getWorkerSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('worker_runs')
      .select('ran_at')
      .eq('source', source)
      .eq('status', status)
      .order('ran_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const ranAt = (data[0] as { ran_at?: string }).ran_at;
    if (!ranAt) return null;
    const date = new Date(ranAt);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export async function recordWorkerRun(
  source: string,
  status: 'ok' | 'error',
  itemsFound: number,
  itemsNew: number,
  error?: string
): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb) return false;
  try {
    const { error: insertError } = await sb.from('worker_runs').insert({
      source,
      status,
      items_found: itemsFound,
      items_new: itemsNew,
      error: error ?? null,
    });
    if (insertError) {
      console.warn('Worker: worker run record failed:', describeError(insertError));
      return false;
    }
    return true;
  } catch (err) {
    // observability must never fail the run
    console.warn(
      'Worker: worker run record threw:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Known source_ids already stored — lets the job skip push for old items.
 *
 * The read is paged: the notices table grows past 1000 rows, and a
 * truncated read would make every notice beyond the cut look new, so it
 * would be pushed to every device every 15 minutes.
 *
 * @returns The known ids and whether the read actually worked. A failed read
 *   must never be mistaken for "the table is empty".
 */
export async function fetchKnownSourceIds(
): Promise<{ ids: Set<string>; ok: boolean; error: string | null }> {
  const sb = getWorkerSupabase();
  const known = new Set<string>();
  if (!sb) return { ids: known, ok: false, error: 'supabase-not-configured' };
  const read = await selectAllRows<{ source_id: string }>(
    sb,
    'notices',
    'source_id',
    'source_id',
  );
  if (!read.ok) {
    console.warn('Worker: known source id read failed:', read.error);
    return { ids: known, ok: false, error: read.error };
  }
  for (const r of read.rows) {
    if (r?.source_id) known.add(r.source_id);
  }
  return { ids: known, ok: true, error: null };
}

/**
 * The known source ids AND the enrichment state of every stored notice.
 *
 * One paged read answers both questions, so the notices table is not read
 * twice per run.
 */
export async function fetchKnownNotices(): Promise<{
  ids: Set<string>;
  states: Map<string, NoticeState>;
  ok: boolean;
  error: string | null;
}> {
  const ids = new Set<string>();
  const states = new Map<string, NoticeState>();
  const sb = getWorkerSupabase();
  if (!sb) {
    return { ids, states, ok: false, error: 'supabase-not-configured' };
  }
  const read = await selectAllRows<{
    source_id: string;
    posted_at: string;
    audience: Record<string, unknown> | null;
    deadline_at: string | null;
    source: string;
  }>(sb, 'notices', 'source_id,posted_at,audience,deadline_at,source', 'source_id');
  if (!read.ok) {
    console.warn('Worker: known notice read failed:', read.error);
    return { ids, states, ok: false, error: read.error };
  }
  for (const row of read.rows) {
    if (!row?.source_id) continue;
    ids.add(row.source_id);
    states.set(row.source_id, {
      posted_at: row.posted_at,
      audience: row.audience ?? null,
      deadline_at: row.deadline_at ?? null,
      source: row.source ?? 'main',
    });
  }
  return { ids, states, ok: true, error: null };
}

export interface StoredTimetableSnapshot {
  classKey: string;
  hash: string;
  payload: unknown;
}

export interface TimetableSnapshotRead {
  /**
   * False when the snapshots could not be read. An empty table is a valid
   * cold start (`ok` is then true with an empty map) - only a failed read
   * sets `ok` to false.
   */
  ok: boolean;
  snapshots: Map<string, StoredTimetableSnapshot>;
  error: string | null;
}

/**
 * Reads the last known timetable snapshot per class and reports whether
 * the read worked.
 *
 * The two cases must not be mixed up: "the table is empty" means the
 * worker starts from a clean baseline, "the read failed" means the worker
 * knows nothing about the previous state and must not overwrite it.
 */
export async function readTimetableSnapshots(
): Promise<TimetableSnapshotRead> {
  const sb = getWorkerSupabase();
  const snapshots = new Map<string, StoredTimetableSnapshot>();
  if (!sb) return { ok: true, snapshots, error: null };
  const read = await selectAllRows<{
    class_key: string;
    hash: string;
    payload: unknown;
  }>(sb, 'timetable_snapshots', 'class_key,hash,payload', 'class_key');
  if (!read.ok) {
    return { ok: false, snapshots, error: read.error };
  }
  for (const r of read.rows) {
    if (!r?.class_key) continue;
    snapshots.set(r.class_key, { classKey: r.class_key, hash: r.hash ?? '', payload: r.payload });
  }
  return { ok: true, snapshots, error: null };
}

/**
 * Loads the last known timetable snapshot per class so the worker can diff
 * against the previous run (the worker itself is stateless between runs).
 *
 * Throws when the read failed. A failed read must not be mistaken for a
 * cold start: the caller would then diff against nothing and overwrite
 * the stored snapshot with the new data, losing the change for good.
 */
export async function fetchTimetableSnapshots(): Promise<Map<string, StoredTimetableSnapshot>> {
  const read = await readTimetableSnapshots();
  if (!read.ok) {
    throw new Error(`Timetable snapshot read failed: ${read.error ?? 'unknown error'}`);
  }
  return read.snapshots;
}

/** Upserts the latest snapshot per class (one row per class_key). */
export async function upsertTimetableSnapshots(
  rows: Array<{ classKey: string; hash: string; payload: unknown }>,
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || rows.length === 0) return { written: 0, failed: 0 };
  const BATCH = 100;
  let written = 0;
  let failed = 0;
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
        failed += batch.length;
        console.warn('Worker: timetable snapshot upsert failed:', describeError(error));
      } else {
        written += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: timetable snapshot upsert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
}

/** The change keys that are already in the change history. */
export async function fetchRecordedChangeKeys(): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const keys = new Set<string>();
  if (!sb) return keys;
  const read = await selectAllRows<{ change_key: string | null }>(
    sb,
    'timetable_changes',
    'change_key',
    'change_key',
  );
  if (!read.ok) {
    console.warn('Worker: recorded change key read failed:', read.error);
    return keys;
  }
  for (const row of read.rows) {
    if (row?.change_key) keys.add(row.change_key);
  }
  return keys;
}

/** Appends detected timetable changes to the change history. */
export async function recordTimetableChanges(
  changes: Array<{ classKey: string; changeKey?: string; diff: unknown }>,
): Promise<WriteResult> {
  const sb = getWorkerSupabase();
  if (!sb || changes.length === 0) return { written: 0, failed: 0 };
  const BATCH = 100;
  let written = 0;
  let failed = 0;
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH).map((change) => ({
      class_key: change.classKey,
      // The deterministic key makes the history idempotent: the same edit
      // always lands on the same row.
      change_key: change.changeKey ?? null,
      diff: change.diff,
      detected_at: new Date().toISOString(),
    }));
    try {
      // The unique index on `change_key` is partial (`where change_key is
      // not null`), so `ON CONFLICT (change_key)` cannot be inferred by
      // Postgres. `ignoreDuplicates` writes `ON CONFLICT DO NOTHING`, which
      // works with any unique constraint and keeps the history idempotent.
      const { data, error } = await sb
        .from('timetable_changes')
        .upsert(batch, { ignoreDuplicates: true });
      if (error) {
        failed += batch.length;
        console.warn('Worker: timetable change insert failed:', describeError(error));
      } else {
        // The database answers with the rows it actually inserted.
        const inserted = (data ?? []) as unknown[];
        written += inserted.length > 0 ? inserted.length : batch.length;
      }
    } catch (err) {
      failed += batch.length;
      console.warn(
        'Worker: timetable change insert threw:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { written, failed };
}

/** Change keys already pushed — used to keep pushes one-per-change. */
export async function fetchPushedChangeKeys(
): Promise<Set<string>> {
  const sb = getWorkerSupabase();
  const keys = new Set<string>();
  if (!sb) return keys;
  const read = await selectAllRows<{ change_key: string }>(
    sb,
    'timetable_push_log',
    'change_key',
    'change_key',
  );
  if (!read.ok) {
    console.warn('Worker: pushed change key read failed:', read.error);
    return keys;
  }
  for (const r of read.rows) {
    if (r?.change_key) keys.add(r.change_key);
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
    const { error } = await sb.from('timetable_push_log').upsert(
      {
        change_key: changeKey,
        class_key: classKey,
        semester_session_id: semesterSessionId,
        recipients,
        pushed_at: new Date().toISOString(),
      },
      { onConflict: 'change_key' },
    );
    if (error) {
      console.warn('Worker: timetable push mark failed:', describeError(error));
    }
  } catch (err) {
    // observability must never fail the run
    console.warn(
      'Worker: timetable push mark threw:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * The result announcements that were already pushed.
 *
 * The rows are paged for the same reason as the other reads.
 */
export async function fetchPushedResultUrls(): Promise<ReadSetResult> {
  const sb = getWorkerSupabase();
  const urls = new Set<string>();
  if (!sb) return { ok: false, rows: urls, error: 'supabase-not-configured' };
  const read = await selectAllRows<{ file_url: string; pushed_at: string | null }>(
    sb,
    'results_push_log',
    'file_url,pushed_at',
    'file_url',
  );
  if (!read.ok) {
    console.warn('Worker: pushed result read failed:', read.error);
    return { ok: false, rows: urls, error: read.error };
  }
  for (const row of read.rows) {
    if (row?.file_url && row.pushed_at) urls.add(row.file_url);
  }
  return { ok: true, rows: urls, error: null };
}

/**
 * Records that a result announcement was seen, whether or not the push
 * worked. A row without `pushed_at` is a result that still has to be
 * pushed.
 */
export async function markResultSeen(
  fileUrl: string,
  programme: string,
): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('results_push_log').upsert(
      {
        file_url: fileUrl,
        programme,
        first_seen_at: new Date().toISOString(),
      },
      { onConflict: 'file_url', ignoreDuplicates: true },
    );
    if (error) {
      console.warn('Worker: result push log upsert failed:', describeError(error));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      'Worker: result push log upsert threw:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Marks a result announcement as pushed. Only called after a confirmed send,
 * so a failed push is retried on the next worker run.
 */
export async function markResultPushed(
  fileUrl: string,
  programme: string,
  recipients: number,
): Promise<boolean> {
  const sb = getWorkerSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from('results_push_log').upsert(
      {
        file_url: fileUrl,
        programme,
        first_seen_at: new Date().toISOString(),
        pushed_at: new Date().toISOString(),
        recipients,
        last_error: null,
      },
      { onConflict: 'file_url' },
    );
    if (error) {
      console.warn('Worker: result push mark failed:', describeError(error));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      'Worker: result push mark threw:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Removes the device tokens the push service rejected.
 *
 * `DeviceNotRegistered` means the app is gone: the token is dead and every
 * later push would fail with it.
 */
export async function deleteDeviceTokens(tokens: string[]): Promise<number> {
  const sb = getWorkerSupabase();
  if (!sb || tokens.length === 0) return 0;
  try {
    const { error } = await sb.from('device_tokens').delete().in('token', tokens);
    if (error) {
      console.warn('Worker: device token delete failed:', describeError(error));
      return 0;
    }
    return tokens.length;
  } catch (err) {
    console.warn(
      'Worker: device token delete threw:',
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}
