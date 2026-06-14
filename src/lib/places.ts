import * as ImageManipulator from 'expo-image-manipulator';
import { COMMUNITY_ID, LISTING_PHOTOS_BUCKET, isSupabaseConfigured, supabase } from './supabase';

// ── Place types (the sub-categories shown as filter tabs) ───────────
export interface PlaceType {
  key: string;
  label: string;
  icon: string;   // Ionicons name
  color: string;
}

export const PLACE_TYPES: PlaceType[] = [
  { key: 'hospital',   label: 'Hospital',         icon: 'medkit',     color: '#DC2626' },
  { key: 'clinic',     label: 'Clinic / Doctor',  icon: 'medical',    color: '#EF4444' },
  { key: 'pharmacy',   label: 'Pharmacy',         icon: 'bandage',    color: '#16A34A' },
  { key: 'school',     label: 'School',           icon: 'school',     color: '#4F80E2' },
  { key: 'daycare',    label: 'Daycare / Preschool', icon: 'happy',   color: '#F59E0B' },
  { key: 'grocery',    label: 'Supermarket / Grocery', icon: 'cart',  color: '#16A34A' },
  { key: 'salon',      label: 'Salon / Spa',      icon: 'cut',        color: '#DB2777' },
  { key: 'restaurant', label: 'Restaurant / Café', icon: 'restaurant', color: '#E8650A' },
  { key: 'gym',        label: 'Gym / Fitness',    icon: 'barbell',    color: '#6366F1' },
  { key: 'bank',       label: 'Bank / ATM',       icon: 'card',       color: '#0891B2' },
  { key: 'petrol',     label: 'Petrol Pump',      icon: 'car',        color: '#64748B' },
  { key: 'vet',        label: 'Vet',              icon: 'paw',        color: '#92400E' },
  { key: 'worship',    label: 'Temple / Worship', icon: 'flower',     color: '#CA8A04' },
  { key: 'other',      label: 'Other',            icon: 'location',   color: '#6B7280' },
];

export const placeTypeMeta = (key: string | null): PlaceType =>
  PLACE_TYPES.find((t) => t.key === key) ?? PLACE_TYPES[PLACE_TYPES.length - 1];

export interface PlaceRow {
  id: string;
  community_id: string;
  created_by: string;
  place_type: string;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  hours: string | null;
  photos: string[];
  created_at: string;
  bump_at: string;
  creator?: { name: string; flat: string | null } | null;
}

const SELECT = '*, creator:profiles!places_created_by_fkey(name,flat)';

export async function fetchPlaces(
  opts: { type?: string } = {},
  communityId: string = COMMUNITY_ID,
): Promise<PlaceRow[]> {
  let q = supabase.from('places').select(SELECT).eq('community_id', communityId);
  if (opts.type) q = q.eq('place_type', opts.type);
  const { data, error } = await q.order('bump_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as PlaceRow[];
}

export async function fetchPlaceById(id: string): Promise<PlaceRow | null> {
  const { data, error } = await supabase.from('places').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as PlaceRow) ?? null;
}

export async function fetchPlaceCount(communityId: string = COMMUNITY_ID): Promise<number> {
  try {
    const { count } = await supabase
      .from('places').select('id', { count: 'exact', head: true }).eq('community_id', communityId);
    return count ?? 0;
  } catch { return 0; }
}

/** Compress + upload one photo to `place/<id>/<index>.jpg`; returns its public URL. */
export async function uploadPlacePhoto(localUri: string, placeId: string, index = 0): Promise<string> {
  const m = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 1200 } }], {
    compress: 0.7, format: ImageManipulator.SaveFormat.JPEG,
  });
  const res = await fetch(m.uri);
  const buf = await res.arrayBuffer();
  const path = `place/${placeId}/${index}.jpg`;
  const { error } = await supabase.storage.from(LISTING_PHOTOS_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface NewPlaceInput {
  communityId?: string;
  createdBy: string;
  placeType: string;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  hours: string | null;
  photoUris: string[]; // local URIs to upload
}

export async function createPlace(input: NewPlaceInput): Promise<PlaceRow> {
  const { data, error } = await supabase.from('places').insert({
    community_id: input.communityId ?? COMMUNITY_ID,
    created_by: input.createdBy,
    place_type: input.placeType,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    address: input.address?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    phone: input.phone?.replace(/[^\d+]/g, '') || null,
    whatsapp: input.whatsapp?.replace(/\D/g, '') || null,
    website: input.website?.trim() || null,
    hours: input.hours?.trim() || null,
  }).select(SELECT).single();
  if (error) throw error;
  const place = data as PlaceRow;
  if (input.photoUris.length) {
    const urls: string[] = [];
    for (let i = 0; i < input.photoUris.length; i++) {
      try { urls.push(await uploadPlacePhoto(input.photoUris[i], place.id, i)); } catch { /* skip bad photo */ }
    }
    if (urls.length) {
      await supabase.from('places').update({ photos: urls }).eq('id', place.id);
      place.photos = urls;
    }
  }
  return place;
}

export interface UpdatePlaceInput {
  placeType?: string;
  name?: string;
  description?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  hours?: string | null;
  photos?: string[]; // final URL list (already-uploaded public URLs)
}

export async function updatePlace(id: string, patch: UpdatePlaceInput): Promise<void> {
  const row: Record<string, unknown> = { bump_at: new Date().toISOString() };
  if (patch.placeType !== undefined) row.place_type = patch.placeType;
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.address !== undefined) row.address = patch.address?.trim() || null;
  if (patch.lat !== undefined) row.lat = patch.lat;
  if (patch.lng !== undefined) row.lng = patch.lng;
  if (patch.phone !== undefined) row.phone = patch.phone?.replace(/[^\d+]/g, '') || null;
  if (patch.whatsapp !== undefined) row.whatsapp = patch.whatsapp?.replace(/\D/g, '') || null;
  if (patch.website !== undefined) row.website = patch.website?.trim() || null;
  if (patch.hours !== undefined) row.hours = patch.hours?.trim() || null;
  if (patch.photos !== undefined) row.photos = patch.photos;
  const { error } = await supabase.from('places').update(row).eq('id', id);
  if (error) throw error;
}

export async function deletePlace(id: string): Promise<void> {
  const { error } = await supabase.from('places').delete().eq('id', id);
  if (error) throw error;
}

export function subscribePlaces(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase.channel(`places-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `community_id=eq.${communityId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
