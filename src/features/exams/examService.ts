/**
 * GBU One — Exam Hub & On-Device Result Finder Engine
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

export interface DatesheetEntry {
  id: string;
  programmeCode: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  examDate: string; // ISO date
  examTime: string; // e.g. "09:30 - 12:30"
  shift: 'Morning' | 'Evening';
  roomBlock?: string;
}

export interface StudentResultRecord {
  rollNo: string;
  studentName: string;
  programme: string;
  semester: string;
  sgpa: number;
  cgpa: number;
  status: 'PASS' | 'PCP' | 'FAIL';
  grades: Array<{
    subjectCode: string;
    subjectName: string;
    credits: number;
    grade: string;
  }>;
}

export const MOCK_DATESHEET: DatesheetEntry[] = [
  {
    id: 'ds_1',
    programmeCode: 'BCS',
    semester: 'II',
    subjectCode: 'CSE205',
    subjectName: 'Data Structures & Algorithms',
    examDate: '2026-11-03T04:00:00.000Z',
    examTime: '09:30 AM - 12:30 PM',
    shift: 'Morning',
    roomBlock: 'SOICT Block B',
  },
  {
    id: 'ds_2',
    programmeCode: 'BCS',
    semester: 'II',
    subjectCode: 'CSE209',
    subjectName: 'Operating Systems',
    examDate: '2026-11-05T04:00:00.000Z',
    examTime: '09:30 AM - 12:30 PM',
    shift: 'Morning',
    roomBlock: 'SOICT Block B',
  },
  {
    id: 'ds_3',
    programmeCode: 'BCS',
    semester: 'II',
    subjectCode: 'BAS201',
    subjectName: 'Discrete Mathematics',
    examDate: '2026-11-07T04:00:00.000Z',
    examTime: '09:30 AM - 12:30 PM',
    shift: 'Morning',
    roomBlock: 'SOICT Block A',
  },
  {
    id: 'ds_4',
    programmeCode: 'BCS',
    semester: 'II',
    subjectCode: 'CSE211',
    subjectName: 'Database Management Systems',
    examDate: '2026-11-10T04:00:00.000Z',
    examTime: '09:30 AM - 12:30 PM',
    shift: 'Morning',
    roomBlock: 'SOICT Block B',
  },
];

export const MOCK_STUDENT_RESULTS: StudentResultRecord[] = [
  {
    rollNo: '22/ICS/042',
    studentName: 'Aarav Sharma',
    programme: 'B.Tech CS',
    semester: 'Semester II',
    sgpa: 8.45,
    cgpa: 8.2,
    status: 'PASS',
    grades: [
      { subjectCode: 'CSE205', subjectName: 'Data Structures', credits: 4, grade: 'A' },
      { subjectCode: 'CSE209', subjectName: 'Operating Systems', credits: 4, grade: 'A+' },
      { subjectCode: 'BAS201', subjectName: 'Discrete Mathematics', credits: 4, grade: 'B+' },
      { subjectCode: 'CSE211', subjectName: 'DBMS Lab', credits: 2, grade: 'O' },
    ],
  },
  {
    rollNo: '22/ICS/015',
    studentName: 'Priya Verma',
    programme: 'B.Tech CS',
    semester: 'Semester II',
    sgpa: 9.1,
    cgpa: 8.95,
    status: 'PASS',
    grades: [
      { subjectCode: 'CSE205', subjectName: 'Data Structures', credits: 4, grade: 'O' },
      { subjectCode: 'CSE209', subjectName: 'Operating Systems', credits: 4, grade: 'A+' },
      { subjectCode: 'BAS201', subjectName: 'Discrete Mathematics', credits: 4, grade: 'A' },
      { subjectCode: 'CSE211', subjectName: 'DBMS Lab', credits: 2, grade: 'O' },
    ],
  },
  {
    rollNo: '22/ICS/088',
    studentName: 'Rohan Gupta',
    programme: 'B.Tech CS',
    semester: 'Semester II',
    sgpa: 6.8,
    cgpa: 7.1,
    status: 'PCP',
    grades: [
      { subjectCode: 'CSE205', subjectName: 'Data Structures', credits: 4, grade: 'B' },
      { subjectCode: 'CSE209', subjectName: 'Operating Systems', credits: 4, grade: 'F' },
      { subjectCode: 'BAS201', subjectName: 'Discrete Mathematics', credits: 4, grade: 'B' },
      { subjectCode: 'CSE211', subjectName: 'DBMS Lab', credits: 2, grade: 'A' },
    ],
  },
];

export function normalizeRollNumber(val: string): string {
  return val
    .trim()
    .toUpperCase()
    .replace(/[\s.\-_/]+/g, '/')
    .replace(/^\/|\/$/g, '');
}

/**
 * On-device roll number search engine
 * Per docs/ARCHITECTURE.md section 5:
 * Searching happens entirely on-device; roll number is NEVER sent to server
 */
export function searchRollNumberResult(
  rollNo: string,
  records: StudentResultRecord[] = MOCK_STUDENT_RESULTS,
): StudentResultRecord | null {
  const cleanRoll = normalizeRollNumber(rollNo);
  if (!cleanRoll) return null;
  const match = records.find(
    (r) => normalizeRollNumber(r.rollNo) === cleanRoll,
  );
  return match || null;
}

/**
 * Calculates countdown days until exam date
 */
export function calculateExamCountdown(targetDateStr: string): number {
  const target = new Date(targetDateStr).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
