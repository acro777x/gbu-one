import {
  computeTimetableDiff,
  Timetable,
  GBU_PERIOD_TIMES,
} from '../src/features/timetable/timetableProvider';

describe('GBU Timetable Provider & Diff Engine', () => {
  it('maps standard period timings correctly for GBU', () => {
    expect(GBU_PERIOD_TIMES[1]).toEqual({ start: '08:30', end: '09:30' });
    expect(GBU_PERIOD_TIMES[2]).toEqual({ start: '09:30', end: '10:30' });
    expect(GBU_PERIOD_TIMES[3]).toEqual({ start: '10:30', end: '11:30' });
    expect(GBU_PERIOD_TIMES[4]).toEqual({ start: '11:30', end: '12:30' });
    expect(GBU_PERIOD_TIMES[6]).toEqual({ start: '01:30', end: '02:30' });
  });

  it('detects room changes between timetable snapshots', () => {
    const oldTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-18T08:00:00Z',
      semesterSessionId: '39',
      slots: [
        {
          id: '1',
          day: 1,
          period: 1,
          start: '08:30',
          end: '09:30',
          subject: 'Operating System',
          subjectCode: 'CSE209',
          room: 'IL101',
        },
      ],
    };

    const newTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-18T08:30:00Z',
      semesterSessionId: '39',
      slots: [
        {
          id: '1',
          day: 1,
          period: 1,
          start: '08:30',
          end: '09:30',
          subject: 'Operating System',
          subjectCode: 'CSE209',
          room: 'Room 204',
        },
      ],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('room_changed');
    expect(diffs[0].message).toContain('Room 204');
  });

  it('detects moved classes to different time slots or days', () => {
    const oldTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-18T08:00:00Z',
      semesterSessionId: '39',
      slots: [
        {
          id: '1',
          day: 1,
          period: 1,
          start: '08:30',
          end: '09:30',
          subject: 'Data Structures',
          subjectCode: 'CSE205',
          room: 'IL101',
        },
      ],
    };

    const newTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-18T08:30:00Z',
      semesterSessionId: '39',
      slots: [
        {
          id: '2',
          day: 1,
          period: 2,
          start: '09:30',
          end: '10:30',
          subject: 'Data Structures',
          subjectCode: 'CSE205',
          room: 'IL101',
        },
      ],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('moved');
    expect(diffs[0].message).toContain('09:30');
  });
});
