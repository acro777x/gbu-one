/**
 * GBU Timetable Provider & Diff Engine
 * Integrates with GBU schedule API (https://mygbu.in/schd/api.php?schd=39 / 40)
 * Per docs/DATA_SOURCES.md & docs/ARCHITECTURE.md
 */

export interface ClassRef {
  school: string;
  programme: string;
  programmeCode: string;
  semester: string;
  section: string;
}

export type Slot = {
  id: string;
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday ... 6 = Saturday
  period: number; // 1..10
  start: string; // e.g. "08:30"
  end: string; // e.g. "09:30"
  subject: string;
  subjectCode: string;
  faculty?: string;
  room?: string;
  type?: 'lecture' | 'lab' | 'tutorial';
  isChanged?: boolean;
  changeNote?: string;
  isCancelled?: boolean;
};

export interface Timetable {
  classKey: string;
  fetchedAt: string;
  semesterSessionId: string;
  slots: Slot[];
}

export interface TimetableDiffItem {
  type: 'added' | 'removed' | 'moved' | 'room_changed';
  slot: Slot;
  oldSlot?: Slot;
  message: string;
}

export interface TimetableProvider {
  listClasses(): Promise<ClassRef[]>;
  getTimetable(classKey: string, semesterSessionId?: string): Promise<Timetable>;
}

// Standard period time mapping for GBU
export const GBU_PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '08:30', end: '09:30' },
  2: { start: '09:30', end: '10:30' },
  3: { start: '10:30', end: '11:30' },
  4: { start: '11:30', end: '12:30' },
  5: { start: '12:30', end: '01:30' },
  6: { start: '01:30', end: '02:30' },
  7: { start: '02:30', end: '03:30' },
  8: { start: '03:30', end: '04:30' },
  9: { start: '04:30', end: '05:30' },
  10: { start: '05:30', end: '06:30' },
};

// Raw entry format from Mygbu.in/schd/api.php
export interface RawGBUTimetableItem {
  TimeTableId: string;
  TT_Day: string;
  TT_Period: string;
  CSF_Id: string;
  Room_Id: string;
  ActivityTag: string;
  RoomName: string;
  Building: string;
  Section_Id: string;
  Subject_Code: string;
  SectionName: string;
  Code: string;
  faculty_id: string;
  TeacherName: string;
  program_id: string;
  program_name: string;
  school: string;
  StudentDepartment: string;
  subject_name: string;
  abbr: string;
  subject_id: string;
  SessionId: string;
}

export class GBUTimetableProvider implements TimetableProvider {
  private baseUrl = 'https://mygbu.in/schd/api.php';
  private cachedRawData: Record<string, RawGBUTimetableItem[]> = {};

  private async fetchRawData(sessionId: string = '39'): Promise<RawGBUTimetableItem[]> {
    if (this.cachedRawData[sessionId]) {
      return this.cachedRawData[sessionId];
    }

    try {
      const response = await fetch(`${this.baseUrl}?schd=${sessionId}`, {
        headers: {
          'User-Agent': 'GBUOne-App/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch timetable: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        this.cachedRawData[sessionId] = data;
        return data;
      }
      return [];
    } catch (err) {
      console.warn('Network fetch error, falling back to mock timetable:', err);
      return MOCK_RAW_TIMETABLE;
    }
  }

  async listClasses(): Promise<ClassRef[]> {
    const raw = await this.fetchRawData('39');
    const classMap = new Map<string, ClassRef>();

    for (const item of raw) {
      const section = item.SectionName ? item.SectionName.trim() : '';
      if (!section) continue;

      if (!classMap.has(section)) {
        classMap.set(section, {
          school: item.school ? item.school.trim() : 'SOICT',
          programme: item.program_name ? item.program_name.trim() : 'B.Tech',
          programmeCode: item.Code ? item.Code.trim() : 'BCS',
          semester: section.includes('-II') ? 'II' : section.includes('-IV') ? 'IV' : 'I',
          section,
        });
      }
    }

    return Array.from(classMap.values());
  }

  async getTimetable(classKey: string, semesterSessionId: string = '39'): Promise<Timetable> {
    const raw = await this.fetchRawData(semesterSessionId);
    const filtered = raw.filter(
      (item) => item.SectionName && item.SectionName.trim().toUpperCase() === classKey.trim().toUpperCase(),
    );

    const slots: Slot[] = filtered.map((item) => {
      const periodNum = parseInt(item.TT_Period, 10) || 1;
      const timing = GBU_PERIOD_TIMES[periodNum] || { start: '08:30', end: '09:30' };
      const dayNum = (parseInt(item.TT_Day, 10) || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

      let actType: 'lecture' | 'lab' | 'tutorial' = 'lecture';
      const tagLower = (item.ActivityTag || '').toLowerCase();
      if (tagLower.includes('lab') || tagLower.includes('practical')) actType = 'lab';
      if (tagLower.includes('tut')) actType = 'tutorial';

      return {
        id: item.TimeTableId || `${item.TT_Day}-${item.TT_Period}-${item.Subject_Code}`,
        day: dayNum,
        period: periodNum,
        start: timing.start,
        end: timing.end,
        subject: item.subject_name ? item.subject_name.trim() : (item.Subject_Code || 'Class'),
        subjectCode: item.Subject_Code ? item.Subject_Code.trim() : '',
        faculty: item.TeacherName ? item.TeacherName.trim() : undefined,
        room: item.RoomName ? item.RoomName.trim() : undefined,
        type: actType,
      };
    });

    return {
      classKey,
      fetchedAt: new Date().toISOString(),
      semesterSessionId,
      slots,
    };
  }
}

/**
 * Computes structured diffs between old and new timetable snapshots
 * Per docs/ARCHITECTURE.md section "Timetable change detection"
 */
export function computeTimetableDiff(
  oldTimetable: Timetable,
  newTimetable: Timetable,
): TimetableDiffItem[] {
  const diffs: TimetableDiffItem[] = [];

  const remainingOldSlots = [...oldTimetable.slots];
  const remainingNewSlots = [...newTimetable.slots];

  // 1. Match unchanged day & period for the same subject
  for (let i = remainingNewSlots.length - 1; i >= 0; i--) {
    const newSlot = remainingNewSlots[i];
    const oldIdx = remainingOldSlots.findIndex((os) => {
      const sameSubject =
        os.subjectCode && newSlot.subjectCode
          ? os.subjectCode.toUpperCase() === newSlot.subjectCode.toUpperCase()
          : os.subject.toLowerCase() === newSlot.subject.toLowerCase();
      return os.day === newSlot.day && os.period === newSlot.period && sameSubject;
    });

    if (oldIdx !== -1) {
      const oldSlot = remainingOldSlots[oldIdx];
      const oldRoom = (oldSlot.room || '').trim();
      const newRoom = (newSlot.room || '').trim();
      if (oldRoom !== newRoom && (oldRoom || newRoom)) {
        diffs.push({
          type: 'room_changed',
          slot: newSlot,
          oldSlot,
          message: `${newSlot.subject} room changed to ${newRoom || 'Room TBD'} (was ${oldRoom || 'TBD'})`,
        });
      }
      remainingOldSlots.splice(oldIdx, 1);
      remainingNewSlots.splice(i, 1);
    }
  }

  // 2. Match moved classes (same subject, different day or period)
  for (let i = remainingNewSlots.length - 1; i >= 0; i--) {
    const newSlot = remainingNewSlots[i];
    const oldIdx = remainingOldSlots.findIndex((os) => {
      return os.subjectCode && newSlot.subjectCode
        ? os.subjectCode.toUpperCase() === newSlot.subjectCode.toUpperCase()
        : os.subject.toLowerCase() === newSlot.subject.toLowerCase();
    });

    if (oldIdx !== -1) {
      const oldSlot = remainingOldSlots[oldIdx];
      diffs.push({
        type: 'moved',
        slot: newSlot,
        oldSlot,
        message: `${newSlot.subject} moved to Day ${newSlot.day} at ${newSlot.start} (${newSlot.room || 'Room TBD'})`,
      });
      remainingOldSlots.splice(oldIdx, 1);
      remainingNewSlots.splice(i, 1);
    }
  }

  // 3. Any remaining new slots are newly added
  for (const newSlot of remainingNewSlots) {
    diffs.push({
      type: 'added',
      slot: newSlot,
      message: `New class added: ${newSlot.subject} at ${newSlot.start} (${newSlot.room || 'Room TBD'})`,
    });
  }

  // 4. Any remaining old slots are cancelled / removed
  for (const oldSlot of remainingOldSlots) {
    diffs.push({
      type: 'removed',
      slot: oldSlot,
      oldSlot,
      message: `${oldSlot.subject} on Day ${oldSlot.day} at ${oldSlot.start} was cancelled/removed`,
    });
  }

  return diffs;
}

/**
 * Applies detected diffs to a timetable snapshot, marking changed slots with isChanged and changeNote
 */
export function applyDiffsToTimetable(
  timetable: Timetable,
  diffs: TimetableDiffItem[],
): Timetable {
  if (!diffs || diffs.length === 0) return timetable;

  const changedSlotNotes = new Map<string, string>();
  const removedSlots: Slot[] = [];

  for (const d of diffs) {
    if (d.type === 'removed' && d.slot) {
      removedSlots.push({
        ...d.slot,
        id: `cancelled_${d.slot.id}`,
        isChanged: true,
        isCancelled: true,
        changeNote: d.message,
      });
    } else if (d.slot) {
      changedSlotNotes.set(d.slot.id, d.message);
    }
  }

  const updatedSlots = timetable.slots.map((slot) => {
    const note = changedSlotNotes.get(slot.id);
    if (note) {
      return {
        ...slot,
        isChanged: true,
        changeNote: note,
      };
    }
    return slot;
  });

  return {
    ...timetable,
    slots: [...updatedSlots, ...removedSlots],
  };
}

// Fallback mock timetable data matching GBU BCS-II B
export const MOCK_RAW_TIMETABLE: RawGBUTimetableItem[] = [
  {
    TimeTableId: '23001',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19568',
    Room_Id: '208',
    ActivityTag: 'Lecture',
    RoomName: 'IL101',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'CSE209',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2690',
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
    TimeTableId: '23002',
    TT_Day: '1',
    TT_Period: '2',
    CSF_Id: '19569',
    Room_Id: '208',
    ActivityTag: 'Lecture',
    RoomName: 'IL101',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'CSE205',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2691',
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
  {
    TimeTableId: '23003',
    TT_Day: '1',
    TT_Period: '3',
    CSF_Id: '19570',
    Room_Id: '208',
    ActivityTag: 'Lecture',
    RoomName: 'IL101',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'BAS201',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2692',
    TeacherName: 'Dr. Neha Gupta',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Discrete Mathematics',
    abbr: 'NG',
    subject_id: '15116',
    SessionId: '39',
  },
  {
    TimeTableId: '23004',
    TT_Day: '1',
    TT_Period: '6',
    CSF_Id: '19571',
    Room_Id: 'LAB02',
    ActivityTag: 'Lab',
    RoomName: 'Lab 2',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'CSE211',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2690',
    TeacherName: 'Prashant Gaurav',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'OS Lab',
    abbr: 'PG',
    subject_id: '15117',
    SessionId: '39',
  },
];
