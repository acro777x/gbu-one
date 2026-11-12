/**
 * GBU One — Worker entrypoint (run by GitHub Actions cron).
 * Fetch -> enrich -> upsert (Supabase, idempotent on source_id) -> push.
 * Timetable stage: poll -> diff against stored snapshot -> record -> push
 * to the devices of the affected class only.
 *
 * THE FAILURE CONTRACT
 * --------------------
 * Every stage reports whether it worked. A stage that failed is recorded in
 * `worker_runs` and the process exits with code 1 at the END of the run, so
 * one failing stage does not hide the others and the cron shows red instead
 * of green over stale data.
 *
 * The worker never overwrites stored data with an empty parse (the
 * layout-change guard lives in noticesJob) and it never advances the
 * timetable baseline before the change has been delivered.
 */
import 'dotenv/config';
import { NoticesWorkerJob, fetchWithTlsTolerance } from './noticesJob';
import { collectCalendarRows } from './calendarJob';
import { runResultsStage } from './resultsJob';
import {
  checkSchema,
  upsertNotices,
  recordWorkerRun,
  fetchKnownNotices,
  isWorkerSupabaseConfigured,
  fetchTimetableSnapshots,
  upsertTimetableSnapshots,
  recordTimetableChanges,
  fetchRecordedChangeKeys,
  fetchPushedChangeKeys,
  saveNoticeRawText,
  saveNoticeAudience,
  fetchProcessedAttachmentHashes,
  recordAttachmentProcessing,
  recordAttachmentFailure,
  fetchProcessedAttachmentSources,
  fetchProcessedAttachmentUrls,
  fetchNoticesWithFiles,
  fetchRecentAttachmentFailures,
  fetchNoticeRawText,
  deleteLegacyNoticeRows,
  upsertCalendarEvents,
  upsertExamDateSlots,
  deleteStaleCalendarEvents,
  deleteStaleExamDateSlots,
} from './supabaseClient';
import {
  sendPushForCandidates,
  sendPushForTimetableChanges,
  normaliseClassKey,
} from './pushSender';
import {
  TimetablePollerJob,
  buildSnapshotRowHash,
  buildTimetableSnapshotPayload,
  parseTimetableSnapshotPayload,
} from './timetableJob';
import {
  extractAttachments,
  resolveAttachmentUrl,
  MAX_ATTACHMENT_BYTES,
  type OcrRunner,
} from './attachmentPipeline';
import { runTesseract, runVision, isTesseractAvailable } from './ocrRunner';
import { resolveOcrProvider } from './ocrService';
import { fetchWithRetry, politeWait } from './http';
import { workerRunsScheduler } from './sourceScheduler';
import { StageFailures } from './runStages';
import { detectNoticeAudience } from '../src/features/notices/noticeService';
import type { Timetable } from '../src/features/timetable/timetableProvider';

/**
 * How long a broken attachment is left alone before the worker tries it
 * again. Without it a file that cannot be read is downloaded and OCR'd every
 * fifteen minutes, forever.
 */
const ATTACHMENT_BACKOFF_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const started = Date.now();
  console.log(JSON.stringify({ event: 'worker_start', at: new Date().toISOString() }));
  const failures = new StageFailures();

  const supa = isWorkerSupabaseConfigured();
  let schemaOk = false;
  if (!supa) {
    console.warn('Worker: Supabase not configured — running parse-only (no persistence, no push).');
  } else {
    const check = await checkSchema();
    if (!check.ok) {
      const reason =
        `missing table(s): ${check.missing.join(', ') || 'unknown'}` +
        `${check.error ? ` (${check.error})` : ''}. ` +
        'The owner has to paste supabase/schema.sql into the Supabase dashboard.';
      console.error(JSON.stringify({ event: 'worker_schema_error', reason }));
      await recordWorkerRun('schema', 'error', 0, 0, reason);
      failures.record('schema', reason);
    } else {
      schemaOk = true;
    }
  }

  if (schemaOk) {
    await runNoticesStage(failures);
    await runTimetableStage(failures);
    await runCalendarStage(failures);
    try {
      await runResultsStage();
    } catch (err) {
      // The stage already recorded the failure; the run continues so the
      // other stages still get their chance.
      failures.record(
        'results',
        err instanceof Error ? err.message : String(err),
      );
    }
    await runAttachmentStage(failures);
  }

  const failedStages = failures.list();
  console.log(JSON.stringify({
    event: 'worker_done',
    ms: Date.now() - started,
    at: new Date().toISOString(),
    failedStages,
  }));

  if (failedStages.length > 0) {
    // The exit code is set at the END, so every stage had its chance to run
    // and to report.
    console.error(
      JSON.stringify({
        event: 'worker_failed',
        stages: failedStages,
        note: 'the data of the failed stages is stale',
      }),
    );
    process.exitCode = 1;
  }
}

/**
 * The notices stage: scrape every source, enrich, store and push.
 */
async function runNoticesStage(failures: StageFailures): Promise<void> {
  // Seed the dedupe set from the stored rows so reruns don't re-push old
  // notices. A failed read is NOT an empty table: it must not be mistaken
  // for a first sync, and it must not push anything either.
  const known = await fetchKnownNotices();
  if (!known.ok) {
    const reason = `known source id read failed: ${known.error ?? 'unknown error'}`;
    await recordWorkerRun('notices', 'error', 0, 0, reason);
    failures.record('notices', reason);
    return;
  }
  const knownCount = known.ids.size;

  // How many notices each source has stored. A source that suddenly parses
  // nothing but has rows stored has lost its notices - the page layout
  // changed.
  const storedCounts = new Map<string, number>();
  for (const state of known.states.values()) {
    storedCounts.set(state.source, (storedCounts.get(state.source) ?? 0) + 1);
  }

  const worker = new NoticesWorkerJob([...known.ids], { scheduler: workerRunsScheduler });
  let result;
  try {
    result = await worker.runJob();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'worker_error', error: msg }));
    await recordWorkerRun('notices', 'error', 0, 0, msg);
    failures.record('notices', msg);
    return;
  }

  console.log(JSON.stringify({
    event: 'worker_scraped',
    total: result.totalScraped,
    fresh: result.newNoticesCount,
    pushCandidates: result.pushCandidates.length,
  }));

  // The layout-change guard, per source. A source that answered but yielded
  // nothing is suspicious: the page layout probably changed. The rows that
  // were stored earlier are kept (the store is an upsert, never a replace),
  // and the stage is recorded as failed so the cron shows red.
  //
  // A source that never had any notices is not a layout change - some of the
  // university portals simply publish nothing at the moment.
  const suspiciousSources = result.sourceResults.filter((s) => {
    if (s.skipped) return false;
    if (s.failed) return true;
    if (!s.suspicious) return false;
    return (storedCounts.get(s.source) ?? 0) > 0;
  });
  for (const source of suspiciousSources) {
    const reason = `${source.source}: ${source.reason ?? 'empty parse'}`;
    console.warn(JSON.stringify({ event: 'worker_source_suspicious', source: source.source, reason }));
    await recordWorkerRun(`notices:${source.source}`, 'error', source.count, 0, reason);
    failures.record('notices', reason);
  }

  if (result.notices.length > 0) {
    const written = await upsertNotices(result.notices, known.states);
    console.log(JSON.stringify({ event: 'worker_upserted', ...written }));
    if (written.failed > 0) {
      failures.record('notices', `${written.failed} notice row(s) could not be written`);
    }

    // The source id used to be a prefix of the sha256 digest. The rows of
    // that old format describe the same notices as the new rows, so they
    // are removed - otherwise every notice would be stored twice.
    const currentIds = new Set(result.notices.map((n) => n.sourceId));
    const legacyIds = [...known.ids].filter((id) => /^src_[0-9a-f]{16}$/.test(id));
    if (legacyIds.length > 0) {
      const deleted = await deleteLegacyNoticeRows(legacyIds, currentIds);
      if (deleted.failed > 0) {
        failures.record(
          'notices',
          `${deleted.failed} legacy notice row(s) could not be deleted`,
        );
      }
    }
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
  if (isFirstSync) {
    console.log(JSON.stringify({ event: 'worker_baseline', note: 'first sync: no pushes sent' }));
  }
  if (pushable.length > 0) {
    const receipts = await sendPushForCandidates(pushable);
    const sent = receipts.reduce((a, r) => a + r.sent, 0);
    console.log(JSON.stringify({ event: 'worker_push', sent, receipts: receipts.length }));
  } else {
    console.log(JSON.stringify({ event: 'worker_push_skipped', reason: 'no-candidates' }));
  }

  await recordWorkerRun('notices', 'ok', result.totalScraped, result.newNoticesCount);
}

/**
 * Attachment stage: download each notice's file once, pull the text out of it
 * (PDF text layer, or OCR for images and scanned PDFs) and store the text on
 * the notice. Files already processed are skipped by content hash and by URL.
 */
async function runAttachmentStage(failures: StageFailures): Promise<void> {
  // The links are resolved to the absolute, HTTPS file URL, so the URL dedupe
  // compares the same string everywhere.
  const stored = await fetchAttachmentCandidates();
  const notices = stored
    .map((notice) => ({ ...notice, fileUrl: resolveAttachmentUrl(notice.fileUrl) ?? '' }))
    .filter((notice) => notice.fileUrl.length > 0);
  if (notices.length === 0) {
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
    await politeWait(url, 1500);
    const res = await fetchWithRetry(
      url,
      { headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project; contact: student.gbuone@gmail.com)' } },
      {
        attempts: 2,
        baseDelayMs: 2000,
        timeoutMs: 30_000,
        fetchImpl: (target, init) => fetchWithTlsTolerance(target, init),
      },
    );
    if (!res.ok) throw new Error(`http-${res.status}`);

    // The size is checked BEFORE the body is buffered, so a huge file is
    // never pulled into memory.
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_BYTES) {
      throw new Error(`too-large (${declared} bytes)`);
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`too-large (${bytes.length} bytes)`);
    }
    return { bytes, contentType: res.headers.get('content-type') };
  };

  // Files already processed in an earlier run are not extracted again, and
  // the notice itself is not fetched again.
  const processedHashes = await fetchProcessedAttachmentHashes();
  const processedSources = await fetchProcessedAttachmentSources();
  const processedUrlOwners = new Map<string, string>();
  for (const [url, owner] of await fetchProcessedAttachmentUrls()) {
    const resolved = resolveAttachmentUrl(url);
    if (resolved) processedUrlOwners.set(resolved, owner);
  }
  const processedUrls = new Set(processedUrlOwners.keys());

  // A file that was already extracted for another notice: the text of that
  // notice is copied over instead of downloading the file again.
  for (const notice of notices) {
    const owner = processedUrlOwners.get(notice.fileUrl);
    if (!owner) continue;
    const text = await fetchNoticeRawText(owner);
    if (!text) continue;
    await saveNoticeRawText(notice.sourceId, text, []);
    const audience = detectNoticeAudience(notice.title, text);
    await saveNoticeAudience(notice.sourceId, audience as Record<string, unknown>);
  }

  // A file that failed recently is left alone for a while.
  const recentlyFailed = await fetchRecentAttachmentFailures(ATTACHMENT_BACKOFF_MS);
  const candidates = notices.filter((n) => !recentlyFailed.has(n.fileUrl));
  if (candidates.length !== notices.length) {
    console.log(JSON.stringify({
      event: 'worker_attachments_backoff',
      skipped: notices.length - candidates.length,
      note: 'these files failed recently and are not retried yet',
    }));
  }

  const processed = await extractAttachments(candidates, {
    download,
    ocr,
    provider,
    processedHashes,
    processedSourceIds: processedSources,
    processedUrls,
    delayBetweenDownloadsMs: 1500,
    onFailure: (failure) => {
      console.warn(
        JSON.stringify({
          event: 'worker_attachment_failed',
          url: failure.fileUrl,
          reason: failure.reason,
        }),
      );
      void recordAttachmentFailure(failure.fileUrl, failure.reason);
    },
  });

  if (processed.length === 0) {
    console.log(JSON.stringify({ event: 'worker_attachments_done', extracted: 0 }));
    return;
  }

  let saved = 0;
  for (const item of processed) {
    const notice = notices.find((n) => n.sourceId === item.sourceId);
    const ok = await saveNoticeRawText(
      item.sourceId,
      item.outcome.rawText,
      item.outcome.extractedDeadlines,
    );
    if (ok) saved++;

    // The audience can be refined with what the document body says - the
    // title alone is not always enough.
    if (notice?.title) {
      const audience = detectNoticeAudience(notice.title, item.outcome.rawText);
      await saveNoticeAudience(item.sourceId, audience as Record<string, unknown>);
    }
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
    ...recorded,
  }));

  if (recorded.failed > 0) {
    failures.record('attachments', `${recorded.failed} attachment record(s) could not be written`);
  }
}

/** The notices that carry a downloadable file. */
async function fetchAttachmentCandidates(): Promise<
  Array<{ sourceId: string; fileUrl: string; title: string }>
> {
  const read = await fetchNoticesWithFiles();
  if (!read.ok) {
    console.warn('Worker: attachment candidate read failed:', read.error);
    return [];
  }
  return read.rows;
}

/**
 * Timetable stage: diff the freshly polled schedule against the stored
 * snapshot, record the change, push it to the devices of the affected class
 * and only then advance the stored snapshot.
 */
async function runTimetableStage(failures: StageFailures): Promise<void> {
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

    // The new snapshots, per class, before the push.
    const newTimetables = new Map<string, Timetable[]>();
    for (const timetable of job.getSnapshots().values()) {
      const key = normaliseClassKey(timetable.classKey);
      const list = newTimetables.get(key) ?? [];
      list.push(timetable);
      newTimetables.set(key, list);
    }

    console.log(JSON.stringify({
      event: 'worker_timetable_scanned',
      classes: result.totalClassesScanned,
      changes: result.changedClassesCount,
    }));

    if (result.changes.length === 0) {
      // Nothing changed, so the snapshot can be advanced safely.
      const snapshotRows = [...newTimetables.entries()].map(([classKey, timetables]) => {
        const payload = buildTimetableSnapshotPayload(timetables);
        return { classKey, hash: buildSnapshotRowHash(payload), payload };
      });
      const written = await upsertTimetableSnapshots(snapshotRows);
      console.log(JSON.stringify({ event: 'worker_timetable_snapshots', ...written }));
      await recordWorkerRun('timetable', 'ok', result.totalClassesScanned, 0);
      return;
    }

    // The change is recorded BEFORE the push, so a crash between the two
    // does not lose it.
    //
    // A change that is already in the history is not written again: the
    // change key is deterministic, so the same edit always produces the same
    // row.
    const knownChangeKeys = await fetchRecordedChangeKeys();
    const newChanges = result.changes.filter(
      (change) => !knownChangeKeys.has(change.changeKey),
    );
    const recordedChanges = await recordTimetableChanges(
      newChanges.map((change) => ({
        classKey: normaliseClassKey(change.classKey),
        changeKey: change.changeKey,
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
      ...recordedChanges,
    }));

    // The snapshot is advanced only for the sessions whose change was
    // delivered. Everything else keeps the snapshot it had, so the next run
    // sees the same change again and tries to deliver it once more.
    const delivered = new Set<string>();
    for (const receipt of receipts) {
      if (receipt.sent > 0 || receipt.reason === 'already-pushed') {
        delivered.add(receipt.changeKey);
      }
    }
    const blockedSessions = new Set<string>();
    for (const change of result.changes) {
      if (delivered.has(change.changeKey)) continue;
      blockedSessions.add(
        `${normaliseClassKey(change.classKey)}#${change.semesterSessionId}`,
      );
    }

    const snapshotRows = [...newTimetables.entries()].map(([classKey, timetables]) => {
      // The old snapshot of the class, per session.
      const oldBySession = new Map<string, Timetable>();
      for (const [key, timetable] of previous.entries()) {
        if (!key.startsWith(`${classKey}#`)) continue;
        oldBySession.set(timetable.semesterSessionId, timetable);
      }
      // A session whose change was not delivered keeps its old snapshot; a
      // session without a change gets the new one.
      const merged = timetables.map((timetable) => {
        const sessionKey = `${classKey}#${timetable.semesterSessionId}`;
        if (!blockedSessions.has(sessionKey)) return timetable;
        return oldBySession.get(timetable.semesterSessionId) ?? timetable;
      });
      const payload = buildTimetableSnapshotPayload(merged);
      return { classKey, hash: buildSnapshotRowHash(payload), payload };
    });

    const written = await upsertTimetableSnapshots(snapshotRows);
    console.log(JSON.stringify({
      event: 'worker_timetable_snapshots',
      ...written,
      heldBack: blockedSessions.size,
    }));
    if (written.failed > 0) {
      failures.record('timetable', `${written.failed} snapshot row(s) could not be written`);
    }

    if (blockedSessions.size > 0) {
      failures.record(
        'timetable',
        `${blockedSessions.size} session(s) keep their old snapshot: the change was not delivered`,
      );
    }

    await recordWorkerRun('timetable', 'ok', result.totalClassesScanned, result.changedClassesCount);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'worker_timetable_error', error: msg }));
    await recordWorkerRun('timetable', 'error', 0, 0, msg);
    failures.record('timetable', msg);
  }
}

/**
 * Calendar stage: read the university's academic calendar, the holiday list
 * and (when it is published) the end-semester date sheet, then store them.
 */
async function runCalendarStage(failures: StageFailures): Promise<void> {
  try {
    const result = await collectCalendarRows({ scheduler: workerRunsScheduler });
    console.log(JSON.stringify({
      event: 'worker_calendar_scraped',
      events: result.events.length,
      slots: result.slots.length,
      reasons: result.reasons,
    }));

    if (!result.ok) {
      const reason = result.reasons.join('; ') || 'no calendar data';
      await recordWorkerRun('calendar', 'error', 0, 0, reason);
      failures.record('calendar', reason);
      return;
    }

    const written = await upsertCalendarEvents(result.events);
    const slotsWritten = await upsertExamDateSlots(result.slots);
    console.log(JSON.stringify({
      event: 'worker_calendar_upserted',
      events: written.written,
      eventFailures: written.failed,
      slots: slotsWritten.written,
      slotFailures: slotsWritten.failed,
    }));
    if (written.failed > 0 || slotsWritten.failed > 0) {
      failures.record(
        'calendar',
        `${written.failed + slotsWritten.failed} calendar row(s) could not be written`,
      );
    }

    // The rows that are no longer published are removed, so an edited title
    // does not leave a duplicate behind for ever.
    const eventsBySource = new Map<string, string[]>();
    for (const event of result.events) {
      const key = `${event.source}|${event.semester}`;
      const list = eventsBySource.get(key) ?? [];
      list.push(event.event_key);
      eventsBySource.set(key, list);
    }
    for (const [key, keepKeys] of eventsBySource) {
      const [source, semester] = key.split('|');
      const deleted = await deleteStaleCalendarEvents(source, semester, keepKeys);
      if (deleted.failed > 0) {
        failures.record('calendar', `${deleted.failed} stale calendar row(s) could not be deleted`);
      }
    }

    const slotsBySchool = new Map<string, string[]>();
    for (const slot of result.slots) {
      const list = slotsBySchool.get(slot.school_code) ?? [];
      list.push(slot.slot_key);
      slotsBySchool.set(slot.school_code, list);
    }
    for (const [schoolCode, keepKeys] of slotsBySchool) {
      const deleted = await deleteStaleExamDateSlots(schoolCode, keepKeys);
      if (deleted.failed > 0) {
        failures.record('calendar', `${deleted.failed} stale date slot(s) could not be deleted`);
      }
    }

    await recordWorkerRun('calendar', 'ok', result.events.length, result.slots.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'worker_calendar_error', error: msg }));
    await recordWorkerRun('calendar', 'error', 0, 0, msg);
    failures.record('calendar', msg);
  }
}

void main();
