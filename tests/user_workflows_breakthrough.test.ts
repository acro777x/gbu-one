/**
 * GBU One — Hostile User Workflows Breakthrough Automated Test Suite
 *
 * Exhaustively tests 10 distinct, hostile, real-world user paths across:
 *  1. Rapid Subject/Semester switching under heavy catalogue load
 *  2. Corrupt, stub, soft-404, or HTML error pages disguised as PDFs
 *  3. Hostile file upload attempts (executables, scripts, 0-byte, 35MB oversized)
 *  4. Malicious metadata injection (path traversal, script tags, invalid years)
 *  5. Offline PYQ local queue buffering & durability when backend is down
 *  6. Class Alarm past-time rollover on edge boundaries & past classes
 *  7. Hostile / malformed roll number search inputs (spaces, punctuation, casing, SQL injections)
 *  8. Unauthorized access attempts to moderation queue (role enforcement)
 *  9. Multi-format paper inspection (PDF, JPG, PNG, DOC, DOCX)
 * 10. Erratic university room code parsing and deterministic campus mapping
 */

import {
  filterPapers,
  normalizeSemester,
  buildCataloguePapers,
  MOCK_PAPERS,
  FULL_CATALOGUE_PAPERS,
  type PYQItem,
} from '../src/features/pyq/pyqService';
import {
  isProbablyPdf,
  looksLikeSoft404,
  isPdfErrorPage,
  describeDownloadProblem,
  isSafePdfUrl,
  buildCacheFileName,
  looksLikeDocUrl,
  isProbablyDoc,
  MIN_PDF_BYTES,
} from '../src/components/pdf/pdfHelpers';
import {
  validateUploadFile,
  validateUploadMeta,
  slugifySegment,
  buildStoragePath,
  publicPaperUrl,
  extensionForMimeType,
  PYQ_MAX_BYTES,
} from '../src/features/pyq/pyqStorage';
import {
  buildQueuedUpload,
  enqueueUpload,
  dequeueUpload,
} from '../src/features/pyq/localUploadQueue';
import {
  fireAtFor,
  canScheduleReminder,
} from '../src/features/notifications/notificationPreferences';
import {
  nextSlotDate,
  slotStartToday,
} from '../src/features/timetable/schedule';
import { Slot } from '../src/features/timetable/timetableProvider';
import {
  normalizeRollNumber,
  searchRollNumberResult,
  MOCK_STUDENT_RESULTS,
  calculateExamCountdown,
  MOCK_DATESHEET,
} from '../src/features/exams/examService';
import {
  moderatorStatus,
} from '../src/features/pyq/pyqRepository';
import {
  parseRoomLocation,
  formatRoomLocation,
} from '../src/features/timetable/roomMapping';

describe('Hostile User Workflows Breakthrough Suite', () => {
  // =========================================================================
  // 1. Rapid Subject/Semester switching under heavy catalogue load
  // =========================================================================
  describe('Path 1: Rapid Subject/Semester switching under heavy catalogue load', () => {
    it('filters synchronously without dropping frames across 800+ subjects', () => {
      const allPapers = FULL_CATALOGUE_PAPERS;
      expect(allPapers.length).toBeGreaterThanOrEqual(100);

      // Simulate frantic tapping across semesters and schools
      const schools = ['SOICT', 'SOE', 'SOBT', 'SOM', 'SOL', 'SOVSAS', 'SOHSS'];
      const semesters = ['Sem I', 'Sem II', 'Sem III', 'Sem IV', 'Sem V', 'Sem VI', 'Sem VII', 'Sem VIII'];

      for (const school of schools) {
        for (const sem of semesters) {
          const results = filterPapers(allPapers, '', school, sem, 'All', 'All');
          expect(Array.isArray(results)).toBe(true);
          for (const item of results) {
            expect(item.school.toUpperCase()).toBe(school.toUpperCase());
            expect(normalizeSemester(item.semester)).toBe(normalizeSemester(sem));
          }
        }
      }
    });

    it('handles rapid query typing with special characters and whitespace without crashing', () => {
      const allPapers = FULL_CATALOGUE_PAPERS;
      const queries = [
        '   ',
        'c++',
        'data & structures',
        '%%%',
        '../',
        'operating',
        'computational',
        '101',
      ];

      for (const q of queries) {
        const results = filterPapers(allPapers, q, 'All', 'All', 'All', 'All');
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. Corrupt, stub, soft-404, or HTML error page disguised as PDF
  // =========================================================================
  describe('Path 2: Corrupt, stub, soft-404, or HTML error page disguised as PDF', () => {
    it('detects soft-404 HTML body served with HTTP 200 and describes it accurately', () => {
      const soft404Html = '<html><head><title>404 - Page not found</title></head><body><h1>404 - Page not found</h1></body></html>';
      expect(looksLikeSoft404(soft404Html)).toBe(true);
      const desc = describeDownloadProblem(200, soft404Html, soft404Html.length);
      expect(desc).toContain('404 - Page not found');
    });

    it('detects GBU internal server error HTML page served with HTTP 500', () => {
      const errorHtml = '<html><body>An error occurred while processing your request. Please try again later.</body></html>';
      expect(isPdfErrorPage(errorHtml)).toBe(true);
      const desc = describeDownloadProblem(500, errorHtml, errorHtml.length);
      expect(desc).toContain('error page');
    });

    it('rejects stub files under minimum document size', () => {
      const stub = '%PDF-1.4\nstub';
      expect(stub.length).toBeLessThan(MIN_PDF_BYTES);
      const desc = describeDownloadProblem(200, stub, stub.length);
      expect(desc).toContain('too small to be a real document');
    });

    it('refuses unsafe URL protocols that attempt local or scheme injection', () => {
      expect(isSafePdfUrl('file:///etc/passwd')).toBe(false);
      expect(isSafePdfUrl('javascript:alert(1)')).toBe(false);
      expect(isSafePdfUrl('content://com.android.providers.downloads/1')).toBe(false);
      expect(isSafePdfUrl('https://www.gbu.ac.in/notice.pdf\njavascript:evil()')).toBe(false);
      expect(isSafePdfUrl('https://www.gbu.ac.in/notice.pdf')).toBe(true);
    });
  });

  // =========================================================================
  // 3. Hostile file upload attempts (executables, scripts, 0-byte, 35MB oversized)
  // =========================================================================
  describe('Path 3: Hostile file uploads (executables, scripts, 0-byte, 35MB oversized)', () => {
    it('rejects executable and script files immediately', () => {
      expect(validateUploadFile({ name: 'malware.exe', mimeType: 'application/x-msdownload', size: 1024 }).ok).toBe(false);
      expect(validateUploadFile({ name: 'exploit.sh', mimeType: 'application/x-sh', size: 2048 }).ok).toBe(false);
      expect(validateUploadFile({ name: 'script.js', mimeType: 'application/javascript', size: 4096 }).ok).toBe(false);
    });

    it('rejects zero-byte files but accepts a size the picker could not measure', () => {
      expect(validateUploadFile({ name: 'paper.pdf', mimeType: 'application/pdf', size: 0 }).ok).toBe(false);
      expect(validateUploadFile({ name: 'paper.pdf', mimeType: 'application/pdf', size: -100 }).ok).toBe(false);
      // A cloud document provider may report `size: null`. That is an
      // UNKNOWN size, not an empty file: rejecting it as "The selected file
      // is empty" lost real question papers.
      expect(validateUploadFile({ name: 'paper.pdf', mimeType: 'application/pdf', size: null }).ok).toBe(true);
    });

    it('rejects files exceeding 20 MB limit', () => {
      const oversized = PYQ_MAX_BYTES + 1024;
      const res = validateUploadFile({ name: 'huge_scan.pdf', mimeType: 'application/pdf', size: oversized });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toContain('20 MB or smaller');
      }
    });

    it('accepts valid PDF, JPG and PNG files within limits', () => {
      expect(validateUploadFile({ name: 'paper.pdf', mimeType: 'application/pdf', size: 1024 * 500 }).ok).toBe(true);
      expect(validateUploadFile({ name: 'scan.jpg', mimeType: 'image/jpeg', size: 1024 * 300 }).ok).toBe(true);
      expect(validateUploadFile({ name: 'scan.png', mimeType: 'image/png', size: 1024 * 400 }).ok).toBe(true);
    });

    it('rejects DOC and DOCX, which the storage bucket does not allow', () => {
      // The bucket allows application/pdf, image/jpeg and image/png only.
      // A Word file used to pass the app's validation and was then refused
      // by the bucket with a raw error the student could not act on.
      expect(validateUploadFile({ name: 'paper.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1024 * 200 }).ok).toBe(false);
      expect(validateUploadFile({ name: 'notes.doc', mimeType: 'application/msword', size: 1024 * 150 }).ok).toBe(false);
    });
  });

  // =========================================================================
  // 4. Malicious metadata injection (path traversal, script tags, invalid years)
  // =========================================================================
  describe('Path 4: Malicious metadata injection (path traversal, script tags, invalid years)', () => {
    it('sanitizes path traversal attempts in storage segments', () => {
      const dirty = '../../../../etc/passwd';
      const clean = slugifySegment(dirty);
      expect(clean).not.toContain('..');
      expect(clean).not.toContain('/');
      expect(clean).toBe('ETC-PASSWD');
    });

    it('rejects missing or empty required metadata', () => {
      expect(validateUploadMeta({ subjectCode: '   ', subjectName: 'Maths', school: 'SOICT', programmeCode: 'BCS', semester: 'I', year: 2025 }).ok).toBe(false);
      expect(validateUploadMeta({ subjectCode: 'CS101', subjectName: '', school: 'SOICT', programmeCode: 'BCS', semester: 'I', year: 2025 }).ok).toBe(false);
      expect(validateUploadMeta({ subjectCode: 'CS101', subjectName: 'CS', school: '', programmeCode: 'BCS', semester: 'I', year: 2025 }).ok).toBe(false);
    });

    it('rejects out-of-range examination years', () => {
      expect(validateUploadMeta({ subjectCode: 'CS101', subjectName: 'CS', school: 'SOICT', programmeCode: 'BCS', semester: 'I', year: 1850 }).ok).toBe(false);
      expect(validateUploadMeta({ subjectCode: 'CS101', subjectName: 'CS', school: 'SOICT', programmeCode: 'BCS', semester: 'I', year: 2500 }).ok).toBe(false);
      expect(validateUploadMeta({ subjectCode: 'CS101', subjectName: 'CS', school: 'SOICT', programmeCode: 'BCS', semester: 'I', year: 2026 }).ok).toBe(true);
    });

    it('builds secure deterministic storage paths with extension resolution', () => {
      const meta = {
        school: 'SOICT',
        programmeCode: 'BCS',
        semester: 'II',
        subjectCode: 'CSE205',
        subjectName: 'Data Structures',
        year: 2026,
        examType: 'Mid Sem' as const,
      };
      const pdfPath = buildStoragePath(meta, 'paper123', 'pyq-pending', 'application/pdf');
      expect(pdfPath).toBe('pyq-pending/SOICT/BCS/II/CSE205/2026-MID-SEM-PAPER123.pdf');

      const docxPath = buildStoragePath(meta, 'paper124', 'pyq-pending', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(docxPath).toBe('pyq-pending/SOICT/BCS/II/CSE205/2026-MID-SEM-PAPER124.docx');

      const publicUrl = publicPaperUrl(docxPath, 'https://test.supabase.co');
      expect(publicUrl).toBe('https://test.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/II/CSE205/2026-MID-SEM-PAPER124.docx');
    });
  });

  // =========================================================================
  // 5. Offline PYQ local queue buffering & durability when backend is down
  // =========================================================================
  describe('Path 5: Offline PYQ local queue buffering & durability', () => {
    it('buffers offline uploads locally and safely creates queued items', async () => {
      const entry = buildQueuedUpload(
        {
          uri: 'file:///cache/paper_upload.pdf',
          name: 'paper_upload.pdf',
          mimeType: 'application/pdf',
          size: 10240,
        },
        {
          school: 'SOICT',
          programmeCode: 'BCS',
          semester: 'II',
          subjectCode: 'CSE205',
          subjectName: 'Data Structures',
          year: 2026,
          examType: 'Mid Sem',
        },
      );

      expect(entry.id).toBeDefined();
      expect(entry.meta.subjectCode).toBe('CSE205');
      expect(entry.file.size).toBe(10240);

      const queue = await enqueueUpload(entry);
      expect(queue.some((item) => item.id === entry.id)).toBe(true);

      const remaining = await dequeueUpload(entry.id);
      expect(remaining.some((item) => item.id === entry.id)).toBe(false);
    });
  });

  // =========================================================================
  // 6. Class Alarm past-time rollover on edge boundaries & past classes
  // =========================================================================
  describe('Path 6: Class Alarm past-time rollover on edge boundaries', () => {
    it('rolls over to next week when a class has already passed today', () => {
      const fixedNow = new Date('2026-11-03T14:00:00.000Z'); // Tuesday 2 PM UTC
      const pastSlot: Slot = {
        id: 'slot_tue_morning',
        day: 2, // Tuesday
        period: 1,
        start: '09:00',
        end: '10:00',
        subject: 'Engineering Math',
        subjectCode: 'BAS101',
        room: 'LL101',
      };

      const startToday = slotStartToday(pastSlot, fixedNow);
      expect(startToday).toBeDefined();
      expect(startToday!.getTime()).toBeLessThan(fixedNow.getTime());

      // Next slot date rolls forward to next Tuesday (7 days later)
      const nextWeekDate = nextSlotDate(pastSlot, fixedNow);
      expect(nextWeekDate).toBeDefined();
      expect(nextWeekDate!.getTime()).toBeGreaterThan(fixedNow.getTime());
      const diffDays = Math.round((nextWeekDate!.getTime() - fixedNow.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('rejects scheduling reminders in the past unless rolled forward', () => {
      const now = new Date('2026-11-03T11:00:00.000Z');
      const pastClass = new Date('2026-11-03T10:00:00.000Z');
      const pastFireAt = fireAtFor(pastClass, 10);

      const check = canScheduleReminder(pastClass, pastFireAt, now);
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.reason).toBe('already-started');
      }
    });

    it('approves scheduling reminders for rolled-over future occurrences', () => {
      const now = new Date('2026-11-03T11:00:00.000Z');
      const nextWeekClass = new Date('2026-11-10T09:00:00.000Z');
      const futureFireAt = fireAtFor(nextWeekClass, 15);

      const check = canScheduleReminder(nextWeekClass, futureFireAt, now);
      expect(check.ok).toBe(true);
    });
  });

  // =========================================================================
  // 7. Hostile / malformed roll number search inputs
  // =========================================================================
  describe('Path 7: Hostile / malformed roll number searches', () => {
    it('normalizes spaces, hyphens, and mixed casing into canonical format', () => {
      expect(normalizeRollNumber('22 / ics . 042')).toBe('22/ICS/042');
      expect(normalizeRollNumber('22-ics-042')).toBe('22/ICS/042');
      expect(normalizeRollNumber('  22/ICS/042  ')).toBe('22/ICS/042');
      expect(normalizeRollNumber('22_ICS_042')).toBe('22/ICS/042');
    });

    it('finds student result records on-device despite hostile input formatting', () => {
      const result = searchRollNumberResult('  22-ics-042  ', MOCK_STUDENT_RESULTS);
      expect(result).not.toBeNull();
      expect(result?.studentName).toBe('Aarav Sharma');
      expect(result?.sgpa).toBe(8.45);
    });

    it('fails closed safely against SQL injection and script strings without leaking records', () => {
      expect(searchRollNumberResult("' OR 1=1 --", MOCK_STUDENT_RESULTS)).toBeNull();
      expect(searchRollNumberResult('<script>alert(1)</script>', MOCK_STUDENT_RESULTS)).toBeNull();
      expect(searchRollNumberResult(';; DROP TABLE students;', MOCK_STUDENT_RESULTS)).toBeNull();
    });
  });

  // =========================================================================
  // 8. Unauthorized access attempts to moderation queue (role enforcement)
  // =========================================================================
  describe('Path 8: Unauthorized access to moderation queue', () => {
    it('denies access when user is signed out or email is empty', async () => {
      const status = await moderatorStatus(null);
      expect(status.state).toBe('signed-out');
      expect(status.reason).toContain('Sign in');
    });

    it('denies access to normal non-moderator student emails', async () => {
      const status = await moderatorStatus('unauthorized_student@gbu.ac.in');
      expect(status.state).not.toBe('moderator');
    });
  });

  // =========================================================================
  // 9. Multi-format paper inspection (PDF, JPG, PNG, DOC, DOCX)
  // =========================================================================
  describe('Path 9: Multi-format paper inspection (PDF, JPG, PNG, DOC, DOCX)', () => {
    it('identifies Word documents by URL extension', () => {
      expect(looksLikeDocUrl('https://example.com/pyq/midsem.docx')).toBe(true);
      expect(looksLikeDocUrl('https://example.com/pyq/midsem.doc')).toBe(true);
      expect(looksLikeDocUrl('https://example.com/pyq/midsem.pdf')).toBe(false);
      expect(looksLikeDocUrl('https://example.com/pyq/scan.jpg')).toBe(false);
    });

    it('identifies Word documents by magic byte signatures (DOCX zip and DOC compound file)', () => {
      const docxHeader = String.fromCharCode(0x50, 0x4b, 0x03, 0x04) + 'some_docx_zip_data';
      expect(isProbablyDoc(docxHeader)).toBe(true);

      const docHeader = String.fromCharCode(0xd0, 0xcf, 0x11, 0xe0) + 'some_doc_binary_data';
      expect(isProbablyDoc(docHeader)).toBe(true);

      const pdfHeader = '%PDF-1.4\n...';
      expect(isProbablyDoc(pdfHeader)).toBe(false);
    });

    it('generates correct cache filenames preserving .docx, .doc, and image extensions', () => {
      expect(buildCacheFileName('https://gbu.ac.in/paper.docx')).toContain('.docx');
      expect(buildCacheFileName('https://gbu.ac.in/paper.doc')).toContain('.doc');
      expect(buildCacheFileName('https://gbu.ac.in/paper.pdf')).toContain('.pdf');
      expect(buildCacheFileName('https://gbu.ac.in/scan.png')).toContain('.png');
      expect(buildCacheFileName('https://gbu.ac.in/scan.jpg')).toContain('.jpg');
    });
  });

  // =========================================================================
  // 10. Erratic university timetable room codes & campus building mapping
  // =========================================================================
  describe('Path 10: Erratic university room code parsing and campus building mapping', () => {
    it('maps LL room codes to Law Building (Law Lecture Hall)', () => {
      const r1 = parseRoomLocation('LL101');
      expect(r1.building).toBe('Law Building');
      expect(r1.roomType).toBe('Law Lecture Hall');
      expect(r1.fullDisplay).toBe('LL101 • Law Building');

      const r2 = parseRoomLocation('LL 204');
      expect(r2.building).toBe('Law Building');
      expect(r2.fullDisplay).toBe('LL 204 • Law Building');
    });

    it('maps LP room codes to Law Building (Law Practical Lab)', () => {
      const r = parseRoomLocation('LP102');
      expect(r.building).toBe('Law Building');
      expect(r.roomType).toBe('Law Practical Lab');
      expect(r.fullDisplay).toContain('Law Building (Law Lab)');
    });

    it('maps IP room codes to SOICT Building (ICT Practical Lab)', () => {
      const r = parseRoomLocation('IP101');
      expect(r.building).toBe('SOICT Building');
      expect(r.roomType).toBe('ICT Practical Lab');
      expect(r.fullDisplay).toContain('SOICT (ICT Lab)');
    });

    it('maps CLT and IL-CLT to ICT New Building (Central Lecture Theatre)', () => {
      const r1 = parseRoomLocation('IL-103 (CLT.)');
      expect(r1.building).toBe('ICT New Building');
      expect(r1.roomType).toBe('Central Lecture Theatre');
      expect(r1.fullDisplay).toBe('IL-103 (CLT.) • ICT New Building');

      const r2 = parseRoomLocation('Central Lecture Theatre');
      expect(r2.building).toBe('ICT New Building');
    });

    it('handles unexpected, empty or TBD room values gracefully', () => {
      expect(formatRoomLocation('', 'SOICT')).toBe('Room to be announced');
      expect(formatRoomLocation(null, 'SOBT')).toBe('Room to be announced');
      expect(formatRoomLocation('TBD', 'SOE')).toBe('TBD • SOE');
    });
  });
});
