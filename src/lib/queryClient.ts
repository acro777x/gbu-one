/**
 * GBU One — TanStack Query client (singleton).
 * Offline-first defaults: screens render cached data instantly (`placeholderData`
 * / persisted snapshots) while a background refetch refreshes. Retries are
 * capped so a dead campus network fails fast and the cache stays visible.
 */
import React, { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientContext } from '@tanstack/react-query';

export function QueryClientProvider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    client.mount();
    return () => {
      client.unmount();
    };
  }, [client]);

  return React.createElement(QueryClientContext.Provider, { value: client }, children);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min: cache is fresh
      gcTime: 7 * 24 * 60 * 60 * 1000, // keep cache for 7 days for offline use
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

export const NOTICE_QUERY_KEY = ['notices'] as const;
export const TIMETABLE_QUERY_KEY = ['timetable'] as const;
export const EVENTS_QUERY_KEY = ['campus-events'] as const;

export default queryClient;
