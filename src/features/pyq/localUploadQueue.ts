/**
 * GBU One - the local upload queue.
 *
 * A student can hand in a question paper before the cloud is connected (the
 * project has no Supabase project yet) and before they have an account. The
 * paper is kept on the phone with everything needed to upload it later, so
 * the upload flow is never a dead end and nothing is lost.
 *
 * The queue USED to be write-only: `dequeueUpload` had no call site in the
 * app, so every paper that was saved "for later" stayed on the phone for
 * ever while the screen promised it "will upload automatically once
 * connected". `flushUploadQueue()` is that promise, kept.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PyqUploadMeta } from './pyqStorage';
import { uploadPendingPaper } from './pyqRepository';

export const LOCAL_UPLOAD_QUEUE_KEY = '@gbu_one_pyq_upload_queue';

/** Where a queued paper is in its life. */
export type QueuedUploadStatus = 'queued' | 'uploading' | 'synced' | 'failed';

/**
 * Who handed the paper in.
 *
 * `authUserId` is the Supabase Auth user id (null for a guest) and
 * `studentId` is the device identity (GBU-XXXXXX). They are kept apart so
 * a guest upload never tries to write a non-uuid into the foreign key.
 */
export interface QueuedUploadIdentity {
  authUserId: string | null;
  studentId: string;
  name?: string;
  avatarId?: string;
}

export interface QueuedUpload {
  /** Stable id of the queued paper. */
  id: string;
  /** The file as the picker returned it. */
  file: {
    uri: string;
    name: string;
    mimeType: string;
    /** Null when the picker could not measure the file. */
    size: number | null;
  };
  meta: PyqUploadMeta;
  /** When the student handed it in. */
  queuedAt: string;
  /** Where the paper is in the upload life. */
  status: QueuedUploadStatus;
  /** How many times the upload has been tried. */
  attempts: number;
  /** Why the last attempt failed. */
  lastError: string | null;
  /** The earliest moment the entry may be tried again (backoff). */
  nextAttemptAt: string | null;
  /** Who handed the paper in. */
  uploader: QueuedUploadIdentity;
}

function normaliseIdentity(raw: unknown): QueuedUploadIdentity {
  const candidate = (raw ?? {}) as Partial<QueuedUploadIdentity>;
  return {
    authUserId: typeof candidate.authUserId === 'string' ? candidate.authUserId : null,
    studentId: typeof candidate.studentId === 'string' ? candidate.studentId : '',
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    avatarId: typeof candidate.avatarId === 'string' ? candidate.avatarId : undefined,
  };
}

function normaliseStatus(raw: unknown): QueuedUploadStatus {
  if (raw === 'uploading' || raw === 'synced' || raw === 'failed') return raw;
  return 'queued';
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

/**
 * Reads the queue, ignoring anything that is not a usable entry.
 *
 * Entries written by an older build have no status, no attempt counter and
 * no identity; they are brought up to date here instead of being dropped,
 * so a paper saved before an app update is never lost.
 */
export function parseQueuedUploads(raw: string | null): QueuedUpload[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isQueuedUpload).map((entry) => {
    const candidate = entry as Partial<QueuedUpload>;
    return {
      ...entry,
      file: {
        uri: entry.file.uri,
        name: entry.file.name ?? 'paper.pdf',
        mimeType: entry.file.mimeType ?? 'application/pdf',
        size:
          typeof entry.file.size === 'number'
            ? entry.file.size
            : entry.file.size === null
              ? null
              : null,
      },
      status: normaliseStatus(candidate.status),
      attempts: typeof candidate.attempts === 'number' ? candidate.attempts : 0,
      lastError: typeof candidate.lastError === 'string' ? candidate.lastError : null,
      nextAttemptAt:
        typeof candidate.nextAttemptAt === 'string' ? candidate.nextAttemptAt : null,
      uploader: normaliseIdentity(candidate.uploader),
    };
  });
}

/** Builds the queue entry for a paper. */
export function buildQueuedUpload(
  file: { uri: string; name: string; mimeType: string; size: number | null },
  meta: PyqUploadMeta,
  now: Date = new Date(),
  uploader?: QueuedUploadIdentity,
): QueuedUpload {
  return {
    id: `local_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    meta,
    queuedAt: now.toISOString(),
    status: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    uploader: normaliseIdentity(uploader),
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

/**
 * Deletes a queued paper without uploading it.
 *
 * The student needs a way out: a paper they picked by mistake, or one they
 * no longer want to contribute, must not sit on the phone for ever.
 */
export async function deleteQueuedUpload(id: string): Promise<QueuedUpload[]> {
  return dequeueUpload(id);
}

/**
 * Puts a failed paper back in line for the next attempt.
 */
export async function retryQueuedUpload(id: string): Promise<QueuedUpload[]> {
  const queue = await readUploadQueue();
  const next = queue.map((entry) =>
    entry.id === id
      ? { ...entry, status: 'queued' as QueuedUploadStatus, lastError: null, nextAttemptAt: null }
      : entry,
  );
  await writeUploadQueue(next);
  return next;
}

/** How long to wait before the next attempt, in minutes. */
export function uploadBackoffMinutes(attempts: number): number {
  const minutes = 2 ** Math.max(0, attempts);
  return Math.min(minutes, 60);
}

export interface FlushUploadQueueOptions {
  /**
   * The signed-in identity, used when an entry does not carry one (a paper
   * queued as a guest is uploaded with the account once the student signs
   * in).
   */
  uploader?: QueuedUploadIdentity;
  /** The clock, injected by the tests. */
  now?: Date;
  /** How many entries to try in one pass. */
  limit?: number;
}

export interface FlushUploadQueueResult {
  /** Papers that reached the library. */
  uploaded: number;
  /** Papers that failed and stay on the phone. */
  failed: number;
  /** Papers that were not tried yet (still in backoff). */
  skipped: number;
  /** What is still on the phone. */
  remaining: QueuedUpload[];
}

let flushInFlight: Promise<FlushUploadQueueResult> | null = null;

/**
 * Uploads every queued paper that is due.
 *
 * A paper that succeeds is taken off the queue. A paper that fails stays on
 * the phone with the reason and a backoff, so a dead network cannot turn
 * into a hammering of the server and the paper is not lost.
 */
export async function flushUploadQueue(
  options: FlushUploadQueueOptions = {},
): Promise<FlushUploadQueueResult> {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async (): Promise<FlushUploadQueueResult> => {
    const now = options.now ?? new Date();
    const limit = options.limit ?? 10;
    const queue = await readUploadQueue();
    if (queue.length === 0) {
      return { uploaded: 0, failed: 0, skipped: 0, remaining: [] };
    }

    let uploaded = 0;
    let failed = 0;
    let skipped = 0;
    let attempted = 0;
    // `current` is the source of truth for what is on the phone: it is
    // written after every change, so the stored queue never goes backwards.
    let current: QueuedUpload[] = [...queue];

    for (const entry of queue) {
      if (attempted >= limit) {
        skipped += 1;
        continue;
      }

      if (entry.status === 'synced') {
        current = current.filter((item) => item.id !== entry.id);
        continue;
      }

      const dueAt = entry.nextAttemptAt ? Date.parse(entry.nextAttemptAt) : 0;
      if (entry.status === 'failed' && dueAt > now.getTime()) {
        skipped += 1;
        continue;
      }

      const identity: QueuedUploadIdentity = {
        authUserId: options.uploader?.authUserId ?? entry.uploader.authUserId ?? null,
        studentId: options.uploader?.studentId || entry.uploader.studentId,
        name: options.uploader?.name || entry.uploader.name,
        avatarId: options.uploader?.avatarId || entry.uploader.avatarId,
      };

      // Mark the attempt BEFORE it starts, so a crash in the middle does not
      // leave the paper looking as if it had never been tried.
      current = current.map((item) =>
        item.id === entry.id ? { ...item, status: 'uploading' as QueuedUploadStatus } : item,
      );
      await writeUploadQueue(current);
      attempted += 1;

      const result = await uploadPendingPaper(entry.file, entry.meta, identity);

      if (result.ok) {
        current = current.filter((item) => item.id !== entry.id);
        await writeUploadQueue(current);
        uploaded += 1;
        continue;
      }

      const attempts = entry.attempts + 1;
      const backoffMs = uploadBackoffMinutes(attempts) * 60 * 1000;
      const failedEntry: QueuedUpload = {
        ...entry,
        status: 'failed',
        attempts,
        lastError: result.reason,
        nextAttemptAt: new Date(now.getTime() + backoffMs).toISOString(),
        uploader: identity,
      };
      failed += 1;
      current = current.map((item) => (item.id === entry.id ? failedEntry : item));
      await writeUploadQueue(current);
    }

    await writeUploadQueue(current);
    return { uploaded, failed, skipped, remaining: current };
  })();

  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}
