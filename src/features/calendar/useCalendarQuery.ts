/**
 * GBU One — Academic calendar query (offline-first).
 *
 * The events come from Supabase (`calendar_events`); the bundled seed keeps
 * the screen usable when the backend is not reachable.
 */
import { useQuery } from '@tanstack/react-query';
import { type CalendarEvent } from './calendarService';
import { OFFICIAL_ACADEMIC_EVENTS } from './officialAcademicCalendar';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const CALENDAR_QUERY_KEY = ['calendar-events'] as const;

interface CalendarRow {
  id?: unknown;
  title?: unknown;
  date_from?: unknown;
  date_to?: unknown;
  type?: unknown;
  source_url?: unknown;
}

const CATEGORIES: CalendarEvent['category'][] = ['holiday', 'exam', 'academic', 'vacation'];

function toCategory(value: unknown): CalendarEvent['category'] {
  const raw = String(value ?? 'academic').toLowerCase();
  return (CATEGORIES as string[]).includes(raw)
    ? (raw as CalendarEvent['category'])
    : 'academic';
}

/** Maps a database row to the shape the calendar screen renders. */
export function calendarRowToEvent(row: CalendarRow): CalendarEvent {
  const dateFrom = String(row.date_from ?? '');
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    dateFrom,
    dateTo: String(row.date_to ?? dateFrom),
    category: toCategory(row.type),
    description: row.source_url ? String(row.source_url) : undefined,
  };
}

/** Loads the calendar events from the backend. */
export async function listCalendarEvents(limit = 300): Promise<CalendarEvent[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('date_from', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return (data as CalendarRow[]).map(calendarRowToEvent);
  } catch {
    return [];
  }
}

export function useCalendarQuery() {
  return useQuery<CalendarEvent[]>({
    queryKey: CALENDAR_QUERY_KEY,
    queryFn: async () => {
      const events = await listCalendarEvents();
      // The official calendar ships with the app, so the screen is right even
      // before the worker has pushed the parsed rows to the backend.
      return events.length > 0 ? events : OFFICIAL_ACADEMIC_EVENTS;
    },
    initialData: OFFICIAL_ACADEMIC_EVENTS,
    // The seed must not count as fresh, or the query never fetches.
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60 * 1000,
  });
}

export default useCalendarQuery;
