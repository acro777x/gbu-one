/**
 * GBU One — Academic Calendar & Holiday Service
 * Parsed from Academic Calendar 2026-27 & List of Vacation 2026
 * Per docs/DATA_SOURCES.md
 */

export interface CalendarEvent {
  id: string;
  title: string;
  dateFrom: string; // ISO string
  dateTo: string;
  category: 'holiday' | 'exam' | 'academic' | 'vacation';
  description?: string;
}

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'cal_1',
    title: 'Autumn Semester 2026-27 Commencement',
    dateFrom: '2026-08-01T00:00:00.000Z',
    dateTo: '2026-08-01T23:59:59.000Z',
    category: 'academic',
    description: 'Classes begin for 2nd, 3rd, and 4th year students across all schools',
  },
  {
    id: 'cal_2',
    title: 'Mid Semester Examinations (Autumn 2026)',
    dateFrom: '2026-11-03T00:00:00.000Z',
    dateTo: '2026-11-10T23:59:59.000Z',
    category: 'exam',
    description: 'Mid term exams for all undergraduate and postgraduate programmes',
  },
  {
    id: 'cal_3',
    title: 'Diwali & Govardhan Puja Vacation',
    dateFrom: '2026-10-31T00:00:00.000Z',
    dateTo: '2026-11-02T23:59:59.000Z',
    category: 'holiday',
    description: 'University closed on account of Diwali & Govardhan Puja',
  },
  {
    id: 'cal_4',
    title: 'Chhath Puja',
    dateFrom: '2026-11-07T00:00:00.000Z',
    dateTo: '2026-11-07T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday',
  },
  {
    id: 'cal_5',
    title: 'Guru Nanak Jayanti',
    dateFrom: '2026-11-15T00:00:00.000Z',
    dateTo: '2026-11-15T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday',
  },
  {
    id: 'cal_6',
    title: 'End Semester Practical Examinations',
    dateFrom: '2026-12-01T00:00:00.000Z',
    dateTo: '2026-12-07T23:59:59.000Z',
    category: 'exam',
    description: 'Departmental laboratory evaluations and viva-voce',
  },
  {
    id: 'cal_7',
    title: 'End Semester Theory Examinations',
    dateFrom: '2026-12-10T00:00:00.000Z',
    dateTo: '2026-12-24T23:59:59.000Z',
    category: 'exam',
    description: 'Major semester final exams across university exam halls',
  },
  {
    id: 'cal_8',
    title: 'Winter Vacation 2026-27',
    dateFrom: '2026-12-25T00:00:00.000Z',
    dateTo: '2027-01-05T23:59:59.000Z',
    category: 'vacation',
    description: 'Winter break for all students',
  },
];

export function filterCalendarEvents(
  events: CalendarEvent[],
  category: string,
): CalendarEvent[] {
  if (category === 'All') return events;
  return events.filter((e) => e.category.toLowerCase() === category.toLowerCase());
}
