import {
  computeSlotStatuses,
  countUnreadNotices,
  dayIndexForDate,
  deadlineCountdownText,
  findNextSlot,
  formatDuration,
  nearestFutureDate,
  nextSlotBadge,
  nextSlotDate,
  schoolMinutesOf,
  selectDeadlineNotices,
  slotDurationMinutes,
  slotProgressPercent,
  slotStartToday,
} from '../src/features/timetable/schedule';
import type { NoticeItem } from '../src/features/notices/noticeService';
import type { Slot } from '../src/features/timetable/timetableProvider';

// October 2026: 19 = Monday, 21 = Wednesday, 25 = Sunday.
const at = (day: number, hour = 0, minute = 0): Date => new Date(2026, 9, day, hour, minute);

const makeSlot = (over: Partial<Slot> & Pick<Slot, 'id' | 'day' | 'start' | 'end'>): Slot => ({
  period: 1,
  subject: 'Operating Systems',
  subjectCode: 'CSE209',
  ...over,
});

const makeNotice = (over: Partial<NoticeItem> & Pick<NoticeItem, 'id' | 'postedAt'>): NoticeItem => ({
  source: 'main',
  sourceId: over.id,
  title: 'Notice',
  cleanTitle: 'Notice',
  fileUrl: 'https://gbu.ac.in/notices',
  fileType: 'pdf',
  category: 'academic',
  audience: { all: true },
  importance: 3,
  ...over,
});

describe('day mapping', () => {
  it('maps the calendar onto timetable days 1..7 (Monday..Sunday)', () => {
    expect(dayIndexForDate(at(19))).toBe(1);
    expect(dayIndexForDate(at(20))).toBe(2);
    expect(dayIndexForDate(at(21))).toBe(3);
    expect(dayIndexForDate(at(22))).toBe(4);
    expect(dayIndexForDate(at(23))).toBe(5);
    expect(dayIndexForDate(at(24))).toBe(6);
    expect(dayIndexForDate(at(25))).toBe(7);
  });

  it('never maps Sunday to Monday', () => {
    expect(dayIndexForDate(new Date(2026, 9, 25, 23, 59))).toBe(7);
  });
});

describe('period clock', () => {
  it('reads GBU period times on the 12-hour school-day clock', () => {
    expect(schoolMinutesOf('08:30')).toBe(0);
    expect(schoolMinutesOf('09:30')).toBe(60);
    expect(schoolMinutesOf('12:30')).toBe(240);
    expect(schoolMinutesOf('01:30')).toBe(300);
    expect(schoolMinutesOf('07:30')).toBe(660);
  });

  it('derives the real slot duration', () => {
    expect(slotDurationMinutes(makeSlot({ id: 'a', day: 3, start: '08:30', end: '09:30' }))).toBe(60);
    expect(slotDurationMinutes(makeSlot({ id: 'b', day: 3, start: '12:30', end: '01:30' }))).toBe(60);
    expect(slotDurationMinutes(makeSlot({ id: 'c', day: 3, start: 'nope', end: '09:30' }))).toBeNull();
  });
});

describe('next slot selection', () => {
  const wednesday = [
    makeSlot({ id: 'p1', day: 3, start: '08:30', end: '09:30' }),
    makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' }),
    makeSlot({ id: 'p3', day: 3, start: '11:30', end: '12:30' }),
    makeSlot({ id: 'thu', day: 4, start: '08:30', end: '09:30' }),
  ];

  it('picks the class that is running right now', () => {
    const next = findNextSlot(wednesday, at(21, 9, 45));
    expect(next?.id).toBe('p2');
  });

  it('picks the soonest class that has not started yet', () => {
    const next = findNextSlot(wednesday, at(21, 8, 0));
    expect(next?.id).toBe('p1');
  });

  it('ignores classes that already ended', () => {
    const next = findNextSlot(wednesday, at(21, 10, 45));
    expect(next?.id).toBe('p3');
  });

  it('returns null once the day is over', () => {
    expect(findNextSlot(wednesday, at(21, 13, 0))).toBeNull();
  });

  it('never returns a class from another day', () => {
    expect(findNextSlot(wednesday, at(22, 8, 0))?.id).not.toBe('p1');
  });
});

describe('up next badge', () => {
  it('reports the remaining time before the class', () => {
    const slot = makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' });
    expect(nextSlotBadge(slot, at(21, 8, 0))).toBe('1h 30m left');
    expect(nextSlotBadge(slot, at(21, 9, 15))).toBe('15m left');
  });

  it('reports a running class as live', () => {
    const slot = makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' });
    expect(nextSlotBadge(slot, at(21, 9, 45))).toBe('Live now • 45m left');
  });

  it('reports the empty state when there is no class left', () => {
    expect(nextSlotBadge(null, at(21, 18, 0))).toBe('No more classes today');
  });
});

describe('progress bar', () => {
  const slot = makeSlot({ id: 'p1', day: 3, start: '08:30', end: '09:30' });

  it('is the elapsed fraction of the class', () => {
    expect(slotProgressPercent(slot, at(21, 8, 0))).toBe(0);
    expect(slotProgressPercent(slot, at(21, 9, 0))).toBe(50);
    expect(slotProgressPercent(slot, at(21, 9, 15))).toBe(75);
    expect(slotProgressPercent(slot, at(21, 9, 30))).toBe(100);
    expect(slotProgressPercent(slot, at(21, 9, 45))).toBe(100);
  });

  it('is zero without a class', () => {
    expect(slotProgressPercent(null, at(21, 9, 0))).toBe(0);
  });
});

describe('live and up next classification', () => {
  const wednesday = [
    makeSlot({ id: 'p1', day: 3, start: '08:30', end: '09:30' }),
    makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' }),
    makeSlot({ id: 'p3', day: 3, start: '11:30', end: '12:30' }),
  ];

  it('marks the running class live and the next one up next', () => {
    const statuses = computeSlotStatuses(wednesday, at(21, 9, 45));
    expect(statuses.p2).toBe('LIVE NOW');
    expect(statuses.p3).toBe('UP NEXT');
    expect(statuses.p1).toBe('SCHEDULED');
  });

  it('does not call a morning class live in the afternoon', () => {
    const statuses = computeSlotStatuses(wednesday, at(21, 15, 0));
    expect(statuses.p1).toBe('SCHEDULED');
    expect(statuses.p2).toBe('SCHEDULED');
    expect(statuses.p3).toBe('SCHEDULED');
  });

  it('marks the first class of the day up next before the day starts', () => {
    const statuses = computeSlotStatuses(wednesday, at(21, 7, 0));
    expect(statuses.p1).toBe('UP NEXT');
    expect(statuses.p2).toBe('SCHEDULED');
  });

  it('never marks another day live', () => {
    const statuses = computeSlotStatuses(wednesday, at(22, 9, 0));
    expect(statuses.p1).toBe('SCHEDULED');
    expect(statuses.p2).toBe('SCHEDULED');
  });
});

describe('deadline countdown', () => {
  it('counts the calendar days left', () => {
    expect(deadlineCountdownText('2026-10-23T18:29:59.000Z', at(21, 10, 0))).toBe('2 days left');
    expect(deadlineCountdownText('2026-10-22T18:29:59.000Z', at(21, 10, 0))).toBe('Due tomorrow');
    expect(deadlineCountdownText('2026-10-21T18:29:59.000Z', at(21, 10, 0))).toBe('Due today');
    expect(deadlineCountdownText('2026-10-19T18:29:59.000Z', at(21, 10, 0))).toBe('Overdue');
  });

  it('handles an unusable deadline', () => {
    expect(deadlineCountdownText('not-a-date', at(21, 10, 0))).toBe('No deadline');
  });
});

describe('deadline notices', () => {
  it('keeps the notices that carry a deadline, soonest first', () => {
    const notices = [
      makeNotice({ id: 'a', postedAt: '2026-10-20T10:00:00.000Z' }),
      makeNotice({
        id: 'b',
        postedAt: '2026-10-20T10:00:00.000Z',
        deadlineAt: '2026-11-10T17:00:00.000Z',
      }),
      makeNotice({
        id: 'c',
        postedAt: '2026-10-20T10:00:00.000Z',
        deadlineAt: '2026-10-31T23:59:59.000Z',
      }),
    ];
    const selected = selectDeadlineNotices(notices, 3);
    expect(selected.map((n) => n.id)).toEqual(['c', 'b']);
  });
});

describe('unread notices', () => {
  const notices = [
    makeNotice({ id: 'a', postedAt: '2026-10-18T10:00:00.000Z' }),
    makeNotice({ id: 'b', postedAt: '2026-10-20T10:00:00.000Z' }),
  ];

  it('never reports an unread state for an empty feed', () => {
    expect(countUnreadNotices([], null)).toBe(0);
  });

  it('treats every notice as unread without a last seen stamp', () => {
    expect(countUnreadNotices(notices, null)).toBe(2);
  });

  it('counts only the notices posted after the last seen stamp', () => {
    expect(countUnreadNotices(notices, '2026-10-19T10:00:00.000Z')).toBe(1);
    expect(countUnreadNotices(notices, '2026-10-21T10:00:00.000Z')).toBe(0);
  });
});

describe('exam date', () => {
  it('picks the soonest date that has not passed', () => {
    const dates = ['2026-10-19T04:00:00.000Z', '2026-11-05T04:00:00.000Z', '2026-11-03T04:00:00.000Z'];
    expect(nearestFutureDate(dates, at(21, 10, 0))).toBe('2026-11-03T04:00:00.000Z');
  });

  it('returns null when every date has passed', () => {
    expect(nearestFutureDate(['2026-10-01T04:00:00.000Z'], at(21, 10, 0))).toBeNull();
  });
});

describe('class reminder date', () => {
  it('uses today when the class still starts today', () => {
    const slot = makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' });
    const date = nextSlotDate(slot, at(21, 8, 0));
    expect(date?.getDay()).toBe(3);
    expect(date?.getHours()).toBe(9);
    expect(date?.getMinutes()).toBe(30);
  });

  it('keeps the moment a class already started today', () => {
    const slot = makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' });
    const date = slotStartToday(slot, at(21, 10, 0));
    expect(date?.getDate()).toBe(21);
    expect(date?.getHours()).toBe(9);
    expect(date?.getMinutes()).toBe(30);
    expect(date?.getTime()).toBeLessThan(at(21, 10, 0).getTime());
  });

  it('has no start moment today for another weekday', () => {
    const slot = makeSlot({ id: 'mon', day: 1, start: '08:30', end: '09:30' });
    expect(slotStartToday(slot, at(21, 10, 0))).toBeNull();
  });

  it('rolls to the next week once the class time has passed', () => {
    const slot = makeSlot({ id: 'p2', day: 3, start: '09:30', end: '10:30' });
    const date = nextSlotDate(slot, at(21, 10, 0));
    expect(date?.getDate()).toBe(28);
    expect(date?.getHours()).toBe(9);
  });

  it('finds the next occurrence of a class on another weekday', () => {
    const slot = makeSlot({ id: 'mon', day: 1, start: '08:30', end: '09:30' });
    const date = nextSlotDate(slot, at(21, 10, 0));
    expect(date?.getDay()).toBe(1);
    expect(date?.getDate()).toBe(26);
  });

  it('keeps afternoon periods in the afternoon', () => {
    const slot = makeSlot({ id: 'p5', day: 3, start: '01:30', end: '02:30' });
    const date = nextSlotDate(slot, at(21, 8, 0));
    expect(date?.getHours()).toBe(13);
    expect(date?.getMinutes()).toBe(30);
  });
});

describe('duration formatting', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(62)).toBe('1h 2m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(0)).toBe('0m');
  });
});
