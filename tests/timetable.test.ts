import {
  computeTimetableDiff,
  Timetable,
  GBU_PERIOD_TIMES,
  parseGBUClassCode,
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

  it('detects removed or cancelled classes', () => {
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
      slots: [],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('removed');
    expect(diffs[0].message).toContain('cancelled/removed');
  });

  it('detects newly added classes', () => {
    const oldTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-18T08:00:00Z',
      semesterSessionId: '39',
      slots: [],
    };

    const newTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-18T08:30:00Z',
      semesterSessionId: '39',
      slots: [
        {
          id: '10',
          day: 2,
          period: 3,
          start: '10:30',
          end: '11:30',
          subject: 'Web Technologies',
          subjectCode: 'CSE215',
          room: 'Room 102',
        },
      ],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('added');
    expect(diffs[0].message).toContain('New class added');
    expect(diffs[0].message).toContain('Web Technologies');
  });

  it('handles multi-slot subjects without false positive moves', () => {
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

    // A second lecture of CSE209 is added on Day 3 Period 2
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
          room: 'IL101',
        },
        {
          id: '2',
          day: 3,
          period: 2,
          start: '09:30',
          end: '10:30',
          subject: 'Operating System',
          subjectCode: 'CSE209',
          room: 'IL101',
        },
      ],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('added');
    expect(diffs[0].message).toContain('New class added');
  });

  it('returns empty diff when timetables are identical or both empty', () => {
    const empty1: Timetable = { classKey: 'BCS', fetchedAt: '', semesterSessionId: '39', slots: [] };
    const empty2: Timetable = { classKey: 'BCS', fetchedAt: '', semesterSessionId: '39', slots: [] };
    expect(computeTimetableDiff(empty1, empty2)).toEqual([]);
  });

  it('accurately parses SOICT class codes across CSE, ECE, and IT departments', () => {
    const bcs = parseGBUClassCode('BCS-II A');
    expect(bcs.department).toBe('CSE');
    expect(bcs.programmeCode).toBe('BCS');
    expect(bcs.year).toBe(2);
    expect(bcs.section).toBe('A');

    const bai = parseGBUClassCode('BAI-II A');
    expect(bai.department).toBe('CSE');
    expect(bai.programmeCode).toBe('BAI');
    expect(bai.programme).toContain('Artificial Intelligence');
    expect(bai.year).toBe(2);
    expect(bai.section).toBe('A');

    const cys = parseGBUClassCode('CSE-CS-II A');
    expect(cys.department).toBe('CSE');
    expect(cys.programme).toContain('Cyber Security');
    expect(cys.year).toBe(2);

    const bit = parseGBUClassCode('BIT-II A');
    expect(bit.department).toBe('IT');
    expect(bit.programmeCode).toBe('BIT');
    expect(bit.year).toBe(2);

    const bec = parseGBUClassCode('BEC-II A');
    expect(bec.department).toBe('ECE');
    expect(bec.programmeCode).toBe('BEC');
    expect(bec.year).toBe(2);

    // Formats specified in user prompt: bcs-3-second, bcs-second-a, cse-cs-second, bai-second-a
    const bcsSecondA = parseGBUClassCode('bcs-second-a');
    expect(bcsSecondA.department).toBe('CSE');
    expect(bcsSecondA.programmeCode).toBe('BCS');
    expect(bcsSecondA.year).toBe(2);
    expect(bcsSecondA.section).toBe('A');

    const bcs3Second = parseGBUClassCode('bcs-3-second');
    expect(bcs3Second.department).toBe('CSE');
    expect(bcs3Second.programmeCode).toBe('BCS');
    expect(bcs3Second.year).toBe(2); // "Dash 3 dash second represents the second year Btech cse code"

    const cseCsSecond = parseGBUClassCode('cse-cs-second');
    expect(cseCsSecond.department).toBe('CSE');
    expect(cseCsSecond.programmeCode).toBe('CSE-CS');
    expect(cseCsSecond.year).toBe(2);

    const baiSecondA = parseGBUClassCode('bai-second-a');
    expect(baiSecondA.department).toBe('CSE');
    expect(baiSecondA.programmeCode).toBe('BAI');
    expect(baiSecondA.year).toBe(2);
    expect(baiSecondA.section).toBe('A');

    const ibcs = parseGBUClassCode('IBCS-III A');
    expect(ibcs.department).toBe('CSE');
    expect(ibcs.programmeCode).toBe('IBCS');
    expect(ibcs.year).toBe(3);

    const mcs = parseGBUClassCode('MCS-I A');
    expect(mcs.department).toBe('CSE');
    expect(mcs.programmeCode).toBe('MCS');
    expect(mcs.year).toBe(1);
  });
});
