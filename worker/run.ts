/**
 * GBU One — Worker entrypoint (run by GitHub Actions cron).
 * Fetch -> enrich -> upsert (Supabase, idempotent on source_id) -> push.
 * Exits 0 even when individual sources fail; never overwrites stored data
 * with an empty parse (layout-change guard lives in noticesJob).
 */
import { NoticesWorkerJob } from './noticesJob';
import {
  ensureSchema, upsertNotices, recordWorkerRun, fetchKnownSourceIds,
  isWorkerSupabaseConfigured,
} from './supabaseClient';
import { sendPushForCandidates } from './pushSender';

async function main(): Promise<void> {
  const started = Date.now();
  console.log(JSON.stringify({ event: 'worker_start', at: new Date().toISOString() }));

  const supa = isWorkerSupabaseConfigured();
  if (!supa) {
    console.warn('Worker: Supabase not configured — running parse-only (no persistence, no push).');
  } else {
    await ensureSchema();
  }

  const worker = new NoticesWorkerJob();
  let knownCount = 0;
  if (supa) {
    // Seed dedupe set from stored rows so reruns don't re-push old notices.
    const known = await fetchKnownSourceIds();
    knownCount = known.size;
    worker.seedKnownSourceIds([...known]);
  }

  let result;
  try {
    result = await worker.runJob();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'worker_error', error: msg }));
    await recordWorkerRun('all', 'error', 0, 0, msg);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    event: 'worker_scraped',
    total: result.totalScraped,
    fresh: result.newNoticesCount,
    pushCandidates: result.pushCandidates.length,
  }));

  if (supa && result.notices.length > 0) {
    const written = await upsertNotices(result.notices);
    console.log(JSON.stringify({ event: 'worker_upserted', written }));
    await recordWorkerRun('all', 'ok', result.totalScraped, result.newNoticesCount);
  }

  // Push only items first seen in THIS run (importance >= 3) — never old rows.
  // The very first sync just baselines: no pushes, so we never blast the
  // entire backlog at existing devices.
  const isFirstSync = knownCount === 0;
  const newIds = new Set(result.newSourceIds ?? []);
  const pushable = isFirstSync
    ? []
    : result.pushCandidates.filter(
        (n: { importance: number; sourceId: string }) =>
          n.importance >= 3 && newIds.has(n.sourceId)
      );
  if (supa && isFirstSync) {
    console.log(JSON.stringify({ event: 'worker_baseline', note: 'first sync: no pushes sent' }));
  }
  if (supa && pushable.length > 0) {
    const receipts = await sendPushForCandidates(pushable);
    const sent = receipts.reduce((a, r) => a + r.sent, 0);
    console.log(JSON.stringify({ event: 'worker_push', sent, receipts: receipts.length }));
  } else {
    console.log(JSON.stringify({ event: 'worker_push_skipped', reason: supa ? 'no-candidates' : 'no-supabase' }));
  }

  console.log(JSON.stringify({
    event: 'worker_done', ms: Date.now() - started, at: new Date().toISOString(),
  }));
}

void main();
