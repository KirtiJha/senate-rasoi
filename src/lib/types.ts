// Shared domain types for Senate Chef.

export const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type Slot = (typeof SLOTS)[number];

export const VEG_TYPES = ['Veg', 'Non-veg', 'Egg'] as const;
export type VegType = (typeof VEG_TYPES)[number];

/** A dish row as stored in / returned from Supabase (snake_case columns). */
export interface DishRow {
  id: string;
  community_id: string;
  chef_name: string;
  flat: string;
  whatsapp: string;
  upi: string | null;
  dish_name: string;
  slot: Slot;
  veg_type: VegType;
  price: number;
  max_plates: number;
  plates_left: number;
  description: string | null;
  photo_url: string | null;
  owner_token_hash: string | null; // legacy device-token rows only
  chef_user_id: string | null; // owner (auth.uid())
  order_by: string | null; // ISO deadline to order before cooking starts
  serve_date: string; // YYYY-MM-DD the dish is cooked/served
  created_at: string;
}

export const ORDER_STATUSES = [
  'placed',
  'accepted',
  'rejected',
  'cooking',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses that still hold reserved stock / are "live". */
export const ACTIVE_STATUSES: OrderStatus[] = ['placed', 'accepted', 'cooking'];

/** A server-side order row. */
export interface Order {
  id: string;
  dish_id: string;
  orderer_user_id: string | null;
  buyer_name: string;
  buyer_flat: string | null;
  qty: number;
  status: OrderStatus;
  cancelled_by: 'orderer' | 'chef' | null;
  created_at: string;
  status_updated_at: string;
}

/** Order joined with its dish — the foodie's "My Orders" view. */
export interface MyOrder extends Order {
  dish: Pick<
    DishRow,
    'dish_name' | 'slot' | 'price' | 'photo_url' | 'chef_name' | 'whatsapp' | 'chef_user_id'
  > | null;
}

/** Order joined with the orderer's contact — the chef's Kitchen view. */
export interface ChefOrder extends Order {
  orderer: { name: string; flat: string | null; whatsapp: string | null; phone: string } | null;
}

/** Legacy shape used across the post/order UI (chefName == profile name). */
export interface Profile {
  chefName: string;
  flat: string;
  whatsapp: string;
  upi: string;
}

export const ROLES = ['chef', 'foodie', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** A user profile row (Supabase `profiles`, keyed to the auth user id). */
export interface DbProfile {
  id: string;
  phone: string;
  name: string;
  flat: string | null;
  whatsapp: string | null;
  upi: string | null;
  roles: Role[];
  community_id: string | null;
  blocked: boolean;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
  show_in_directory: boolean;
  notifications_cleared_at: string | null;
  created_at: string;
}

// ── Tiffin service (recurring) ──────────────────────────────────────
export interface TiffinPlan {
  id: string;
  community_id: string;
  chef_user_id: string;
  title: string;
  description: string | null;
  veg_type: VegType;
  slot: Slot;
  price: number;
  days_of_week: number[]; // 0=Sun … 6=Sat
  max_per_day: number;
  cutoff_time: string | null; // 'HH:MM'
  photo_url: string | null;
  active: boolean;
  created_at: string;
}

/** A plan joined with the chef profile (for the Discover tiffin strip). */
export interface TiffinPlanWithChef extends TiffinPlan {
  chef: { name: string; flat: string | null; whatsapp: string | null } | null;
}

export interface Subscription {
  id: string;
  plan_id: string;
  subscriber_user_id: string;
  qty: number;
  start_date: string;
  end_date: string | null;
  paused: boolean;
  created_at: string;
}

/** A subscription joined with its plan (for the foodie's "My Tiffins"). */
export interface SubscriptionWithPlan extends Subscription {
  plan: TiffinPlanWithChef | null;
}

/** One subscriber for a chef's plan on a given date (from chef_tiffin_for_date). */
export interface TiffinDayRow {
  plan_id: string;
  plan_title: string;
  slot: Slot;
  price: number;
  subscription_id: string;
  subscriber_name: string;
  subscriber_flat: string | null;
  subscriber_whatsapp: string | null;
  qty: number;
}

export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const SLOT_EMOJI: Record<Slot, string> = {
  Breakfast: '☀️',
  Lunch: '🍛',
  Dinner: '🌙',
  Snack: '🫙',
};

export const VEG_DOT: Record<VegType, string> = {
  Veg: '🟢',
  'Non-veg': '🔴',
  Egg: '🟡',
};

// ── Listings engine ─────────────────────────────────────────────────

export type ListingStatus = 'active' | 'closed' | 'sold' | 'expired';

/** Minimal owner shape joined from profiles on listing queries. */
export interface ListingOwner {
  name: string;
  flat: string | null;
  whatsapp: string | null;
  phone: string;
}

/** A listing row as returned from Supabase (incl. joined owner). */
export interface ListingRow {
  id: string;
  community_id: string;
  category: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  photos: string[];
  price: number | null;
  price_unit: string | null;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  location: string | null;
  status: ListingStatus;
  is_referral: boolean;
  referral_name: string | null;
  referral_phone: string | null;
  attributes: Record<string, unknown>;
  expires_at: string | null;
  bump_at: string;
  created_at: string;
  owner?: ListingOwner;
}

/** An inquiry row (optionally joined with the inquirer's name). */
export interface InquiryRow {
  id: string;
  listing_id: string;
  from_user_id: string;
  message: string | null;
  status: 'open' | 'closed';
  created_at: string;
  from_user?: { name: string; flat: string | null; whatsapp: string | null };
}
