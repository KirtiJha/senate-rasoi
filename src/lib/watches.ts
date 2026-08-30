import { supabase } from './supabase';

/**
 * Standing watches — the one thing Saathi does while you are not looking.
 *
 * Matching is on keywords rather than meaning, and the resident is shown the
 * literal terms. That is the honest contract: a watch that quietly decides
 * what counts as "similar enough" is one you cannot reason about when it stays
 * silent, and staying silent is the failure a watch must not have.
 */

export interface Watch {
  id: string;
  label: string;
  keywords: string[];
  sources: string[] | null;
  active: boolean;
  created_at: string;
  last_fired_at: string | null;
}

export async function fetchWatches(userId: string): Promise<Watch[]> {
  const { data, error } = await supabase
    .from('saathi_watches')
    .select('id, label, keywords, sources, active, created_at, last_fired_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Watch[];
}

export async function createWatch(
  userId: string,
  communityId: string,
  label: string,
  keywords: string[],
  sources?: string[] | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('saathi_watches')
    .insert({
      user_id: userId,
      community_id: communityId,
      label: label.trim().slice(0, 80),
      // Lowercased here as well as in the trigger: the column is what a person
      // reads back in settings, and mixed case there looks like a bug.
      keywords: keywords.map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 6),
      sources: sources?.length ? sources : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Switch one watch on or off without losing it. */
export async function setWatchActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('saathi_watches').update({ active }).eq('id', id);
  if (error) throw error;
}

/** Silence every watch at once — for someone who wants quiet, not curation. */
export async function setAllWatchesActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('saathi_watches').update({ active }).eq('user_id', userId);
  if (error) throw error;
}

export async function deleteWatch(id: string): Promise<void> {
  const { error } = await supabase.from('saathi_watches').delete().eq('id', id);
  if (error) throw error;
}
