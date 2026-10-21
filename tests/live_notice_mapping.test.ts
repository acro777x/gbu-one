/**
 * The mapping from a live university notice to the app's notice model, and
 * the rule that decides when the app is showing its bundled sample.
 */
import {
  allNoticesAreSample,
  fileTypeFor,
  toNoticeItem,
  toNoticeItems,
} from '../src/features/notices/liveNoticeMapping';
import { MOCK_NOTICES } from '../src/features/notices/noticeService';
import type { LiveNotice } from '../src/features/notices/liveNotices';

function live(overrides: Partial<LiveNotice> = {}): LiveNotice {
  return {
    id: 'live-1',
    source: 'main',
    sourceUrl: 'https://www.gbu.ac.in/page/notices',
    title: 'Revised Mid-Semester Exam Datesheet (Autumn 2026)',
    postedAt: '2026-10-19T00:00:00.000Z',
    postedOn: '19 Oct 2026',
    fileUrl: 'https://www.gbu.ac.in/Admissions/DownloadFile?nName=1_a.pdfNotice.pdf',
    attachmentKind: 'file',
    attachmentLabel: 'Notice.pdf',
    isNew: false,
    category: 'datesheet',
    importance: 4,
    relatedUrls: [],
    ...overrides,
  };
}

describe('live notice mapping', () => {
  it('reads the file kind from the URL', () => {
    expect(fileTypeFor(live({ fileUrl: 'https://x.test/a.pdf' }))).toBe('pdf');
    expect(fileTypeFor(live({ fileUrl: 'https://x.test/a.JPG' }))).toBe('image');
    expect(fileTypeFor(live({ fileUrl: 'https://x.test/a.png' }))).toBe('image');
    expect(fileTypeFor(live({ fileUrl: 'https://x.test/page' }))).toBe('html');
    expect(fileTypeFor(live({ fileUrl: null }))).toBe('html');
  });

  it('carries the real title, date, category and importance across', () => {
    const item = toNoticeItem(live());
    expect(item.title).toContain('Revised Mid-Semester');
    expect(item.cleanTitle.length).toBeGreaterThan(0);
    expect(item.postedAt).toBe('2026-10-19T00:00:00.000Z');
    expect(item.category).toBe('datesheet');
    expect(item.importance).toBe(4);
    expect(item.source).toBe('main');
    expect(item.isSample).toBe(false);
  });

  it('keeps the absolute attachment URL', () => {
    const item = toNoticeItem(live());
    expect(item.fileUrl).toBe(
      'https://www.gbu.ac.in/Admissions/DownloadFile?nName=1_a.pdfNotice.pdf',
    );
  });

  it('falls back to the source page when the link is a JavaScript modal', () => {
    const item = toNoticeItem(
      live({ attachmentKind: 'modal', fileUrl: null, source: 'exams' }),
    );
    expect(item.fileUrl).toBe('https://www.gbu.ac.in/page/notices');
  });

  it('drops notices without a title and sorts newest first', () => {
    const items = toNoticeItems([
      live({ id: 'old', postedAt: '2026-01-01T00:00:00.000Z' }),
      live({ id: 'new', postedAt: '2026-10-19T00:00:00.000Z' }),
      live({ id: 'blank', title: '' }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('new');
  });
});

describe('sample data honesty', () => {
  it('marks every bundled notice as a sample', () => {
    expect(MOCK_NOTICES.length).toBeGreaterThan(0);
    expect(MOCK_NOTICES.every((notice) => notice.isSample === true)).toBe(true);
  });

  it('detects a list that is entirely sample data', () => {
    expect(allNoticesAreSample(MOCK_NOTICES)).toBe(true);
    expect(allNoticesAreSample([toNoticeItem(live())])).toBe(false);
    expect(allNoticesAreSample([])).toBe(false);
  });
});
