import { submitStudentReport } from '../reports/reportsService';
import { Platform } from 'react-native';
/**
 * GBU One — PYQ repository (Supabase Storage + Postgres).
 *
 * Upload flow:   app -> Storage `pyq-pending/` -> `pyq_papers` (pending)
 * Moderation:    a moderator moves the file to `pyq/` and sets the status
 * Browse:        only `status = 'approved'` papers are shown to students
 *
 * EVERY call runs on the signed-in session client (`supabase` from
 * `src/lib/supabase`). There is no service-role key in the app: the new
 * row level security lets a signed-in moderator read the queue, change a
 * status and move the file, so a secret in the APK was never needed.
 *
 * Every call fails soft: the app must keep working when Supabase is not
 * configured or the network is down.
 */
import {
  PYQ_APPROVED_BUCKET,
  PYQ_PENDING_BUCKET,
  buildPaperRow,
  buildStoragePath,
  humaniseUploadError,
  isValidUuid,
  publicPaperUrl,
  resolveCanonicalMime,
  statusAfterAction,
  validateUploadFile,
  validateUploadMeta,
  type ModerationAction,
  type PaperUploaderInput,
  type PaperUploaderProfile,
  type PyqUploadMeta,
} from './pyqStorage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * The legacy name of the contributor profile. Kept so older call sites
 * keep compiling; the identity is now a single object that keeps the auth
 * user id and the device identity apart.
 */
export type UploaderProfile = PaperUploaderProfile;

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
  /** The device identity (GBU-XXXXXX) that names the contributor. */
  uploaderStudentId?: string;
  /** The size of the uploaded file, in bytes. */
  fileSizeBytes?: number;
}

export type PyqUploadResult =
  | { ok: true; paperId: string }
  | { ok: false; reason: string };

export type PyqModerationResult =
  | { ok: true; warning?: string }
  | { ok: false; reason: string };

/** One row of the server-derived contributor points view. */
export interface ContributorPointsRow {
  uploader_student_id: string;
  approved_uploads: number;
  total_downloads: number;
  points: number;
}

/** The uploader details of an approved paper, used to label the leaderboard. */
export interface ContributorProfileRow {
  studentId: string;
  name: string;
  avatarId: string;
  school: string;
}

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
  const studentId = String(row.uploader_student_id ?? '');
  const fileSize = Number(row.file_size_bytes ?? 0);

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
    uploaderStudentId: studentId || undefined,
    fileSizeBytes: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : undefined,
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

/**
 * Returns the id when it really is a uuid, and NULL otherwise.
 *
 * `pyq_papers.uploader_id` is a foreign key to `auth.users(id)`. The old
 * version invented a uuid by hashing whatever string it was given, which
 * produced a valid-looking but non-existent user id and made every guest
 * upload fail on the foreign key. A wrong id is now simply no id.
 */
export function ensureValidUuid(id: string | null | undefined): string | null {
  if (!isValidUuid(id)) return null;
  return id!.trim().toLowerCase();
}

/** The signed-in Supabase user, or null when there is no live session. */
export interface SessionIdentity {
  id: string;
  email: string | null;
  accessToken: string | null;
}

/**
 * Reads the verified session.
 *
 * The moderation queue used to take the email from the student auth store,
 * which in the admin APK is the guest/empty email, so the queue was
 * permanently unreachable. The session is the only trustworthy source of
 * who is acting.
 */
export async function currentSessionIdentity(): Promise<SessionIdentity | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const auth = supabase.auth as unknown as {
      getSession?: () => Promise<{
        data?: {
          session?: {
            access_token?: string;
            user?: { id?: string; email?: string | null };
          } | null;
        };
      }>;
    };
    if (!auth || typeof auth.getSession !== 'function') return null;
    const { data } = await auth.getSession();
    const session = data?.session;
    const user = session?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      accessToken: session?.access_token ?? null,
    };
  } catch {
    return null;
  }
}

/** The email of the signed-in moderator, or null when nobody is signed in. */
export async function currentModeratorEmail(): Promise<string | null> {
  const identity = await currentSessionIdentity();
  return identity?.email ?? null;
}

/** Resolves a signed URL for a moderator to inspect a pending paper. */
export async function getPendingPaperUrl(filePath: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const clean = filePath.replace(/^pyq-pending\//, '');
    const pathsToTry = Array.from(new Set([filePath, clean, `pyq-pending/${clean}`]));

    for (const p of pathsToTry) {
      const { data, error } = await supabase.storage.from(PYQ_PENDING_BUCKET).createSignedUrl(p, 3600);
      if (!error && data?.signedUrl) return data.signedUrl;
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

/** How many rows one page of a paginated list holds. */
const PAGE_SIZE = 200;

/**
 * Lists the papers a student may browse (approved only).
 *
 * The list is paginated: the old `limit(300)` silently dropped every older
 * paper, and every error was swallowed, so a dead backend looked exactly
 * like an empty library. A failure is now raised so the screen can say so.
 */
export async function listApprovedPapers(max = 1000): Promise<PyqPaperRecord[]> {
  if (!isSupabaseConfigured) return [];
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (rows.length < max) {
    const size = Math.min(PAGE_SIZE, max - rows.length);
    const { data, error } = await supabase
      .from('pyq_papers')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, from + size - 1);

    if (error) {
      throw new Error(error.message || 'Could not load the paper library.');
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < size) break;
    from += size;
  }

  return rows.map((row) => rowToPaper(row, storageBaseUrl()));
}

/**
 * Lists the papers waiting for a moderator.
 *
 * Paginated for the same reason: the queue used to be capped at 100 rows,
 * so "Approve all N" only ever approved the first hundred and the count on
 * screen was wrong.
 */
export async function listPendingPapers(max = 500): Promise<PyqPaperRecord[]> {
  if (!isSupabaseConfigured) return [];
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (rows.length < max) {
    const size = Math.min(PAGE_SIZE, max - rows.length);
    const { data, error } = await supabase
      .from('pyq_papers')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(from, from + size - 1);

    if (error) {
      throw new Error(error.message || 'Could not load the moderation queue.');
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < size) break;
    from += size;
  }

  return rows.map((row) => rowToPaper(row, storageBaseUrl()));
}

/** How the moderation screen should treat the signed-in account. */
export type ModeratorState = 'moderator' | 'not-moderator' | 'backend-refused' | 'signed-out';

export interface ModeratorStatus {
  state: ModeratorState;
  /** What the screen should tell the owner to do next. Empty for moderators. */
  reason: string;
}

/**
 * Escapes the LIKE wildcards in an email so `ilike` matches it literally.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Whether the signed-in account may moderate, and - when it may not - why.
 *
 * The email comes from the verified session unless one is passed in. The
 * comparison against the allowlist is case-INSENSITIVE, because the server
 * helper `public.is_moderator()` compares `lower(m.email)` with the JWT
 * email: an allowlist row written as `Admin@GBU.ac.in` matches on the
 * server and must match here too.
 *
 * This used to be a plain boolean that collapsed every failure into `false`,
 * so a project whose row level security has no policy on `moderators` looked
 * exactly like "this account is not a moderator". The reason is carried out
 * here so the screen can point at the fix (docs/ADMIN_MODERATION.md) instead
 * of leaving the queue a dead end.
 */
export async function moderatorStatus(email?: string | null): Promise<ModeratorStatus> {
  const sessionEmail = email ?? (await currentModeratorEmail());
  const cleanEmail = (sessionEmail ?? '').trim();
  if (!cleanEmail) {
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
      .ilike('email', escapeLike(cleanEmail))
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
          `No moderator row is readable for ${cleanEmail}. Either the address is not on the list, ` +
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
 * Approves every pending paper in one pass. Each paper still goes through
 * applyModeration(), so a failure on one paper never blocks or publishes
 * another, and the moderation log keeps one entry per decision.
 */
export async function approveAllPending(): Promise<{ approved: number; failed: number }> {
  const pending = await listPendingPapers();
  let approved = 0;
  let failed = 0;
  for (const paper of pending) {
    const result = await applyModeration(paper.id, 'approve');
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
 * Multi-strategy file uploader for Supabase Storage that works reliably
 * on React Native Android (streaming or multipart) and Web/Node (Supabase JS).
 *
 * `accessToken` is the signed-in user's token when there is one, so the
 * object is owned by that student and can be deleted again by them. A guest
 * falls back to the anon key, which the bucket's insert policy allows.
 */
export async function uploadFileToSupabaseStorage(
  bucket: string,
  path: string,
  file: { uri: string; name?: string | null; mimeType?: string | null },
  canonicalMime: string,
  accessToken?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  const baseUrl = storageBaseUrl();
  const apiKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'placeholder-anon-key';
  const bearer = accessToken || apiKey;

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
            Authorization: `Bearer ${bearer}`,
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
      // Supabase Storage expects the part to be named `file`; an empty field
      // name was rejected by the endpoint.
      formData.append('file', {
        uri: file.uri,
        name: file.name || path.split('/').pop() || 'paper.pdf',
        type: canonicalMime,
      } as unknown as Blob);

      const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${bearer}`,
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

/**
 * Uploads a paper into the pending bucket and queues it for moderation.
 * The file is removed again if the row cannot be written, so the bucket never
 * keeps an orphaned file.
 *
 * The uploader identity is passed in whole: the auth user id (null for a
 * guest) and the device identity are different things and must not be
 * confused with one another.
 */
export async function uploadPendingPaper(
  file: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null },
  meta: PyqUploadMeta,
  uploader: PaperUploaderInput,
  profile?: PaperUploaderProfile,
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
  const session = await currentSessionIdentity();

  // 1. Native stream upload on Android/iOS (or Supabase JS on Node/Web)
  let uploadError: { message?: string } | null = null;
  if ((Platform.OS === 'android' || Platform.OS === 'ios') && typeof process.env.JEST_WORKER_ID === 'undefined') {
    const nativeRes = await uploadFileToSupabaseStorage(
      PYQ_PENDING_BUCKET,
      path,
      file,
      canonicalMime,
      session?.accessToken ?? null,
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
    return { ok: false, reason: humaniseUploadError(uploadError.message) };
  }

  // 2. The queue row. Every column of the schema is written: there is no
  //    fallback row that drops the attribution columns, because that is how
  //    every contributor ended up as an anonymous "GBU Contributor".
  const row = buildPaperRow(meta, paperId, path, uploader, profile, file.size ?? 0);

  const { error: insertError } = await supabase.from('pyq_papers').insert(row);

  if (insertError) {
    // Do not leave the file behind when the queue row could not be written.
    await supabase.storage.from(PYQ_PENDING_BUCKET).remove([path]).catch(() => {});
    return { ok: false, reason: humaniseUploadError(insertError.message) };
  }

  return { ok: true, paperId };
}

/** Removes the bucket prefix from a stored file path. */
function stripBucketPrefix(filePath: string): string {
  return filePath
    .replace(new RegExp(`^${PYQ_PENDING_BUCKET}/`), '')
    .replace(new RegExp(`^${PYQ_APPROVED_BUCKET}/`), '');
}

/** The content fingerprint of a stored object. */
interface ObjectFingerprint {
  etag: string;
  size: number | null;
}

/**
 * Reads the fingerprint (etag + size) of a stored object.
 *
 * The etag of a Supabase Storage object is the MD5 of its bytes, so two
 * objects with the same etag and the same size hold the same bytes.
 */
async function objectFingerprint(bucket: string, key: string): Promise<ObjectFingerprint | null> {
  const slash = key.lastIndexOf('/');
  const folder = slash >= 0 ? key.slice(0, slash) : '';
  const name = slash >= 0 ? key.slice(slash + 1) : key;
  try {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (error || !Array.isArray(data)) return null;
    const entry = data.find((item) => item?.name === name);
    if (!entry) return null;
    const meta = (entry as { metadata?: Record<string, unknown> }).metadata ?? {};
    const etag = String(meta.eTag ?? meta.etag ?? '').replace(/^"|"$/g, '');
    const rawSize = meta.size ?? meta.contentLength;
    const size = Number(rawSize);
    return { etag, size: Number.isFinite(size) ? size : null };
  } catch {
    return null;
  }
}

/**
 * Publishes a pending paper by COPYING the object inside Supabase Storage.
 *
 * WHY A COPY AND NOT A DOWNLOAD + RE-UPLOAD:
 * `@supabase/storage-js` implements `download()` as `data: await (await
 * downloadFn()).blob()`, and on React Native `whatwg-fetch` builds the body
 * of a response from `xhr.responseText` - a UTF-8 STRING. `Response.blob()`
 * then re-encodes those bytes, so a binary PDF or JPG comes out corrupted.
 * The old approve path downloaded the pending object into a JS Blob and
 * re-uploaded that Blob, which published a broken file into the PUBLIC
 * `pyq` bucket.
 *
 * The copy endpoint is a SERVER side file copy: the bytes never enter the
 * app, never become a string, and stay byte for byte identical. The copy
 * runs with the moderator's own session, which the `pyq moderator move`
 * policy allows (read from `pyq-pending`, write to `pyq`).
 */
export async function publishPendingObject(
  sourceFilePath: string,
  destinationFilePath: string,
): Promise<{ ok: true; warning?: string } | { ok: false; reason: string }> {
  const destinationKey = stripBucketPrefix(destinationFilePath);
  const sourceCandidates = Array.from(
    new Set([sourceFilePath, stripBucketPrefix(sourceFilePath)]),
  ).filter(Boolean);

  let lastError = 'Could not publish the paper.';
  for (const sourceKey of sourceCandidates) {
    const { error } = await supabase.storage
      .from(PYQ_PENDING_BUCKET)
      .copy(sourceKey, destinationKey, { destinationBucket: PYQ_APPROVED_BUCKET });

    if (error) {
      lastError = error.message || 'Could not publish the paper.';
      continue;
    }

    // The copy is a server side copy, so the bytes are identical by
    // construction. The fingerprint check proves it rather than assuming it.
    const [sourcePrint, destinationPrint] = await Promise.all([
      objectFingerprint(PYQ_PENDING_BUCKET, sourceKey),
      objectFingerprint(PYQ_APPROVED_BUCKET, destinationKey),
    ]);

    if (sourcePrint && destinationPrint) {
      const sameEtag =
        sourcePrint.etag.length > 0 && sourcePrint.etag === destinationPrint.etag;
      const sameSize =
        sourcePrint.size === null ||
        destinationPrint.size === null ||
        sourcePrint.size === destinationPrint.size;
      if (!sameEtag || !sameSize) {
        // The copy is not the upload: it is taken out of the public bucket
        // again before the paper is rolled back to pending.
        await supabase.storage
          .from(PYQ_APPROVED_BUCKET)
          .remove([destinationKey])
          .catch(() => {});
        return {
          ok: false,
          reason: 'The published copy did not match the uploaded file, so it was not released.',
        };
      }
    }

    return { ok: true };
  }

  return { ok: false, reason: `Could not publish the paper: ${lastError}` };
}

/**
 * Applies a moderation decision to a queued paper.
 *
 * Approving copies the file from the pending bucket to the approved bucket
 * and sets the status. The ORDER matters: the status is written FIRST and
 * the file is moved second, so a failed move can be rolled back. The old
 * order deleted the pending file before the status write, so a failed
 * update left a pending row whose source file was gone - a paper that could
 * never be approved afterwards.
 */
export async function applyModeration(
  paperId: string,
  action: ModerationAction,
  note?: string | null,
): Promise<PyqModerationResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'Cloud sync is not configured yet.' };

  const session = await currentSessionIdentity();
  if (!session) {
    return {
      ok: false,
      reason: 'Sign in with the moderator account to review uploads.',
    };
  }
  const moderatorEmail = session.email ?? null;

  const { data, error } = await supabase
    .from('pyq_papers')
    .select('*')
    .eq('id', paperId)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: 'Paper not found.' };

  const row = data as Record<string, unknown>;
  const filePath = String(row.file_path ?? '');
  const originalStatus = String(row.status ?? 'pending');
  const nextStatus = statusAfterAction(action);
  const cleanApprovedPath = stripBucketPrefix(filePath);
  const targetStoredPath = `${PYQ_APPROVED_BUCKET}/${cleanApprovedPath}`;
  const warnings: string[] = [];

  if (action === 'approve') {
    // 1. The status is written first.
    const { error: updateError } = await supabase
      .from('pyq_papers')
      .update({
        status: nextStatus,
        file_path: targetStoredPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paperId);

    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }

    // 2. Then the bytes are moved, without passing through a JS string.
    const published = await publishPendingObject(filePath, cleanApprovedPath);
    if (!published.ok) {
      // Roll the status back: the paper stays pending and can be approved
      // again once the storage problem is fixed.
      await supabase
        .from('pyq_papers')
        .update({ status: originalStatus, file_path: filePath })
        .eq('id', paperId);
      return { ok: false, reason: published.reason };
    }

    // 3. The pending copy is dropped. A leftover file is harmless; a failed
    //    publish is not, so this step never fails the decision.
    const { error: removeError } = await supabase.storage
      .from(PYQ_PENDING_BUCKET)
      .remove(Array.from(new Set([filePath, cleanApprovedPath])));
    if (removeError) {
      warnings.push(`The pending copy could not be cleaned up (${removeError.message}).`);
    }
  } else {
    const { error: updateError } = await supabase
      .from('pyq_papers')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', paperId);

    if (updateError) {
      return { ok: false, reason: updateError.message || 'Could not update the paper.' };
    }

    const { error: removeError } = await supabase.storage
      .from(PYQ_PENDING_BUCKET)
      .remove(Array.from(new Set([filePath, stripBucketPrefix(filePath)])));
    if (removeError) {
      warnings.push(`The uploaded file could not be removed (${removeError.message}).`);
    }
  }

  const log = await recordModerationLog(paperId, action, moderatorEmail, note ?? null);
  if (!log.ok) {
    warnings.push(`The decision was saved but the moderation log was not written (${log.reason}).`);
  }

  return { ok: true, warning: warnings.length ? warnings.join(' ') : undefined };
}

/**
 * Writes the moderation trail.
 *
 * The trail is written with the same session client as the decision, so it
 * carries the ACTUAL moderator (the signed-in email) and cannot fail
 * silently: a failure is reported to the caller.
 */
export async function recordModerationLog(
  paperId: string,
  action: ModerationAction,
  moderatorEmail: string | null,
  note: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isSupabaseConfigured) return { ok: true };
  try {
    const { error } = await supabase.from('pyq_moderation_log').insert({
      paper_id: paperId,
      action,
      moderator_email: moderatorEmail,
      note: note ?? null,
      created_at: new Date().toISOString(),
    });
    if (error) {
      return { ok: false, reason: error.message || 'The moderation log was refused.' };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'The moderation log could not be written.',
    };
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

/**
 * The server-derived contributor points.
 *
 * The points are computed by the `pyq_contributor_points` view in the
 * database, so two devices can never disagree about the score. The app
 * never tallies points itself.
 */
export async function fetchContributorPoints(): Promise<ContributorPointsRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('pyq_contributor_points').select('*');
  if (error) {
    throw new Error(error.message || 'Could not load the contributor standings.');
  }
  return (data ?? []) as ContributorPointsRow[];
}

/**
 * The names behind the contributor points.
 *
 * The points view only carries the device identity, so the display name,
 * the avatar and the school are read from the approved papers themselves.
 */
export async function fetchContributorProfiles(): Promise<ContributorProfileRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('pyq_papers')
    .select('uploader_student_id,uploader_name,uploader_avatar,school')
    .eq('status', 'approved')
    .limit(2000);
  if (error) {
    throw new Error(error.message || 'Could not load the contributor list.');
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const seen = new Map<string, ContributorProfileRow>();
  for (const row of rows) {
    const studentId = String(row.uploader_student_id ?? '');
    if (!studentId || seen.has(studentId)) continue;
    seen.set(studentId, {
      studentId,
      name: String(row.uploader_name ?? ''),
      avatarId: String(row.uploader_avatar ?? ''),
      school: String(row.school ?? ''),
    });
  }
  return Array.from(seen.values());
}
