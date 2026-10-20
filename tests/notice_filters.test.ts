/**
 * Unit tests for the N99-style removable notice filters.
 */
import { filterNotices, type NoticeItem } from '../src/features/notices/noticeService';

const notice = (over: Partial<NoticeItem> = {}): NoticeItem => ({
  id: 'n1',
  source: 'main',
  sourceId: 'src_1',
  title: 'Fee Submission Deadline Extended',
  cleanTitle: 'Fee Submission Deadline Extended to 31st Oct',
  postedAt: '2026-10-17T00:00:00.000Z',
  fileUrl: 'https://gbu.ac.in/a.pdf',
  fileType: 'pdf',
  category: 'fees',
  audience: { all: true },
  importance: 5,
  ...over,
});

const notices: NoticeItem[] = [
  notice({ id: 'fees', category: 'fees', audience: { all: true }, importance: 5 }),
  notice({
    id: 'datesheet',
    title: 'Revised Mid Semester Examination Schedule',
    cleanTitle: 'Revised Mid Semester Examination Schedule',
    category: 'datesheet',
    audience: { schools: ['SOICT'], semesters: ['II'] },
    importance: 5,
  }),
  notice({
    id: 'hostel',
    title: 'Hostel Room Reallotment Schedule',
    cleanTitle: 'Hostel Room Reallotment Schedule',
    category: 'hostel',
    audience: { schools: ['SOM'], semesters: ['I'] },
    importance: 2,
  }),
  notice({
    id: 'low',
    title: 'Library Reading Hour Notice',
    cleanTitle: 'Library Reading Hour Notice',
    category: 'other',
    audience: { schools: ['SOE'] },
    importance: 1,
  }),
];

describe('notice filters', () => {
  it('keeps everything when no filter is set', () => {
    expect(filterNotices(notices)).toHaveLength(4);
  });

  it('filters by category', () => {
    const result = filterNotices(notices, { categories: ['fees'] });
    expect(result.map((n) => n.id)).toEqual(['fees']);
  });

  it('accepts several categories at once', () => {
    const result = filterNotices(notices, { categories: ['fees', 'datesheet'] });
    expect(result.map((n) => n.id)).toEqual(['fees', 'datesheet']);
  });

  it('combines categories with a school', () => {
    const result = filterNotices(notices, { categories: ['datesheet'], schools: ['SOICT'] });
    expect(result.map((n) => n.id)).toEqual(['datesheet']);
  });

  it('excludes a notice whose school does not match', () => {
    const result = filterNotices(notices, { schools: ['SOE'] });
    expect(result.map((n) => n.id)).toEqual(['low']);
  });

  it('matches the school case-insensitively', () => {
    expect(filterNotices(notices, { schools: ['soict'] }).map((n) => n.id)).toEqual(['datesheet']);
  });

  it('keeps the "for me" notices', () => {
    const result = filterNotices(notices, { forMe: true });
    // Importance >= 2 or audience.all.
    expect(result.map((n) => n.id)).toEqual(['fees', 'datesheet', 'hostel']);
  });

  it('searches the title', () => {
    const result = filterNotices(notices, { query: 'deadline' });
    expect(result.map((n) => n.id)).toEqual(['fees']);
  });

  it('searches the extracted document text too', () => {
    const withText = [notice({ id: 'text', rawText: 'Last Date: 31 Oct 2026 for scholarship forms' })];
    expect(filterNotices(withText, { query: 'scholarship' }).map((n) => n.id)).toEqual(['text']);
  });

  it('ignores an empty filter list', () => {
    expect(filterNotices(notices, { categories: [], schools: [] })).toHaveLength(4);
  });

  it('requires every active filter to match', () => {
    const result = filterNotices(notices, { categories: ['datesheet'], schools: ['SOM'] });
    expect(result).toHaveLength(0);
  });
});
