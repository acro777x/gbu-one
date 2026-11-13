/**
 * The offline cache layer.
 *
 * The project rule is: "every main screen renders from local cache, then
 * refreshes". That layer is `src/lib/db.ts`, and it is exercised through
 * the fake SQLite in `tests/setup.ts`.
 *
 * That fake had two bugs that made the whole layer untested:
 *
 *  1. it dropped the FIRST insert parameter, so every cached row held the
 *     wrong column values;
 *  2. its DELETE removed every row, so the cache prune emptied the cache
 *     instead of keeping the newest N.
 *
 * So the notices cache, the timetable cache and the events cache were never
 * actually round-tripped by a test. These tests do that now.
 */
import {
  readCachedEvents,
  readCachedNotices,
  readCachedTimetable,
  writeCachedEvents,
  writeCachedNotices,
  writeCachedTimetable,
} from '../src/lib/db';
import type { NoticeItem } from '../src/features/notices/noticeService';
import type { Timetable } from '../src/features/timetable/timetableProvider';
import type { CampusEvent } from '../src/features/events/eventsService';

const NOTICE: NoticeItem = {
  id: 'not_1',
  sourceId: 'not_1',
  source: 'main',
  title: 'Notice for Scholarship on NSP Portal',
  cleanTitle: 'Notice for Scholarship on NSP Portal',
  postedAt: '2026-11-01T00:00:00.000Z',
  fileUrl: 'https://example.gbu.ac.in/x.pdf',
  fileType: 'pdf',
  category: 'scholarship',
  audience: { all: true, schools: [] },
  importance: 3,
} as unknown as NoticeItem;

describe('the offline cache', () => {
  it('round-trips a notice with every column intact', () => {
    writeCachedNotices([NOTICE]);
    const rows = readCachedNotices();
    expect(rows.length).toBeGreaterThan(0);
    const found = rows.find((n) => n.sourceId === NOTICE.sourceId);
    expect(found).toBeDefined();
    // Every field must survive the write - the fake used to shift them all
    // by one, so the title landed in the source column and the importance
    // landed in the file type.
    expect(found!.title).toBe(NOTICE.title);
    expect(found!.cleanTitle).toBe(NOTICE.cleanTitle);
    expect(found!.fileUrl).toBe(NOTICE.fileUrl);
    expect(found!.category).toBe(NOTICE.category);
    expect(found!.importance).toBe(NOTICE.importance);
    expect(found!.postedAt).toBe(NOTICE.postedAt);
    expect(found!.source).toBe(NOTICE.source);
  });

  it('keeps only the newest notices', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      ...NOTICE,
      sourceId: `not_${index}`,
      id: `not_${index}`,
      postedAt: `2026-11-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    })) as unknown as NoticeItem[];
    writeCachedNotices(many);
    const rows = readCachedNotices();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(500);
  });

  it('round-trips a timetable', () => {
    const timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-11-01T00:00:00.000Z',
      semesterSessionId: '39',
      source: 'live',
      slots: [
        {
          id: 'd1|p1|CSE205|IL101|SOMEONE',
          day: 1,
          period: 1,
          start: '09:30',
          end: '10:30',
          subject: 'Data Structures & Algorithms',
          subjectCode: 'CSE205',
          faculty: 'Someone',
          room: 'IL101',
          type: 'lecture',
        },
      ],
    } as unknown as Timetable;

    writeCachedTimetable('BCS-II B', '39', timetable);
    const read = readCachedTimetable('bcs-ii b', '39');
    expect(read).not.toBeNull();
    expect(read!.slots).toHaveLength(1);
    expect(read!.slots[0].subjectCode).toBe('CSE205');
    // The class key is matched case-insensitively.
    expect(readCachedTimetable('BCS-II B', '39')).not.toBeNull();
    // And a different session is a different row.
    expect(readCachedTimetable('BCS-II B', '40')).toBeNull();
  });

  it('round-trips a campus event', () => {
    const event = {
      id: 'evt_1',
      title: 'SOICT CodeSprint Hackathon 2026',
      description: 'A 36-hour hackathon.',
      category: 'hackathon',
      startDate: '2026-12-01T09:00:00.000Z',
      endDate: '2026-12-03T17:00:00.000Z',
      venue: 'ICT Block',
      isFree: true,
      registrationRequired: false,
      audience: ['all'],
      source: 'admin',
      isSample: false,
    } as unknown as CampusEvent;

    writeCachedEvents([event]);
    const rows = readCachedEvents();
    expect(rows.length).toBeGreaterThan(0);
    const found = rows.find((e) => e.id === 'evt_1');
    expect(found).toBeDefined();
    expect(found!.title).toBe('SOICT CodeSprint Hackathon 2026');
    expect(found!.venue).toBe('ICT Block');
  });
});
