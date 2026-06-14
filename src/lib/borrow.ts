import * as ImageManipulator from 'expo-image-manipulator';
import { COMMUNITY_ID, LISTING_PHOTOS_BUCKET, isSupabaseConfigured, supabase } from './supabase';

export type LendStatus = 'available' | 'lent' | 'unavailable';
export type BorrowStatus = 'pending' | 'accepted' | 'declined' | 'returned';
export type LendKind = 'offer' | 'request';

export const BORROW_CATEGORIES = [
  { key: 'tools', label: 'Tools', icon: 'construct' },
  { key: 'kitchen', label: 'Kitchen', icon: 'restaurant' },
  { key: 'party', label: 'Party & events', icon: 'balloon' },
  { key: 'kids', label: 'Kids', icon: 'happy' },
  { key: 'books', label: 'Books & games', icon: 'book' },
  { key: 'medical', label: 'Medical', icon: 'medkit' },
  { key: 'outdoor', label: 'Outdoor & travel', icon: 'bicycle' },
  { key: 'other', label: 'Other', icon: 'cube' },
] as const;

export interface LendItem {
  id: string;
  community_id: string;
  owner_user_id: string;
  kind: LendKind;
  title: string;
  description: string | null;
  category: string | null;
  photo_url: string | null;
  status: LendStatus;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  created_at: string;
  bump_at: string;
  owner?: { name: string; flat: string | null; whatsapp: string | null; phone: string | null };
}

export interface BorrowRequest {
  id: string;
  item_id: string;
  requester_id: string;
  note: string | null;
  status: BorrowStatus;
  created_at: string;
  requester?: { name: string; flat: string | null; whatsapp: string | null; phone: string | null };
}

const SELECT = '*, owner:profiles!lend_items_owner_user_id_fkey(name,flat,whatsapp,phone)';
const REQ_SELECT = '*, requester:profiles!borrow_requests_requester_id_fkey(name,flat,whatsapp,phone)';

export async function fetchItems(opts: { category?: string; availableOnly?: boolean; mine?: string; kind?: LendKind } = {}, communityId: string = COMMUNITY_ID): Promise<LendItem[]> {
  let q = supabase.from('lend_items').select(SELECT).eq('community_id', communityId);
  if (opts.kind) q = q.eq('kind', opts.kind);
  if (opts.category && opts.category !== 'all') q = q.eq('category', opts.category);
  if (opts.availableOnly) q = q.eq('status', 'available');
  if (opts.mine) q = q.eq('owner_user_id', opts.mine);
  const { data, error } = await q.order('bump_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as LendItem[];
}

export async function fetchBorrowCounts(communityId: string = COMMUNITY_ID): Promise<{ offers: number; requests: number }> {
  const { data } = await supabase
    .from('lend_items')
    .select('kind', { count: 'exact', head: false })
    .eq('community_id', communityId)
    .eq('status', 'available');
  const rows = (data ?? []) as { kind: LendKind }[];
  return {
    offers: rows.filter((r) => r.kind === 'offer').length,
    requests: rows.filter((r) => r.kind === 'request').length,
  };
}

export async function fetchItem(id: string): Promise<LendItem | null> {
  const { data, error } = await supabase.from('lend_items').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as LendItem) ?? null;
}

export async function uploadItemPhoto(localUri: string, itemId: string): Promise<string> {
  const m = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 1000 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const res = await fetch(m.uri);
  const buf = await res.arrayBuffer();
  const path = `borrow/${itemId}/0.jpg`;
  const { error } = await supabase.storage.from(LISTING_PHOTOS_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function postItem(input: {
  communityId?: string; ownerUserId: string; kind?: LendKind; title: string; description: string | null; category: string | null;
  photoUri: string | null; contactWhatsapp: string | null; contactPhone: string | null;
}): Promise<LendItem> {
  const { data, error } = await supabase.from('lend_items').insert({
    community_id: input.communityId ?? COMMUNITY_ID,
    owner_user_id: input.ownerUserId,
    kind: input.kind ?? 'offer',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    contact_whatsapp: input.contactWhatsapp?.replace(/\D/g, '') || null,
    contact_phone: input.contactPhone?.replace(/\D/g, '') || null,
  }).select(SELECT).single();
  if (error) throw error;
  const item = data as LendItem;
  if (input.photoUri) {
    try {
      const url = await uploadItemPhoto(input.photoUri, item.id);
      await supabase.from('lend_items').update({ photo_url: url }).eq('id', item.id);
      item.photo_url = url;
    } catch { /* skip bad photo */ }
  }
  return item;
}

export async function setItemStatus(id: string, status: LendStatus): Promise<void> {
  const { error } = await supabase.from('lend_items').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateItem(id: string, patch: { title?: string; description?: string | null; category?: string | null; photo_url?: string | null }): Promise<void> {
  const { error } = await supabase.from('lend_items').update({
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.photo_url !== undefined ? { photo_url: patch.photo_url } : {}),
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('lend_items').delete().eq('id', id);
  if (error) throw error;
}

export async function requestBorrow(itemId: string, requesterId: string, note: string | null): Promise<BorrowRequest> {
  const { data, error } = await supabase.from('borrow_requests')
    .insert({ item_id: itemId, requester_id: requesterId, note: note?.trim() || null })
    .select(REQ_SELECT).single();
  if (error) throw error;
  return data as BorrowRequest;
}

export async function fetchRequests(itemId: string): Promise<BorrowRequest[]> {
  const { data, error } = await supabase.from('borrow_requests').select(REQ_SELECT).eq('item_id', itemId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BorrowRequest[];
}

export async function setRequestStatus(id: string, status: BorrowStatus): Promise<void> {
  const { error } = await supabase.from('borrow_requests').update({ status }).eq('id', id);
  if (error) throw error;
}

export function subscribeItems(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase.channel(`lend-items-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lend_items', filter: `community_id=eq.${communityId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeRequests(itemId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase.channel(`borrow-requests-${itemId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_requests', filter: `item_id=eq.${itemId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
