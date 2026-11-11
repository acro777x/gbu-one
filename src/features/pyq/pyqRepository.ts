import { submitStudentReport } from '../reports/reportsService';
import { Platform } from 'react-native';
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
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  PYQ_APPROVED_BUCKET,
  PYQ_PENDING_BUCKET,
  buildPaperRow,
  buildStoragePath,
  publicPaperUrl,
  resolveCanonicalMime,
  statusAfterAction,
  validateUploadFile,
  validateUploadMeta,
  type ModerationAction,
  type PyqUploadMeta,
} from './pyqStorage';
import { awardUploadPoints } from './pyqLeaderboard';

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
  uploader_name?: string;
  uploader_id?: string;
  uploader_avatar?: string;
}

export interface UploaderProfile {
  name?: string;
  uniqueStudentId?: string;
  avatarId?: string;
}

export type PyqUploadResult =
  | { ok: true; paperId: string }
  | { ok: false; reason: string };

export type PyqModerationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function rowToPaper(row: Record<string, unknown>, storageBaseUrl: string): PyqPaperRecord {
  const filePath = String(row.file_path ?? '');
  const status = String(row.status ?? 'pending') as PyqPaperRecord['status'];
  const approved = status === 'approved';
  const uploaderId = (row.uploader_id as string | null) ?? (row.uploaderId as string | null) ?? null;
  const uploaderName =
    (row.uploader_name as string | undefined) ??
    (row.uploaderName as string | undefined) ??
    undefined;
  const uploaderAvatar =
    (row.uploader_avatar as string | undefined) ??
    (row.uploaderAvatar as string | undefined) ??
    undefined;

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
    uploaderId,
    uploader_name: uploaderName,
    uploader_id: uploaderId ?? undefined,
    uploader_avatar: uploaderAvatar,
  };
}

/** The Supabase project URL, used to build public download links. */
function storageBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  if (!url || url.includes('placeholder')) {
    return 'https://pjnxllnncsoroevgfbmt.supabase.co';
  }
  return url.replace(/\/$/, '');
}

export function ensureValidUuid(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, '0');
  const fullHex = (hex + hex + hex + hex).slice(0, 32);
  return `${fullHex.slice(0, 8)}-${fullHex.slice(8, 12)}-4${fullHex.slice(13, 16)}-8${fullHex.slice(17, 20)}-${fullHex.slice(20, 32)}`;
}

export function getStorageClient() {
  const serviceKey =
    undefined;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pjnxllnncsoroevgfbmt.supabase.co';
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  if (url && anonKey) {
    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabase;
}

function getAdminClient() {
  const serviceKey =
    undefined;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pjnxllnncsoroevgfbmt.supabase.co';
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabase;
}

/** Resolves a signed URL for a moderator to inspect a pending paper. */
export async function getPendingPaperUrl(filePath: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const clean = filePath.replace(/^pyq-pending\//, '');
    const pathsToTry = [filePath, clean, `pyq-pending/${clean}`];
    const client = getAdminClient();

    for (const p of pathsToTry) {
      const { data, error } = await client.storage.from(PYQ_PENDING_BUCKET).createSignedUrl(p, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
    }

    if (client !== supabase) {
      for (const p of pathsToTry) {
        const { data, error } = await supabase.storage.from(PYQ_PENDING_BUCKET).createSignedUrl(p, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
      }
    }

    return null;
  } catch {
    return null;
  }
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
  const mime = resolveCanonicalMime(file.mimeType, file.name ?? path);
  return {
    uri: file.uri,
    name: file.name ?? path.split('/').pop() ?? 'paper.pdf',
    type: mime,
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
    const res = await supabase
      .from('pyq_papers')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);
    let data = res.data;
    const error = res.error;

    if ((!data || data.length === 0) && isSupabaseConfigured) {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pjnxllnncsoroevgfbmt.supabase.co';
      const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      if (url && key) {
        const cleanClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const cleanRes = await cleanClient
          .from('pyq_papers')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(limit);
        if (cleanRes.data && cleanRes.data.length > 0) {
          data = cleanRes.data;
        }
      }
    }

    if (!data) return [];
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

export function generatePaperUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Uploads a paper into the pending bucket and queues it for moderation.
 * The file is removed again if the row cannot be written, so the bucket never
 * keeps an orphaned file.
 */
/**
 * Multi-strategy file uploader for Supabase Storage that works reliably
 * on React Native Android (streaming or multipart) and Web/Node (Supabase JS).
 */
export async function uploadFileToSupabaseStorage(
  bucket: string,
  path: string,
  file: { uri: string; name?: string | null; mimeType?: string | null },
  canonicalMime: string,
): Promise<{ ok: boolean; reason?: string }> {
  const baseUrl = storageBaseUrl();
  const apiKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'placeholder-anon-key';

  if ((Platform.OS === 'android' || Platform.OS === 'ios') && typeof process.env.JEST_WORKER_ID === 'undefined') {
    // Strategy 1: Native Stream via ReactNativeBlobUtil (Android/iOS local filesystem)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ReactNativeBlobUtil = require('react-native-blob-util').default;
      if (ReactNativeBlobUtil?.wrap && ReactNativeBlobUtil?.fetch && file.uri) {
        const cleanPath = file.uri.replace(/^file:\/\//, '');
        const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
        const res = await ReactNativeBlobUtil.fetch(
          'POST',
          uploadUrl,
          {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': canonicalMime,
            'x-upsert': 'true',
          },
          ReactNativeBlobUtil.wrap(cleanPath),
        );
        const info = res.info();
        if (info && info.status >= 200 && info.status < 300) {
          return { ok: true };
        }
        const respText = await res.text().catch(() => '');
        let errMsg = `Upload failed with HTTP ${info?.status}`;
        try {
          const parsed = JSON.parse(respText);
          if (parsed.message || parsed.error) errMsg = parsed.message || parsed.error;
        } catch {
          // Ignore JSON parse errors and retain default errMsg
        }
        return { ok: false, reason: errMsg };
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 2: React Native FormData multipart upload
    try {
      const formData = new FormData();
      formData.append('', {
        uri: file.uri,
        name: file.name || path.split('/').pop() || 'paper.pdf',
        type: canonicalMime,
      } as unknown as Blob);

      const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          'x-upsert': 'true',
        },
        body: formData,
      });

      if (res.ok) {
        return { ok: true };
      }
      const respText = await res.text().catch(() => '');
      let errMsg = `Upload failed with HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(respText);
        if (parsed.message || parsed.error) errMsg = parsed.message || parsed.error;
      } catch {
        // Ignore JSON parse errors and retain default errMsg
      }
      return { ok: false, reason: errMsg };
    } catch {
      // Continue to standard client
    }
  }

  // Strategy 3: Supabase JS storage client (Node / Jest / Web)
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, localFileBody({ ...file, mimeType: canonicalMime }, path), {
      contentType: canonicalMime,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, reason: uploadError.message || 'Upload failed.' };
  }
  return { ok: true };
}

export async function uploadPendingPaper(
  file: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null },
  meta: PyqUploadMeta,
  uploaderId: string | null,
  uploaderProfile?: UploaderProfile,
): Promise<PyqUploadResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'Cloud sync is not configured yet.' };
  }

  const metaCheck = validateUploadMeta(meta);
  if (!metaCheck.ok) return { ok: false, reason: metaCheck.reason };

  const fileCheck = validateUploadFile(file);
  if (!fileCheck.ok) return { ok: false, reason: fileCheck.reason };

  const canonicalMime = resolveCanonicalMime(file.mimeType, file.name);
  const paperId = generatePaperUuid();
  const path = buildStoragePath(meta, paperId, PYQ_PENDING_BUCKET, canonicalMime, file.name);

  // 1. Native stream upload on Android/iOS (or Supabase JS on Node/Web)
  let uploadError: { message?: string } | null = null;
  if ((Platform.OS === 'android' || Platform.OS === 'ios') && typeof process.env.JEST_WORKER_ID === 'undefined') {
    const nativeRes = await uploadFileToSupabaseStorage(
      PYQ_PENDING_BUCKET,
      path,
      file,
      canonicalMime,
    );
    if (!nativeRes.ok) {
      uploadError = { message: nativeRes.reason || 'Upload failed.' };
    }
  } else {
    try {
      const res = await supabase.storage
        .from(PYQ_PENDING_BUCKET)
        .upload(path, localFileBody({ ...file, mimeType: canonicalMime }, path), {
          contentType: canonicalMime,
          upsert: true,
        });
      uploadError = res.error;
    } catch (err) {
      uploadError = { message: err instanceof Error ? err.message : 'Upload failed.' };
    }
  }

  if (uploadError) {
    return { ok: false, reason: uploadError.message || 'Upload failed.' };
  }

  const row = buildPaperRow(meta, paperId, path, uploaderId, uploaderProfile);
  if (file.size) {
    row.file_size_bytes = file.size;
  }
  if (uploaderProfile?.name) {
    row.uploader_name = uploaderProfile.name;
  }

  let { error: insertError } = await supabase.from('pyq_papers').insert(row);

  if (insertError) {
    // If Postgres table does not have uploader_name or custom columns in schema cache,
    // retry with clean base row
    const baseRow = {
      id: paperId,
      school: meta.school.trim().toUpperCase(),
      programme_code: meta.programmeCode.trim().toUpperCase(),
      semester: meta.semester.trim().toUpperCase(),
      subject_code: meta.subjectCode.trim().toUpperCase(),
      subject_name: meta.subjectName.trim(),
      year: Number(meta.year),
      exam_type: meta.examType,
      file_path: path,
      uploader_id: uploaderId,
      status: 'pending',
      downloads: 0,
    };
    const retry = await supabase.from('pyq_papers').insert(baseRow);
    if (!retry.error) {
      insertError = null;
    } else {
      // If Postgres rejects string ID for uuid column (22P02), retry with null
      const retryNull = await supabase.from('pyq_papers').insert({
        ...baseRow,
        uploader_id: null,
      });
      if (!retryNull.error) {
        insertError = null;
      }
    }
  }

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

  const client = getAdminClient();

  const { data, error } = await client
    .from('pyq_papers')
    .select('*')
    .eq('id', paperId)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'Paper not found.' };

  const row = data as Record<string, unknown>;
  const filePath = String(row.file_path ?? '');
  const nextStatus = statusAfterAction(action);
  const cleanPendingPath = filePath.replace(new RegExp(`^${PYQ_PENDING_BUCKET}/`), '');
  const cleanApprovedPath = filePath.replace(new RegExp(`^(${PYQ_PENDING_BUCKET}|${PYQ_APPROVED_BUCKET})/`), '');
  const targetStoredPath = `${PYQ_APPROVED_BUCKET}/${cleanApprovedPath}`;
  const pendingPathsToTry = [filePath, cleanPendingPath, `${PYQ_PENDING_BUCKET}/${cleanPendingPath}`];

  if (action === 'approve') {
    let blob: Blob | null = null;
    let downloadError: { message?: string } | null = null;

    for (const p of pendingPathsToTry) {
      const res = await client.storage.from(PYQ_PENDING_BUCKET).download(p);
      if (!res.error && res.data) {
        blob = res.data;
        downloadError = null;
        break;
      } else if (res.error) {
        downloadError = res.error;
      }
    }

    if (!blob && client !== supabase) {
      for (const p of pendingPathsToTry) {
        const res = await supabase.storage.from(PYQ_PENDING_BUCKET).download(p);
        if (!res.error && res.data) {
          blob = res.data;
          downloadError = null;
          break;
        }
      }
    }

    if (!blob) {
      return { ok: false, reason: downloadError?.message || 'Could not read the uploaded file.' };
    }

    const canonicalMime = resolveCanonicalMime(blob.type, cleanApprovedPath);
    const { error: uploadError } = await client.storage
      .from(PYQ_APPROVED_BUCKET)
      .upload(cleanApprovedPath, blob, {
        contentType: canonicalMime,
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, reason: uploadError.message || 'Could not publish the paper.' };
    }

    await client.storage.from(PYQ_PENDING_BUCKET).remove(pendingPathsToTry).catch(() => {});

    const { error: updateError } = await client
      .from('pyq_papers')
      .update({ status: nextStatus, file_path: targetStoredPath })
      .eq('id', paperId);

    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }

    if (row.uploader_id) {
      void awardUploadPoints({
        id: String(row.uploader_id),
        name: String(row.uploader_name || 'GBU Contributor'),
        avatarId: row.uploader_avatar ? String(row.uploader_avatar) : undefined,
        uniqueStudentId: String(row.uploader_id),
        school: row.school ? String(row.school) : undefined,
      }).catch(() => {});
    }
  } else if (action === 'reject') {
    await client.storage.from(PYQ_PENDING_BUCKET).remove(pendingPathsToTry).catch(() => {});
    const { error: updateError } = await client
      .from('pyq_papers')
      .update({ status: nextStatus })
      .eq('id', paperId);

    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }
  } else {
    const { error: updateError } = await client
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
  options?: {
    customNote?: string;
    studentName?: string;
    subjectCode?: string;
    subjectName?: string;
  },
): Promise<PyqModerationResult> {
  if (!reason.trim()) return { ok: false, reason: 'Please choose a reason.' };

  // Always record into student & admin reports system
  await submitStudentReport({
    type: 'pyq',
    category: 'PYQ Paper',
    paperId,
    subjectCode: options?.subjectCode,
    subjectName: options?.subjectName,
    reason: reason.trim(),
    customNote: options?.customNote?.trim(),
    reporterName: options?.studentName || 'GBU Student',
    reporterStudentId: reporterId || 'GBU-SCHOLAR',
  }).catch(() => {});

  return { ok: true };
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
