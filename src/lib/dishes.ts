import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  COMMUNITY_ID,
  DISH_PHOTOS_BUCKET,
  isSupabaseConfigured,
  supabase,
} from './supabase';
import type { ChefOrder, DishRow, OrderStatus, Profile, Slot, VegType } from './types';

// ── Instant cold-start: cache the last feed on-device ───────────────
const FEED_CACHE_KEY = 'senate-rasoi:feed-cache';

export async function getCachedDishes(): Promise<DishRow[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    return raw ? (JSON.parse(raw) as DishRow[]) : [];
  } catch {
    return [];
  }
}

async function cacheDishes(dishes: DishRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(dishes));
  } catch {
    /* best-effort */
  }
}

// ── Read the board ──────────────────────────────────────────────────
/** Today's + upcoming dishes (past serve-dates are hidden). */
export async function fetchDishes(): Promise<DishRow[]> {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('community_id', COMMUNITY_ID)
    .gte('serve_date', today)
    .order('serve_date', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DishRow[];
  cacheDishes(rows); // fire-and-forget for next cold-start
  return rows;
}

/**
 * Subscribe to live changes on the dishes table. Returns an unsubscribe fn.
 * We keep it simple: any change triggers a refetch by the caller.
 */
export function subscribeToDishes(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('dishes-board')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dishes' },
      () => onChange()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Photo upload ────────────────────────────────────────────────────
/**
 * Compress + upload a dish photo to Supabase Storage. Returns the public URL.
 * Client-side compression keeps the bucket small (PLAN.md §2: no base64 bloat).
 */
export async function uploadDishPhoto(localUri: string, dishId: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1000 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
  );

  const res = await fetch(manipulated.uri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `${COMMUNITY_ID}/${dishId}.jpg`;

  const { error } = await supabase.storage
    .from(DISH_PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(DISH_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** A chef's recent dishes (incl. past), de-duped by name — for quick re-posting. */
export async function fetchMyRecentDishes(userId: string): Promise<DishRow[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('chef_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(24);
  if (error) throw error;
  const seen = new Set<string>();
  const out: DishRow[] = [];
  for (const d of (data ?? []) as DishRow[]) {
    const k = d.dish_name.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(d);
    }
  }
  return out.slice(0, 8);
}

// ── Post a dish ─────────────────────────────────────────────────────
export interface NewDishInput {
  chefUserId: string; // owner (auth.uid())
  profile: Profile; // denormalised chef name/flat/whatsapp/upi for display
  dishName: string;
  slot: Slot;
  vegType: VegType;
  price: number;
  maxPlates: number;
  description: string;
  photoUri: string | null;
  orderBy: string | null; // ISO deadline to accept orders, or null for no limit
  serveDate: string; // YYYY-MM-DD
}

export async function postDish(input: NewDishInput): Promise<DishRow> {
  // Pre-generate the id (a real UUID) so the photo path can reference it.
  const id = Crypto.randomUUID();

  let photoUrl: string | null = null;
  if (input.photoUri) {
    photoUrl = await uploadDishPhoto(input.photoUri, id);
  }

  const row = {
    id,
    community_id: COMMUNITY_ID,
    chef_user_id: input.chefUserId, // ownership (RLS enforces auth.uid() = this)
    chef_name: input.profile.chefName.trim(),
    flat: input.profile.flat.trim(),
    whatsapp: input.profile.whatsapp.trim(),
    upi: input.profile.upi.trim() || null,
    dish_name: input.dishName.trim(),
    slot: input.slot,
    veg_type: input.vegType,
    price: input.price,
    max_plates: input.maxPlates,
    plates_left: input.maxPlates, // must equal max_plates per the RLS insert check
    description: input.description.trim() || null,
    photo_url: photoUrl,
    order_by: input.orderBy, // chef-set "accept orders until" deadline
    serve_date: input.serveDate,
  };

  const { data, error } = await supabase.from('dishes').insert(row).select().single();
  if (error) throw error;
  return data as DishRow;
}

// ── Place an order (atomic reserve + pending order row) ─────────────
/** Returns the new server order id, or null if it couldn't be filled / closed. */
export async function placeOrder(dishId: string, qty: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('place_order', { p_dish_id: dishId, p_qty: qty });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ── Chef: read + manage orders for one of your dishes ───────────────
export async function listChefOrders(dishId: string): Promise<ChefOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, orderer:profiles!orders_orderer_user_id_fkey(name,flat,whatsapp,phone)')
    .eq('dish_id', dishId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ChefOrder[];
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
  return Boolean(data);
}

// ── Remove your own dish (RLS: only owner or admin can delete) ──────
export async function deleteDish(dishId: string): Promise<boolean> {
  const { data, error } = await supabase.from('dishes').delete().eq('id', dishId).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ── WhatsApp deep links (free "tap-to-notify") ──────────────────────
function waPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits; // assume India for 10-digit
}

export function waLink(phone: string | null | undefined, message: string): string {
  return `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(message)}`;
}

/** Foodie → chef, sent when placing an order. */
export function buildWhatsAppOrderLink(dish: DishRow, qty: number): string {
  const msg =
    `Hi ${dish.chef_name}! I just ordered on Aangan 🍽️\n\n` +
    `*${dish.dish_name}* × ${qty} = ₹${dish.price * qty}\n\n` +
    `Please confirm. Thanks!`;
  return waLink(dish.whatsapp, msg);
}

/** Chef → foodie, a friendly nudge for a status change. */
export function statusMessageForFoodie(dishName: string, status: OrderStatus): string {
  const line: Record<OrderStatus, string> = {
    placed: `I’ve got your order for *${dishName}*.`,
    accepted: `Your order for *${dishName}* is confirmed ✅`,
    rejected: `Sorry, I can’t take your order for *${dishName}* this time 🙏`,
    cooking: `Started cooking your *${dishName}* 🍳`,
    delivered: `Your *${dishName}* is delivered — enjoy! 🍽️`,
    cancelled: `Your order for *${dishName}* has been cancelled.`,
  };
  return `Aangan: ${line[status]}`;
}
