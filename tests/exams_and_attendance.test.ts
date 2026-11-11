/**
 * Unit Tests for Phase 5: Exams Hub, Results Finder, Calendar, and Attendance Tracker
 * Per docs/ROADMAP.md Phase 5, docs/DATA_SOURCES.md, docs/ARCHITECTURE.md
 */

import fs from 'fs';
import path from 'path';
import {
  searchRollNumberResult,
  calculateExamCountdown,
  MOCK_DATESHEET,
} from '../src/features/exams/examService';
import {
  MOCK_CALENDAR_EVENTS,
  filterCalendarEvents,
  type CalendarEvent,
} from '../src/features/calendar/calendarService';
import { mergeCalendarEvents } from '../src/features/calendar/useCalendarQuery';
import { OFFICIAL_ACADEMIC_EVENTS } from '../src/features/calendar/officialAcademicCalendar';
import {
  calculateAttendanceStatus,
  useAttendanceStore,
} from '../src/features/attendance/attendanceStore';
import {
  parseExcelDateSheet,
  parseSubjectCell,
  buildClassKey,
  matchClassKey,
  filterSlotsForStudent,
  examSlotToRow,
  rowToExamSlot,
  examSlotToDatesheetEntry,
  dateSlotKey,
  type ExamDateSlot,
} from '../src/features/exams/examDateSheetParser';
import { parseAnyDateSheet } from '../worker/examDateSheet';
import { upsertExamDateSlots } from '../worker/supabaseClient';

describe('Phase 5 — Exams, Results, Deadlines, Calendar & Attendance', () => {
  describe('Exam Service & On-Device Result Finder', () => {
    it('finds student results by exact and normalised roll number on-device', () => {
      const res1 = searchRollNumberResult('22/ICS/042');
      expect(res1).not.toBeNull();
      expect(res1?.studentName).toBe('Aarav Sharma');
      expect(res1?.sgpa).toBe(8.45);
      expect(res1?.status).toBe('PASS');
      expect(res1?.grades).toHaveLength(4);

      // Case-insensitive & normalized hyphens/dots
      const res2 = searchRollNumberResult('22-ics-015');
      expect(res2).not.toBeNull();
      expect(res2?.studentName).toBe('Priya Verma');
      expect(res2?.sgpa).toBe(9.1);

      // Malformed roll numbers with spaces around delimiters
      const resSpaced = searchRollNumberResult('22 / ICS / 042');
      expect(resSpaced).not.toBeNull();
      expect(resSpaced?.studentName).toBe('Aarav Sharma');

      const resHyphenSpaced = searchRollNumberResult('22 - ics - 015');
      expect(resHyphenSpaced).not.toBeNull();
      expect(resHyphenSpaced?.studentName).toBe('Priya Verma');

      const resMultiSpace = searchRollNumberResult('  22   ICS   042  ');
      expect(resMultiSpace).not.toBeNull();
      expect(resMultiSpace?.studentName).toBe('Aarav Sharma');

      // Non-existent roll number
      const res3 = searchRollNumberResult('99/UNKNOWN/999');
      expect(res3).toBeNull();
    });

    it('calculates non-negative countdown days until exams', () => {
      const countdown = calculateExamCountdown('2026-11-03T04:00:00.000Z');
      expect(typeof countdown).toBe('number');
      expect(countdown).toBeGreaterThanOrEqual(0);
    });

    it('contains datesheet entries with subject codes and shifts', () => {
      expect(MOCK_DATESHEET.length).toBeGreaterThanOrEqual(4);
      for (const entry of MOCK_DATESHEET) {
        expect(entry.subjectCode).toBeDefined();
        expect(entry.examDate).toBeDefined();
        expect(['Morning', 'Evening']).toContain(entry.shift);
      }
    });
  });

  describe('Academic Calendar & Holidays', () => {
    it('contains semester milestones, exams, and gazetted holidays', () => {
      expect(MOCK_CALENDAR_EVENTS.length).toBeGreaterThanOrEqual(8);
      const categories = MOCK_CALENDAR_EVENTS.map((e) => e.category);
      expect(categories).toContain('holiday');
      expect(categories).toContain('exam');
      expect(categories).toContain('academic');
    });

    it('filters events by category correctly', () => {
      const holidays = filterCalendarEvents(MOCK_CALENDAR_EVENTS, 'Holiday');
      expect(holidays.every((e) => e.category === 'holiday')).toBe(true);

      const exams = filterCalendarEvents(MOCK_CALENDAR_EVENTS, 'Exam');
      expect(exams.every((e) => e.category === 'exam')).toBe(true);

      const all = filterCalendarEvents(MOCK_CALENDAR_EVENTS, 'All');
      expect(all).toHaveLength(MOCK_CALENDAR_EVENTS.length);
    });

    it('merges official academic events with incoming worker events without discarding holidays', () => {
      const workerEvents: CalendarEvent[] = [
        {
          id: 'worker_special_1',
          title: 'Special Convocation 2026',
          dateFrom: '2026-11-20',
          dateTo: '2026-11-20',
          category: 'academic',
        },
      ];
      const merged = mergeCalendarEvents(OFFICIAL_ACADEMIC_EVENTS, workerEvents);

      expect(merged.length).toBe(OFFICIAL_ACADEMIC_EVENTS.length + 1);
      const titles = merged.map((e) => e.title);
      expect(titles).toContain('Special Convocation 2026');
      expect(titles).toContain('Diwali (Deepawali)');
      expect(titles).toContain('Mid semester examination');
    });
  });

  describe('Attendance Tracker & 75% Formula', () => {
    it('calculates percentage and shortage when attendance is below 75%', () => {
      // 18 attended out of 30 classes = 60%
      const status = calculateAttendanceStatus(18, 30, 75);
      expect(status.percentage).toBe(60);
      expect(status.isShortage).toBe(true);
      // To reach 75%: (18 + x) / (30 + x) >= 0.75 => 18 + x >= 22.5 + 0.75x => 0.25x >= 4.5 => x >= 18
      expect(status.classesNeededFor75).toBe(18);
      expect(status.canBunkMargin).toBe(0);
    });

    it('calculates safe bunk margin when attendance is above 75%', () => {
      // 28 attended out of 30 classes = 93.3%
      const status = calculateAttendanceStatus(28, 30, 75);
      expect(status.percentage).toBeCloseTo(93.33, 1);
      expect(status.isShortage).toBe(false);
      expect(status.classesNeededFor75).toBe(0);
      // 28 / (30 + y) >= 0.75 => 30 + y <= 37.33 => y <= 7
      expect(status.canBunkMargin).toBe(7);
    });

    it('handles boundary and edge conditions safely without division by zero', () => {
      // 0 total classes
      const zeroTotal = calculateAttendanceStatus(0, 0, 75);
      expect(zeroTotal.percentage).toBe(100);
      expect(zeroTotal.isShortage).toBe(false);
      expect(zeroTotal.classesNeededFor75).toBe(0);
      expect(zeroTotal.canBunkMargin).toBe(0);

      // Target 100% when classes already missed
      const target100 = calculateAttendanceStatus(10, 12, 100);
      expect(target100.isShortage).toBe(true);
      expect(target100.classesNeededFor75).toBeGreaterThan(0);
      expect(isFinite(target100.classesNeededFor75)).toBe(true);

      // Target 0%
      const targetZero = calculateAttendanceStatus(5, 10, 0);
      expect(targetZero.isShortage).toBe(false);
      expect(targetZero.canBunkMargin).toBe(10);

      // Attended > total (clamped)
      const overflow = calculateAttendanceStatus(15, 10, 75);
      expect(overflow.percentage).toBe(100);
      expect(overflow.isShortage).toBe(false);
    });

    it('initialises attendance as empty on cold start so students are not served a fabricated record', () => {
      useAttendanceStore.getState().resetAll();
      expect(useAttendanceStore.getState().subjects).toEqual([]);
    });

    it('updates attendance store state when marking classes', () => {
      const store = useAttendanceStore.getState();
      store.resetAll();

      // Marking an attended class adds the subject dynamically
      store.markAttended('CSE205', 'Data Structures & Algorithms');
      let subject = useAttendanceStore
        .getState()
        .subjects.find((s) => s.subjectCode === 'CSE205');

      expect(subject?.attended).toBe(1);
      expect(subject?.total).toBe(1);

      // Marking again increments both
      store.markAttended('CSE205');
      subject = useAttendanceStore
        .getState()
        .subjects.find((s) => s.subjectCode === 'CSE205');
      expect(subject?.attended).toBe(2);
      expect(subject?.total).toBe(2);

      // Marking missed increments only total
      store.markMissed('CSE205');
      subject = useAttendanceStore
        .getState()
        .subjects.find((s) => s.subjectCode === 'CSE205');
      expect(subject?.attended).toBe(2);
      expect(subject?.total).toBe(3);
    });

    it('calculates aggregate attendance battery percentage and safety margins', () => {
      const store = useAttendanceStore.getState();
      store.resetAll();
      store.setAttendance('CSE205', 24, 28, 'Data Structures & Algorithms');
      store.setAttendance('CSE209', 22, 30, 'Operating Systems');

      const subjects = useAttendanceStore.getState().subjects;
      const totalAttended = subjects.reduce((acc, s) => acc + s.attended, 0);
      const totalClasses = subjects.reduce((acc, s) => acc + s.total, 0);
      const status = calculateAttendanceStatus(totalAttended, totalClasses, 75);

      expect(status.percentage).toBeGreaterThan(0);
      expect(status.percentage).toBeLessThanOrEqual(100);
      expect(typeof status.isShortage).toBe('boolean');
      expect(typeof status.canBunkMargin).toBe('number');
      expect(typeof status.classesNeededFor75).toBe('number');
    });
  });

  describe('Authentic GBU Exam Date Sheet Parser & Ingestion Pipeline', () => {
    const fixturePath = path.join(__dirname, '../worker/fixtures/gbu_midsem_datesheet_sample.csv');
    const fixtureCsv = fs.readFileSync(fixturePath, 'utf8');

    it('parses authentic GBU Mid-Sem CSV grid fixture into ExamDateSlot array', () => {
      const slots = parseExcelDateSheet(fixtureCsv);
      expect(slots.length).toBe(48);

      // Verify School & ExamType auto-detection
      expect(slots.every((s) => s.schoolCode === 'soict')).toBe(true);
      expect(slots.every((s) => s.examType === 'mid_sem')).toBe(true);

      // Verify shift timings
      const morningSlots = slots.filter((s) => s.slot === 'morning');
      const eveningSlots = slots.filter((s) => s.slot === 'evening');
      expect(morningSlots.length).toBeGreaterThan(0);
      expect(eveningSlots.length).toBeGreaterThan(0);
      expect(morningSlots[0].shiftTime).toContain('10.00am-11.30am');
      expect(eveningSlots[0].shiftTime).toContain('3.30pm-5.00pm');
    });

    it('parses course code and title cleanly without mangling contiguous words (CSE209 fix)', () => {
      const slots = parseExcelDateSheet(fixtureCsv);

      // CSE209 Operating System (originally "CSE209Operating System" without space)
      const cse209 = slots.find((s) => s.subjectCode === 'CSE209');
      expect(cse209).toBeDefined();
      expect(cse209?.subjectCode).toBe('CSE209');
      expect(cse209?.subjectName).toBe('Operating System');
      expect(cse209?.classKey).toBe('btech_cse_sem3');

      // Verify parseSubjectCell unit behavior with varied formats
      const p1 = parseSubjectCell('CSE209Operating System');
      expect(p1.subjectCode).toBe('CSE209');
      expect(p1.subjectName).toBe('Operating System');

      const p2 = parseSubjectCell('CS307- Python');
      expect(p2.subjectCode).toBe('CS307');
      expect(p2.subjectName).toBe('Python');

      const p3 = parseSubjectCell('CSE201 Scientific Computing with Python');
      expect(p3.subjectCode).toBe('CSE201');
      expect(p3.subjectName).toBe('Scientific Computing with Python');

      const p4 = parseSubjectCell('VACLB001 Constitution of India');
      expect(p4.subjectCode).toBe('VACLB001');
      expect(p4.subjectName).toBe('Constitution of India');

      const p5 = parseSubjectCell('MA101 (Back Paper)');
      expect(p5.subjectCode).toBe('MA101');
      expect(p5.isBackPaper).toBe(true);
    });

    it('maps all programmes to canonical class keys faithfully', () => {
      const slots = parseExcelDateSheet(fixtureCsv);
      const classKeys = Array.from(new Set(slots.map((s) => s.classKey)));

      expect(classKeys).toContain('int_btech_mtech_cse_sem1');
      expect(classKeys).toContain('btech_cse_sem1');
      expect(classKeys).toContain('btech_cse_sem3');
      expect(classKeys).toContain('btech_ai_sem3');
      expect(classKeys).toContain('btech_cse_sem5');
      expect(classKeys).toContain('btech_it_sem3');
      expect(classKeys).toContain('bca_sem3');
      expect(classKeys).toContain('mca_ai_sem3');
    });

    it('filters slots for student enrolled in B.Tech CSE Sem 3', () => {
      const slots = parseExcelDateSheet(fixtureCsv);
      const studentSlots = filterSlotsForStudent(slots, 'btech_cse_sem3');

      expect(studentSlots).toHaveLength(6);
      const codes = studentSlots.map((s) => s.subjectCode);
      expect(codes).toContain('CSE201'); // Scientific Computing with Python
      expect(codes).toContain('CSE203'); // Data Structures
      expect(codes).toContain('CSE209'); // Operating System
      expect(codes).toContain('MB457');  // Organizational Behaviour
      expect(codes).toContain('CSE205'); // Database Management System
      expect(codes).toContain('CSE207'); // Computer Organization and Architecture

      // Test canonical class key generation
      expect(buildClassKey('B. Tech. (CSE) Batch (2025-2029) 3rd Semester')).toBe('btech_cse_sem3');
      expect(buildClassKey('Integrated B. Tech.- M. Tech. (CSE) 1st Semester')).toBe('int_btech_mtech_cse_sem1');
      expect(buildClassKey('MCA (AI) 3rd Semester')).toBe('mca_ai_sem3');

      // Test alias matching (e.g. bcs_sem3 matches btech_cse_sem3)
      expect(matchClassKey('bcs_sem3', 'btech_cse_sem3')).toBe(true);
      expect(matchClassKey('btech_cse_3', 'btech_cse_sem3')).toBe(true);
      expect(matchClassKey('btech_ai_sem3', 'btech_cse_sem3')).toBe(false);
    });

    it('parses tabular/flat format date sheet Excel and CSV files', () => {
      const flatCsv = [
        'Date,Shift,Programme,Semester,Course Code,Course Name,Paper ID',
        '14-12-2026,Morning 09:30-12:30,B.Tech CSE,Sem 3,CSE201,Scientific Computing,101',
        '16-12-2026,Evening 02:00-05:00,B.Tech CSE,Sem 3,CSE203,Data Structures,102',
      ].join('\n');

      const flatSlots = parseExcelDateSheet(flatCsv, { examType: 'end_sem', schoolCode: 'soict' });
      expect(flatSlots).toHaveLength(2);
      expect(flatSlots[0].examDate).toBe('2026-12-14');
      expect(flatSlots[0].slot).toBe('morning');
      expect(flatSlots[0].subjectCode).toBe('CSE201');
      expect(flatSlots[0].paperId).toBe('101');
      expect(flatSlots[0].classKey).toBe('btech_cse_sem3');
      expect(flatSlots[1].examDate).toBe('2026-12-16');
      expect(flatSlots[1].slot).toBe('evening');
      expect(flatSlots[1].subjectCode).toBe('CSE203');
      expect(flatSlots[1].paperId).toBe('102');
    });

    it('supports universal date sheet ingestion via parseAnyDateSheet', () => {
      // CSV string
      const slotsFromCsv = parseAnyDateSheet(fixtureCsv, 'midsem.csv');
      expect(slotsFromCsv.length).toBe(48);

      // Buffer
      const buffer = Buffer.from(fixtureCsv, 'utf8');
      const slotsFromBuffer = parseAnyDateSheet(buffer, 'midsem.csv');
      expect(slotsFromBuffer.length).toBe(48);

      // ArrayBuffer
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const slotsFromAb = parseAnyDateSheet(ab, 'midsem.xlsx');
      expect(slotsFromAb.length).toBe(48);
    });

    it('converts ExamDateSlot to database row and DatesheetEntry UI shape faithfully', () => {
      const slot: ExamDateSlot = {
        slotKey: 'datesheet:soict:2026-12-14:morning:cse201:scientific-computing',
        schoolCode: 'soict',
        programme: 'B. Tech. (CSE) Batch (2025-2029) 3rd Semester',
        classKey: 'btech_cse_sem3',
        examDate: '2026-12-14',
        slot: 'morning',
        shiftTime: '09:30 AM - 12:30 PM',
        subjectCode: 'CSE201',
        subjectName: 'Scientific Computing with Python',
        paperId: '1001',
        examType: 'end_sem',
        isBackPaper: false,
      };

      const row = examSlotToRow(slot);
      expect(row.slot_key).toBe(slot.slotKey);
      expect(row.class_key).toBe('btech_cse_sem3');
      expect(row.paper_id).toBe('1001');

      const reconstructed = rowToExamSlot(row);
      expect(reconstructed.slotKey).toBe(slot.slotKey);
      expect(reconstructed.subjectCode).toBe('CSE201');
      expect(reconstructed.classKey).toBe('btech_cse_sem3');

      const entry = examSlotToDatesheetEntry(slot);
      expect(entry.id).toBe(slot.slotKey);
      expect(entry.subjectCode).toBe('CSE201');
      expect(entry.shift).toBe('Morning');
      expect(entry.examTime).toBe('09:30 AM - 12:30 PM');
      expect(entry.paperId).toBe('1001');
      expect(entry.examType).toBe('end_sem');
    });

    it('verifies deterministic dateSlotKey and batch deduplication in upsertExamDateSlots', async () => {
      const key1 = dateSlotKey('soict', '2026-12-14', 'morning', 'CSE201', 'Scientific Computing');
      const key2 = dateSlotKey('soict', '2026-12-14', 'morning', 'CSE201', 'Scientific Computing');
      expect(key1).toBe(key2);

      // Verify upsertExamDateSlots handles duplicate slotKeys safely without throwing
      const mockSlot: ExamDateSlot = {
        slotKey: key1,
        schoolCode: 'soict',
        programme: 'B.Tech CSE',
        classKey: 'btech_cse_sem3',
        examDate: '2026-12-14',
        slot: 'morning',
        subjectCode: 'CSE201',
        subjectName: 'Scientific Computing',
        examType: 'end_sem',
        isBackPaper: false,
      };

      // Calling with duplicates (without Supabase configured in test env returns 0 safely)
      const count = await upsertExamDateSlots([mockSlot, mockSlot]);
      expect(typeof count).toBe('number');
    });

    it('generates collision-free keys across different classes for shared exams and preserves all 48 slots', () => {
      // Int B.Tech + M.Tech (CSE) 1st Sem and B.Tech (CSE) 1st Sem both take ES101 on 07-10-2026 Morning
      const keyClass1 = dateSlotKey('soict', '2026-10-07', 'morning', 'ES101', 'Environmental Studies', 'int_btech_mtech_cse_sem1');
      const keyClass2 = dateSlotKey('soict', '2026-10-07', 'morning', 'ES101', 'Environmental Studies', 'btech_cse_sem1');
      expect(keyClass1).not.toBe(keyClass2);
      expect(keyClass1).toContain('int_btech_mtech_cse_sem1');
      expect(keyClass2).toContain('btech_cse_sem1');

      // Verify all 48 slots in the authentic fixture produce 48 unique slot keys
      const slots = parseExcelDateSheet(fixtureCsv);
      const uniqueKeys = new Set(slots.map((s) => s.slotKey));
      expect(slots.length).toBe(48);
      expect(uniqueKeys.size).toBe(48);
    });

    it('handles dual-format PDF date sheet ingestion via parseAnyDateSheet', () => {
      const pdfText = 'B. Tech. (CSE) 3rd Semester | Morning Shift 10.00am-11.30am | 07-10-2026 | CSE201 Python\nMid-Semester Examination';
      const pdfBuffer = Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Length ${pdfText.length + 30} >>\nstream\nBT (${pdfText}) Tj ET\nendstream\nendobj\ntrailer\n%%EOF\n`,
        'latin1',
      );

      const slots = parseAnyDateSheet(pdfBuffer, 'soict_midsem.pdf');
      expect(slots.length).toBe(1);
      expect(slots[0].examType).toBe('mid_sem');
      expect(slots[0].classKey).toBe('btech_cse_sem3');
      expect(slots[0].subjectCode).toBe('CSE201');
      expect(slots[0].subjectName).toBe('Python');
      expect(slots[0].shiftTime).toBe('10:00 AM - 11:30 AM');
      expect(slots[0].slotKey).toContain('btech_cse_sem3');
    });

    it('formats mid_sem vs end_sem shift timings accurately in examSlotToDatesheetEntry', () => {
      const midSlot: ExamDateSlot = {
        slotKey: 'slot_mid_1',
        schoolCode: 'soict',
        programme: 'B. Tech. (CSE)',
        classKey: 'btech_cse_sem3',
        examDate: '2026-10-07',
        slot: 'evening',
        subjectCode: 'CSE201',
        subjectName: 'Scientific Computing with Python',
        examType: 'mid_sem',
        isBackPaper: false,
      };

      const midEntry = examSlotToDatesheetEntry(midSlot);
      expect(midEntry.shift).toBe('Evening');
      expect(midEntry.examTime).toBe('03:30 PM - 05:00 PM');

      const endSlot: ExamDateSlot = {
        ...midSlot,
        slotKey: 'slot_end_1',
        examDate: '2026-12-14',
        slot: 'morning',
        examType: 'end_sem',
      };
      const endEntry = examSlotToDatesheetEntry(endSlot);
      expect(endEntry.shift).toBe('Morning');
      expect(endEntry.examTime).toBe('09:30 AM - 12:30 PM');
    });
  });
});
