/**
 * GBU One — Campus events query (offline-first: cache, then refresh).
 *
 * Order of truth:
 *  1) Supabase `campus_events` table, when the project is configured.
 *  2) The bundled seed (`MOCK_EVENTS`), clearly labelled as a sample.
 *  3) SQLite cache, so a screen that has been opened before paints instantly.
 */
import { useQuery } from '@tanstack/react-query';
import {
  CampusEvent,
  EventCategory,
  EventFilter,
  MOCK_EVENTS,
  filterEvents,
  sortEventsByDate,
  upcomingEvents,
} from './eventsService';
import { readCachedEvents, writeCachedEvents } from '../../lib/db';
import { EVENTS_QUERY_KEY } from '../../lib/queryClient';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

async function fetchEventsLive(): Promise<CampusEvent[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('campus_events')
      .select('*')
      .order('start_date', { ascending: true })
      .limit(300);
    if (error || !data || data.length === 0) return null;
    return (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      category: (row.category as CampusEvent['category']) ?? 'other',
      startDate: String(row.start_date ?? ''),
      endDate: String(row.end_date ?? row.start_date ?? ''),
      venue: String(row.venue ?? ''),
      isFree: Boolean(row.is_free),
      registrationRequired: Boolean(row.registration_required),
      registrationUrl: (row.registration_url as string | undefined) ?? undefined,
      imageUrl: (row.image_url as string | undefined) ?? undefined,
      audience: Array.isArray(row.audience) ? (row.audience as string[]) : ['all'],
      source: 'supabase' as const,
      isSample: false,
    }));
  } catch {
    return null;
  }
}

export function useEventsQuery() {
  return useQuery<CampusEvent[]>({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: async () => {
      const live = await fetchEventsLive();
      if (live && live.length > 0) {
        writeCachedEvents(live);
        return live;
      }

      const cached = readCachedEvents();
      if (cached.length > 0) {
        return cached;
      }

      return MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' as const }));
    },
    // Instant paint: seed the cache synchronously at query creation.
    initialData: () => {
      const cached = readCachedEvents();
      return cached.length > 0 ? cached : MOCK_EVENTS.map((e) => ({ ...e, source: 'seed' as const }));
    },
    // The seeded data is treated as stale from the start, so the query really does fetch.
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60 * 1000,
  });
}

export { filterEvents, sortEventsByDate, upcomingEvents, MOCK_EVENTS };
export type { CampusEvent, EventFilter, EventCategory };
export default useEventsQuery;