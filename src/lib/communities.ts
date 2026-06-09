import { supabase } from './supabase';

export interface Community {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  lat?: number | null;
  lon?: number | null;
  osm_place_id?: string | null;
  city?: string | null;
}

const COMMUNITY_COLS = 'id, name, slug, address, lat, lon, osm_place_id, city';

export async function fetchCommunities(): Promise<Community[]> {
  const { data, error } = await supabase
    .from('communities')
    .select(COMMUNITY_COLS)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Community[];
}

export async function fetchCommunityById(id: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from('communities')
    .select(COMMUNITY_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Community | null;
}

/** Is a real-world place already on Aangan? (de-dupe by OpenStreetMap id) */
export async function findCommunityByOsm(osmPlaceId: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from('communities')
    .select(COMMUNITY_COLS)
    .eq('osm_place_id', osmPlaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as Community) ?? null;
}

export interface NewCommunity {
  name: string;
  address: string;
  lat?: number | null;
  lon?: number | null;
  osmPlaceId?: string | null;
  city?: string | null;
  createdBy: string;
}

/** Create a society (the caller becomes its admin). Throws 'duplicate-society'
 *  if that place is already onboarded. Requires an authenticated session. */
export async function createCommunity(input: NewCommunity): Promise<Community> {
  const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'society';
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabase
    .from('communities')
    .insert({
      name: input.name.trim(),
      slug,
      address: input.address.trim() || null,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      osm_place_id: input.osmPlaceId ?? null,
      city: input.city ?? null,
      created_by: input.createdBy,
    })
    .select(COMMUNITY_COLS)
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('duplicate-society');
    throw error;
  }
  return data as Community;
}

export async function submitJoinRequest(input: {
  societyName: string;
  societyAddress: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail?: string;
}): Promise<void> {
  const { error } = await supabase.from('society_join_requests').insert({
    society_name: input.societyName.trim(),
    society_address: input.societyAddress.trim(),
    requester_name: input.requesterName.trim(),
    requester_phone: input.requesterPhone.replace(/\D/g, ''),
    requester_email: input.requesterEmail?.trim() || null,
  });
  if (error) throw error;
}
