import AsyncStorage from '@react-native-async-storage/async-storage';

// Recent search terms, most-recent-first, persisted on-device.
const KEY = 'aangan:recent-searches';
const MAX = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Add a term to the front (de-duped, case-insensitive); returns the new list. */
export async function addRecentSearch(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return getRecentSearches();
  try {
    const cur = await getRecentSearches();
    const next = [term, ...cur.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentSearches();
  }
}

export async function clearRecentSearches(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* best-effort */ }
}
