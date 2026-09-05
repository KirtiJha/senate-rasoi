import { supabase } from './supabase';

// What a search can find. One list, ranked by the database across every
// tile, so the screen groups rather than scores.
export type SearchKind =
  | 'resident' | 'sport' | 'document' | 'dish' | 'tiffin' | 'listing' | 'post'
  | 'borrow' | 'lost_found' | 'place' | 'recommend';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  route: string;
  rank: number;
}

export const SEARCH_MIN_CHARS = 2;

/** One question to the database; typo-tolerant (pg_trgm), RLS-honouring. */
export async function searchSociety(communityId: string, q: string, limit = 60): Promise<SearchHit[]> {
  const t = q.trim();
  if (t.length < SEARCH_MIN_CHARS) return [];
  const { data, error } = await supabase.rpc('search_society', { p_community: communityId, p_q: t, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as SearchHit[];
}
