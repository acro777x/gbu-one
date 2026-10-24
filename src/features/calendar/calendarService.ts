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
    dateFrom: '2026-08-03T00:00:00.000Z',
    dateTo: '2026-08-03T23:59:59.000Z',
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
    title: 'Diwali (Deepawali)',
    dateFrom: '2026-11-08T00:00:00.000Z',
    dateTo: '2026-11-08T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday as per GBU List of Vacation 2026',
  },
  {
    id: 'cal_4',
    title: 'Govardhan Puja',
    dateFrom: '2026-11-09T00:00:00.000Z',
    dateTo: '2026-11-09T23:59:59.000Z',
    category: 'holiday',
    description: 'University closed on account of Govardhan Puja',
  },
  {
    id: 'cal_5',
    title: 'Bhaiya Dooj / Chitragupta Jayanti',
    dateFrom: '2026-11-11T00:00:00.000Z',
    dateTo: '2026-11-11T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday as per GBU Office Order',
  },
  {
    id: 'cal_6',
    title: 'Chhath Puja',
    dateFrom: '2026-11-15T00:00:00.000Z',
    dateTo: '2026-11-15T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday',
  },
  {
    id: 'cal_7',
    title: 'Guru Nanak Jayanti & Guru Tegh Bahadur Martyrdom Day',
    dateFrom: '2026-11-24T00:00:00.000Z',
    dateTo: '2026-11-24T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday & Executive Order Holiday',
  },
  {
    id: 'cal_8',
    title: 'End Semester Practical Examinations',
    dateFrom: '2026-11-30T00:00:00.000Z',
    dateTo: '2026-12-04T23:59:59.000Z',
    category: 'exam',
    description: 'Departmental laboratory evaluations and viva-voce',
  },
  {
    id: 'cal_9',
    title: 'Back Paper Examination (Monsoon 2026)',
    dateFrom: '2026-12-07T00:00:00.000Z',
    dateTo: '2026-12-12T23:59:59.000Z',
    category: 'exam',
    description: 'Back paper evaluations across university schools',
  },
  {
    id: 'cal_10',
    title: 'End Semester Theory Examinations',
    dateFrom: '2026-12-14T00:00:00.000Z',
    dateTo: '2026-12-24T23:59:59.000Z',
    category: 'exam',
    description: 'Major semester final exams across university exam halls (GBU Academic Calendar)',
  },
  {
    id: 'cal_11',
    title: 'Winter Vacation 2026-27',
    dateFrom: '2026-12-25T00:00:00.000Z',
    dateTo: '2027-01-05T23:59:59.000Z',
    category: 'vacation',
    description: 'Winter break for all students',
  },
  {
    id: 'cal_12',
    title: 'Christmas Day',
    dateFrom: '2026-12-25T00:00:00.000Z',
    dateTo: '2026-12-25T23:59:59.000Z',
    category: 'holiday',
    description: 'Gazetted Holiday',
  },
  {
    id: 'cal_13',
    title: 'Declaration of Results',
    dateFrom: '2027-01-25T00:00:00.000Z',
    dateTo: '2027-01-25T23:59:59.000Z',
    category: 'exam',
    description: 'Official declaration of Monsoon 2026 semester examination results',
  },
];

export function filterCalendarEvents(
  events: CalendarEvent[],
  category: string,
): CalendarEvent[] {
  if (category === 'All') return events;
  return events.filter((e) => e.category.toLowerCase() === category.toLowerCase());
}
