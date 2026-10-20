/**
 * GBU One — Push dispatch (Expo Push Service, FCM under the hood).
 * Sends to stored device tokens for push candidates (importance >= 3) and
 * for timetable changes (class-targeted).
 * No-op when Supabase or EXPO_PUSH credentials are missing.
 */
import type { NoticeItem } from '../src/features/notices/noticeService';
import { normaliseClassKey } from '../src/lib/classKey';
import type { TimetableChangeRecord } from './timetableJob';
import { getWorkerSupabase, markTimetablePush } from './supabaseClient';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Android channel for timetable change pushes (docs/NOTIFICATIONS.md). */
export const TIMETABLE_CHANNEL_ID = 'timetable_changes';

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

async function fetchTokensForNotice(): Promise<string[]> {
  const sb = getWorkerSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb.from('device_tokens').select('token').limit(1000);
    const tokens = ((data ?? []) as Array<{ token: string }>)
      .map((r) => r?.token)
      .filter(isExpoToken);
    return [...new Set(tokens)];
  } catch {
    return [];
  }
}

/** Loads the device tokens registered for a single class. */
export async function fetchTokensForClass(classKey: string): Promise<string[]> {
  const sb = getWorkerSupabase();
  if (!sb) return [];
  const wanted = normaliseClassKey(classKey);
  if (!wanted) return [];
  try {
    const { data } = await sb
      .from('device_tokens')
      .select('token,class_key')
      .limit(2000);
    return selectTokensForClass((data ?? []) as DeviceTokenRow[], wanted);
  } catch {
    return [];
  }
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
 * A change is recorded as pushed only after a successful send, so a failed
 * send is retried on the next worker run.
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
    try {
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
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(messages),
        });
        if (res.ok) sent += batch.length;
      }
    } catch (err) {
      console.warn('Worker: timetable push send failed:', err);
    }

    if (sent > 0) {
      await markTimetablePush(
        change.changeKey,
        change.classKey,
        change.semesterSessionId,
        sent,
      );
    }
    receipts.push({
      changeKey: change.changeKey, classKey: change.classKey,
      sent, skipped: sent === 0, reason: sent === 0 ? 'send-failed' : undefined,
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
    try {
      for (const batch of chunk(tokens, 100)) {
        const messages = batch.map((to) => ({
          to,
          sound: 'default',
          title: 'GBU One — New notice',
          body: n.cleanTitle.slice(0, 140),
          data: { sourceId: n.sourceId, category: n.category },
        }));
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(messages),
        });
        if (res.ok) sent += batch.length;
      }
      // Mark pushed so reruns never re-notify for the same notice.
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
    } catch (err) {
      console.warn('Worker: push send failed:', err);
    }
    receipts.push({ noticeId: n.sourceId, sent, skipped: sent === 0 });
  }
  return receipts;
}
