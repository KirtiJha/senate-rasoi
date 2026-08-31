import { isSupabaseConfigured, supabase } from './supabase';
import type { InquiryRow } from './types';

/** Record an in-app inquiry. This is what notifies the owner (0089). */
export async function sendInquiry(
  listingId: string,
  fromUserId: string,
  message: string | null
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('inquiries').upsert(
    { listing_id: listingId, from_user_id: fromUserId, message: message ?? null },
    { onConflict: 'listing_id,from_user_id', ignoreDuplicates: false }
  );
  if (error) throw error;
}

/**
 * A user's own inquiry history, with enough of the listing to show a row.
 *
 * The listing is joined rather than fetched separately because a request is
 * meaningless without the thing it was about — "you asked to join" needs to
 * say what.
 */
export async function fetchMyInquiries(userId: string): Promise<InquiryRow[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*, listing:listings!inquiries_listing_id_fkey(id,title,category,status,photos)')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InquiryRow[];
}

/**
 * How many neighbours have enquired on each of the given listings.
 * Returns a map of listing_id → count. RLS lets a listing owner read the
 * inquiries on their own listings, so this is safe to call for one's own ids.
 */
export async function fetchInquiryCountsForOwner(
  listingIds: string[]
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || listingIds.length === 0) return {};
  const { data, error } = await supabase
    .from('inquiries')
    .select('listing_id')
    .in('listing_id', listingIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { listing_id: string }).listing_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** All inquiries on a listing (owner-only; RLS enforces this). */
export async function fetchListingInquiries(listingId: string): Promise<InquiryRow[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*, from_user:profiles!inquiries_from_user_id_fkey(name,flat,whatsapp)')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InquiryRow[];
}
