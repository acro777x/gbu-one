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
  it('starts in the pending state', () => {
    const row = buildPaperRow(META, 'pyq_1', 'pyq-pending/x.pdf', 'user-1');
    expect(row.status).toBe('pending');
    expect(row.subject_code).toBe('CSE205');
    expect(row.programme_code).toBe('BCS');
    expect(row.exam_type).toBe('Mid Sem');
    expect(row.uploader_id).toBe('user-1');
    expect(row.downloads).toBe(0);
  });

  it('accepts a null uploader for guest uploads', () => {
    const row = buildPaperRow(META, 'pyq_1', 'pyq-pending/x.pdf', null);
    expect(row.uploader_id).toBeNull();
  });
});

describe('moderation actions', () => {
  it('maps every action to a status', () => {
    expect(statusAfterAction('approve')).toBe('approved');
    expect(statusAfterAction('reject')).toBe('rejected');
    expect(statusAfterAction('request-changes')).toBe('pending');
  });

  it('has a label for every action', () => {
    for (const action of MODERATION_ACTIONS) {
      expect(moderationActionLabel(action).length).toBeGreaterThan(0);
    }
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
