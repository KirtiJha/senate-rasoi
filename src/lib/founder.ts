import { supabase } from './supabase';

/**
 * How far a new society has got.
 *
 * Onboarding ends with a founder alone in an app whose every tile is about
 * neighbours. These are the five things that turn an empty society into a
 * live one, each measured from the data rather than remembered as a flag,
 * so the list stays honest if someone else does the work.
 */
export interface FounderProgress {
  members: number;
  announcements: number;
  emergencyContacts: number;
  documents: number;
  places: number;
}

async function headCount(table: string, communityId: string, extra?: (q: any) => any): Promise<number> {
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('community_id', communityId);
    if (extra) q = extra(q);
    const { count } = await q;
    return count ?? 0;
  } catch { return 0; }
}

export async function fetchFounderProgress(communityId: string): Promise<FounderProgress> {
  const [members, announcements, emergencyContacts, documents, places] = await Promise.all([
    headCount('profiles', communityId),
    headCount('posts', communityId, (q) => q.eq('category', 'announcement')),
    headCount('emergency_contacts', communityId),
    headCount('documents', communityId),
    headCount('places', communityId),
  ]);
  return { members, announcements, emergencyContacts, documents, places };
}

export const FOUNDER_HIDDEN_KEY = (communityId: string) => `aangan:founder:hidden:${communityId}`;
/** Dev-only: set to '1' in storage to preview the checklist on a finished society. */
export const FOUNDER_PREVIEW_KEY = 'aangan:founder:preview';
