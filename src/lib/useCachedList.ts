import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useRefreshOnFocus } from './useRefreshOnFocus';

type Opts = {
  enabled?: boolean;
  /** Realtime subscription, held only while the screen is focused. */
  subscribe?: (onChange: () => void) => () => void;
  /** Key prefix to invalidate on focus/reload; defaults to the whole key. */
  prefix?: QueryKey;
};

/**
 * A screen's data, from the cache first.
 *
 * Most screens had the same three lines — data in state, a load() that
 * fetched it, a focus effect that called it — which meant a blank screen
 * and a round-trip every time you came back from a card. This keeps the
 * names (`data`, `loading`, `load`) so a screen swaps in one hook and the
 * rest of the file stands, but the data comes from the query cache:
 * painted at once, refreshed quietly on return, on a realtime change, or
 * when the screen calls `load()` after writing.
 */
export function useCached<T>(queryKey: QueryKey, queryFn: () => Promise<T>, opts: Opts = {}) {
  const qc = useQueryClient();
  const prefix = opts.prefix ?? queryKey;
  const q = useQuery({ queryKey, queryFn, enabled: opts.enabled ?? true });
  useRefreshOnFocus(prefix, opts.subscribe);
  const prefixString = JSON.stringify(prefix);
  const load = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: JSON.parse(prefixString) as QueryKey });
  }, [qc, prefixString]);
  return {
    data: q.data as T | undefined,
    loading: q.isPending,
    failed: q.isError && !q.data,
    fetching: q.isFetching,
    load,
    refetch: q.refetch,
  };
}

/** `useCached` for a list: `rows` is never undefined. */
export function useCachedList<T>(queryKey: QueryKey, queryFn: () => Promise<T[]>, opts: Opts = {}) {
  const { data, ...rest } = useCached<T[]>(queryKey, queryFn, opts);
  return { rows: (data ?? []) as T[], ...rest };
}
