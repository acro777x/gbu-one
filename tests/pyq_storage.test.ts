/**
 * Unit tests for the PYQ upload policy and the moderation queue.
 * Per docs/ROADMAP.md Phase 4 and docs/ARCHITECTURE.md.
 */
import {
  MODERATION_ACTIONS,
  PYQ_ALLOWED_MIME_TYPES,
  PYQ_APPROVED_BUCKET,
  PYQ_MAX_BYTES,
  PYQ_PENDING_BUCKET,
  buildPaperRow,
  buildStoragePath,
  extensionForMimeType,
  moderationActionLabel,
  normaliseExamType,
  publicPaperUrl,
  resolveCanonicalMime,
  slugifySegment,
  statusAfterAction,
  validateUploadFile,
  validateUploadMeta,
  type PyqUploadMeta,
} from '../src/features/pyq/pyqStorage';
import { paperRecordToItem } from '../src/features/pyq/usePyqQuery';

const META: PyqUploadMeta = {
  school: 'SOICT',
  programmeCode: 'BCS',
  semester: 'II',
  subjectCode: 'CSE205',
  subjectName: 'Data Structures & Algorithms',
  year: 2025,
  examType: 'Mid Sem',
};

describe('path slugs', () => {
  it('upper-cases and hyphenates', () => {
    expect(slugifySegment('bcs')).toBe('BCS');
    expect(slugifySegment('Data Structures & Algorithms')).toBe('DATA-STRUCTURES-ALGORITHMS');
    expect(slugifySegment('  ')).toBe('');
  });

  it('strips characters that are unsafe in a storage path', () => {
    expect(slugifySegment('../etc/passwd')).toBe('ETC-PASSWD');
    expect(slugifySegment('a/b\\c')).toBe('A-B-C');
  });
});

describe('exam type normalisation', () => {
  it('maps every accepted spelling', () => {
    expect(normaliseExamType('mid sem')).toBe('Mid Sem');
    expect(normaliseExamType('Mid-Semester')).toBe('Mid Sem');
    expect(normaliseExamType('end sem')).toBe('End Sem');
    expect(normaliseExamType('back paper')).toBe('Back Paper');
  });

  it('falls back to Mid Sem for anything unknown', () => {
    expect(normaliseExamType('nonsense')).toBe('Mid Sem');
  });
});

describe('upload validation', () => {
  it('accepts complete metadata', () => {
    expect(validateUploadMeta(META)).toEqual({ ok: true });
  });

  it('rejects missing fields', () => {
    expect(validateUploadMeta({ ...META, subjectCode: '  ' })).toEqual({
      ok: false,
      reason: 'Subject code is required.',
    });
    expect(validateUploadMeta({ ...META, subjectName: '' })).toEqual({
      ok: false,
      reason: 'Subject name is required.',
    });
    expect(validateUploadMeta({ ...META, year: 1999 })).toEqual({
      ok: false,
      reason: 'Year must be between 2000 and 2100.',
    });
  });

  it('accepts PDF, JPG and PNG files', () => {
    for (const mimeType of PYQ_ALLOWED_MIME_TYPES) {
      expect(validateUploadFile({ mimeType, size: 1024 }).ok).toBe(true);
    }
  });

  it('rejects other file types', () => {
    expect(validateUploadFile({ mimeType: 'application/zip', size: 1024 })).toEqual({
      ok: false,
      reason: 'Only PDF, JPG and PNG papers are accepted.',
    });
  });

  it('rejects DOC and DOCX, which the storage bucket does not allow', () => {
    // The bucket only accepts application/pdf, image/jpeg and image/png.
    // A Word file used to pass the app's validation and was then refused
    // by the bucket with a raw error.
    expect(validateUploadFile({ mimeType: 'application/msword', size: 1024 }).ok).toBe(false);
    expect(
      validateUploadFile({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024,
      }).ok,
    ).toBe(false);
    expect(validateUploadFile({ mimeType: 'application/pdf', name: 'paper.docx', size: 1024 }).ok).toBe(
      false,
    );
  });

  it('accepts a file whose size the picker could not measure', () => {
    // A cloud document provider may report `size: null`. That is an unknown
    // size, not an empty file: real papers used to be lost here.
    expect(validateUploadFile({ mimeType: 'application/pdf', size: null }).ok).toBe(true);
    expect(validateUploadFile({ mimeType: 'application/pdf', size: undefined }).ok).toBe(true);
    expect(validateUploadFile({ mimeType: 'application/pdf', size: 0 }).ok).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(validateUploadFile({ mimeType: 'application/pdf', size: 0 }).ok).toBe(false);
  });

  it('rejects a file over 20 MB', () => {
    expect(validateUploadFile({ mimeType: 'application/pdf', size: PYQ_MAX_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'Papers must be 20 MB or smaller.',
    });
    expect(validateUploadFile({ mimeType: 'application/pdf', size: PYQ_MAX_BYTES }).ok).toBe(true);
  });

  it('maps mime types to extensions', () => {
    expect(extensionForMimeType('application/pdf')).toBe('pdf');
    expect(extensionForMimeType('image/png')).toBe('png');
    expect(extensionForMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForMimeType('application/zip')).toBe('bin');
  });

  it('normalises complex or degraded mime types from Android SAF picker', () => {
    expect(resolveCanonicalMime('text/plain; charset=utf-8', 'paper.pdf')).toBe('application/pdf');
    expect(resolveCanonicalMime('text/plain; charset=utf-8', 'scan.png')).toBe('image/png');
    expect(resolveCanonicalMime('application/octet-stream', 'exam.jpg')).toBe('image/jpeg');
    expect(resolveCanonicalMime('application/pdf; charset=binary', 'doc.pdf')).toBe('application/pdf');
    expect(resolveCanonicalMime('image/png; charset=utf-8', 'diagram')).toBe('image/png');

    // validateUploadFile accepts files with Android SAF degraded text/plain when filename is pdf
    expect(
      validateUploadFile({
        mimeType: 'text/plain; charset=utf-8',
        name: 'Maths_EndSem_2023.pdf',
        size: 512000,
      }).ok,
    ).toBe(true);
  });
});

describe('storage paths', () => {
  it('builds a sorted path under the pending bucket', () => {
    const path = buildStoragePath(META, 'pyq_abc123', PYQ_PENDING_BUCKET, 'application/pdf');
    expect(path).toBe('pyq-pending/SOICT/BCS/II/CSE205/2025-MID-SEM-PYQ-ABC123.pdf');
  });

  it('builds the approved path when the bucket changes', () => {
    const path = buildStoragePath(META, 'pyq_abc123', PYQ_APPROVED_BUCKET, 'application/pdf');
    expect(path.startsWith(`${PYQ_APPROVED_BUCKET}/`)).toBe(true);
  });

  it('never lets a field escape its path segment', () => {
    const path = buildStoragePath(
      { ...META, subjectCode: '../../etc' },
      'pyq_1',
      PYQ_PENDING_BUCKET,
      'application/pdf',
    );
    expect(path).toBe('pyq-pending/SOICT/BCS/II/ETC/2025-MID-SEM-PYQ-1.pdf');
    expect(path.split('/')).toHaveLength(6);
    expect(path.split('/').every((segment) => !segment.includes('..'))).toBe(true);
  });
});

describe('paper rows', () => {
  it('starts in the pending state and keeps the whole attribution', () => {
    const row = buildPaperRow(
      META,
      'pyq_1',
      'pyq-pending/x.pdf',
      {
        authUserId: '3f0d5b2a-9c1e-4a7b-8d6e-1c2b3a4d5e6f',
        studentId: 'GBU-21ICS045',
        name: 'Test User',
        avatarId: 'tech-scholar',
      },
      undefined,
      2048,
    );
    expect(row.status).toBe('pending');
    expect(row.subject_code).toBe('CSE205');
    expect(row.programme_code).toBe('BCS');
    expect(row.exam_type).toBe('Mid Sem');
    // The auth user id is a real uuid and goes into the foreign key.
    expect(row.uploader_id).toBe('3f0d5b2a-9c1e-4a7b-8d6e-1c2b3a4d5e6f');
    // The device identity is a separate column.
    expect(row.uploader_student_id).toBe('GBU-21ICS045');
    expect(row.uploader_name).toBe('Test User');
    expect(row.uploader_avatar).toBe('tech-scholar');
    expect(row.file_size_bytes).toBe(2048);
    expect(row.downloads).toBe(0);
  });

  it('accepts a null uploader for guest uploads', () => {
    const row = buildPaperRow(META, 'pyq_1', 'pyq-pending/x.pdf', {
      authUserId: null,
      studentId: 'GBU-99XYZ12',
      name: 'Guest Scholar',
    });
    expect(row.uploader_id).toBeNull();
    expect(row.uploader_student_id).toBe('GBU-99XYZ12');
  });

  it('never writes a device identity into the auth foreign key', () => {
    // `uploader_id` is a real FK to auth.users(id): a device id there breaks
    // every guest upload, so it has to stay NULL.
    const row = buildPaperRow(META, 'pyq_1', 'pyq-pending/x.pdf', 'GBU-99XYZ12', {
      uniqueStudentId: 'GBU-99XYZ12',
    });
    expect(row.uploader_id).toBeNull();
    expect(row.uploader_student_id).toBe('GBU-99XYZ12');
  });

  it('refuses a non-uuid auth id', () => {
    const row = buildPaperRow(META, 'pyq_1', 'pyq-pending/x.pdf', 'auth_user_aarav', {
      uniqueStudentId: 'GBU-SOICT-9921',
      name: 'Aarav Sharma',
    });
    expect(row.uploader_id).toBeNull();
    expect(row.uploader_student_id).toBe('GBU-SOICT-9921');
    expect(row.uploader_name).toBe('Aarav Sharma');
  });
});

describe('moderation actions', () => {
  it('maps every action to a status', () => {
    expect(statusAfterAction('approve')).toBe('approved');
    expect(statusAfterAction('reject')).toBe('rejected');
  });

  it('has a label for every action', () => {
    for (const action of MODERATION_ACTIONS) {
      expect(moderationActionLabel(action).length).toBeGreaterThan(0);
    }
  });

  it('does not offer a request-changes action that changes nothing', () => {
    // It used to map to `pending` - a no-op that told nobody anything.
    expect(MODERATION_ACTIONS).not.toContain('request-changes');
  });
});

describe('paper links', () => {
  it('builds a public URL for an approved paper', () => {
    const url = publicPaperUrl('pyq/SOICT/BCS/II/CSE205/a.pdf', 'https://proj.supabase.co');
    expect(url).toBe(
      'https://proj.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/II/CSE205/a.pdf',
    );
  });

  it('returns the raw path when no project URL is known', () => {
    expect(publicPaperUrl('pyq/a.pdf', '')).toBe('pyq/a.pdf');
  });
});

describe('record mapping', () => {
  it('maps an approved row to the screen shape', () => {
    const item = paperRecordToItem({
      id: 'pyq_1',
      school: 'SOICT',
      programmeCode: 'BCS',
      semester: 'II',
      subjectCode: 'CSE205',
      subjectName: 'Data Structures & Algorithms',
      year: 2025,
      examType: 'Mid Sem',
      downloads: 12,
      status: 'approved',
      fileUrl: 'https://x/a.pdf',
      uploaderId: 'u1',
    });
    expect(item.status).toBe('approved');
    expect(item.programme).toBe('BCS');
    expect(item.fileUrl).toBe('https://x/a.pdf');
  });

  it('marks a pending row as pending', () => {
    const item = paperRecordToItem({
      id: 'pyq_2',
      school: 'SOICT',
      programmeCode: 'BCS',
      semester: 'II',
      subjectCode: 'CSE209',
      subjectName: 'Operating System',
      year: 2025,
      examType: 'End Sem',
      downloads: 0,
      status: 'pending',
      fileUrl: 'pyq-pending/x.pdf',
      uploaderId: null,
    });
    expect(item.status).toBe('pending');
  });
});
