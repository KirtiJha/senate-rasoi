import { supabase } from './supabase';
import type { DbProfile } from './types';

/** All residents (members) of a community, for the directory — ordered by flat. */
export async function fetchResidents(communityId: string): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('community_id', communityId)
    .order('flat', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}
