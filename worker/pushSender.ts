/**
 * GBU One — Push dispatch (Expo Push Service, FCM under the hood).
 * Sends to stored device tokens for push candidates (importance >= 3).
 * No-op when Supabase or EXPO_PUSH credentials are missing.
 */
import type { NoticeItem } from '../src/features/notices/noticeService';
import { getWorkerSupabase } from './supabaseClient';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushReceipt {
  noticeId: string;
  sent: number;
  skipped: boolean;
  reason?: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchTokensForNotice(): Promise<string[]> {
  const sb = getWorkerSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb.from('device_tokens').select('token').limit(1000);
    const tokens = ((data ?? []) as Array<{ token: string }>)
      .map((r) => r?.token)
      .filter((t): t is string => typeof t === 'string' && t.startsWith('ExponentPushToken'));
    return [...new Set(tokens)];
  } catch {
    return [];
  }
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
