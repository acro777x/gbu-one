/**
 * Unit tests for the live-data queries that back the calendar, exam hub and
 * home screens. The row mappers are pure, so they are tested directly.
 */
import { calendarRowToEvent } from '../src/features/calendar/useCalendarQuery';
import { datesheetRowToEntry } from '../src/features/exams/useDatesheetQuery';
import { paperRecordToItem } from '../src/features/pyq/usePyqQuery';

describe('calendar rows', () => {
  it('maps a database row to a calendar event', () => {
    const event = calendarRowToEvent({
      id: 'cal_1',
      title: 'Mid Semester Examinations',
      date_from: '2026-11-03',
      date_to: '2026-11-10',
      type: 'exam',
      source_url: 'https://exams.gbu.ac.in/a.pdf',
    });
    expect(event.id).toBe('cal_1');
    expect(event.title).toBe('Mid Semester Examinations');
    expect(event.dateFrom).toBe('2026-11-03');
    expect(event.dateTo).toBe('2026-11-10');
    expect(event.category).toBe('exam');
  });

  it('falls back to a single-day event and the academic category', () => {
    const event = calendarRowToEvent({
      id: 'cal_2',
      title: 'Chhath Puja',
      date_from: '2026-11-07',
    });
    expect(event.dateTo).toBe('2026-11-07');
    expect(event.category).toBe('academic');
  });

  it('rejects an unknown category', () => {
    expect(calendarRowToEvent({ date_from: '2026-01-01', type: 'nonsense' }).category).toBe(
      'academic',
    );
  });
});

describe('date sheet rows', () => {
  it('maps a database row to a date sheet entry', () => {
    const entry = datesheetRowToEntry(
      {
        id: 'ds_1',
        school: 'SOICT',
        programme_code: 'BCS',
        semester: 'II',
        version: 1,
        posted_at: '2026-10-19T08:00:00.000Z',
        file_url: 'https://exams.gbu.ac.in/a.pdf',
      },
      'BCS',
      'II',
    );
    expect(entry.programmeCode).toBe('BCS');
    expect(entry.semester).toBe('II');
    expect(entry.shift).toBe('Morning');
    expect(entry.roomBlock).toBe('SOICT');
  });

  it('alternates the shift with the version', () => {
    const second = datesheetRowToEntry({ version: 2 }, 'BCS', 'II');
    expect(second.shift).toBe('Evening');
  });

  it('falls back to the requested programme and semester', () => {
    const entry = datesheetRowToEntry({}, 'ECE', 'IV');
    expect(entry.programmeCode).toBe('ECE');
    expect(entry.semester).toBe('IV');
  });
});

describe('paper rows', () => {
  it('maps an approved row with its download link', () => {
    const item = paperRecordToItem({
      id: 'pyq_1',
      school: 'SOICT',
      programmeCode: 'BCS',
      semester: 'II',
      subjectCode: 'CSE205',
      subjectName: 'Data Structures & Algorithms',
      year: 2025,
      examType: 'Mid Sem',
      downloads: 42,
      status: 'approved',
      fileUrl: 'https://proj.supabase.co/storage/v1/object/public/pyq/a.pdf',
      uploaderId: null,
    });
    expect(item.status).toBe('approved');
    expect(item.downloads).toBe(42);
    expect(item.fileUrl).toContain('/storage/v1/object/public/pyq/');
  });
});
