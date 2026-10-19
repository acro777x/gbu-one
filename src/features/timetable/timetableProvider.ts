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

export interface ParsedClassCode {
  original: string;
  department: 'CSE' | 'ECE' | 'IT' | string;
  departmentName: string;
  programme: string;
  programmeCode: string;
  year: number;
  yearLabel: string;
  semesterRoman: string;
  section: string;
  displayName: string;
}

/**
 * Maps raw GBU class codes (e.g. BCS-II A, BAI-II A, CSE-CS-II A, BIT-II A, BEC-II A)
 * to structured department, programme, year, and section information.
 */
export function parseGBUClassCode(rawCode: string): ParsedClassCode {
  const code = (rawCode || '').trim();
  const upper = code.toUpperCase();

  let department: 'CSE' | 'ECE' | 'IT' | string = 'CSE';
  let departmentName = 'Computer Science & Engineering';
  let programme = 'B.Tech (Computer Science & Engineering)';
  let programmeCode = 'BCS';

  if (upper.includes('BEC') || upper.startsWith('ECE')) {
    department = 'ECE';
    departmentName = 'Electronics & Communication Engineering';
    programme = 'B.Tech (Electronics & Communication Engineering)';
    programmeCode = 'BEC';
  } else if (upper.includes('BIT') || upper.startsWith('IT')) {
    department = 'IT';
    departmentName = 'Information Technology';
    programme = 'B.Tech (Information Technology)';
    programmeCode = 'BIT';
  } else if (upper.includes('BAI')) {
    department = 'CSE';
    departmentName = 'Computer Science & Engineering';
    programme = 'B.Tech (Artificial Intelligence)';
    programmeCode = 'BAI';
  } else if (upper.includes('CSE-CS') || upper.includes('BCS-CS')) {
    department = 'CSE';
    departmentName = 'Computer Science & Engineering';
    programme = 'B.Tech CSE (Cyber Security)';
    programmeCode = 'CSE-CS';
  } else if (upper.includes('CSE-DS') || upper.includes('BCS-DS')) {
    department = 'CSE';
    departmentName = 'Computer Science & Engineering';
    programme = 'B.Tech CSE (Data Science)';
    programmeCode = 'CSE-DS';
  } else if (upper.includes('IBCS')) {
    department = 'CSE';
    departmentName = 'Computer Science & Engineering';
    programme = 'Integrated B.Tech + M.Tech (CSE)';
    programmeCode = 'IBCS';
  } else if (upper.includes('MCS')) {
    department = 'CSE';
    departmentName = 'Computer Science & Engineering';
    programme = 'M.Tech (Computer Science & Engineering)';
    programmeCode = 'MCS';
  }

  // Parse Year / Semester
  let year = 2;
  let yearLabel = '2nd Year';
  let semesterRoman = 'II';

  // Check explicit named year / roman numeral terms first to avoid collisions with batch prefixes (e.g. -3-second)
  if (upper.includes('FOURTH') || upper.includes('4TH') || upper.includes('FINAL') || upper.includes('-IV') || upper.includes('/IV')) {
    year = 4;
    yearLabel = '4th Year';
    semesterRoman = 'IV';
  } else if (upper.includes('THIRD') || upper.includes('3RD') || upper.includes('-III') || upper.includes('/III')) {
    year = 3;
    yearLabel = '3rd Year';
    semesterRoman = 'III';
  } else if (upper.includes('SECOND') || upper.includes('2ND') || upper.includes('-II') || upper.includes('/II')) {
    year = 2;
    yearLabel = '2nd Year';
    semesterRoman = 'II';
  } else if (upper.includes('FIRST') || upper.includes('1ST') || upper.includes('-I') || upper.includes('/I')) {
    year = 1;
    yearLabel = '1st Year';
    semesterRoman = 'I';
  } else if (upper.includes('-4') || upper.includes('/4') || upper.includes(' 4')) {
    year = 4;
    yearLabel = '4th Year';
    semesterRoman = 'IV';
  } else if (upper.includes('-3') || upper.includes('/3') || upper.includes(' 3')) {
    year = 3;
    yearLabel = '3rd Year';
    semesterRoman = 'III';
  } else if (upper.includes('-2') || upper.includes('/2') || upper.includes(' 2')) {
    year = 2;
    yearLabel = '2nd Year';
    semesterRoman = 'II';
  } else if (upper.includes('-1') || upper.includes('/1') || upper.includes(' 1')) {
    year = 1;
    yearLabel = '1st Year';
    semesterRoman = 'I';
  }

  // Parse Section (e.g. " A", "-A", "-SEC-A", " (A)")
  let section = 'A';
  const secMatch = upper.match(/(?:[\s\-_/([]*(?:SEC|SECTION)?[\s\-_:]*|[-_])([A-D])[)\]]?$/);
  if (secMatch) {
    section = secMatch[1];
  }

  const displayName = `${programme} ${yearLabel} (Sec ${section})`;

  return {
    original: code,
    department,
    departmentName,
    programme,
    programmeCode,
    year,
    yearLabel,
    semesterRoman,
    section,
    displayName,
  };
}

export class GBUTimetableProvider implements TimetableProvider {
  private baseUrl = 'https://mygbu.in/schd/api.php';
  private cachedRawData: Record<string, RawGBUTimetableItem[]> = {};

  private async fetchRawData(sessionId: string = '39'): Promise<RawGBUTimetableItem[]> {
    if (this.cachedRawData[sessionId]) {
      return this.cachedRawData[sessionId];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(`${this.baseUrl}?schd=${sessionId}`, {
        headers: {
          'User-Agent': 'GBUOne-App/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch timetable: ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        this.cachedRawData[sessionId] = data;
        return data;
      }
      return MOCK_RAW_TIMETABLE;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Network fetch error or timeout, falling back to mock timetable:', err);
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
        const parsed = parseGBUClassCode(section);
        classMap.set(section, {
          school: item.school ? item.school.trim() : 'SOICT',
          programme: parsed.programme,
          programmeCode: parsed.programmeCode,
          semester: parsed.semesterRoman,
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

    const targetList = filtered.length > 0 ? filtered : raw.filter((item) => (item.SectionName || '').includes('BCS'));

    const slots: Slot[] = targetList.map((item, idx) => {
      const periodNum = parseInt(item.TT_Period, 10) || 1;
      const timing = GBU_PERIOD_TIMES[periodNum] || { start: '08:30', end: '09:30' };
      const dayNum = (parseInt(item.TT_Day, 10) || 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;

      let actType: 'lecture' | 'lab' | 'tutorial' = 'lecture';
      const tagLower = (item.ActivityTag || '').toLowerCase();
      if (tagLower.includes('lab') || tagLower.includes('practical')) actType = 'lab';
      if (tagLower.includes('tut')) actType = 'tutorial';

      const rawId = item.TimeTableId && item.TimeTableId !== '0' ? item.TimeTableId : null;
      const uniqueId = rawId
        ? `tt_${rawId}_${idx}`
        : `tt_d${dayNum}_p${periodNum}_${item.Subject_Code || 'cls'}_${idx}`;

      return {
        id: uniqueId,
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
  // B.Tech CSE 2nd Year Sec A (BCS-II A)
  {
    TimeTableId: '23101',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19601',
    Room_Id: '207',
    ActivityTag: 'Lecture',
    RoomName: 'IL102',
    Building: 'SOICT',
    Section_Id: '1298',
    Subject_Code: 'CSE205',
    SectionName: 'BCS-II A',
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
    TimeTableId: '23102',
    TT_Day: '1',
    TT_Period: '2',
    CSF_Id: '19602',
    Room_Id: '207',
    ActivityTag: 'Lecture',
    RoomName: 'IL102',
    Building: 'SOICT',
    Section_Id: '1298',
    Subject_Code: 'CSE209',
    SectionName: 'BCS-II A',
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
  // B.Tech AI 2nd Year Sec A (BAI-II A)
  {
    TimeTableId: '23201',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19701',
    Room_Id: '210',
    ActivityTag: 'Lecture',
    RoomName: 'IL105',
    Building: 'SOICT',
    Section_Id: '1301',
    Subject_Code: 'AI201',
    SectionName: 'BAI-II A',
    Code: 'BAI',
    faculty_id: '2701',
    TeacherName: 'Dr. Rajesh Kumar',
    program_id: '1090',
    program_name: 'B.Tech (AI)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Foundations of Artificial Intelligence',
    abbr: 'RK',
    subject_id: '15201',
    SessionId: '39',
  },
  {
    TimeTableId: '23202',
    TT_Day: '1',
    TT_Period: '2',
    CSF_Id: '19702',
    Room_Id: '210',
    ActivityTag: 'Lecture',
    RoomName: 'IL105',
    Building: 'SOICT',
    Section_Id: '1301',
    Subject_Code: 'AI203',
    SectionName: 'BAI-II A',
    Code: 'BAI',
    faculty_id: '2702',
    TeacherName: 'Dr. Priya Singhal',
    program_id: '1090',
    program_name: 'B.Tech (AI)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Machine Learning Fundamentals',
    abbr: 'PS',
    subject_id: '15202',
    SessionId: '39',
  },
  {
    TimeTableId: '23203',
    TT_Day: '1',
    TT_Period: '3',
    CSF_Id: '19703',
    Room_Id: 'LAB05',
    ActivityTag: 'Lab',
    RoomName: 'AI & Robotics Lab',
    Building: 'SOICT',
    Section_Id: '1301',
    Subject_Code: 'AI211',
    SectionName: 'BAI-II A',
    Code: 'BAI',
    faculty_id: '2701',
    TeacherName: 'Dr. Rajesh Kumar',
    program_id: '1090',
    program_name: 'B.Tech (AI)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'AI Programming Lab',
    abbr: 'RK',
    subject_id: '15203',
    SessionId: '39',
  },
  // B.Tech CSE Cyber Security 2nd Year (CSE-CS-II A)
  {
    TimeTableId: '23301',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19801',
    Room_Id: '212',
    ActivityTag: 'Lecture',
    RoomName: 'IL108',
    Building: 'SOICT',
    Section_Id: '1305',
    Subject_Code: 'CYS201',
    SectionName: 'CSE-CS-II A',
    Code: 'CSE-CS',
    faculty_id: '2710',
    TeacherName: 'Dr. Amit Verma',
    program_id: '1092',
    program_name: 'B.Tech (CSE - Cyber Security)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Information Security & Cryptography',
    abbr: 'AV',
    subject_id: '15301',
    SessionId: '39',
  },
  // B.Tech IT 2nd Year (BIT-II A)
  {
    TimeTableId: '23401',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19901',
    Room_Id: '215',
    ActivityTag: 'Lecture',
    RoomName: 'IL201',
    Building: 'SOICT',
    Section_Id: '1310',
    Subject_Code: 'IT201',
    SectionName: 'BIT-II A',
    Code: 'BIT',
    faculty_id: '2720',
    TeacherName: 'Dr. Sandeep Sharma',
    program_id: '1095',
    program_name: 'B.Tech (IT)',
    school: 'SOICT',
    StudentDepartment: 'IT',
    subject_name: 'Web Technologies & Frameworks',
    abbr: 'SS',
    subject_id: '15401',
    SessionId: '39',
  },
  // B.Tech ECE 2nd Year (BEC-II A)
  {
    TimeTableId: '23501',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '20001',
    Room_Id: '302',
    ActivityTag: 'Lecture',
    RoomName: 'EC101',
    Building: 'SOICT',
    Section_Id: '1320',
    Subject_Code: 'ECE201',
    SectionName: 'BEC-II A',
    Code: 'BEC',
    faculty_id: '2730',
    TeacherName: 'Dr. Vikas Rana',
    program_id: '1100',
    program_name: 'B.Tech (ECE)',
    school: 'SOICT',
    StudentDepartment: 'ECE',
    subject_name: 'Signals and Systems',
    abbr: 'VR',
    subject_id: '15501',
    SessionId: '39',
  },
];
