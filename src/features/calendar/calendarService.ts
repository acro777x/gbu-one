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


export function filterCalendarEvents(
  events: CalendarEvent[],
  category: string,
): CalendarEvent[] {
  if (category === 'All') return events;
  return events.filter((e) => e.category.toLowerCase() === category.toLowerCase());
}
