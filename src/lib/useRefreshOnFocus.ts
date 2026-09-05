import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Keep a screen's queries fresh the way a resident expects: cached data paints
 * at once, and coming back to the screen — or a realtime change while it is
 * open — refetches quietly behind it.
 *
 * The first focus after mount is skipped: useQuery already fetched on mount
 * when the data was stale, and the old focus effects fetched a second time.
 *
 * `prefix` is matched as a query-key prefix, so one call covers a list and
 * its side counts. `subscribe`, when given, is called with a bump function and
 * must return an unsubscribe; it lives only while the screen is focused.
 */
export function useRefreshOnFocus(prefix: QueryKey, subscribe?: (onChange: () => void) => () => void) {
  const qc = useQueryClient();
  const first = useRef(true);
  const prefixRef = useRef(prefix); prefixRef.current = prefix;
  const subRef = useRef(subscribe); subRef.current = subscribe;
  const keyString = JSON.stringify(prefix);
  useFocusEffect(useCallback(() => {
    const bump = () => { qc.invalidateQueries({ queryKey: prefixRef.current }); };
    if (first.current) first.current = false; else bump();
    return subRef.current ? subRef.current(bump) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, keyString]));
}
