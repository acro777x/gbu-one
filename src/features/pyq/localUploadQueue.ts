/**
 * GBU One - the local upload queue.
 *
 * A student can hand in a question paper before the cloud is connected (the
 * project has no Supabase project yet) and before they have an account. The
 * paper is kept on the phone with everything needed to upload it later, so
 * the upload flow is never a dead end and nothing is lost.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PyqUploadMeta } from './pyqStorage';

export const LOCAL_UPLOAD_QUEUE_KEY = '@gbu_one_pyq_upload_queue';

export interface QueuedUpload {
  /** Stable id of the queued paper. */
  id: string;
  /** The file as the picker returned it. */
  file: {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  };
  meta: PyqUploadMeta;
  /** When the student handed it in. */
  queuedAt: string;
}

function isQueuedUpload(entry: unknown): entry is QueuedUpload {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<QueuedUpload>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.queuedAt === 'string' &&
    !!candidate.file &&
    typeof candidate.file.uri === 'string' &&
    !!candidate.meta
  );
}

/** Reads the queue, ignoring anything that is not a usable entry. */
export function parseQueuedUploads(raw: string | null): QueuedUpload[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isQueuedUpload);
}

/** Builds the queue entry for a paper. */
export function buildQueuedUpload(
  file: { uri: string; name: string; mimeType: string; size: number },
  meta: PyqUploadMeta,
  now: Date = new Date(),
): QueuedUpload {
  return {
    id: `local_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    meta,
    queuedAt: now.toISOString(),
  };
}

/** Reads the stored queue. */
export async function readUploadQueue(): Promise<QueuedUpload[]> {
  try {
    return parseQueuedUploads(await AsyncStorage.getItem(LOCAL_UPLOAD_QUEUE_KEY));
  } catch {
    return [];
  }
}

/** Replaces the stored queue. */
export async function writeUploadQueue(queue: QueuedUpload[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // A failed write only means the paper is not remembered next launch.
  }
}

/** Adds a paper to the queue. */
export async function enqueueUpload(entry: QueuedUpload): Promise<QueuedUpload[]> {
  const queue = await readUploadQueue();
  const next = [...queue, entry];
  await writeUploadQueue(next);
  return next;
}

/** Removes a paper from the queue once it has been uploaded. */
export async function dequeueUpload(id: string): Promise<QueuedUpload[]> {
  const queue = await readUploadQueue();
  const next = queue.filter((entry) => entry.id !== id);
  await writeUploadQueue(next);
  return next;
}
