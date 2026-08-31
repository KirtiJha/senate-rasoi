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
export async function fetchDishes(communityId: string = COMMUNITY_ID): Promise<DishRow[]> {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('community_id', communityId)
    .gte('serve_date', today)
    .is('withdrawn_at', null)
    .order('serve_date', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DishRow[];
  cacheDishes(rows); // fire-and-forget for next cold-start
  return rows;
}

/** Fetch a single dish by id (for the detail screen). Null if not found. */
export async function fetchDishById(id: string): Promise<DishRow | null> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as DishRow) ?? null;
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
  communityId?: string; // defaults to COMMUNITY_ID
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

  // Photo upload is best-effort: a Storage hiccup (e.g. the dish-photos bucket or
  // its policy not yet set) must never block posting the dish. The caller compares
  // photo_url against the requested photoUri to warn that the image didn't attach.
  let photoUrl: string | null = null;
  if (input.photoUri) {
    try {
      photoUrl = await uploadDishPhoto(input.photoUri, id);
    } catch (e) {
      console.error('dish photo upload failed — posting without it:', e);
    }
  }

  const row = {
    id,
    community_id: input.communityId ?? COMMUNITY_ID,
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

/**
 * Edit a dish's core fields + photo (owner/admin via RLS). `photoUri` may be an
 * existing public URL (kept), a new local URI (re-uploaded), or null (removed).
 * Returns the resolved photo_url so the caller can refresh its copy.
 */
export async function updateDish(
  dishId: string,
  patch: { dishName?: string; description?: string | null; price?: number; photoUri?: string | null },
): Promise<{ photo_url: string | null | undefined }> {
  const row: Record<string, unknown> = {};
  if (patch.dishName !== undefined) row.dish_name = patch.dishName.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.price !== undefined) row.price = patch.price;
  let photo_url: string | null | undefined;
  if (patch.photoUri !== undefined) {
    if (patch.photoUri == null) { row.photo_url = null; photo_url = null; }
    else if (/^https?:\/\//.test(patch.photoUri)) { /* unchanged — leave as-is */ }
    else {
      // Re-upload overwrites the same path, so bust caches with a version query.
      const url = await uploadDishPhoto(patch.photoUri, dishId);
      photo_url = `${url}?v=${Date.now()}`;
      row.photo_url = photo_url;
    }
  }
  const { error } = await supabase.from('dishes').update(row).eq('id', dishId);
  if (error) throw error;
  return { photo_url };
}

/**
 * Take a dish off the board.
 *
 * Deletes it outright when nobody has ordered — withdrawing an unsold dish is
 * a normal thing to do and should be instant. Once someone has actually eaten,
 * 0092 refuses the delete and this falls back to withdrawing: off the board,
 * with the orders, payments and reviews kept.
 *
 * That guard exists because deleting a dish used to cascade through orders
 * into dish_feedback, so a chef could raise their own rating by removing the
 * dish that earned a bad one.
 */
export async function deleteDish(dishId: string): Promise<boolean> {
  const { data, error } = await supabase.from('dishes').delete().eq('id', dishId).select('id');
  if (!error) return (data?.length ?? 0) > 0;

  const blocked = /ordered|check_violation/i.test(error.message ?? '');
  if (!blocked) throw error;

  return withdrawDish(dishId);
}

/** Off the board, everything kept. */
export async function withdrawDish(dishId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('withdraw_dish', { p_dish: dishId });
  if (error) throw error;
  return data === true;
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

// ── Kitchen reputation ──────────────────────────────────────────────

export interface ChefReputation {
  chef_user_id: string;
  total: number;
  repeat_count: number;
  /** False until five people have answered — see 0079. */
  enough: boolean;
}

export interface PendingFeedback {
  order_id: string;
  dish_id: string;
  dish_name: string;
  chef_name: string;
  delivered_at: string;
}

/**
 * Reputation for a whole board in one round trip.
 *
 * Returns counts only — never a note, never who said what. In a building of
 * forty flats, seeing individual answers would identify whoever left the
 * single "no".
 */
export async function fetchChefReputations(chefIds: string[]): Promise<Map<string, ChefReputation>> {
  const ids = [...new Set(chefIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase.rpc('chef_reputations', { p_chefs: ids });
  if (error) throw error;
  return new Map((data as ChefReputation[] ?? []).map((r) => [r.chef_user_id, r]));
}

/** Delivered orders this person has not rated yet. Empty is the normal case. */
export async function fetchPendingFeedback(): Promise<PendingFeedback[]> {
  const { data, error } = await supabase.rpc('pending_feedback');
  if (error) throw error;
  return (data ?? []) as PendingFeedback[];
}

/**
 * "Would you order again?" — plus an optional note the chef alone will read.
 *
 * Deliberately not a star rating: a score out of five for a neighbour you meet
 * in the lift tomorrow gets answered politely rather than honestly.
 */
export async function leaveDishFeedback(
  orderId: string,
  wouldRepeat: boolean,
  note?: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('leave_dish_feedback', {
    p_order_id: orderId,
    p_would_repeat: wouldRepeat,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
  return data === true;
}

// ── Recurring dishes ────────────────────────────────────────────────

export interface DishTemplate {
  id: string;
  dish_name: string;
  slot: Slot;
  veg_type: VegType;
  price: number;
  max_plates: number;
  description: string | null;
  photo_url: string | null;
  days_of_week: number[];
  active: boolean;
  last_run_on: string | null;
}

export async function fetchDishTemplates(userId: string): Promise<DishTemplate[]> {
  const { data, error } = await supabase
    .from('dish_templates')
    .select('id, dish_name, slot, veg_type, price, max_plates, description, photo_url, days_of_week, active, last_run_on')
    .eq('chef_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DishTemplate[];
}

/**
 * Turn a dish into a standing one.
 *
 * Takes the dish it was made from rather than a form of its own: a chef who
 * has just posted idli should be able to say "every Tuesday" without typing it
 * all again, which is the entire point of the feature.
 */
export async function createDishTemplate(
  dish: DishRow,
  daysOfWeek: number[],
  ctx: { userId: string; communityId: string },
): Promise<string> {
  const { data, error } = await supabase
    .from('dish_templates')
    .insert({
      community_id: ctx.communityId,
      chef_user_id: ctx.userId,
      dish_name: dish.dish_name,
      slot: dish.slot,
      veg_type: dish.veg_type,
      price: dish.price,
      max_plates: dish.max_plates,
      description: dish.description,
      photo_url: dish.photo_url,
      chef_name: dish.chef_name,
      flat: dish.flat,
      whatsapp: dish.whatsapp,
      upi: dish.upi ?? null,
      days_of_week: [...new Set(daysOfWeek)].sort(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function setDishTemplateActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('dish_templates').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteDishTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('dish_templates').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Every order still waiting on this chef, whatever the dish's date.
 *
 * The Kitchen tab builds its list from `fetchDishes`, which hides anything
 * before today. So an order placed at 9pm and not acted on disappeared from
 * the chef's screen at midnight — permanently, still holding a reserved plate,
 * while the buyer sat past the self-cancel window on "waiting for chef".
 *
 * Backed by an RPC (0094) rather than a client join, because orders are not
 * directly readable: everything on that table goes through SECURITY DEFINER.
 */
export interface OpenOrder {
  order_id: string;
  dish_id: string;
  dish_name: string;
  serve_date: string;
  buyer_name: string;
  buyer_flat: string | null;
  qty: number;
  unit_price: number | null;
  status: OrderStatus;
  created_at: string;
}

export async function fetchChefOpenOrders(): Promise<OpenOrder[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('chef_open_orders');
  if (error) throw error;
  return (data ?? []) as OpenOrder[];
}

/** What a line of an order actually costs — the agreed price, not today's. */
export function orderTotal(
  order: { qty: number; unit_price?: number | null },
  dishPrice: number,
): number {
  return order.qty * (order.unit_price ?? dishPrice);
}
