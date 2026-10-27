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

/** Virus/size/type checks (docs/ARCHITECTURE.md). */
export const PYQ_MAX_BYTES = 20 * 1024 * 1024;
export const PYQ_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

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

/** Validates the file itself (type and size). */
export function validateUploadFile(file: {
  mimeType?: string | null;
  size?: number | null;
}): PyqValidationResult {
  const mime = (file.mimeType || '').toLowerCase();
  if (!mime) return { ok: false, reason: 'File type could not be read.' };
  if (!(PYQ_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return { ok: false, reason: 'Only PDF, JPG and PNG papers are accepted.' };
  }
  const size = Number(file.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'The selected file is empty.' };
  }
  if (size > PYQ_MAX_BYTES) {
    return { ok: false, reason: 'Papers must be 20 MB or smaller.' };
  }
  return { ok: true };
}

/** File extension for a mime type. */
export function extensionForMimeType(mimeType?: string | null): string {
  switch ((mimeType || '').toLowerCase()) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    default:
      return 'bin';
  }
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
): string {
  const school = slugifySegment(meta.school) || 'SOICT';
  const programme = slugifySegment(meta.programmeCode) || 'GEN';
  const semester = slugifySegment(meta.semester) || 'I';
  const subject = slugifySegment(meta.subjectCode) || 'UNKNOWN';
  const year = Number(meta.year) || new Date().getFullYear();
  const exam = slugifySegment(meta.examType) || 'MID-SEM';
  const id = slugifySegment(paperId) || 'paper';
  const extension = extensionForMimeType(mimeType);
  return `${bucket}/${school}/${programme}/${semester}/${subject}/${year}-${exam}-${id}.${extension}`;
}

/** The row inserted into `pyq_papers` for a new upload. */
export function buildPaperRow(
  meta: PyqUploadMeta,
  paperId: string,
  filePath: string,
  uploaderId: string | null,
): Record<string, unknown> {
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
    uploader_id: uploaderId,
    status: 'pending' as PyqStatus,
    downloads: 0,
  };
}

/** Moderation decision the queue can apply to a pending paper. */
export type ModerationAction = 'approve' | 'reject' | 'request-changes';

export const MODERATION_ACTIONS: ModerationAction[] = ['approve', 'reject', 'request-changes'];

/** Human-readable label for a moderation action. */
export function moderationActionLabel(action: ModerationAction): string {
  switch (action) {
    case 'approve':
      return 'Approve';
    case 'reject':
      return 'Reject';
    case 'request-changes':
      return 'Request changes';
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
