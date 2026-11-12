/**
 * GBU One — Push dispatch (Expo Push Service, FCM under the hood).
 * Sends to stored device tokens for push candidates (importance >= 3) and
 * for timetable changes (class-targeted).
 * No-op when Supabase or EXPO_PUSH credentials are missing.
 *
 * The Expo Push Service answers HTTP 200 with one receipt per message, and
 * a receipt can say `status: "error"`. The old code counted a batch as
 * "sent" whenever the HTTP status was 200, so a rejected message (an
 * expired token, a rate limit, a broken payload) was counted as delivered
 * and the change was marked as pushed for good. Every send therefore reads
 * the receipts.
 */
import type { NoticeItem } from '../src/features/notices/noticeService';
import { normaliseClassKey } from '../src/lib/classKey';
import type { TimetableChangeRecord } from './timetableJob';
import {
  getWorkerSupabase,
  markTimetablePush,
  deleteDeviceTokens,
  selectAllRows,
  type ResultRecord,
} from './supabaseClient';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Android channel for timetable change pushes (docs/NOTIFICATIONS.md). */
export const TIMETABLE_CHANNEL_ID = 'timetable_changes';

/** The Expo error that means "this device is gone". */
const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

export interface PushReceipt {
  noticeId: string;
  sent: number;
  skipped: boolean;
  reason?: string;
}

export interface TimetablePushReceipt {
  changeKey: string;
  classKey: string;
  sent: number;
  skipped: boolean;
  reason?: string;
}

/** A device token row as stored in `device_tokens`. */
export interface DeviceTokenRow {
  token?: string | null;
  class_key?: string | null;
}

/** Canonical class key form used on both the app and worker side. */
export { normaliseClassKey };

function isExpoToken(token: unknown): token is string {
  return typeof token === 'string' && token.startsWith('ExponentPushToken');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Picks the device tokens registered for one class.
 * Matching is case- and whitespace-insensitive because the app registers the
 * section code exactly as the university publishes it.
 */
export function selectTokensForClass(rows: DeviceTokenRow[], classKey: string): string[] {
  const wanted = normaliseClassKey(classKey);
  if (!wanted) return [];
  const tokens = rows
    .filter((r) => normaliseClassKey(r?.class_key) === wanted)
    .map((r) => r?.token)
    .filter(isExpoToken);
  return [...new Set(tokens)];
}

/** One receipt of the Expo Push Service. */
interface ExpoReceipt {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/** What one batch of messages achieved. */
export interface ExpoBatchResult {
  /** Messages the service accepted. */
  sent: number;
  /** Messages the service rejected. */
  failed: number;
  /** Tokens the service reported as no longer registered. */
  deadTokens: string[];
  /** The first error message, for the log. */
  error?: string;
}

/**
 * Sends one batch and reads the receipts.
 *
 * The receipts decide whether the messages were delivered: HTTP 200 alone
 * only means that the request was understood.
 */
export async function sendExpoBatch(
  messages: Array<Record<string, unknown>>,
  accessToken: string,
): Promise<ExpoBatchResult> {
  let response: Response;
  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    return {
      sent: 0,
      failed: messages.length,
      deadTokens: [],
      error: err instanceof Error ? err.message : 'push-request-failed',
    };
  }

  if (!response.ok) {
    return {
      sent: 0,
      failed: messages.length,
      deadTokens: [],
      error: `http-${response.status}`,
    };
  }

  let receipts: ExpoReceipt[] = [];
  try {
    const body = (await response.json()) as unknown;
    if (Array.isArray(body)) {
      receipts = body as ExpoReceipt[];
    } else if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
      receipts = (body as { data: ExpoReceipt[] }).data;
    }
  } catch (err) {
    return {
      sent: 0,
      failed: messages.length,
      deadTokens: [],
      error: err instanceof Error ? err.message : 'unreadable-push-response',
    };
  }

  if (receipts.length === 0) {
    // No receipt at all: nothing can be claimed to have been delivered.
    return {
      sent: 0,
      failed: messages.length,
      deadTokens: [],
      error: 'no-push-receipts',
    };
  }

  let sent = 0;
  let failed = 0;
  let error: string | undefined;
  const deadTokens: string[] = [];
  for (let index = 0; index < receipts.length; index++) {
    const receipt = receipts[index];
    if (receipt?.status === 'ok') {
      sent += 1;
      continue;
    }
    failed += 1;
    const detail = receipt?.details?.error;
    if (detail === DEVICE_NOT_REGISTERED) {
      const token = messages[index]?.to;
      if (typeof token === 'string') deadTokens.push(token);
    }
    error = error ?? receipt?.message ?? detail ?? 'push-rejected';
  }

  return { sent, failed, deadTokens, error };
}

/** Removes the tokens the push service rejected as gone. */
async function removeDeadTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const removed = await deleteDeviceTokens(tokens);
  if (removed > 0) {
    console.warn(`Worker: removed ${removed} dead device token(s)`);
  }
}

async function fetchTokensForNotice(): Promise<string[]> {
  const sb = getWorkerSupabase();
  if (!sb) return [];
  const read = await selectAllRows<{ token: string }>(sb, 'device_tokens', 'token', 'token');
  if (!read.ok) {
    console.warn('Worker: device token read failed:', read.error);
    return [];
  }
  const tokens = read.rows.map((r) => r?.token).filter(isExpoToken);
  return [...new Set(tokens)];
}

/** Loads the device tokens registered for a single class. */
export async function fetchTokensForClass(classKey: string): Promise<string[]> {
  const sb = getWorkerSupabase();
  if (!sb) return [];
  const wanted = normaliseClassKey(classKey);
  if (!wanted) return [];
  const read = await selectAllRows<{ token: string; class_key: string | null }>(
    sb,
    'device_tokens',
    'token,class_key',
    'token',
  );
  if (!read.ok) {
    console.warn('Worker: device token read failed:', read.error);
    return [];
  }
  return selectTokensForClass(read.rows, wanted);
}

/** Builds the Expo payload for a timetable change (docs/NOTIFICATIONS.md). */
export function buildTimetablePushMessage(change: TimetableChangeRecord): {
  title: string;
  body: string;
  data: Record<string, unknown>;
} {
  return {
    title: 'GBU One — Timetable changed',
    body: (change.notificationMessage || 'Your timetable has changed.').slice(0, 140),
    data: {
      type: 'timetable_change',
      classKey: change.classKey,
      semesterSessionId: change.semesterSessionId,
      changeKey: change.changeKey,
      diffCount: change.diffCount,
    },
  };
}

/**
 * Sends one push per timetable change to the devices of that class only.
 *
 * A change is recorded as pushed only after the push service confirmed the
 * delivery, so a failed send is retried on the next worker run.
 */
export async function sendPushForTimetableChanges(
  changes: TimetableChangeRecord[],
  alreadyPushed: Set<string> = new Set(),
): Promise<TimetablePushReceipt[]> {
  const receipts: TimetablePushReceipt[] = [];
  const accessToken = process.env.EXPO_ACCESS_TOKEN || '';
  if (changes.length === 0) return receipts;

  for (const change of changes) {
    if (alreadyPushed.has(change.changeKey)) {
      receipts.push({
        changeKey: change.changeKey, classKey: change.classKey,
        sent: 0, skipped: true, reason: 'already-pushed',
      });
      continue;
    }
    if (!accessToken) {
      receipts.push({
        changeKey: change.changeKey, classKey: change.classKey,
        sent: 0, skipped: true, reason: 'no-EXPO_ACCESS_TOKEN',
      });
      continue;
    }

    const tokens = await fetchTokensForClass(change.classKey);
    if (tokens.length === 0) {
      receipts.push({
        changeKey: change.changeKey, classKey: change.classKey,
        sent: 0, skipped: true, reason: 'no-tokens',
      });
      continue;
    }

    const { title, body, data } = buildTimetablePushMessage(change);
    let sent = 0;
    let failed = 0;
    let error: string | undefined;
    const deadTokens: string[] = [];

    for (const batch of chunk(tokens, 100)) {
      const messages = batch.map((to) => ({
        to,
        sound: 'default',
        priority: 'high',
        title,
        body,
        channelId: TIMETABLE_CHANNEL_ID,
        data,
      }));
      const result = await sendExpoBatch(messages, accessToken);
      sent += result.sent;
      failed += result.failed;
      deadTokens.push(...result.deadTokens);
      error = error ?? result.error;
    }

    await removeDeadTokens(deadTokens);

    if (sent > 0 && failed === 0) {
      await markTimetablePush(
        change.changeKey,
        change.classKey,
        change.semesterSessionId,
        sent,
      );
    } else {
      // The change was not delivered to everybody, so it stays unmarked and
      // the next worker run tries again.
      console.warn(
        `Worker: timetable push for ${change.changeKey} incomplete (sent ${sent}, failed ${failed}${
          error ? `, ${error}` : ''
        }) - it will be retried`,
      );
    }

    receipts.push({
      changeKey: change.changeKey, classKey: change.classKey,
      sent, skipped: sent === 0, reason: sent === 0 ? (error ?? 'send-failed') : undefined,
    });
  }
  return receipts;
}

export async function sendPushForCandidates(
  candidates: NoticeItem[]
): Promise<PushReceipt[]> {
  const receipts: PushReceipt[] = [];
  const accessToken = process.env.EXPO_ACCESS_TOKEN || '';
  if (candidates.length === 0) return receipts;

  const sb = getWorkerSupabase();
  for (const n of candidates) {
    if (n.importance < 3) {
      receipts.push({ noticeId: n.sourceId, sent: 0, skipped: true, reason: 'importance<3' });
      continue;
    }
    // Dedupe: one push per notice (row exists with pushed flag in audience meta).
    try {
      const { data: existing } = await sb!
        .from('notices')
        .select('id,audience')
        .eq('source_id', n.sourceId)
        .maybeSingle();
      const aud = (existing as { audience?: { pushed?: boolean } } | null)?.audience;
      if (aud?.pushed) {
        receipts.push({ noticeId: n.sourceId, sent: 0, skipped: true, reason: 'already-pushed' });
        continue;
      }
    } catch {
      // fall through and attempt send
    }

    const tokens = await fetchTokensForNotice();
    if (tokens.length === 0 || !accessToken) {
      receipts.push({
        noticeId: n.sourceId, sent: 0, skipped: true,
        reason: tokens.length === 0 ? 'no-tokens' : 'no-EXPO_ACCESS_TOKEN',
      });
      continue;
    }

    let sent = 0;
    let failed = 0;
    let error: string | undefined;
    const deadTokens: string[] = [];

    for (const batch of chunk(tokens, 100)) {
      const messages = batch.map((to) => ({
        to,
        sound: 'default',
        title: 'GBU One — New notice',
        body: n.cleanTitle.slice(0, 140),
        data: { sourceId: n.sourceId, category: n.category },
      }));
      const result = await sendExpoBatch(messages, accessToken);
      sent += result.sent;
      failed += result.failed;
      deadTokens.push(...result.deadTokens);
      error = error ?? result.error;
    }

    await removeDeadTokens(deadTokens);

    // Mark pushed so reruns never re-notify for the same notice. Only when
    // every message was accepted: a partial delivery has to be retried.
    if (sent > 0 && failed === 0) {
      try {
        const { data: row } = await sb!
          .from('notices').select('id,audience').eq('source_id', n.sourceId).maybeSingle();
        const r = row as { id: string; audience?: Record<string, unknown> } | null;
        if (r?.id) {
          await sb!.from('notices').update({
            audience: { ...(r.audience ?? {}), pushed: true },
          }).eq('id', r.id);
        }
      } catch {
        // ignore
      }
    } else {
      console.warn(
        `Worker: notice push for ${n.sourceId} incomplete (sent ${sent}, failed ${failed}${
          error ? `, ${error}` : ''
        })`,
      );
    }

    receipts.push({
      noticeId: n.sourceId, sent, skipped: sent === 0,
      reason: sent === 0 ? (error ?? 'send-failed') : undefined,
    });
  }
  return receipts;
}

export interface ResultPushReceipt {
  fileUrl: string;
  programme: string;
  sent: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Sends push notifications to all devices when a new result batch is published.
 */
export async function sendPushForResults(
  results: ResultRecord[],
  alreadyPushedUrls: Set<string> = new Set(),
): Promise<ResultPushReceipt[]> {
  const receipts: ResultPushReceipt[] = [];
  const accessToken = process.env.EXPO_ACCESS_TOKEN || '';
  if (results.length === 0) return receipts;

  for (const r of results) {
    const url = r.fileUrl || r.file_url || '';
    if (!url) continue;
    if (alreadyPushedUrls.has(url)) {
      receipts.push({
        fileUrl: url,
        programme: r.programme,
        sent: 0,
        skipped: true,
        reason: 'already-pushed',
      });
      continue;
    }
    if (!accessToken) {
      receipts.push({
        fileUrl: url,
        programme: r.programme,
        sent: 0,
        skipped: true,
        reason: 'no-EXPO_ACCESS_TOKEN',
      });
      continue;
    }

    const tokens = await fetchTokensForNotice();
    if (tokens.length === 0) {
      receipts.push({
        fileUrl: url,
        programme: r.programme,
        sent: 0,
        skipped: true,
        reason: 'no-tokens',
      });
      continue;
    }

    let sent = 0;
    let error: string | undefined;
    const deadTokens: string[] = [];
    const title = 'GBU One — Results Declared';
    const body = `${r.title || `Result declared for ${r.programme} (${r.semester ? `Sem ${r.semester}` : 'Latest'})`}. Tap to view.`.slice(0, 140);
    const data = {
      type: 'result_declared',
      fileUrl: url,
      programme: r.programme,
      semester: r.semester,
    };

    for (const batch of chunk(tokens, 100)) {
      const messages = batch.map((to) => ({
        to,
        sound: 'default',
        priority: 'high',
        title,
        body,
        channelId: 'results',
        data,
      }));
      const result = await sendExpoBatch(messages, accessToken);
      sent += result.sent;
      deadTokens.push(...result.deadTokens);
      error = error ?? result.error;
    }

    await removeDeadTokens(deadTokens);

    receipts.push({
      fileUrl: url,
      programme: r.programme,
      sent,
      skipped: sent === 0,
      reason: sent === 0 ? (error ?? 'send-failed') : undefined,
    });
  }
  return receipts;
}
