import { isSupabaseConfigured, supabase } from './supabase';

/** One message in a listing's chat / Q&A thread (Phase 12a). */
export interface ListingMessageRow {
  id: string;
  listing_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { name: string; flat: string | null };
}

const SELECT = '*, author:profiles!listing_messages_author_id_fkey(name, flat)';

/** All messages on a listing, oldest first. */
export async function fetchListingMessages(listingId: string): Promise<ListingMessageRow[]> {
  const { data, error } = await supabase
    .from('listing_messages')
    .select(SELECT)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ListingMessageRow[];
}

/** Post a message to a listing's thread as the given user. */
export async function sendListingMessage(
  listingId: string,
  authorId: string,
  body: string,
): Promise<ListingMessageRow> {
  const { data, error } = await supabase
    .from('listing_messages')
    .insert({ listing_id: listingId, author_id: authorId, body: body.trim() })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as ListingMessageRow;
}

/** Delete a message (author or society admin — enforced by RLS). */
export async function deleteListingMessage(id: string): Promise<void> {
  const { error } = await supabase.from('listing_messages').delete().eq('id', id);
  if (error) throw error;
}

/** Live-subscribe to a listing's thread; calls onChange on any insert/delete. */
export function subscribeToListingMessages(listingId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`listing-messages-${listingId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'listing_messages', filter: `listing_id=eq.${listingId}` },
      onChange,
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
