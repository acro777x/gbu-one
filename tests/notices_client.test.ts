/**
 * The client half of the notices pipeline.
 *
 * These tests cover the four things that used to be wrong and that a student
 * would notice:
 *  1. A notice that arrives from the worker and the same notice that arrives
 *     from the on-device scrape must be ONE entry, not two.
 *  2. The bundled archive must never be reported as live university data.
 *  3. The live mapping must carry a real audience and a real deadline.
 *  4. A broadcast payload must be checked against the database before it is
 *     written to the cache.
 *  5. The admin console must be told the truth when a publish fails.
 */
import {
  mergeNoticeList,
  fetchNoticesForScreen,
  resolveBroadcastNotice,
} from '../src/features/notices/useNoticesQuery';
import { toNoticeItem } from '../src/features/notices/liveNoticeMapping';
import { useNoticesStatusStore } from '../src/features/notices/noticesStatus';
import {
  publishNoticeToCampus,
  deleteNoticeFromCampus,
} from '../src/features/notices/adminNoticesService';
import { MOCK_NOTICES, type NoticeItem } from '../src/features/notices/noticeService';
import type { LiveNotice } from '../src/features/notices/liveNotices';

const NOTICE_URL = 'https://www.gbu.ac.in/Admissions/DownloadFile?nName=-1071752_8ba41d50.pdfNotice.pdf';

/** The shape the worker writes into Postgres: a uuid key and a `src_` id. */
const workerRow = (): NoticeItem => ({
  id: 'c3d4e5f6-7890-1234-abcd-ef0123456784',
  source: 'main',
  sourceId: 'src_9f2c1a7b3d4e5f60',
  title: 'Revised Date Sheet for End Semester Examination',
  cleanTitle: 'Revised Date Sheet for End Semester Examination',
  postedAt: '2026-10-21T00:00:00.000Z',
  fileUrl: NOTICE_URL,
  fileType: 'pdf',
  category: 'datesheet',
  audience: { all: true },
  importance: 4,
  deadlineAt: null,
  isSample: false,
});

/** The shape the on-device scrape produces. */
const deviceRow = (): NoticeItem => {
  const live: LiveNotice = {
    id: 'lt_main_1a2b3c4d',
    source: 'main',
    sourceUrl: 'https://www.gbu.ac.in/page/notices',
    title: 'Revised Date Sheet for End Semester Examination',
    postedAt: '2026-10-21T00:00:00.000Z',
    postedOn: '21 Oct 2026',
    fileUrl: NOTICE_URL,
    attachmentKind: 'file',
    attachmentLabel: 'Notice.pdf',
    isNew: false,
    category: 'datesheet',
    importance: 4,
    relatedUrls: [],
  };
  return toNoticeItem(live);
};

describe('notices client', () => {
  describe('one identity per notice', () => {
    it('merges the worker copy and the device copy into ONE entry', () => {
      const worker = workerRow();
      const device = deviceRow();

      // Before the fix these two described the same notice but had nothing in
      // common, so both were listed - twice on the home carousel too.
      expect(worker.id).not.toBe(device.id);
      expect(worker.sourceId).not.toBe(device.sourceId);

      const merged = mergeNoticeList([worker, device]);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe(device.id);
      expect(merged[0].title).toBe(worker.title);
    });

    it('merges the two copies whichever way round they arrive', () => {
      const merged = mergeNoticeList([deviceRow(), workerRow()]);
      expect(merged).toHaveLength(1);
    });

    it('keeps two different notices apart', () => {
      const other = workerRow();
      other.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      other.sourceId = 'src_1111111111111111';
      other.title = 'Notice for Scholarship on NSP Portal';
      other.cleanTitle = 'Notice for Scholarship on NSP Portal';
      other.fileUrl = 'https://www.gbu.ac.in/Admissions/DownloadFile?nName=other.pdf';

      const merged = mergeNoticeList([workerRow(), other]);
      expect(merged).toHaveLength(2);
    });

    it('never lists a notice that was withdrawn', () => {
      const worker = workerRow();
      const device = deviceRow();
      // The tombstone carries the identity the app uses, so it hides the
      // notice no matter which copy of it arrives.
      const merged = mergeNoticeList([worker, device], [device.id]);
      expect(merged).toHaveLength(0);
    });
  });

  describe('honest status', () => {
    it('reports the bundled archive as sample, never as live', async () => {
      // The network is down and the phone has no cache, so all that is left
      // is the archive. The status has to say so.
      const failingFetch = jest.fn(() => Promise.reject(new Error('network unreachable')));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = failingFetch;

      // The refresh failed, so the failure is raised - the screen keeps the
      // data it has and shows the error.
      await expect(fetchNoticesForScreen()).rejects.toBeTruthy();
      const status = useNoticesStatusStore.getState();

      expect(status.source).toBe('sample');
      expect(status.source).not.toBe('live');
      // The archive is never presented as live university data.
      expect(MOCK_NOTICES.length).toBeGreaterThan(0);
      expect(MOCK_NOTICES.every((n) => n.isSample === true)).toBe(true);
    });
  });

  describe('live mapping', () => {
    it('carries the audience and the deadline of a live notice', () => {
      const item = toNoticeItem({
        id: 'lt_main_deadline',
        source: 'main',
        sourceUrl: 'https://www.gbu.ac.in/page/notices',
        title: 'Office Order: Last date of fee submission extended to 31st Oct 2026 for SOICT',
        postedAt: '2026-10-21T00:00:00.000Z',
        postedOn: '21 Oct 2026',
        fileUrl: NOTICE_URL,
        attachmentKind: 'file',
        attachmentLabel: 'Notice.pdf',
        isNew: false,
        category: 'fees',
        importance: 4,
        relatedUrls: [],
      });

      expect(item.audience.schools).toContain('SOICT');
      expect(item.audience.all).toBe(false);
      expect(item.deadlineAt).not.toBeNull();
      const deadline = new Date(item.deadlineAt as string);
      expect(deadline.getUTCMonth()).toBe(9);
      expect(deadline.getUTCDate()).toBe(31);
    });

    it('carries the date-sheet PDFs the exam portal hides in a modal', () => {
      const item = toNoticeItem({
        id: 'lt_exams_datesheet',
        source: 'exams',
        sourceUrl: 'https://exams.gbu.ac.in/',
        title: 'Datesheet for End Semester Examination – December 2025',
        postedAt: '2025-12-05T00:00:00.000Z',
        postedOn: '05-12-2025',
        fileUrl: null,
        attachmentKind: 'modal',
        attachmentLabel: 'View School-wise Datesheet',
        isNew: false,
        category: 'datesheet',
        importance: 4,
        relatedUrls: [
          'https://exams.gbu.ac.in/uploads/datesheet/soict-end-sem-dec-2025.pdf',
          'https://exams.gbu.ac.in/uploads/datesheet/som-end-sem-dec-2025.pdf',
        ],
      });

      expect(item.relatedAttachments).toHaveLength(2);
      expect(item.relatedAttachments?.[0].url).toContain('soict-end-sem-dec-2025.pdf');
      expect(item.relatedAttachments?.[0].label).toContain('SOICT');
    });
  });

  describe('broadcast re-validation', () => {
    const dbNotice: NoticeItem = {
      ...workerRow(),
      id: 'not_abcdef0123456789',
      title: 'The title the database holds',
    };

    it('accepts the notice the database holds, not the payload', async () => {
      const reader = jest.fn(async () => dbNotice);
      const resolved = await resolveBroadcastNotice(
        { id: 'src_9f2c1a7b3d4e5f60', title: 'A title a forger chose' },
        reader,
      );

      expect(reader).toHaveBeenCalledWith('src_9f2c1a7b3d4e5f60');
      expect(resolved?.title).toBe('The title the database holds');
    });

    it('rejects a payload the database does not confirm', async () => {
      const reader = jest.fn(async () => null);
      const resolved = await resolveBroadcastNotice({ id: 'src_9f2c1a7b3d4e5f60' }, reader);
      expect(resolved).toBeNull();
    });

    it('rejects a payload whose id could tamper with the filter', async () => {
      const reader = jest.fn(async () => dbNotice);
      const resolved = await resolveBroadcastNotice(
        { id: 'x,source_id.eq.admin' },
        reader,
      );
      expect(resolved).toBeNull();
      expect(reader).not.toHaveBeenCalled();
    });

    it('rejects a payload without any id', async () => {
      const reader = jest.fn(async () => dbNotice);
      expect(await resolveBroadcastNotice({}, reader)).toBeNull();
      expect(await resolveBroadcastNotice(null, reader)).toBeNull();
      expect(reader).not.toHaveBeenCalled();
    });
  });

  describe('admin publish', () => {
    it('reports the failure instead of claiming the notice was published', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'new row violates row-level security policy' }),
          text: () =>
            Promise.resolve('{"message":"new row violates row-level security policy"}'),
        }),
      );

      const result = await publishNoticeToCampus({
        title: 'Diwali Campus Holiday Notification 2026',
        category: 'other',
        importance: 5,
        fileUrl: 'https://www.gbu.ac.in/diwali.pdf',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('not published');
    });

    it('reports the failure of a delete as well', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'permission denied' }),
          text: () => Promise.resolve('{"message":"permission denied"}'),
        }),
      );

      const result = await deleteNoticeFromCampus('admin_notice_123_abc');
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
