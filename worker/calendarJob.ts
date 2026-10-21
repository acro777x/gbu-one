/**
 * The worker's academic calendar job.
 *
 * It reads the university's own documents:
 *
 *  - the Academic Calendar PDF (the examination portal publishes a copy with
 *    a text layer, so no OCR is needed for it),
 *  - the holiday list (a scan in Hindi, so it needs OCR - when the Devanagari
 *    language data is not installed the job says so instead of inventing
 *    dates),
 *  - the end-semester date sheet, one PDF per school, when the portal has
 *    published one for the running session.
 *
 * Everything is written with an idempotent key, so a run can be repeated
 * safely.
 */
import { fetchAcademicCalendar } from './academicCalendar';
import { fetchDateSheet, DATE_SHEET_SCHOOL_CODES } from './examDateSheet';
import { fetchHolidays2026 } from './holidayList';

export interface CalendarEventRow {
  event_key: string;
  title: string;
  date_from: string;
  date_to: string;
  type: 'holiday' | 'exam' | 'academic' | 'vacation';
  semester: string;
  source_url: string;
  source: string;
}

export interface DateSlotRow {
  slot_key: string;
  school_code: string;
  programme: string;
  exam_date: string;
  slot: 'morning' | 'evening';
  subject_code: string;
  subject_name: string;
  is_back_paper: boolean;
  source_url: string;
}

export interface CalendarJobResult {
  ok: boolean;
  events: CalendarEventRow[];
  slots: DateSlotRow[];
  /** Every reason a source could not be read, so a run is never silently partial. */
  reasons: string[];
}

/** The key an event is stored under, so a re-run updates instead of duplicating. */
export function calendarEventKey(
  title: string,
  dateFrom: string,
  semester: string,
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `academic:${semester}:${dateFrom}:${slug}`;
}

/** The key a date-sheet slot is stored under. */
export function dateSlotKey(
  schoolCode: string,
  examDate: string,
  slot: string,
  subjectCode: string,
  subjectName: string,
): string {
  return `datesheet:${schoolCode}:${examDate}:${slot}:${subjectCode}:${subjectName}`
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function categoryFor(name: string): CalendarEventRow['type'] {
  const lower = name.toLowerCase();
  if (lower.includes('examination') || lower.includes('answer book') || lower.includes('result')) {
    return 'exam';
  }
  if (lower.includes('vacation')) return 'vacation';
  if (lower.includes('holiday')) return 'holiday';
  return 'academic';
}

/**
 * Reads every calendar source and returns the rows to write. It never throws:
 * a source that cannot be read is reported in `reasons`.
 */
export async function collectCalendarRows(
  options: { includeHolidays?: boolean; dateSheetMonth?: string; dateSheetYear?: number } = {},
): Promise<CalendarJobResult> {
  const reasons: string[] = [];
  const events: CalendarEventRow[] = [];
  const slots: DateSlotRow[] = [];

  const calendar = await fetchAcademicCalendar();
  if (!calendar.ok) {
    reasons.push(`academic-calendar: ${calendar.reason ?? 'unavailable'}`);
  } else {
    for (const event of calendar.events) {
      const start = event.startDate;
      if (!start) continue;
      const end = event.endDate ?? start;
      events.push({
        event_key: calendarEventKey(event.name, start, event.semester),
        title: event.name,
        date_from: start,
        date_to: end,
        type: categoryFor(event.name),
        semester: event.semester,
        source_url: calendar.source,
        source: 'academic-calendar',
      });
    }
  }

  if (options.includeHolidays !== false) {
    const holidays = await fetchHolidays2026();
    if (!holidays.ok) {
      reasons.push(`holidays: ${holidays.reason ?? 'unavailable'}`);
    } else {
      for (const holiday of holidays.holidays) {
        const start = holiday.startDate;
        if (!start) continue;
        events.push({
          event_key: calendarEventKey(holiday.name, start, 'holiday'),
          title: holiday.name,
          date_from: start,
          date_to: holiday.endDate ?? start,
          type: 'holiday',
          semester: 'holiday',
          source_url: 'https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf',
          source: 'holiday-list',
        });
      }
    }
  }

  // The date sheet for the running session is published towards the end of
  // the semester; until then the portal has nothing and this is reported.
  const month = options.dateSheetMonth;
  const year = options.dateSheetYear;
  if (month && year) {
    let published = 0;
    for (const schoolCode of DATE_SHEET_SCHOOL_CODES) {
      const sheet = await fetchDateSheet(schoolCode, { month, year });
      if (!sheet.ok) {
        reasons.push(`datesheet:${schoolCode}: ${sheet.reason ?? 'unavailable'}`);
        continue;
      }
      published += 1;
      for (const slot of sheet.slots) {
        slots.push({
          slot_key: dateSlotKey(
            slot.schoolCode,
            slot.date,
            slot.slot,
            slot.subjectCode ?? '',
            slot.subjectName,
          ),
          school_code: slot.schoolCode,
          programme: slot.programme,
          exam_date: slot.date,
          slot: slot.slot,
          subject_code: slot.subjectCode ?? '',
          subject_name: slot.subjectName,
          is_back_paper: slot.isBackPaper,
          source_url: sheet.url,
        });
      }
    }
    if (published === 0) {
      reasons.push('datesheet: no school has published a sheet for that session yet');
    }
  }

  return { ok: events.length > 0 || slots.length > 0, events, slots, reasons };
}
