/**
 * GBU One — PYQ repository (Supabase Storage + Postgres).
 *
 * Upload flow:   app -> Storage `pyq-pending/` -> `pyq_papers` (pending)
 * Moderation:    a moderator moves the file to `pyq/` and sets the status
 * Browse:        only `status = 'approved'` papers are shown to students
 *
 * Every call fails soft: the app must keep working when Supabase is not
 * configured or the network is down.
 */
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  PYQ_APPROVED_BUCKET,
  PYQ_PENDING_BUCKET,
  buildPaperRow,
  buildStoragePath,
  publicPaperUrl,
  statusAfterAction,
  validateUploadFile,
  validateUploadMeta,
  type ModerationAction,
  type PyqUploadMeta,
} from './pyqStorage';

export interface PyqPaperRecord {
  id: string;
  school: string;
  programmeCode: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  year: number;
  examType: 'Mid Sem' | 'End Sem' | 'Back Paper';
  downloads: number;
  status: 'pending' | 'approved' | 'rejected';
  fileUrl: string;
  uploaderId: string | null;
}

export type PyqUploadResult =
  | { ok: true; paperId: string }
  | { ok: false; reason: string };

export type PyqModerationResult =
  | { ok: true }
  | { ok: false; reason: string };

function rowToPaper(row: Record<string, unknown>, storageBaseUrl: string): PyqPaperRecord {
  const filePath = String(row.file_path ?? '');
  const status = String(row.status ?? 'pending') as PyqPaperRecord['status'];
  const approved = status === 'approved';
  return {
    id: String(row.id ?? ''),
    school: String(row.school ?? ''),
    programmeCode: String(row.programme_code ?? ''),
    semester: String(row.semester ?? ''),
    subjectCode: String(row.subject_code ?? ''),
    subjectName: String(row.subject_name ?? ''),
    year: Number(row.year ?? 0),
    examType: (row.exam_type as PyqPaperRecord['examType']) ?? 'Mid Sem',
    downloads: Number(row.downloads ?? 0),
    status,
    fileUrl: approved ? publicPaperUrl(filePath, storageBaseUrl) : filePath,
    uploaderId: (row.uploader_id as string | null) ?? null,
  };
}

/** The Supabase project URL, used to build public download links. */
function storageBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  return url.includes('placeholder') ? '' : url.replace(/\/$/, '');
}

/**
 * React Native has no `File` object for a local file: the platform passes
 * `{ uri, name, type }` and the Supabase storage client understands that
 * descriptor at runtime. The published typings only describe the DOM
 * `FileBody`, so the descriptor is narrowed here in one place.
 */
type StorageUploadFn = ReturnType<typeof supabase.storage.from>['upload'];

function localFileBody(
  file: { uri: string; name?: string | null; mimeType?: string | null },
  path: string,
): Parameters<StorageUploadFn>[1] {
  return {
    uri: file.uri,
    name: file.name ?? path.split('/').pop() ?? 'paper.pdf',
    type: file.mimeType ?? 'application/pdf',
    upsert: false,
  } as unknown as Parameters<StorageUploadFn>[1];
}

/** Lists the papers a student may browse (approved only). */
export async function listApprovedPapers(limit = 300): Promise<PyqPaperRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('pyq_papers')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((row) => rowToPaper(row, storageBaseUrl()));
  } catch {
    return [];
  }
}

/** Lists the papers waiting for a moderator. */
export async function listPendingPapers(limit = 100): Promise<PyqPaperRecord[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('pyq_papers')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((row) => rowToPaper(row, storageBaseUrl()));
  } catch {
    return [];
  }
}

/** How the moderation screen should treat the signed-in account. */
export type ModeratorState = 'moderator' | 'not-moderator' | 'backend-refused' | 'signed-out';

export interface ModeratorStatus {
  state: ModeratorState;
  /** What the screen should tell the owner to do next. Empty for moderators. */
  reason: string;
}

/**
 * Whether the signed-in account may moderate, and - when it may not - why.
 *
 * This used to be a plain boolean that collapsed every failure into `false`,
 * so a project whose row level security has no policy on `moderators` looked
 * exactly like "this account is not a moderator". The owner saw "Moderator
 * access required" even though their allowlist row existed. The reason is
 * carried out here so the screen can point at the fix
 * (docs/ADMIN_MODERATION.md) instead of leaving the queue a dead end.
 */
export async function moderatorStatus(email?: string | null): Promise<ModeratorStatus> {
  if (!email?.trim()) {
    return {
      state: 'signed-out',
      reason: 'Sign in with the account on the moderator list to review uploads.',
    };
  }

  if (!isSupabaseConfigured) {
    return {
      state: 'backend-refused',
      reason: 'The GBU One cloud is not configured in this build, so the queue cannot load.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('moderators')
      .select('role')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      return {
        state: 'backend-refused',
        reason: `The server refused to read the moderator list (${error.message}).`,
      };
    }

    if (!data) {
      return {
        state: 'not-moderator',
        reason:
          `No moderator row is readable for ${email}. Either the address is not on the list, ` +
          'or the project is missing the policies in supabase/schema.ts — see docs/ADMIN_MODERATION.md.',
      };
    }

    return { state: 'moderator', reason: '' };
  } catch (err) {
    return {
      state: 'backend-refused',
      reason: err instanceof Error ? err.message : 'Could not reach the moderator list.',
    };
  }
}

/** True when the signed-in email is on the moderator allowlist. */
export async function isModerator(email?: string | null): Promise<boolean> {
  return (await moderatorStatus(email)).state === 'moderator';
}

/**
 * Approves every pending paper in one pass. The owner asked to clear the
 * imported archive without tapping 39 times; each paper still goes through
 * applyModeration(), so a failure on one paper never blocks or publishes
 * another, and the moderation log keeps one entry per decision.
 */
export async function approveAllPending(
  moderatorEmail?: string | null,
): Promise<{ approved: number; failed: number }> {
  const pending = await listPendingPapers();
  let approved = 0;
  let failed = 0;
  for (const paper of pending) {
    const result = await applyModeration(paper.id, 'approve', moderatorEmail ?? null);
    if (result.ok) approved += 1;
    else failed += 1;
  }
  return { approved, failed };
}

/**
 * Uploads a paper into the pending bucket and queues it for moderation.
 * The file is removed again if the row cannot be written, so the bucket never
 * keeps an orphaned file.
 */
export async function uploadPendingPaper(
  file: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null },
  meta: PyqUploadMeta,
  uploaderId: string | null,
): Promise<PyqUploadResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'Cloud sync is not configured yet.' };
  }

  const metaCheck = validateUploadMeta(meta);
  if (!metaCheck.ok) return { ok: false, reason: metaCheck.reason };

  const fileCheck = validateUploadFile(file);
  if (!fileCheck.ok) return { ok: false, reason: fileCheck.reason };

  const paperId = `pyq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const path = buildStoragePath(meta, paperId, PYQ_PENDING_BUCKET, file.mimeType);

  const { error: uploadError } = await supabase.storage
    .from(PYQ_PENDING_BUCKET)
    .upload(path, localFileBody(file, path));

  if (uploadError) {
    return { ok: false, reason: uploadError.message || 'Upload failed.' };
  }

  const row = buildPaperRow(meta, paperId, path, uploaderId);
  const { error: insertError } = await supabase.from('pyq_papers').insert(row);

  if (insertError) {
    // Do not leave the file behind when the queue row could not be written.
    await supabase.storage.from(PYQ_PENDING_BUCKET).remove([path]).catch(() => {});
    return { ok: false, reason: insertError.message || 'Could not queue the paper.' };
  }

  return { ok: true, paperId };
}

/**
 * Applies a moderation decision to a queued paper.
 * Approving moves the file from the pending bucket to the approved bucket;
 * rejecting removes it. The status is only changed after the file move
 * succeeded, so a failed move never publishes an unapproved paper.
 */
export async function applyModeration(
  paperId: string,
  action: ModerationAction,
  moderatorEmail?: string | null,
  note?: string | null,
): Promise<PyqModerationResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'Cloud sync is not configured yet.' };

  const { data, error } = await supabase
    .from('pyq_papers')
    .select('*')
    .eq('id', paperId)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'Paper not found.' };

  const row = data as Record<string, unknown>;
  const filePath = String(row.file_path ?? '');
  const nextStatus = statusAfterAction(action);

  if (action === 'approve') {
    const target = filePath.replace(new RegExp(`^${PYQ_PENDING_BUCKET}/`), `${PYQ_APPROVED_BUCKET}/`);
    const { data: blob, error: downloadError } = await supabase.storage
      .from(PYQ_PENDING_BUCKET)
      .download(filePath);
    if (downloadError || !blob) {
      return { ok: false, reason: downloadError?.message || 'Could not read the uploaded file.' };
    }
    const { error: uploadError } = await supabase.storage
      .from(PYQ_APPROVED_BUCKET)
      .upload(target, blob, { upsert: true });
    if (uploadError) {
      return { ok: false, reason: uploadError.message || 'Could not publish the paper.' };
    }
    await supabase.storage.from(PYQ_PENDING_BUCKET).remove([filePath]).catch(() => {});

    const { error: updateError } = await supabase
      .from('pyq_papers')
      .update({ status: nextStatus, file_path: target })
      .eq('id', paperId);
    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }
  } else if (action === 'reject') {
    await supabase.storage.from(PYQ_PENDING_BUCKET).remove([filePath]).catch(() => {});
    const { error: updateError } = await supabase
      .from('pyq_papers')
      .update({ status: nextStatus })
      .eq('id', paperId);
    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }
  } else {
    const { error: updateError } = await supabase
      .from('pyq_papers')
      .update({ status: nextStatus })
      .eq('id', paperId);
    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }
  }

  await recordModerationLog(paperId, action, moderatorEmail ?? null, note ?? null);

  return { ok: true };
}

/** Writes the moderation trail. */
export async function recordModerationLog(
  paperId: string,
  action: ModerationAction,
  moderatorEmail: string | null,
  note: string | null,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('pyq_moderation_log').insert({
      paper_id: paperId,
      action,
      moderator_email: moderatorEmail,
      note: note ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // The trail is best-effort; the decision itself is already stored.
  }
}

/** Reports a published paper for takedown. */
export async function reportPaper(
  paperId: string,
  reason: string,
  reporterId: string | null,
): Promise<PyqModerationResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'Cloud sync is not configured yet.' };
  if (!reason.trim()) return { ok: false, reason: 'Please choose a reason.' };
  try {
    const { error } = await supabase.from('reports').insert({
      pyq_id: paperId,
      reason: reason.trim(),
      reporter_id: reporterId,
      created_at: new Date().toISOString(),
    });
    if (error) return { ok: false, reason: error.message || 'Could not send the report.' };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Could not send the report.',
    };
  }
}

/** Increments the download counter of a paper. */
export async function recordDownload(paperId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.rpc('increment_paper_downloads', { paper_id: paperId });
  } catch {
    // The counter is cosmetic; a failure must not break the download.
  }
}
