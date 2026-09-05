import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * The cache the app never had.
 *
 * Every screen fetched on every focus and remembered nothing between visits,
 * so switching tabs meant a loading state and a round-trip — and opening the
 * app after a day meant an empty Home until Supabase answered. This is the
 * standard answer in this stack: TanStack Query with the cache persisted to
 * AsyncStorage, so a screen paints from what it showed last time in under a
 * frame and refetches quietly behind it.
 *
 * Defaults are tuned for a society app, not a stock ticker: data is "fresh"
 * for a minute (no refetch on quick back-and-forth), kept for a day (so a
 * cold start still has something to show), and retried once — the network
 * here is a lift shaft, not a data centre.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      retryDelay: 1200,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'aangan:query-cache:v1',
  throttleTime: 1000,
});

/** How long a persisted entry may be revived after a cold start. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * "Focus" on a phone is the app coming to the foreground, not a browser tab.
 * Without this, refetchOnWindowFocus would only ever fire on web.
 */
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
    return () => sub.remove();
  });
  // No NetInfo yet (native module — arrives with the next build). Until
  // then assume online; failed requests still retry and the cache still
  // serves. When NetInfo lands, this is the one line that changes.
  onlineManager.setOnline(true);
}

/**
 * Query keys, in one place, so an invalidation from a realtime event and the
 * screen that reads the data agree on the name.
 */
export const qk = {
  home: (communityId: string, userId: string | null) => ['home', communityId, userId] as const,
  inbox: (userId: string) => ['inbox', userId] as const,
  feed: (communityId: string, category: string) => ['feed', communityId, category] as const,
  thread: (threadId: string) => ['thread', threadId] as const,
  directory: (communityId: string) => ['directory', communityId] as const,
  places: (communityId: string) => ['places', communityId] as const,
  polls: (communityId: string) => ['polls', communityId] as const,
  search: (communityId: string, q: string) => ['search', communityId, q] as const,
} as const;
