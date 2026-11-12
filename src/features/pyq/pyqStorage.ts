/**
 * GBU One — PYQ upload & moderation policy (pure logic, unit tested).
 *
 * Per docs/ARCHITECTURE.md: uploads land in the Storage bucket
 * `pyq-pending/`, a moderator (the owner plus trusted students in
 * `public.moderators`) approves them, and approved files move to `pyq/`.
 * Nothing here touches the network, so the rules can be tested offline.
 */

export const PYQ_PENDING_BUCKET = 'pyq-pending';
export const PYQ_APPROVED_BUCKET = 'pyq';

/**
 * Virus/size/type checks (docs/ARCHITECTURE.md).
 *
 * The list mirrors the bucket's `allowed_mime_types` in supabase/schema.ts
 * EXACTLY (`application/pdf`, `image/jpeg`, `image/png`). DOC/DOCX used to
 * pass the app's own validation and was then refused by the bucket with a
 * raw error the student could not act on, so the two lists agree now.
 */
export const PYQ_MAX_BYTES = 20 * 1024 * 1024;
export const PYQ_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

/** The file extensions that are accepted, matching the bucket again. */
export const PYQ_ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'] as const;

export type PyqExamType = 'Mid Sem' | 'End Sem' | 'Back Paper';
export type PyqStatus = 'pending' | 'approved' | 'rejected';

export const PYQ_EXAM_TYPES: PyqExamType[] = ['Mid Sem', 'End Sem', 'Back Paper'];

export interface PyqUploadMeta {
  school: string;
  programmeCode: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  year: number;
  examType: PyqExamType;
}

export type PyqValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Slugifies one path segment so a storage path is always safe. */
export function slugifySegment(value: string): string {
  return (value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * True when the value is a real UUID.
 *
 * `pyq_papers.uploader_id` is a foreign key to `auth.users(id)`, so it may
 * only ever hold a genuine uuid. The device identity of a guest
 * (`GBU-XXXXXX`) is NOT a uuid and must never be written into that column.
 */
export function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/** Normalises the exam type the app and the database agree on. */
export function normaliseExamType(value: string): PyqExamType {
  const lower = (value || '').trim().toLowerCase();
  if (lower.startsWith('mid')) return 'Mid Sem';
  if (lower.startsWith('end')) return 'End Sem';
  if (lower.startsWith('back')) return 'Back Paper';
  return 'Mid Sem';
}

/** Validates the upload metadata (everything except the file bytes). */
export function validateUploadMeta(meta: Partial<PyqUploadMeta>): PyqValidationResult {
  if (!meta.subjectCode?.trim()) return { ok: false, reason: 'Subject code is required.' };
  if (!meta.subjectName?.trim()) return { ok: false, reason: 'Subject name is required.' };
  if (!meta.school?.trim()) return { ok: false, reason: 'School is required.' };
  if (!meta.programmeCode?.trim()) return { ok: false, reason: 'Programme is required.' };
  if (!meta.semester?.trim()) return { ok: false, reason: 'Semester is required.' };
  const year = Number(meta.year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { ok: false, reason: 'Year must be between 2000 and 2100.' };
  }
  return { ok: true };
}

/**
 * Resolves a clean, canonical MIME type from a given MIME type string and/or filename.
 * Strips charset and parameters (e.g. 'text/plain; charset=utf-8' -> 'text/plain').
 * Prioritizes the actual file extension when the system-reported MIME type is
 * generic or misleading (e.g. 'text/plain' or 'application/octet-stream' on Android).
 */
export function resolveCanonicalMime(mimeType?: string | null, fileName?: string | null): string {
  const cleanMime = (mimeType || '').split(';')[0].trim().toLowerCase();
  const ext = (fileName || '').split('.').pop()?.trim().toLowerCase() || '';

  // 1. If file extension clearly indicates a supported paper document, prefer it
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // 2. If extension is unknown or missing, check if clean MIME matches a supported format
  if (cleanMime === 'application/pdf') return 'application/pdf';
  if (cleanMime === 'image/png') return 'image/png';
  if (cleanMime === 'image/jpeg' || cleanMime === 'image/jpg') return 'image/jpeg';
  if (cleanMime === 'application/msword') return 'application/msword';
  if (cleanMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // 3. Fallback to clean MIME if present, otherwise default to PDF
  return cleanMime || 'application/pdf';
}

/**
 * Validates the file itself (type and size). Supported formats: PDF, JPG, PNG.
 *
 * A cloud document provider may report `size: null` for a document it cannot
 * measure. Such a file is NOT empty - it used to be rejected as "The selected
 * file is empty", which lost real papers - so an unknown size is allowed and
 * only a size that is known to be zero is refused.
 */
export function validateUploadFile(file: {
  mimeType?: string | null;
  size?: number | null;
  name?: string | null;
}): PyqValidationResult {
  const canonicalMime = resolveCanonicalMime(file.mimeType, file.name);
  const name = (file.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  const validByMime = (PYQ_ALLOWED_MIME_TYPES as readonly string[]).includes(canonicalMime);
  const validByExt = (PYQ_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);

  if (!file.mimeType && !name) return { ok: false, reason: 'File type could not be read.' };
  if (!validByMime && !validByExt) {
    return { ok: false, reason: 'Only PDF, JPG and PNG papers are accepted.' };
  }
  if (file.size === null || file.size === undefined) {
    // The size is unknown, not zero. Let the upload through; the bucket
    // enforces the 20 MB cap anyway.
    return { ok: true };
  }
  const size = Number(file.size);
  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, reason: 'The selected file could not be read.' };
  }
  if (size === 0) {
    return { ok: false, reason: 'The selected file is empty.' };
  }
  if (size > PYQ_MAX_BYTES) {
    return { ok: false, reason: 'Papers must be 20 MB or smaller.' };
  }
  return { ok: true };
}

/** File extension for a mime type or filename. */
export function extensionForMimeType(mimeType?: string | null, fileName?: string | null): string {
  const canonical = resolveCanonicalMime(mimeType, fileName);
  if (canonical === 'application/pdf') return 'pdf';
  if (canonical === 'image/png') return 'png';
  if (canonical === 'image/jpeg') return 'jpg';
  if (canonical === 'application/msword') return 'doc';
  if (canonical === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';

  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'doc' || ext === 'docx') {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  }

  return 'bin';
}

/**
 * Storage path for an upload.
 * The id keeps two uploads of the same paper apart.
 */
export function buildStoragePath(
  meta: PyqUploadMeta,
  paperId: string,
  bucket: string = PYQ_PENDING_BUCKET,
  mimeType?: string | null,
  fileName?: string | null,
): string {
  const school = slugifySegment(meta.school) || 'SOICT';
  const programme = slugifySegment(meta.programmeCode) || 'GEN';
  const semester = slugifySegment(meta.semester) || 'I';
  const subject = slugifySegment(meta.subjectCode) || 'UNKNOWN';
  const year = Number(meta.year) || new Date().getFullYear();
  const exam = slugifySegment(meta.examType) || 'MID-SEM';
  const id = slugifySegment(paperId) || 'paper';
  const extension = extensionForMimeType(mimeType, fileName);
  return `${bucket}/${school}/${programme}/${semester}/${subject}/${year}-${exam}-${id}.${extension}`;
}

/**
 * Who is handing the paper in.
 *
 * `authUserId` is the Supabase Auth user id and may only be a real uuid;
 * it is NULL for a guest (the insert policy allows that). `studentId` is the
 * device identity (`GBU-XXXXXX`) that names the contributor on the
 * leaderboard, and it is what `pyq_contributor_points` groups by.
 */
export interface PaperUploaderIdentity {
  /** The signed-in Supabase user id, or null for a guest. */
  authUserId: string | null;
  /** The device identity (GBU-XXXXXX). */
  studentId: string;
  /** The display name shown next to the paper. */
  name?: string;
  /** The avatar pack id shown next to the paper. */
  avatarId?: string;
}

/** The display details of a contributor (the legacy "uploader profile"). */
export interface PaperUploaderProfile {
  name?: string;
  uniqueStudentId?: string;
  avatarId?: string;
}

/**
 * What the callers may hand in as "the uploader".
 *
 * A plain string is the legacy shape (the auth user id). It is still
 * accepted so older call sites keep working, but it is validated: a string
 * that is not a uuid is NOT written into the `uploader_id` foreign key.
 */
export type PaperUploaderInput = PaperUploaderIdentity | string | null | undefined;

/**
 * Resolves the uploader into one unambiguous shape.
 */
export function resolveUploaderIdentity(
  uploader: PaperUploaderInput,
  profile?: PaperUploaderProfile,
): PaperUploaderIdentity {
  if (uploader && typeof uploader === 'object') {
    return {
      authUserId: isValidUuid(uploader.authUserId) ? uploader.authUserId!.trim().toLowerCase() : null,
      studentId: (uploader.studentId ?? '').trim(),
      name: uploader.name ?? profile?.name,
      avatarId: uploader.avatarId ?? profile?.avatarId,
    };
  }

  return {
    authUserId: isValidUuid(uploader) ? (uploader as string).trim().toLowerCase() : null,
    studentId: (profile?.uniqueStudentId ?? '').trim(),
    name: profile?.name,
    avatarId: profile?.avatarId,
  };
}

/**
 * The row inserted into `pyq_papers` for a new upload.
 *
 * Every column of the rewritten schema is filled in on purpose:
 * `uploader_id` is the real auth user id (null for a guest),
 * `uploader_student_id` is the device identity, `uploader_name` /
 * `uploader_avatar` keep the attribution, and `file_size_bytes` records the
 * size of the picked asset. There is no "retry without the extra columns"
 * fallback any more: the columns exist, and a row that drops them would
 * turn every contributor into an anonymous entry.
 */
export function buildPaperRow(
  meta: PyqUploadMeta,
  paperId: string,
  filePath: string,
  uploader: PaperUploaderInput,
  profile?: PaperUploaderProfile,
  fileSizeBytes?: number | null,
): Record<string, unknown> {
  const identity = resolveUploaderIdentity(uploader, profile);
  const size = Number(fileSizeBytes);

  return {
    id: paperId,
    school: meta.school.trim().toUpperCase(),
    programme_code: meta.programmeCode.trim().toUpperCase(),
    semester: meta.semester.trim().toUpperCase(),
    subject_code: meta.subjectCode.trim().toUpperCase(),
    subject_name: meta.subjectName.trim(),
    year: Number(meta.year),
    exam_type: meta.examType,
    file_path: filePath,
    // A guest has no auth user: the column must be NULL, never the device id.
    uploader_id: identity.authUserId,
    uploader_student_id: identity.studentId,
    uploader_name: (identity.name ?? '').trim(),
    uploader_avatar: (identity.avatarId ?? '').trim(),
    file_size_bytes: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
    status: 'pending' as PyqStatus,
    downloads: 0,
  };
}

/** Moderation decision the queue can apply to a pending paper. */
export type ModerationAction = 'approve' | 'reject';

/**
 * The decisions the queue offers.
 *
 * `request-changes` used to be in this list, but it mapped to `pending` -
 * a no-op that changed nothing and told the uploader nothing. It was
 * removed rather than left as a button that does nothing.
 */
export const MODERATION_ACTIONS: ModerationAction[] = ['approve', 'reject'];

/** Human-readable label for a moderation action. */
export function moderationActionLabel(action: ModerationAction): string {
  switch (action) {
    case 'approve':
      return 'Approve';
    case 'reject':
      return 'Reject';
    default:
      return 'Review';
  }
}

/** The status a pending paper ends up in after an action. */
export function statusAfterAction(action: ModerationAction): PyqStatus {
  switch (action) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    default:
      return 'pending';
  }
}

/** Public URL of an approved paper. */
export function publicPaperUrl(filePath: string, baseUrl: string): string {
  if (!baseUrl) return filePath;
  const clean = filePath.replace(/^pyq-pending\//, '').replace(/^pyq\//, '');
  return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${PYQ_APPROVED_BUCKET}/${clean}`;
}

/**
 * Turns a raw Supabase/PostgREST error into something a student can act on.
 *
 * The screen used to show the raw string ("new row violates row-level
 * security policy"), which means nothing to a first-year student.
 */
export function humaniseUploadError(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (!text) return 'The upload could not be completed. Please try again.';

  const lower = text.toLowerCase();
  if (lower.includes('row-level security') || lower.includes('row level security')) {
    return 'The library refused this upload. Please sign in and try again.';
  }
  if (lower.includes('duplicate key') || lower.includes('already exists')) {
    return 'This paper is already in the library.';
  }
  if (lower.includes('mime') || lower.includes('content type') || lower.includes('not allowed')) {
    return 'Only PDF, JPG and PNG papers are accepted.';
  }
  if (lower.includes('exceeds the maximum allowed size') || lower.includes('too large') || lower.includes('file size')) {
    return 'Papers must be 20 MB or smaller.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused')
  ) {
    return 'No connection to the library. The paper was saved on this phone.';
  }
  if (lower.includes('jwt') || lower.includes('token')) {
    return 'Your session expired. Please sign in again and retry.';
  }
  if (lower.includes('permission') || lower.includes('not authorized') || lower.includes('forbidden')) {
    return 'The library refused the upload. Please sign in and try again.';
  }
  if (lower.includes('storage') && lower.includes('not found')) {
    return 'The library could not be reached. Please try again.';
  }
  return 'The upload could not be completed. Please try again.';
}
