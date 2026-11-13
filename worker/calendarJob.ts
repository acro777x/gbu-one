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
import { fetchAcademicCalendar, type AcademicEvent } from './academicCalendar';
import {
  fetchDateSheet,
  DATE_SHEET_SCHOOL_CODES,
  resolveRunningDateSheetSession,
} from './examDateSheet';
import {
  baseClassKeyOf,
  buildCanonicalClassKey,
  dateSlotKey,
} from '../src/lib/classKey';
import { fetchHolidays2026 } from './holidayList';
import { SOURCE_KEYS, WORKER_CONFIG } from './sources.config';
import { ALWAYS_FETCH, type SourceScheduler } from './sourceScheduler';

/** The month abbreviations the published date-sheet files use. */
const MONTH_ABBREVIATIONS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

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
  class_key?: string;
  exam_type?: 'mid_sem' | 'end_sem' | 'practical';
  shift_time?: string;
  paper_id?: string;
}

export interface CalendarJobResult {
  ok: boolean;
  events: CalendarEventRow[];
  slots: DateSlotRow[];
  /** Every reason a source could not be read, so a run is never silently partial. */
  reasons: string[];
  /** The date-sheet session the run looked for, for the log. */
  dateSheetSession: { month: string; year: number } | null;
}

/**
 * The session the end-semester date sheet belongs to.
 *
 * The academic calendar states when the end-semester examination is. That
 * date is the name of the published file (`<school>-end-sem-dec-2025.pdf`),
 * so the calendar is the authority. When the calendar cannot be read, the
 * running session is used, and an env var can override both.
 */
export function resolveDateSheetSession(
  events: AcademicEvent[],
  env: Record<string, string | undefined> = process.env,
): { month: string; year: number } {
  const envMonth = env.EXAM_DATE_SHEET_MONTH?.trim().toLowerCase();
  const envYear = Number(env.EXAM_DATE_SHEET_YEAR);
  if (envMonth && Number.isFinite(envYear) && envYear > 2000) {
    return { month: envMonth, year: envYear };
  }

  // The end-semester examination of the calendar names the session.
  const endSemester = events
    .filter((event) => /end\s*semester\s*examination/i.test(event.name))
    .filter((event) => Boolean(event.startDate))
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  for (const event of endSemester) {
    const start = event.startDate;
    if (!start) continue;
    const [yearText, monthText] = start.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) continue;
    if (monthIndex < 0 || monthIndex > 11) continue;
    return { month: MONTH_ABBREVIATIONS[monthIndex], year };
  }

  return resolveRunningDateSheetSession();
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

/**
 * The key a date-sheet slot is stored under.
 *
 * The class key is mandatory and it is the CANONICAL one: the key is the
 * unique identity of the row, so two cohorts of one programme must never
 * share it. The shared implementation lives in `src/lib/classKey.ts`.
 */
export { dateSlotKey };

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
  options: {
    includeHolidays?: boolean;
    dateSheetMonth?: string;
    dateSheetYear?: number;
    /** Environment used for the session override. */
    env?: Record<string, string | undefined>;
    /** Decides whether a source may be fetched now. */
    scheduler?: SourceScheduler;
  } = {},
): Promise<CalendarJobResult> {
  const reasons: string[] = [];
  const events: CalendarEventRow[] = [];
  const slots: DateSlotRow[] = [];
  const scheduler = options.scheduler ?? ALWAYS_FETCH;

  // The academic calendar and the holiday list change twice a year, so they
  // are only fetched when their interval has elapsed. The Hindi holiday list
  // is a scan that needs OCR - it must not be OCR'd 96 times a day.
  const calendarDue = await scheduler.shouldFetch(
    SOURCE_KEYS.academicCalendar,
    WORKER_CONFIG.sources.academicCalendar.intervalMinutes,
  );
  const calendar = calendarDue.skip
    ? { ok: false as const, events: [] as AcademicEvent[], source: '', reason: calendarDue.reason }
    : await fetchAcademicCalendar();
  if (calendarDue.skip) {
    console.log(JSON.stringify({
      event: 'worker_source_skipped',
      source: SOURCE_KEYS.academicCalendar,
      reason: calendarDue.reason,
    }));
  } else if (!calendar.ok) {
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
    await scheduler.markFetched(SOURCE_KEYS.academicCalendar, calendar.events.length);
  }

  if (options.includeHolidays !== false) {
    const holidaysDue = await scheduler.shouldFetch(
      SOURCE_KEYS.holidays,
      WORKER_CONFIG.sources.holidays.intervalMinutes,
    );
    if (holidaysDue.skip) {
      console.log(JSON.stringify({
        event: 'worker_source_skipped',
        source: SOURCE_KEYS.holidays,
        reason: holidaysDue.reason,
      }));
    } else {
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
            source_url: WORKER_CONFIG.sources.holidays.url,
            source: 'holiday-list',
          });
        }
        await scheduler.markFetched(SOURCE_KEYS.holidays, holidays.holidays.length);
      }
    }
  }

  // The date sheet for the running session is published towards the end of
  // the semester; until then the portal has nothing and this is reported.
  //
  // The session is taken from the academic calendar (the end-semester
  // examination names the published file) and can be overridden with the
  // EXAM_DATE_SHEET_MONTH / EXAM_DATE_SHEET_YEAR environment variables.
  const session = resolveDateSheetSession(calendar.ok ? calendar.events : [], options.env);
  const month = options.dateSheetMonth ?? session.month;
  const year = options.dateSheetYear ?? session.year;
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
        // The slot key carries the CANONICAL class key, so two cohorts of
        // one programme are two rows; the row keeps the BASE class key,
        // because that is the value the database is filtered on.
        const canonicalKey = buildCanonicalClassKey(slot.programme);
        const classKey = baseClassKeyOf(canonicalKey);
        const shiftTime =
          slot.slot === 'morning' ? '09:30 AM - 12:30 PM' : '02:00 PM - 05:00 PM';
        slots.push({
          slot_key: dateSlotKey(
            slot.schoolCode,
            slot.date,
            slot.slot,
            slot.subjectCode ?? '',
            slot.subjectName,
            canonicalKey,
          ),
          school_code: slot.schoolCode,
          programme: slot.programme,
          class_key: classKey,
          exam_date: slot.date,
          slot: slot.slot,
          shift_time: shiftTime,
          subject_code: slot.subjectCode ?? '',
          subject_name: slot.subjectName,
          exam_type: 'end_sem',
          is_back_paper: slot.isBackPaper,
          source_url: sheet.url,
        });
      }
    }
    if (published === 0) {
      reasons.push('datesheet: no school has published a sheet for that session yet');
    }
  }

  return {
    ok: events.length > 0 || slots.length > 0,
    events,
    slots,
    reasons,
    dateSheetSession: { month, year },
  };
}
