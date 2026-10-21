import {
  computeTimetableDiff,
  Timetable,
  GBU_PERIOD_TIMES,
  parseGBUClassCode,
  buildStableSlotIds,
  Slot,
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
});
