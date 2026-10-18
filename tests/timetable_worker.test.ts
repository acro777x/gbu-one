/**
 * Unit Tests for Timetable Worker Job & Diff Pipeline
 * Per docs/ARCHITECTURE.md & docs/NOTIFICATIONS.md
 */

import {
  TimetablePollerJob,
  buildTimetableFromRawItems,
  formatTimetableChangeNotification,
} from '../worker/timetableJob';
import {
  RawGBUTimetableItem,
  Slot,
  applyDiffsToTimetable,
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
});
