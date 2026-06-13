import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  COMMUNITY_ID,
  LISTING_PHOTOS_BUCKET,
  isSupabaseConfigured,
  supabase,
} from './supabase';
import type { ListingRow, ListingStatus } from './types';

const FEED_CACHE_PREFIX = 'aangan:listings-cache:';

async function getCachedListings(category: string): Promise<ListingRow[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_PREFIX + category);
    return raw ? (JSON.parse(raw) as ListingRow[]) : [];
  } catch {
    return [];
  }
}

async function cacheListings(category: string, rows: ListingRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_CACHE_PREFIX + category, JSON.stringify(rows));
  } catch { /* best-effort */ }
}

// ── Feed ────────────────────────────────────────────────────────────

export async function fetchListings(
  category: string,
  communityId: string = COMMUNITY_ID,
  offset = 0,
  limit = 20,
): Promise<ListingRow[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*, owner:profiles!listings_owner_user_id_fkey(name,flat,whatsapp,phone,upi)')
    .eq('community_id', communityId)
    .eq('category', category)
    .eq('status', 'active')
    .order('bump_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as ListingRow[];
  if (offset === 0) cacheListings(category, rows);
  return rows;
}

const LISTING_SELECT = '*, owner:profiles!listings_owner_user_id_fkey(name,flat,whatsapp,phone,upi)';

/**
 * Search active listings in a community. Uses the full-text index (migration
 * 0022, stemmed + ranked) first; falls back to substring `ilike` for partial
 * tokens FTS can't stem. With no query (category-only) returns the newest.
 */
export async function searchListings(query: string, communityId: string = COMMUNITY_ID, category?: string): Promise<ListingRow[]> {
  const q = query.trim();
  const base = () => {
    let b = supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('community_id', communityId)
      .eq('status', 'active');
    if (category) b = b.eq('category', category);
    return b;
  };

  if (!q) {
    const { data, error } = await base().order('bump_at', { ascending: false }).limit(40);
    if (error) throw error;
    return (data ?? []) as ListingRow[];
  }

  // Full-text first (GIN index, stemmed).
  const { data: fts, error: ftsErr } = await base()
    .textSearch('search_tsv', q, { type: 'websearch', config: 'english' })
    .order('bump_at', { ascending: false })
    .limit(40);
  if (ftsErr) throw ftsErr;
  if (fts && fts.length) return fts as ListingRow[];

  // Fallback: substring match for partial tokens. Neutralise PostgREST/ilike
  // metacharacters so the query can't be broken out of (RLS still backstops).
  const safe = q.replace(/[%_,()*\\]/g, ' ').trim();
  const { data, error } = await base()
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('bump_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export { getCachedListings };

/**
 * Active-listing count per category for the Home tiles, plus today's available
 * dishes counted under the `food` key (dishes are a separate engine).
 */
export async function fetchCategoryCounts(communityId: string = COMMUNITY_ID): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const { data } = await supabase
      .from('listings')
      .select('category')
      .eq('community_id', communityId)
      .eq('status', 'active')
      .limit(5000);
    for (const r of (data ?? []) as { category: string }[]) counts[r.category] = (counts[r.category] ?? 0) + 1;
  } catch { /* best-effort */ }
  try {
    const today = new Date().toLocaleDateString('en-CA');
    const { count } = await supabase
      .from('dishes')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .gte('serve_date', today)
      .gt('plates_left', 0);
    if (count) counts.food = count;
  } catch { /* best-effort */ }
  return counts;
}

/** All active listings in a community across every category (newest-bumped first). */
export async function fetchAllListings(
  communityId: string = COMMUNITY_ID,
  offset = 0,
  limit = 30,
): Promise<ListingRow[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('community_id', communityId)
    .eq('status', 'active')
    .order('bump_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export async function fetchListingById(id: string): Promise<ListingRow | null> {
  const { data, error } = await supabase
    .from('listings')
    .select('*, owner:profiles!listings_owner_user_id_fkey(name,flat,whatsapp,phone,upi)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ListingRow) ?? null;
}

export async function fetchMyListings(userId: string): Promise<ListingRow[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export function subscribeToListings(category: string, communityId: string | undefined, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const opts: { event: '*'; schema: string; table: string; filter?: string } = { event: '*', schema: 'public', table: 'listings' };
  if (communityId) opts.filter = `community_id=eq.${communityId}`; // only this society's writes
  const channel = supabase
    .channel(`listings-${communityId ?? 'all'}-${category}`)
    .on('postgres_changes', opts, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Photo upload ────────────────────────────────────────────────────

export async function uploadListingPhoto(localUri: string, listingId: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1000 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
  );
  const res = await fetch(manipulated.uri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `${COMMUNITY_ID}/${listingId}/0.jpg`;
  const { error } = await supabase.storage
    .from(LISTING_PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Create ──────────────────────────────────────────────────────────

export interface NewListingInput {
  category: string;
  communityId?: string; // defaults to COMMUNITY_ID
  ownerUserId: string;
  title: string;
  description: string;
  photoUri: string | null;
  price: number | null;
  priceUnit: string | null;
  whatsapp: string | null;
  location: string | null;
  isReferral: boolean;
  referralName: string | null;
  referralPhone: string | null;
  attributes: Record<string, unknown>;
}

export async function postListing(input: NewListingInput): Promise<ListingRow> {
  const id = Crypto.randomUUID();

  let photos: string[] = [];
  if (input.photoUri) {
    photos = [await uploadListingPhoto(input.photoUri, id)];
  }

  const row = {
    id,
    community_id: input.communityId ?? COMMUNITY_ID,
    category: input.category,
    owner_user_id: input.ownerUserId,
    title: input.title.trim(),
    description: input.description.trim() || null,
    photos,
    price: input.price,
    price_unit: input.priceUnit,
    contact_whatsapp: input.whatsapp?.trim() || null,
    location: input.location?.trim() || null,
    status: 'active' as ListingStatus,
    is_referral: input.isReferral,
    referral_name: input.referralName?.trim() || null,
    referral_phone: input.referralPhone?.trim() || null,
    attributes: input.attributes,
  };

  const { data, error } = await supabase.from('listings').insert(row).select().single();
  if (error) throw error;
  return data as ListingRow;
}

// ── Status changes (owner / admin) ──────────────────────────────────

export async function setListingStatus(id: string, status: ListingStatus): Promise<void> {
  const { error } = await supabase.from('listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('listings').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ── WhatsApp contact links ──────────────────────────────────────────

function waPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export function waLink(phone: string | null | undefined, message: string): string {
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function buildInquiryWhatsAppLink(listing: ListingRow, senderName: string, message: string): string {
  const ownerPhone = listing.contact_whatsapp ?? listing.owner?.whatsapp ?? null;
  const target = listing.is_referral ? listing.referral_phone : null;
  const phone = target ?? ownerPhone;
  const ctaMsg =
    message.trim()
      ? `Hi! I found your listing *${listing.title}* on Aangan.\n\n${message.trim()}`
      : `Hi! I'm interested in *${listing.title}* on Aangan. (from ${senderName})`;
  return waLink(phone, ctaMsg);
}
