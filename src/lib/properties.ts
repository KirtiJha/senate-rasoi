import * as ImageManipulator from 'expo-image-manipulator';
import { COMMUNITY_ID, LISTING_PHOTOS_BUCKET, isSupabaseConfigured, supabase } from './supabase';

export type ListingType = 'sale' | 'rent';
export type PropertyStatus = 'available' | 'sold' | 'rented';
export type Furnishing = 'unfurnished' | 'semi' | 'furnished';
export type Parking = 'none' | 'open' | 'covered';
export type ReferralStatus = 'new' | 'contacted' | 'closed';

export interface PropertyOwner {
  name: string;
  flat: string | null;
  whatsapp: string | null;
  phone: string | null;
}

export interface PropertyRow {
  id: string;
  community_id: string;
  owner_user_id: string;
  listing_type: ListingType;
  title: string;
  description: string | null;
  config: string | null;
  area_sqft: number | null;
  floor: number | null;
  total_floors: number | null;
  furnishing: Furnishing | null;
  facing: string | null;
  bathrooms: number | null;
  balconies: number | null;
  parking: Parking | null;
  tower: string | null;
  flat_no: string | null;
  available_from: string | null;
  amenities: string[];
  photos: string[];
  contact_whatsapp: string | null;
  contact_phone: string | null;
  status: PropertyStatus;
  bump_at: string;
  created_at: string;
  owner?: PropertyOwner;
}

export interface PropertyReferralRow {
  id: string;
  property_id: string;
  referrer_id: string;
  candidate_name: string;
  candidate_phone: string | null;
  note: string | null;
  status: ReferralStatus;
  created_at: string;
  referrer?: { name: string; flat: string | null };
}

// ── Form option sets ────────────────────────────────────────────────
export const CONFIG_OPTIONS = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'];
export const FURNISHING_OPTIONS: { value: Furnishing; label: string }[] = [
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'semi', label: 'Semi-furnished' },
  { value: 'furnished', label: 'Furnished' },
];
export const PARKING_OPTIONS: { value: Parking; label: string }[] = [
  { value: 'none', label: 'No parking' },
  { value: 'open', label: 'Open' },
  { value: 'covered', label: 'Covered' },
];
export const FACING_OPTIONS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
export const AMENITY_OPTIONS = ['Lift', 'Power backup', 'Security', '24x7 water', 'Gym', 'Swimming pool', 'Club house', 'Park', 'Play area', 'Gas pipeline', 'Modular kitchen', 'Pet friendly'];

const SELECT = '*, owner:profiles!property_listings_owner_user_id_fkey(name,flat,whatsapp,phone)';

export interface PropertyFilters {
  type?: ListingType | 'all';
  availableOnly?: boolean;
  mine?: string; // owner user id
}

export async function fetchProperties(filters: PropertyFilters = {}, communityId: string = COMMUNITY_ID): Promise<PropertyRow[]> {
  let q = supabase.from('property_listings').select(SELECT).eq('community_id', communityId);
  if (filters.type && filters.type !== 'all') q = q.eq('listing_type', filters.type);
  if (filters.availableOnly) q = q.eq('status', 'available');
  if (filters.mine) q = q.eq('owner_user_id', filters.mine);
  q = q.order('bump_at', { ascending: false }).limit(100);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export async function fetchPropertyById(id: string): Promise<PropertyRow | null> {
  const { data, error } = await supabase.from('property_listings').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as PropertyRow) ?? null;
}

export async function fetchMyProperties(userId: string): Promise<PropertyRow[]> {
  const { data, error } = await supabase
    .from('property_listings').select(SELECT)
    .eq('owner_user_id', userId).order('bump_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export interface NewProperty {
  communityId?: string;
  ownerUserId: string;
  listingType: ListingType;
  title: string;
  description: string | null;
  config: string | null;
  areaSqft: number | null;
  floor: number | null;
  totalFloors: number | null;
  furnishing: Furnishing | null;
  facing: string | null;
  bathrooms: number | null;
  balconies: number | null;
  parking: Parking | null;
  tower: string | null;
  flatNo: string | null;
  availableFrom: string | null;
  amenities: string[];
  contactWhatsapp: string | null;
  contactPhone: string | null;
  photoUris: string[];
}

export async function uploadPropertyPhoto(localUri: string, propertyId: string, index: number): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false },
  );
  const res = await fetch(manipulated.uri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `property/${propertyId}/${index}.jpg`;
  const { error } = await supabase.storage
    .from(LISTING_PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function postProperty(input: NewProperty): Promise<PropertyRow> {
  const { data, error } = await supabase
    .from('property_listings')
    .insert({
      community_id: input.communityId ?? COMMUNITY_ID,
      owner_user_id: input.ownerUserId,
      listing_type: input.listingType,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      config: input.config,
      area_sqft: input.areaSqft,
      floor: input.floor,
      total_floors: input.totalFloors,
      furnishing: input.furnishing,
      facing: input.facing,
      bathrooms: input.bathrooms,
      balconies: input.balconies,
      parking: input.parking,
      tower: input.tower?.trim() || null,
      flat_no: input.flatNo?.trim() || null,
      available_from: input.availableFrom,
      amenities: input.amenities,
      contact_whatsapp: input.contactWhatsapp?.replace(/\D/g, '') || null,
      contact_phone: input.contactPhone?.replace(/\D/g, '') || null,
      photos: [],
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  const prop = data as PropertyRow;
  if (input.photoUris.length) {
    const urls: string[] = [];
    for (let i = 0; i < input.photoUris.length; i++) {
      try { urls.push(await uploadPropertyPhoto(input.photoUris[i], prop.id, i)); } catch { /* skip a bad photo */ }
    }
    if (urls.length) {
      await supabase.from('property_listings').update({ photos: urls }).eq('id', prop.id);
      prop.photos = urls;
    }
  }
  return prop;
}

export async function setPropertyStatus(id: string, status: PropertyStatus): Promise<void> {
  const { error } = await supabase.from('property_listings').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Update an existing listing. `photos` is the final URL list (kept + newly uploaded). */
export async function updateProperty(
  id: string,
  input: Omit<NewProperty, 'communityId' | 'ownerUserId' | 'photoUris'> & { photos: string[] },
): Promise<void> {
  const { error } = await supabase.from('property_listings').update({
    listing_type: input.listingType,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    config: input.config,
    area_sqft: input.areaSqft,
    floor: input.floor,
    total_floors: input.totalFloors,
    furnishing: input.furnishing,
    facing: input.facing,
    bathrooms: input.bathrooms,
    balconies: input.balconies,
    parking: input.parking,
    tower: input.tower?.trim() || null,
    flat_no: input.flatNo?.trim() || null,
    available_from: input.availableFrom,
    amenities: input.amenities,
    contact_whatsapp: input.contactWhatsapp?.replace(/\D/g, '') || null,
    contact_phone: input.contactPhone?.replace(/\D/g, '') || null,
    photos: input.photos,
    bump_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteProperty(id: string): Promise<void> {
  const { error } = await supabase.from('property_listings').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeProperties(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`property-listings-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'property_listings', filter: `community_id=eq.${communityId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ── Referrals (recommend a buyer / tenant) ──────────────────────────
const REF_SELECT = '*, referrer:profiles!property_referrals_referrer_id_fkey(name,flat)';

export async function createReferral(
  propertyId: string,
  referrerId: string,
  input: { candidateName: string; candidatePhone: string | null; note: string | null },
): Promise<PropertyReferralRow> {
  const { data, error } = await supabase
    .from('property_referrals')
    .insert({
      property_id: propertyId,
      referrer_id: referrerId,
      candidate_name: input.candidateName.trim(),
      candidate_phone: input.candidatePhone?.replace(/\D/g, '') || null,
      note: input.note?.trim() || null,
    })
    .select(REF_SELECT)
    .single();
  if (error) throw error;
  return data as PropertyReferralRow;
}

export async function fetchReferrals(propertyId: string): Promise<PropertyReferralRow[]> {
  const { data, error } = await supabase
    .from('property_referrals').select(REF_SELECT)
    .eq('property_id', propertyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyReferralRow[];
}

export async function setReferralStatus(id: string, status: ReferralStatus): Promise<void> {
  const { error } = await supabase.from('property_referrals').update({ status }).eq('id', id);
  if (error) throw error;
}

export function subscribeReferrals(propertyId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`property-referrals-${propertyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'property_referrals', filter: `property_id=eq.${propertyId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ── Display helpers ─────────────────────────────────────────────────
export function propertySubtitle(p: PropertyRow): string {
  const bits: string[] = [];
  if (p.config) bits.push(p.config);
  if (p.area_sqft) bits.push(`${p.area_sqft} sq.ft`);
  if (p.furnishing) bits.push(p.furnishing === 'semi' ? 'Semi-furnished' : p.furnishing === 'furnished' ? 'Furnished' : 'Unfurnished');
  return bits.join(' · ');
}
