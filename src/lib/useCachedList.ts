import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useRefreshOnFocus } from './useRefreshOnFocus';

/**
 * A tile's list, from the cache first.
 *
 * Most tile screens had the same three lines — rows in state, a load()
 * that fetched them, a focus effect that called it — which meant a blank
 * list and a round-trip every time you came back from a card. This keeps
 * the same names (`rows`, `loading`, `load`) so a screen swaps in one
 * hook and the rest of the file stands, but the rows come from the query
 * cache: painted at once, refreshed quietly on return, on a realtime
 * change, or when the screen calls `load()` after writing.
 */
export function useCachedList<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T[]>,
  opts: {
    enabled?: boolean;
    /** Realtime subscription, held only while the screen is focused. */
    subscribe?: (onChange: () => void) => () => void;
    /** Key prefix to invalidate on focus/reload; defaults to the whole key. */
    prefix?: QueryKey;
  } = {},
) {
  const qc = useQueryClient();
  const prefix = opts.prefix ?? queryKey;
  const q = useQuery({ queryKey, queryFn, enabled: opts.enabled ?? true });
  useRefreshOnFocus(prefix, opts.subscribe);
  const prefixString = JSON.stringify(prefix);
  const load = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: JSON.parse(prefixString) as QueryKey });
  }, [qc, prefixString]);
  return {
    rows: (q.data ?? []) as T[],
    loading: q.isPending,
    failed: q.isError && !q.data,
    fetching: q.isFetching,
    load,
    refetch: q.refetch,
  };
}
