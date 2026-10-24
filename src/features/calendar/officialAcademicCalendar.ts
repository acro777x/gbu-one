/**
 * GBU One - the official academic calendar for the session 2026-27.
 *
 * These are the dates from the university's own Academic Calendar 2026-27
 * (Office Order GBU.-010/Acad./021/2026-123, dated 22/05/2026), read from the
 * PDF the examination portal publishes:
 *
 *   https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf
 *
 * They are shipped with the app so the calendar is useful before the worker
 * has pushed the parsed rows to the backend, and they are replaced by the
 * live rows as soon as the backend is connected. The PDF is linked from the
 * screen so a student can always check the original.
 */
import type { CalendarEvent } from './calendarService';

/** The official calendar PDF, as published by the examination portal. */
export const ACADEMIC_CALENDAR_PDF_URL =
  'https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf';

/** The university's list of holidays (a scan, in Hindi). */
export const HOLIDAY_LIST_PDF_URL =
  'https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf';

export const ACADEMIC_CALENDAR_SESSION = '2026-27';

interface OfficialEvent {
  title: string;
  from: string;
  to?: string;
  category: CalendarEvent['category'];
}

const MONSOON: OfficialEvent[] = [
  { title: 'Fee submission (online), 2nd year onwards', from: '2026-07-10', to: '2026-07-20', category: 'academic' },
  { title: 'Reporting and registration, 2nd year onwards', from: '2026-07-27', to: '2026-07-31', category: 'academic' },
  { title: 'Commencement of classes, 2nd year onwards', from: '2026-08-03', category: 'academic' },
  { title: 'Reporting of 1st year students', from: '2026-08-05', to: '2026-08-06', category: 'academic' },
  { title: 'Induction and orientation of 1st year students', from: '2026-08-07', category: 'academic' },
  { title: 'Commencement of classes, 1st year students', from: '2026-08-10', category: 'academic' },
  { title: 'Mid semester examination', from: '2026-10-07', to: '2026-10-16', category: 'exam' },
  { title: 'Lab and practical examination', from: '2026-11-30', to: '2026-12-04', category: 'exam' },
  { title: 'Back paper examination', from: '2026-12-07', to: '2026-12-12', category: 'exam' },
  { title: 'End semester examination', from: '2026-12-14', to: '2026-12-24', category: 'exam' },
  { title: 'Evaluation and submission of answer books', from: '2027-01-12', category: 'exam' },
  { title: 'Winter vacation', from: '2026-12-25', to: '2027-01-05', category: 'vacation' },
  { title: 'Declaration of results', from: '2027-01-25', category: 'exam' },
];

const WINTER: OfficialEvent[] = [
  { title: 'Fee submission (online)', from: '2026-12-26', to: '2027-01-05', category: 'academic' },
  { title: 'Reporting and registration', from: '2027-01-09', category: 'academic' },
  { title: 'Commencement of classes, all years', from: '2027-01-11', category: 'academic' },
  { title: 'Mid semester examination', from: '2027-03-08', to: '2027-03-19', category: 'exam' },
  { title: 'Lab and practical examination', from: '2027-04-26', to: '2027-04-30', category: 'exam' },
  { title: 'Back paper examination', from: '2027-05-03', to: '2027-05-08', category: 'exam' },
  { title: 'End semester examination', from: '2027-05-10', to: '2027-05-22', category: 'exam' },
  { title: 'Evaluation and submission of back paper answer books', from: '2027-05-19', category: 'exam' },
  { title: 'Evaluation and submission of end term answer books', from: '2027-06-07', category: 'exam' },
  { title: 'Declaration of results', from: '2027-06-20', to: '2027-06-30', category: 'exam' },
  { title: 'Summer vacation', from: '2027-06-08', to: '2027-07-22', category: 'vacation' },
];

/**
 * Gautam Buddha University Official Gazetted & Public Holidays 2026
 * As per Office Order GBU-029/Admin/2026-2470 (List of Vacation 2026).
 */
const GAZETTED_HOLIDAYS_2026: OfficialEvent[] = [
  { title: 'Hazrat Ali Birthday', from: '2026-01-03', category: 'holiday' },
  { title: 'Republic Day', from: '2026-01-26', category: 'holiday' },
  { title: 'Maha Shivratri', from: '2026-02-15', category: 'holiday' },
  { title: 'Holika Dahan', from: '2026-03-02', category: 'holiday' },
  { title: 'Holi (Local Holiday - G.B. Nagar)', from: '2026-03-03', category: 'holiday' },
  { title: 'Holi', from: '2026-03-04', category: 'holiday' },
  { title: 'Eid-ul-Fitr', from: '2026-03-21', category: 'holiday' },
  { title: 'Ram Navami', from: '2026-03-26', category: 'holiday' },
  { title: 'Mahavir Jayanti', from: '2026-03-31', category: 'holiday' },
  { title: 'Good Friday', from: '2026-04-03', category: 'holiday' },
  { title: 'Dr. B.R. Ambedkar Jayanti', from: '2026-04-14', category: 'holiday' },
  { title: 'Buddha Purnima', from: '2026-05-01', category: 'holiday' },
  { title: 'Eid-ul-Zuha (Bakrid)', from: '2026-05-27', category: 'holiday' },
  { title: 'Muharram', from: '2026-06-26', category: 'holiday' },
  { title: 'Shravan Shivratri (Local Holiday)', from: '2026-08-11', category: 'holiday' },
  { title: 'Independence Day', from: '2026-08-15', category: 'holiday' },
  { title: 'Eid-e-Milad / Barawafat', from: '2026-08-26', category: 'holiday' },
  { title: 'Raksha Bandhan', from: '2026-08-28', category: 'holiday' },
  { title: 'Janmashtami', from: '2026-09-04', category: 'holiday' },
  { title: 'Guru Dronacharya Mela (Local Holiday)', from: '2026-09-09', category: 'holiday' },
  { title: 'Mahatma Gandhi Jayanti', from: '2026-10-02', category: 'holiday' },
  { title: 'Dussehra (Mahanavami / Vijayadashami)', from: '2026-10-20', category: 'holiday' },
  { title: 'Diwali (Deepawali)', from: '2026-11-08', category: 'holiday' },
  { title: 'Govardhan Puja', from: '2026-11-09', category: 'holiday' },
  { title: 'Bhaiya Dooj / Chitragupta Jayanti', from: '2026-11-11', category: 'holiday' },
  { title: 'Chhath Puja', from: '2026-11-15', category: 'holiday' },
  { title: 'Guru Nanak Jayanti & Guru Tegh Bahadur Martyrdom Day', from: '2026-11-24', category: 'holiday' },
  { title: 'Christmas Day', from: '2026-12-25', category: 'holiday' },
];

function toEvent(event: OfficialEvent, semester: string, index: number): CalendarEvent {
  return {
    id: `academic_${semester}_${event.from}_${index}`,
    title: event.title,
    dateFrom: event.from,
    dateTo: event.to ?? event.from,
    category: event.category,
    description: event.category === 'holiday' ? HOLIDAY_LIST_PDF_URL : ACADEMIC_CALENDAR_PDF_URL,
  };
}

/** Every official academic event and gazetted holiday for the session, in date order. */
export const OFFICIAL_ACADEMIC_EVENTS: CalendarEvent[] = [
  ...MONSOON.map((event, index) => toEvent(event, 'monsoon', index)),
  ...WINTER.map((event, index) => toEvent(event, 'winter', index)),
  ...GAZETTED_HOLIDAYS_2026.map((event, index) => toEvent(event, 'holiday', index)),
].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));

/** True when the event falls on the given day. */
export function isOnDay(event: CalendarEvent, isoDate: string): boolean {
  return event.dateFrom <= isoDate && isoDate <= event.dateTo;
}
