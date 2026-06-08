import { supabase } from './supabase';
import type { ListingRow } from './types';

export async function saveListing(userId: string, listingId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_listings')
    .insert({ user_id: userId, listing_id: listingId });
  if (error && error.code !== '23505') throw error;
}

export async function unsaveListing(userId: string, listingId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('listing_id', listingId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('saved_listings')
    .select('listing_id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();
  return !!data;
}

export async function fetchSavedListings(userId: string): Promise<ListingRow[]> {
  const { data, error } = await supabase
    .from('saved_listings')
    .select('listing:listings!saved_listings_listing_id_fkey(*, owner:profiles!listings_owner_user_id_fkey(name,flat,whatsapp,phone))')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.listing as ListingRow)
    .filter(Boolean);
}
