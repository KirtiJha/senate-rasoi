import { COMMUNITY_ID, supabase } from './supabase';
import { fetchDirectory } from './directory';

/**
 * Item count behind each Home "Community" tile, keyed by tile key. Cheap
 * head-only `count` queries run in parallel; any one failing yields 0 for that
 * tile rather than failing the whole set. `messages` (unread DMs) and `borrow`
 * are computed elsewhere on Home, so they're intentionally not included here.
 */
export async function fetchHomeTileCounts(
  communityId: string = COMMUNITY_ID,
  userId: string | null = null,
): Promise<Record<string, number>> {
  // Community-scoped head count with optional extra filters (RLS still applies,
  // so e.g. `documents` returns only what this user may see).
  const head = async (table: string, apply: (q: any) => any = (q) => q): Promise<number> => {
    try {
      const { count } = await apply(
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      );
      return count ?? 0;
    } catch { return 0; }
  };

  const [feed, sports, documents, properties, recommend, helpers, polls, emergency, places, payments, directory] =
    await Promise.all([
      head('posts'),
      head('sport_groups'),
      head('documents'),
      head('property_listings', (q) => q.eq('status', 'available')),
      head('reco_questions'),
      head('profiles', (q) => q.eq('donor_available', true)),
      head('polls', (q) => q.eq('is_closed', false)),
      head('emergency_contacts'),
      head('places'),
      // Payments are scoped by participant, not community: count the ones still
      // pending (initiated) where I'm the payer or payee.
      userId
        ? (async () => {
            try {
              const { count } = await supabase
                .from('payments')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'initiated')
                .or(`payer_id.eq.${userId},payee_id.eq.${userId}`);
              return count ?? 0;
            } catch { return 0; }
          })()
        : Promise.resolve(0),
      // Residents: the merged & de-duped directory size (members + entries not
      // already represented by a member).
      (async () => {
        try { return (await fetchDirectory(communityId, userId, false)).length; }
        catch { return 0; }
      })(),
    ]);

  return { feed, sports, documents, properties, recommend, helpers, polls, emergency, places, payments, directory };
}
