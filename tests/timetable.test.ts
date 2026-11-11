import {
  computeTimetableDiff,
  Timetable,
  GBU_PERIOD_TIMES,
  parseGBUClassCode,
  buildStableSlotIds,
  Slot,
  deduplicateSlots,
} from '../src/features/timetable/timetableProvider';
import { getCurrentWeekDays } from '../src/features/timetable/schedule';

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

  // GBU publishes the same logical slot twice: once with the room and once
  // with a null room (verified on the live API, 135 such groups).
  const duplicatedSlot = (overrides: Partial<Slot> = {}): Slot => ({
    id: 'd1|p1|CSE209|IL101|PRASHANT GAURAV',
    day: 1,
    period: 1,
    start: '08:30',
    end: '09:30',
    subject: 'Operating System',
    subjectCode: 'CSE209',
    faculty: 'Prashant Gaurav',
    room: 'IL101',
    type: 'lecture',
    ...overrides,
  });

  it('reports no diffs when the same slot is published twice (one row without a room)', () => {
    const oldTimetable: Timetable = {
      classKey: 'BEE-II',
      fetchedAt: '2026-10-21T08:00:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ id: 'a', room: undefined }), duplicatedSlot({ id: 'b' })],
    };
    const newTimetable: Timetable = {
      classKey: 'BEE-II',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ id: 'a', room: undefined }), duplicatedSlot({ id: 'b' })],
    };

    expect(computeTimetableDiff(oldTimetable, newTimetable)).toEqual([]);
  });

  it('reports no diffs for a whole week that contains duplicated slots', () => {
    const slots: Slot[] = [];
    for (let day = 1; day <= 5; day++) {
      for (let period = 1; period <= 4; period++) {
        const base = duplicatedSlot({
          id: `${day}-${period}`,
          day: day as Slot['day'],
          period,
          subjectCode: `CSE${day}${period}`,
        });
        slots.push({ ...base, id: `${base.id}|a`, room: undefined });
        slots.push({ ...base, id: `${base.id}|b` });
      }
    }
    const oldTimetable: Timetable = { classKey: 'BEE-II', fetchedAt: '', semesterSessionId: '39', slots };
    const newTimetable: Timetable = {
      classKey: 'BEE-II',
      fetchedAt: '',
      semesterSessionId: '39',
      slots: slots.map((s) => ({ ...s })),
    };

    expect(computeTimetableDiff(oldTimetable, newTimetable)).toEqual([]);
  });

  it('reports exactly one room change when the room of a duplicated slot moves', () => {
    const oldTimetable: Timetable = {
      classKey: 'BEE-II',
      fetchedAt: '2026-10-21T08:00:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ id: 'a', room: undefined }), duplicatedSlot({ id: 'b', room: 'EL102' })],
    };
    const newTimetable: Timetable = {
      classKey: 'BEE-II',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ id: 'a', room: undefined }), duplicatedSlot({ id: 'b', room: 'EL103' })],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('room_changed');
    expect(diffs[0].changedField).toBe('room');
    expect(diffs[0].message).toContain('EL103');
    expect(diffs[0].message).toContain('EL102');
    expect(diffs[0].oldSlot?.room).toBe('EL102');
    expect(diffs[0].slot.room).toBe('EL103');
  });

  it('detects a teacher swap', () => {
    const oldTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:00:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ faculty: 'Prashant Gaurav' })],
    };
    const newTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ faculty: 'Dr. Arun Sharma' })],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('room_changed');
    expect(diffs[0].changedField).toBe('faculty');
    expect(diffs[0].message).toContain('teacher changed to Dr. Arun Sharma');
    expect(diffs[0].oldSlot?.faculty).toBe('Prashant Gaurav');
    expect(diffs[0].slot.faculty).toBe('Dr. Arun Sharma');
  });

  it('detects a teacher swap inside a duplicated slot without reporting the room', () => {
    const oldTimetable: Timetable = {
      classKey: 'BHP-I',
      fetchedAt: '2026-10-21T08:00:00Z',
      semesterSessionId: '39',
      slots: [
        duplicatedSlot({ id: 'a', faculty: 'Venus Dillu', room: 'VP102' }),
        duplicatedSlot({ id: 'b', faculty: 'Kallol Mondal', room: 'VP102' }),
      ],
    };
    const newTimetable: Timetable = {
      classKey: 'BHP-I',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [
        duplicatedSlot({ id: 'a', faculty: 'Venus Dillu', room: 'VP102' }),
        duplicatedSlot({ id: 'b', faculty: 'Kallol Mondal', room: 'VP103' }),
      ],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].changedField).toBe('room');
    expect(diffs[0].message).toContain('VP103');
  });

  it('detects a renamed subject and a lecture that became a lab', () => {
    const oldTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:00:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ subject: 'OS', type: 'lecture' })],
    };
    const renamed: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ subject: 'Operating System', type: 'lecture' })],
    };
    const relabelled: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ subject: 'OS', type: 'lab' })],
    };

    const subjectDiffs = computeTimetableDiff(oldTimetable, renamed);
    expect(subjectDiffs).toHaveLength(1);
    expect(subjectDiffs[0].changedField).toBe('subject');
    expect(subjectDiffs[0].message).toContain('Operating System');

    const typeDiffs = computeTimetableDiff(oldTimetable, relabelled);
    expect(typeDiffs).toHaveLength(1);
    expect(typeDiffs[0].changedField).toBe('type');
    expect(typeDiffs[0].message).toContain('lab');
  });

  it('reports an added and a removed slot for a duplicated slot that disappears', () => {
    const oldTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:00:00Z',
      semesterSessionId: '39',
      slots: [
        duplicatedSlot({ id: 'a', subjectCode: 'CSE209' }),
        duplicatedSlot({ id: 'b', subjectCode: 'CSE205', day: 2, period: 3 }),
      ],
    };
    const newTimetable: Timetable = {
      classKey: 'BCS-II B',
      fetchedAt: '2026-10-21T08:30:00Z',
      semesterSessionId: '39',
      slots: [duplicatedSlot({ id: 'a', subjectCode: 'CSE209' })],
    };

    const diffs = computeTimetableDiff(oldTimetable, newTimetable);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('removed');
    expect(diffs[0].oldSlot?.subjectCode).toBe('CSE205');
  });

  it('gives every slot a stable id that is unique inside the class', () => {
    const slots: Slot[] = [
      duplicatedSlot({ id: 'TT-1', room: undefined }),
      duplicatedSlot({ id: 'TT-2', room: undefined }),
      duplicatedSlot({ id: 'TT-3' }),
    ];
    const ids = buildStableSlotIds(slots).map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
    // The same slots always get the same ids.
    expect(buildStableSlotIds(slots).map((s) => s.id)).toEqual(ids);
    // A slot that differs in one value gets a different id.
    const changed = buildStableSlotIds([...slots, duplicatedSlot({ id: 'TT-4', room: 'EL109' })]);
    const changedIds = changed.map((s) => s.id);
    expect(changedIds[3]).not.toBe(ids[2]);
    expect(new Set(changedIds).size).toBe(changedIds.length);
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

  describe('Timetable Deduplication (deduplicateSlots)', () => {
    it('collapses duplicated slots with same (day, period, subject), keeping the roomed slot', () => {
      const roomlessSlot: Slot = {
        id: 'slot-1',
        day: 1,
        period: 1,
        start: '08:30',
        end: '09:30',
        subject: 'Operating System',
        subjectCode: 'CSE209',
        room: undefined,
        faculty: 'Prashant Gaurav',
      };

      const roomedSlot: Slot = {
        id: 'slot-2',
        day: 1,
        period: 1,
        start: '08:30',
        end: '09:30',
        subject: 'Operating System',
        subjectCode: 'CSE209',
        room: 'IL101',
        faculty: 'Prashant Gaurav',
      };

      // Roomless first, roomed second
      const result1 = deduplicateSlots([roomlessSlot, roomedSlot]);
      expect(result1).toHaveLength(1);
      expect(result1[0].room).toBe('IL101');
      expect(result1[0].subjectCode).toBe('CSE209');

      // Roomed first, roomless second
      const result2 = deduplicateSlots([roomedSlot, roomlessSlot]);
      expect(result2).toHaveLength(1);
      expect(result2[0].room).toBe('IL101');
    });

    it('treats string "null" or "undefined" as roomless and collapses to roomed slot', () => {
      const nullStringSlot: Slot = {
        id: 'slot-1',
        day: 2,
        period: 3,
        start: '10:30',
        end: '11:30',
        subject: 'Data Structures',
        subjectCode: 'CSE205',
        room: 'null',
        faculty: 'Dr. Smith',
      };

      const roomedSlot: Slot = {
        id: 'slot-2',
        day: 2,
        period: 3,
        start: '10:30',
        end: '11:30',
        subject: 'Data Structures',
        subjectCode: 'CSE205',
        room: 'IL102',
        faculty: 'Dr. Smith',
      };

      const result = deduplicateSlots([nullStringSlot, roomedSlot]);
      expect(result).toHaveLength(1);
      expect(result[0].room).toBe('IL102');
    });

    it('merges faculty and metadata from roomless duplicate if roomed slot was missing it', () => {
      const roomlessWithFaculty: Slot = {
        id: 'slot-1',
        day: 3,
        period: 2,
        start: '09:30',
        end: '10:30',
        subject: 'Computer Networks',
        subjectCode: 'CSE211',
        faculty: 'Dr. Vikas Rana',
        type: 'lecture',
      };

      const roomedWithoutFaculty: Slot = {
        id: 'slot-2',
        day: 3,
        period: 2,
        start: '09:30',
        end: '10:30',
        subject: 'Computer Networks',
        subjectCode: 'CSE211',
        room: 'EC101',
      };

      const result = deduplicateSlots([roomedWithoutFaculty, roomlessWithFaculty]);
      expect(result).toHaveLength(1);
      expect(result[0].room).toBe('EC101');
      expect(result[0].faculty).toBe('Dr. Vikas Rana');
      expect(result[0].type).toBe('lecture');
    });

    it('does not collapse slots with different periods or different days', () => {
      const p1: Slot = {
        id: 'slot-1',
        day: 1,
        period: 1,
        start: '08:30',
        end: '09:30',
        subject: 'Operating System',
        subjectCode: 'CSE209',
        room: 'IL101',
      };

      const p2: Slot = {
        id: 'slot-2',
        day: 1,
        period: 2,
        start: '09:30',
        end: '10:30',
        subject: 'Operating System',
        subjectCode: 'CSE209',
        room: undefined,
      };

      const result = deduplicateSlots([p1, p2]);
      expect(result).toHaveLength(2);
    });
  });

  describe('Week Strip Unfreezing (getCurrentWeekDays)', () => {
    it('dynamically computes Monday through Sunday for a given baseDate', () => {
      // Wednesday, October 21, 2026
      const baseDate = new Date(2026, 9, 21, 10, 0);
      const days = getCurrentWeekDays(baseDate);

      expect(days).toHaveLength(7);
      expect(days[0].label).toBe('Mon');
      expect(days[0].id).toBe(1);
      expect(days[0].date.getDate()).toBe(19);

      expect(days[2].label).toBe('Wed');
      expect(days[2].id).toBe(3);
      expect(days[2].date.getDate()).toBe(21);

      expect(days[6].label).toBe('Sun');
      expect(days[6].id).toBe(7);
      expect(days[6].date.getDate()).toBe(25);
    });

    it('updates accurately when midnight crossing advances to next week', () => {
      // Sunday, Oct 25, 2026 at 23:59
      const sundayBeforeMidnight = new Date(2026, 9, 25, 23, 59);
      const week1 = getCurrentWeekDays(sundayBeforeMidnight);
      expect(week1[0].date.getDate()).toBe(19);

      // Monday, Oct 26, 2026 at 00:01 (midnight crossing)
      const mondayAfterMidnight = new Date(2026, 9, 26, 0, 1);
      const week2 = getCurrentWeekDays(mondayAfterMidnight);
      expect(week2[0].date.getDate()).toBe(26);
      expect(week2[6].date.getDate()).toBe(1); // Nov 1
    });
  });
});
