/**
 * Test fixture: fabricated student results.
 *
 * It used to live in `src/features/exams/examService.ts`, where it was
 * bundled into the app even though nothing rendered it - the roll-number
 * search takes its records as a parameter, so the constant was only ever
 * a test fixture. Fabricated results with grades sitting in the production
 * bundle are a liability, so they live with the tests.
 */
import type { StudentResultRecord } from '../../src/features/exams/examService';

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
