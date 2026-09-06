import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * The four doors this resident actually uses.
 *
 * Home's index was a flat grid of thirty-one tiles, in a fixed order that
 * put fourteen marketplace categories ahead of Residents, Documents and
 * Payments, and left Emergency at tile twenty-nine — a full screen below
 * the fold on the one screen somebody opens in a hurry.
 *
 * Ranking is local and private: a tap count per tile in this device's
 * storage, never sent anywhere. Until somebody has used the app enough to
 * have a preference, the default is the four a new resident needs first.
 */
const KEY = 'aangan:quick-tiles:v1';
const DEFAULTS = ['directory', 'emergency', 'documents', 'payments'];

type Counts = Record<string, number>;

let memo: Counts | null = null;

async function read(): Promise<Counts> {
  if (memo) return memo;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memo = raw ? (JSON.parse(raw) as Counts) : {};
  } catch { memo = {}; }
  return memo;
}

/** Count a visit. Fire-and-forget: a lost count is not worth a await. */
export function noteTileOpened(key: string): void {
  read().then((counts) => {
    const next = { ...counts, [key]: (counts[key] ?? 0) + 1 };
    memo = next;
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }).catch(() => {});
}

/**
 * The top four keys, from a pool of candidates. Anything the resident has
 * never opened keeps the default order, so the row is useful on day one and
 * becomes theirs by the end of the week.
 */
export function useQuickTiles(pool: string[], count = 4): string[] {
  const [counts, setCounts] = useState<Counts | null>(null);
  useEffect(() => { let live = true; read().then((r) => { if (live) setCounts(r); }); return () => { live = false; }; }, []);

  const rank = useCallback((keys: string[]) => {
    const c = counts ?? {};
    const seen = keys.filter((k) => (c[k] ?? 0) > 0).sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0));
    const rest = DEFAULTS.filter((k) => keys.includes(k) && !seen.includes(k));
    const filler = keys.filter((k) => !seen.includes(k) && !rest.includes(k));
    return [...seen, ...rest, ...filler].slice(0, count);
  }, [counts, count]);

  return rank(pool);
}
