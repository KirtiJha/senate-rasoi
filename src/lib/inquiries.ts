import { isSupabaseConfigured, supabase } from './supabase';
import type { InquiryRow } from './types';

/** Record an in-app inquiry (best-effort — WhatsApp is the primary CTA). */
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

/** A user's own inquiry history. */
export async function fetchMyInquiries(userId: string): Promise<InquiryRow[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InquiryRow[];
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
