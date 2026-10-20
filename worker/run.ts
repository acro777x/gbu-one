/**
 * GBU One — Worker entrypoint (run by GitHub Actions cron).
 * Fetch -> enrich -> upsert (Supabase, idempotent on source_id) -> push.
 * Timetable stage: poll -> diff against stored snapshot -> record -> push
 * to the devices of the affected class only.
 * Exits 0 even when individual sources fail; never overwrites stored data
 * with an empty parse (layout-change guard lives in noticesJob).
 */
import { NoticesWorkerJob, fetchWithTlsTolerance } from './noticesJob';
import {
  ensureSchema, upsertNotices, recordWorkerRun, fetchKnownSourceIds,
  isWorkerSupabaseConfigured, fetchTimetableSnapshots, upsertTimetableSnapshots,
  recordTimetableChanges, fetchPushedChangeKeys,
  saveNoticeRawText, fetchProcessedAttachmentHashes, recordAttachmentProcessing,
  fetchProcessedAttachmentSources,
} from './supabaseClient';
import { sendPushForCandidates, sendPushForTimetableChanges, normaliseClassKey } from './pushSender';
import {
  TimetablePollerJob,
  buildSnapshotRowHash,
  buildTimetableSnapshotPayload,
  parseTimetableSnapshotPayload,
} from './timetableJob';
import { extractAttachments, resolveAttachmentUrl, type OcrRunner } from './attachmentPipeline';
import { runTesseract, runVision, isTesseractAvailable } from './ocrRunner';
import { resolveOcrProvider } from './ocrService';
import type { Timetable } from '../src/features/timetable/timetableProvider';

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

  if (supa) {
    await runTimetableStage();
  }

  if (supa) {
    await runAttachmentStage(result.notices);
  }

  console.log(JSON.stringify({
    event: 'worker_done', ms: Date.now() - started, at: new Date().toISOString(),
  }));
}

/**
 * Attachment stage: download each notice's file once, pull the text out of it
 * (PDF text layer, or OCR for images and scanned PDFs) and store the text on
 * the notice. Files already processed are skipped by content hash.
 */
async function runAttachmentStage(
  notices: Array<{ sourceId: string; fileUrl: string }>,
): Promise<void> {
  try {
    const candidates = notices
      .map((n) => ({ sourceId: n.sourceId, fileUrl: resolveAttachmentUrl(n.fileUrl) ?? '' }))
      .filter((n) => n.fileUrl.length > 0);
    if (candidates.length === 0) {
      console.log(JSON.stringify({ event: 'worker_attachments_skipped', reason: 'no-attachments' }));
      return;
    }

    const provider = resolveOcrProvider();
    const tesseractReady = provider === 'tesseract' ? isTesseractAvailable() : false;
    if (provider === 'tesseract' && !tesseractReady) {
      console.log(JSON.stringify({
        event: 'worker_attachments_skipped',
        reason: 'tesseract-unavailable',
        note: 'install tesseract-ocr in the runner image to OCR scanned files',
      }));
    }

    const ocr: OcrRunner | undefined =
      provider === 'vision'
        ? async (input) => (await runVision(input)).text
        : tesseractReady
          ? async (input) => (await runTesseract(input)).text
          : undefined;

    const download = async (url: string) => {
      const res = await fetchWithTlsTolerance(url, {
        headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project; contact: student.gbuone@gmail.com)' },
      });
      if (!res.ok) throw new Error(`http-${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      return { bytes, contentType: res.headers.get('content-type') };
    };

    // Files already processed in an earlier run are not extracted again, and
    // the notice itself is not fetched again.
    const processedHashes = await fetchProcessedAttachmentHashes();
    const processedSources = await fetchProcessedAttachmentSources();

    const processed = await extractAttachments(candidates, {
      download,
      ocr,
      provider,
      processedHashes,
      processedSourceIds: processedSources,
      delayBetweenDownloadsMs: 1500,
    });

    if (processed.length === 0) {
      console.log(JSON.stringify({ event: 'worker_attachments_done', extracted: 0 }));
      return;
    }

    let saved = 0;
    for (const item of processed) {
      const ok = await saveNoticeRawText(item.sourceId, item.outcome.rawText, item.outcome.extractedDeadlines);
      if (ok) saved++;
    }

    const recorded = await recordAttachmentProcessing(
      processed.map((item) => ({
        contentHash: item.outcome.contentHash,
        sourceId: item.sourceId,
        fileUrl: candidates.find((c) => c.sourceId === item.sourceId)?.fileUrl ?? '',
        fileName: item.outcome.fileName,
        kind: item.outcome.kind,
        byteSize: item.outcome.byteSize,
        provider: item.outcome.provider,
        isScanned: item.outcome.isScanned,
        extractedDeadlines: item.outcome.extractedDeadlines,
        rawTextLength: item.outcome.rawText.length,
      })),
    );

    console.log(JSON.stringify({
      event: 'worker_attachments_done',
      candidates: candidates.length,
      extracted: processed.length,
      rawTextSaved: saved,
      recorded,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(JSON.stringify({ event: 'worker_attachments_error', error: msg }));
  }
}

/**
 * Timetable stage: diff the freshly polled schedule against the stored
 * snapshot, persist both, then push one notification per change to the
 * devices registered for that class.
 */
async function runTimetableStage(): Promise<void> {
  try {
    const stored = await fetchTimetableSnapshots();
    const previous = new Map<string, Timetable>();
    for (const [classKey, row] of stored) {
      for (const [key, timetable] of parseTimetableSnapshotPayload(classKey, row.payload)) {
        previous.set(key, timetable);
      }
    }

    const job = new TimetablePollerJob(previous);
    const result = await job.pollAndComputeDiffs();

    // One snapshot row per class, holding every semester session.
    const byClass = new Map<string, Timetable[]>();
    for (const timetable of job.getSnapshots().values()) {
      const key = normaliseClassKey(timetable.classKey);
      const list = byClass.get(key) ?? [];
      list.push(timetable);
      byClass.set(key, list);
    }
    const snapshotRows = [...byClass.entries()].map(([classKey, timetables]) => {
      const payload = buildTimetableSnapshotPayload(timetables);
      return { classKey, hash: buildSnapshotRowHash(payload), payload };
    });
    const snapshotsWritten = await upsertTimetableSnapshots(snapshotRows);

    console.log(JSON.stringify({
      event: 'worker_timetable_scanned',
      classes: result.totalClassesScanned,
      changes: result.changedClassesCount,
      snapshots: snapshotsWritten,
    }));

    if (result.changes.length > 0) {
      await recordTimetableChanges(
        result.changes.map((change) => ({
          classKey: normaliseClassKey(change.classKey),
          diff: {
            changeKey: change.changeKey,
            semesterSessionId: change.semesterSessionId,
            diffCount: change.diffCount,
            diffs: change.diffs,
            notificationMessage: change.notificationMessage,
          },
        })),
      );

      const alreadyPushed = await fetchPushedChangeKeys();
      const receipts = await sendPushForTimetableChanges(result.changes, alreadyPushed);
      const sent = receipts.reduce((a, r) => a + r.sent, 0);
      console.log(JSON.stringify({
        event: 'worker_timetable_push',
        sent,
        receipts: receipts.length,
        skipped: receipts.filter((r) => r.skipped).length,
      }));
      await recordWorkerRun('timetable', 'ok', result.totalClassesScanned, result.changedClassesCount);
    } else {
      await recordWorkerRun('timetable', 'ok', result.totalClassesScanned, 0);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'worker_timetable_error', error: msg }));
    await recordWorkerRun('timetable', 'error', 0, 0, msg);
  }
}

void main();
