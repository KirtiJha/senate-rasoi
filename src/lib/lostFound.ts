import * as ImageManipulator from 'expo-image-manipulator';
import { COMMUNITY_ID, LISTING_PHOTOS_BUCKET, isSupabaseConfigured, supabase } from './supabase';

export type LostFoundKind = 'lost' | 'found';
export type LostFoundStatus = 'open' | 'resolved';

export const LOST_FOUND_CATEGORIES = [
  { key: 'keys', label: 'Keys', icon: 'key' },
  { key: 'phone', label: 'Phone', icon: 'phone-portrait' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet' },
  { key: 'documents', label: 'Documents', icon: 'document-text' },
  { key: 'bag', label: 'Bag', icon: 'bag' },
  { key: 'kids-toy', label: "Kid's toy", icon: 'happy' },
  { key: 'pet', label: 'Pet', icon: 'paw' },
  { key: 'jewellery', label: 'Jewellery', icon: 'diamond' },
  { key: 'other', label: 'Other', icon: 'cube' },
] as const;

export interface LostFoundItem {
  id: string;
  community_id: string;
  owner_user_id: string;
  kind: LostFoundKind;
  title: string;
  description: string | null;
  category: string | null;
  photo_url: string | null;
  contact_whatsapp: string | null;
  status: LostFoundStatus;
  created_at: string;
  bump_at: string;
  owner?: { name: string; flat: string | null; whatsapp: string | null; phone: string | null };
}

const SELECT = '*, owner:profiles!lost_found_items_owner_user_id_fkey(name,flat,whatsapp,phone)';

export async function fetchLostFoundItems(
  opts: { kind?: LostFoundKind; openOnly?: boolean; mine?: string } = {},
  communityId: string = COMMUNITY_ID,
): Promise<LostFoundItem[]> {
  let q = supabase.from('lost_found_items').select(SELECT).eq('community_id', communityId);
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.openOnly) q = q.eq('status', 'open');
  if (opts.mine) q = q.eq('owner_user_id', opts.mine);
  const { data, error } = await q.order('bump_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as LostFoundItem[];
}

export async function fetchLostFoundItem(id: string): Promise<LostFoundItem | null> {
  const { data, error } = await supabase.from('lost_found_items').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as LostFoundItem) ?? null;
}

export async function fetchLostFoundCounts(communityId: string = COMMUNITY_ID): Promise<number> {
  const { count } = await supabase
    .from('lost_found_items')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'open');
  return count ?? 0;
}

export async function uploadLostFoundPhoto(localUri: string, itemId: string): Promise<string> {
  const m = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 1000 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const res = await fetch(m.uri);
  const buf = await res.arrayBuffer();
  const path = `lost-found/${itemId}/0.jpg`;
  const { error } = await supabase.storage.from(LISTING_PHOTOS_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function postLostFoundItem(input: {
  communityId?: string;
  ownerUserId: string;
  kind: LostFoundKind;
  title: string;
  description: string | null;
  category: string | null;
  photoUri: string | null;
  contactWhatsapp: string | null;
}): Promise<LostFoundItem> {
  const { data, error } = await supabase.from('lost_found_items').insert({
    community_id: input.communityId ?? COMMUNITY_ID,
    owner_user_id: input.ownerUserId,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    contact_whatsapp: input.contactWhatsapp?.replace(/\D/g, '') || null,
  }).select(SELECT).single();
  if (error) throw error;
  const item = data as LostFoundItem;
  if (input.photoUri) {
    try {
      const url = await uploadLostFoundPhoto(input.photoUri, item.id);
      await supabase.from('lost_found_items').update({ photo_url: url }).eq('id', item.id);
      item.photo_url = url;
    } catch { /* skip bad photo */ }
  }
  return item;
}

export async function updateLostFoundItem(id: string, patch: {
  title?: string;
  description?: string | null;
  category?: string | null;
  photo_url?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('lost_found_items').update({
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.photo_url !== undefined ? { photo_url: patch.photo_url } : {}),
  }).eq('id', id);
  if (error) throw error;
}

export async function setLostFoundStatus(id: string, status: LostFoundStatus): Promise<void> {
  const { error } = await supabase.from('lost_found_items').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteLostFoundItem(id: string): Promise<void> {
  const { error } = await supabase.from('lost_found_items').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeLostFoundItems(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`lost-found-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found_items', filter: `community_id=eq.${communityId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
