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

/**
 * Merges official academic events with incoming worker events.
 * Keyed by normalised title and dateFrom so official holidays and milestones
 * are preserved when new or updated events arrive from the worker.
 */
export function mergeCalendarEvents(
  officialEvents: CalendarEvent[],
  workerEvents: CalendarEvent[],
): CalendarEvent[] {
  if (!workerEvents || workerEvents.length === 0) {
    return officialEvents;
  }
  const merged = new Map<string, CalendarEvent>();
  for (const event of officialEvents) {
    const key = `${event.title.trim().toLowerCase()}::${event.dateFrom}`;
    merged.set(key, event);
  }
  for (const event of workerEvents) {
    const key = `${event.title.trim().toLowerCase()}::${event.dateFrom}`;
    merged.set(key, event);
  }
  return Array.from(merged.values()).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
}

export function useCalendarQuery() {
  return useQuery<CalendarEvent[]>({
    queryKey: CALENDAR_QUERY_KEY,
    queryFn: async () => {
      const events = await listCalendarEvents();
      // The official calendar & holidays ship with the app; merge with incoming worker events
      // so holidays and official milestones are preserved even if 1 row is written.
      return mergeCalendarEvents(OFFICIAL_ACADEMIC_EVENTS, events);
    },
    initialData: OFFICIAL_ACADEMIC_EVENTS,
    // The seed must not count as fresh, or the query never fetches.
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60 * 1000,
  });
}

export default useCalendarQuery;
