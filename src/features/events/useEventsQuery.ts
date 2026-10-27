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
  listCampusEvents,
} from './eventsService';
import { readCachedEvents, writeCachedEvents } from '../../lib/db';
import { EVENTS_QUERY_KEY } from '../../lib/queryClient';

export function useEventsQuery() {
  return useQuery<CampusEvent[]>({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: async () => {
      const live = await listCampusEvents();
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
    staleTime: 60 * 1000,
  });
}

export { filterEvents, sortEventsByDate, upcomingEvents, MOCK_EVENTS };
export type { CampusEvent, EventFilter, EventCategory };
export default useEventsQuery;