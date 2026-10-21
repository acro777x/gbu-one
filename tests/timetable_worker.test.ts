/**
 * Unit Tests for Timetable Worker Job & Diff Pipeline
 * Per docs/ARCHITECTURE.md & docs/NOTIFICATIONS.md
 */

const mockLimit = jest.fn();
const mockSelect = jest.fn(() => ({ limit: mockLimit }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockSupabaseClient = { from: mockFrom };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

import {
  TimetablePollerJob,
  buildTimetableFromRawItems,
  buildTimetableHash,
  computeChangeKey,
  formatTimetableChangeNotification,
} from '../worker/timetableJob';
import {
  fetchTimetableSnapshots,
  readTimetableSnapshots,
} from '../worker/supabaseClient';
import {
  RawGBUTimetableItem,
  Slot,
  applyDiffsToTimetable,
  computeTimetableDiff,
} from '../src/features/timetable/timetableProvider';

describe('Timetable Worker Job & Diff Pipeline', () => {
  const sampleRawItems: RawGBUTimetableItem[] = [
    {
      TimeTableId: '101',
      TT_Day: '1',
      TT_Period: '1',
      CSF_Id: '1001',
      Room_Id: '201',
      ActivityTag: 'Lecture',
      RoomName: 'IL101',
      Building: 'SOICT',
      Section_Id: '1299',
      Subject_Code: 'CSE209',
      SectionName: 'BCS-II B',
      Code: 'BCS',
      faculty_id: '1',
      TeacherName: 'Prashant Gaurav',
      program_id: '1088',
      program_name: 'B.Tech (CS)',
      school: 'SOICT',
      StudentDepartment: 'CSE',
      subject_name: 'Operating System',
      abbr: 'PG',
      subject_id: '15114',
      SessionId: '39',
    },
    {
      TimeTableId: '102',
      TT_Day: '1',
      TT_Period: '2',
      CSF_Id: '1002',
      Room_Id: '202',
      ActivityTag: 'Lecture',
      RoomName: 'IL102',
      Building: 'SOICT',
      Section_Id: '1299',
      Subject_Code: 'CSE205',
      SectionName: 'BCS-II B',
      Code: 'BCS',
      faculty_id: '2',
      TeacherName: 'Dr. Arun Sharma',
      program_id: '1088',
      program_name: 'B.Tech (CS)',
      school: 'SOICT',
      StudentDepartment: 'CSE',
      subject_name: 'Data Structures & Algorithms',
      abbr: 'AS',
      subject_id: '15115',
      SessionId: '39',
    },
  ];

  it('builds canonical timetable from raw items correctly', () => {
    const timetable = buildTimetableFromRawItems('BCS-II B', sampleRawItems, '39');
    expect(timetable.classKey).toBe('BCS-II B');
    expect(timetable.semesterSessionId).toBe('39');
    expect(timetable.slots).toHaveLength(2);

    const osSlot = timetable.slots.find((s) => s.subjectCode === 'CSE209');
    expect(osSlot).toBeDefined();
    expect(osSlot?.room).toBe('IL101');
    expect(osSlot?.start).toBe('08:30');
    expect(osSlot?.type).toBe('lecture');
  });

  it('formats single room-changed and moved notifications concisely', () => {
    const movedSlot: Slot = {
      id: '102',
      day: 2,
      period: 3,
      start: '10:30',
      end: '11:30',
      subject: 'Data Structures & Algorithms',
      subjectCode: 'CSE205',
      room: 'IL204',
    };

    const notification = formatTimetableChangeNotification('BCS-II B', [
      {
        type: 'moved',
        slot: movedSlot,
        message: 'Data Structures moved to Day 2 at 10:30 (IL204)',
      },
    ]);

    expect(notification).toContain('Data Structures & Algorithms moved to Day 2 at 10:30');
  });

  it('detects diffs when worker polls two consecutive snapshots', async () => {
    const job = new TimetablePollerJob();

    // 1. First run: establish snapshot baseline
    const initialRun = await job.pollAndComputeDiffs({
      '39': sampleRawItems,
      '40': [],
    });
    expect(initialRun.changedClassesCount).toBe(0);

    // 2. Second run: change room of Operating System to IL108 and add a 3rd class
    const updatedRawItems: RawGBUTimetableItem[] = [
      {
        ...sampleRawItems[0],
        RoomName: 'IL108',
      },
      sampleRawItems[1],
      {
        TimeTableId: '103',
        TT_Day: '1',
        TT_Period: '3',
        CSF_Id: '1003',
        Room_Id: 'LAB01',
        ActivityTag: 'Lab',
        RoomName: 'Lab 1',
        Building: 'SOICT',
        Section_Id: '1299',
        Subject_Code: 'CSE211',
        SectionName: 'BCS-II B',
        Code: 'BCS',
        faculty_id: '3',
        TeacherName: 'Lab Instructor',
        program_id: '1088',
        program_name: 'B.Tech (CS)',
        school: 'SOICT',
        StudentDepartment: 'CSE',
        subject_name: 'Database Lab',
        abbr: 'LI',
        subject_id: '15116',
        SessionId: '39',
      },
    ];

    const diffRun = await job.pollAndComputeDiffs({
      '39': updatedRawItems,
      '40': [],
    });

    expect(diffRun.changedClassesCount).toBe(1);
    const change = diffRun.changes[0];
    expect(change.classKey).toBe('BCS-II B');
    expect(change.diffCount).toBe(2); // 1 room change + 1 added
    expect(change.notificationMessage).toContain('BCS-II B: 2 schedule updates on Monday');
  });

  it('marks cancelled slots as isCancelled and isChanged when applying diffs', () => {
    const tOld = buildTimetableFromRawItems('BCS-II B', sampleRawItems, '39');
    // Drop the second slot (simulating class cancellation)
    const tNew = buildTimetableFromRawItems('BCS-II B', [sampleRawItems[0]], '39');

    const diffs = [
      {
        type: 'removed' as const,
        slot: tOld.slots[1],
        oldSlot: tOld.slots[1],
        message: 'Data Structures & Algorithms was cancelled',
      },
    ];

    const decorated = applyDiffsToTimetable(tNew, diffs);
    expect(decorated.slots).toHaveLength(2);
    const cancelledSlot = decorated.slots.find((s: Slot) => s.isCancelled);
    expect(cancelledSlot).toBeDefined();
    expect(cancelledSlot?.isChanged).toBe(true);
    expect(cancelledSlot?.changeNote).toContain('Data Structures & Algorithms was cancelled');
  });

  // GBU publishes the same logical slot twice - once with the room and once
  // with a null room. The worker used to compare the rows positionally and
  // reported a "room changed" for every one of them on every poll.
  const duplicateRowItems: RawGBUTimetableItem[] = [
    {
      ...sampleRawItems[0],
      TimeTableId: '23001',
      TTId: '189605',
      Room_Id: '0',
      RoomName: null as unknown as string,
      SessionId: '39',
    },
    {
      ...sampleRawItems[0],
      TimeTableId: '23001',
      TTId: '175150',
      Room_Id: '250',
      RoomName: 'EL102        ',
      SessionId: '39',
    },
    sampleRawItems[1],
  ];

  it('reports no diffs when the university repeats a slot with a null room', () => {
    const before = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const after = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');

    expect(before.slots.length).toBe(3);
    expect(computeTimetableDiff(before, after)).toEqual([]);
  });

  it('reports one room change and one teacher change when the university edits a slot', () => {
    const before = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const edited = duplicateRowItems.map((item) =>
      item.TTId === '175150'
        ? { ...item, RoomName: 'EL103        ', TeacherName: 'Dr. Arun Sharma' }
        : item,
    );
    const after = buildTimetableFromRawItems('BCS-II B', edited, '39');

    const diffs = computeTimetableDiff(before, after);
    expect(diffs).toHaveLength(2);
    const roomDiff = diffs.find((d) => d.changedField === 'room');
    const teacherDiff = diffs.find((d) => d.changedField === 'faculty');
    expect(roomDiff?.message).toContain('EL103');
    expect(roomDiff?.oldSlot?.room).toBe('EL102');
    expect(teacherDiff?.message).toContain('Dr. Arun Sharma');
    expect(teacherDiff?.oldSlot?.faculty).toBe('Prashant Gaurav');
  });

  it('gives every slot an id that is unique inside the section and stable across polls', () => {
    const first = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const second = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');

    const ids = first.slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.slots.map((s) => s.id)).toEqual(ids);
    // `TimeTableId` is the same constant on every published row.
    expect(ids.every((id) => id !== '23001')).toBe(true);
  });

  it('changes the stored hash when the teacher of a slot changes', () => {
    const before = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const swapped = duplicateRowItems.map((item) =>
      item.TTId === '175150' ? { ...item, TeacherName: 'Dr. Arun Sharma' } : item,
    );
    const after = buildTimetableFromRawItems('BCS-II B', swapped, '39');

    expect(buildTimetableHash(before)).not.toBe(buildTimetableHash(after));
  });

  it('gives a teacher swap its own change key', () => {
    const before = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const swapped = duplicateRowItems.map((item) =>
      item.TTId === '175150' ? { ...item, TeacherName: 'Dr. Arun Sharma' } : item,
    );
    const after = buildTimetableFromRawItems('BCS-II B', swapped, '39');
    const moved = duplicateRowItems.map((item) =>
      item.TTId === '175150' ? { ...item, RoomName: 'EL103        ' } : item,
    );
    const afterMove = buildTimetableFromRawItems('BCS-II B', moved, '39');

    const teacherKey = computeChangeKey('BCS-II B', '39', computeTimetableDiff(before, after));
    const roomKey = computeChangeKey('BCS-II B', '39', computeTimetableDiff(before, afterMove));
    expect(teacherKey).not.toBe(roomKey);
  });

  it('uses only the rows of the requested session', () => {
    const session39 = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const session40 = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '40');

    expect(session39.slots.length).toBe(3);
    // The API ignores `schd=40` and answers with the rows of session 39.
    expect(session40.slots.length).toBe(0);
  });

  it('reports a session without rows of its own instead of storing a copy of it', async () => {
    const job = new TimetablePollerJob();
    const run = await job.pollAndComputeDiffs({
      '39': duplicateRowItems,
      '40': duplicateRowItems,
    });

    expect(run.emptySessions).toEqual(['40']);
    expect(run.failedSessions).toEqual([]);
    // One class of session 39 - session 40 is not counted a second time.
    expect(run.totalClassesScanned).toBe(1);
    expect(run.changedClassesCount).toBe(0);

    const storedKeys = [...job.getSnapshots().keys()];
    expect(storedKeys).toEqual(['BCS-II B#39']);
    expect(storedKeys.some((key) => key.endsWith('#40'))).toBe(false);
  });

  it('drops a phantom snapshot of a session that has no rows of its own', async () => {
    // A snapshot stored by the old bug: session 40 held a copy of session 39.
    const phantom = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '40');
    const job = new TimetablePollerJob(
      new Map([
        ['BCS-II B#39', buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39')],
        ['BCS-II B#40', phantom],
      ]),
    );

    await job.pollAndComputeDiffs({ '39': duplicateRowItems, '40': duplicateRowItems });

    expect([...job.getSnapshots().keys()]).toEqual(['BCS-II B#39']);
  });

  it('aborts the poll and keeps the stored snapshot when the baseline cannot be read', async () => {
    const job = new TimetablePollerJob();
    job.markBaselineUnavailable('supabase read failed: connection timeout');

    const run = await job.pollAndComputeDiffs({ '39': duplicateRowItems, '40': [] });

    expect(run.aborted).toBe(true);
    expect(run.abortReason).toContain('connection timeout');
    expect(run.baselineLoaded).toBe(false);
    expect(run.changes).toHaveLength(0);
    expect(run.totalClassesScanned).toBe(0);
    // Nothing was written, so the stored baseline survives the failure.
    expect(job.getSnapshots().size).toBe(0);
  });

  it('formats a teacher change as a teacher change', () => {
    const before = buildTimetableFromRawItems('BCS-II B', duplicateRowItems, '39');
    const swapped = duplicateRowItems.map((item) =>
      item.TTId === '175150' ? { ...item, TeacherName: 'Dr. Arun Sharma' } : item,
    );
    const after = buildTimetableFromRawItems('BCS-II B', swapped, '39');

    const message = formatTimetableChangeNotification(
      'BCS-II B',
      computeTimetableDiff(before, after),
    );
    expect(message).toContain('teacher changed to Dr. Arun Sharma');
  });
});

describe('Timetable snapshot baseline', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    };
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockLimit.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('treats an empty table as a cold start', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const read = await readTimetableSnapshots();

    expect(read.ok).toBe(true);
    expect(read.snapshots.size).toBe(0);
    expect(read.error).toBeNull();
  });

  it('loads the stored snapshots', async () => {
    mockLimit.mockResolvedValue({
      data: [{ class_key: 'BCS-II B', hash: 'abc123', payload: { sessions: {} } }],
      error: null,
    });

    const read = await readTimetableSnapshots();

    expect(read.ok).toBe(true);
    expect(read.snapshots.get('BCS-II B')?.hash).toBe('abc123');
  });

  it('reports a failed read instead of pretending the table is empty', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

    const read = await readTimetableSnapshots();

    expect(read.ok).toBe(false);
    expect(read.error).toContain('connection refused');
    expect(read.snapshots.size).toBe(0);
  });

  it('refuses to hand out a baseline that could not be read', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

    await expect(fetchTimetableSnapshots()).rejects.toThrow('connection refused');
  });
});
