/**
 * Unit Tests for Phase 5: Exams Hub, Results Finder, Calendar, and Attendance Tracker
 * Per docs/ROADMAP.md Phase 5, docs/DATA_SOURCES.md, docs/ARCHITECTURE.md
 */

import {
  searchRollNumberResult,
  calculateExamCountdown,
  MOCK_DATESHEET,
} from '../src/features/exams/examService';
import {
  MOCK_CALENDAR_EVENTS,
  filterCalendarEvents,
} from '../src/features/calendar/calendarService';
import {
  calculateAttendanceStatus,
  useAttendanceStore,
} from '../src/features/attendance/attendanceStore';

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

    it('updates attendance store state when marking classes', () => {
      const store = useAttendanceStore.getState();
      const initialSubject = store.subjects[0];
      const initialAttended = initialSubject.attended;
      const initialTotal = initialSubject.total;

      store.markAttended(initialSubject.subjectCode);
      const afterAttend = useAttendanceStore
        .getState()
        .subjects.find((s) => s.subjectCode === initialSubject.subjectCode);

      expect(afterAttend?.attended).toBe(initialAttended + 1);
      expect(afterAttend?.total).toBe(initialTotal + 1);

      store.markMissed(initialSubject.subjectCode);
      const afterMiss = useAttendanceStore
        .getState()
        .subjects.find((s) => s.subjectCode === initialSubject.subjectCode);

      expect(afterMiss?.attended).toBe(initialAttended + 1);
      expect(afterMiss?.total).toBe(initialTotal + 2);
    });

    it('calculates aggregate attendance battery percentage and safety margins', () => {
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
});
