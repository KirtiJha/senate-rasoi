import { COMMUNITY_ID, isSupabaseConfigured, supabase } from './supabase';

/**
 * Rides — carpooling as a booking rather than a classified ad.
 *
 * A recurring ride is one row plus a set of weekdays; individual journeys are
 * never stored. A request carries the DATE it is for, which is what turns
 * "Tuesdays at 9" into "this Tuesday, two seats" without a nightly job and a
 * table that grows forever to hold journeys nobody books. See 0098.
 */

export type RidePreference = 'all' | 'women' | 'men';
export type RideRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface Ride {
  id: string;
  community_id: string;
  driver_user_id: string;
  from_text: string;
  to_text: string;
  depart_time: string;      // 'HH:MM:SS'
  duration_min: number | null;
  days_of_week: number[];   // empty for a one-off
  one_off_date: string | null;
  seats_total: number;
  price_per_seat: number | null;
  preference: RidePreference;
  vehicle: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
  driver?: { name: string; flat: string | null; whatsapp: string | null } | null;
}

export interface RideRequest {
  id: string;
  ride_id: string;
  rider_user_id: string;
  ride_date: string;
  seats: number;
  status: RideRequestStatus;
  note: string | null;
  created_at: string;
  rider?: { name: string; flat: string | null; whatsapp: string | null } | null;
  ride?: Ride | null;
}

export const PREFERENCE_LABELS: Record<RidePreference, string> = {
  all: 'Anyone',
  women: 'Women only',
  men: 'Men only',
};

const RIDE_SELECT = '*, driver:profiles!rides_driver_user_id_fkey(name,flat,whatsapp)';

// ── Dates ───────────────────────────────────────────────────────────

/** Local YYYY-MM-DD. Never via toISOString, which shifts the day in IST. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

/**
 * The next journeys this ride actually makes.
 *
 * Today counts only while the departure is still ahead — a lift that left at
 * 9am is not something to offer at noon.
 */
export function upcomingDates(ride: Ride, horizonDays = 14): string[] {
  if (ride.one_off_date) {
    return ride.one_off_date >= todayIso() ? [ride.one_off_date] : [];
  }

  const [h, m] = (ride.depart_time ?? '00:00').split(':').map(Number);
  const out: string[] = [];

  for (let i = 0; i <= horizonDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (!ride.days_of_week.includes(d.getDay())) continue;
    if (i === 0) {
      const gone = new Date();
      gone.setHours(h, m, 0, 0);
      if (gone.getTime() <= Date.now()) continue;
    }
    out.push(isoDate(d));
  }
  return out;
}

export function formatRideTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatRideDate(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  const today = todayIso();
  if (iso === today) return 'Today';
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (iso === isoDate(t)) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * A Google Maps directions link for this ride.
 *
 * Deep link rather than an embedded map: every in-app map option is either a
 * native module (a new build and another store review) or a billed API key.
 * Google also geocodes free text like "DS Max Senate gate" better than a
 * resident can drop a pin.
 */
export function routeUrl(ride: Pick<Ride, 'from_text' | 'to_text'>): string {
  const q = (s: string) => encodeURIComponent(s.trim());
  return `https://www.google.com/maps/dir/?api=1&origin=${q(ride.from_text)}&destination=${q(ride.to_text)}&travelmode=driving`;
}

// ── Reading ─────────────────────────────────────────────────────────

export async function fetchRides(communityId: string = COMMUNITY_ID): Promise<Ride[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('rides')
    .select(RIDE_SELECT)
    .eq('community_id', communityId)
    .eq('active', true)
    .order('depart_time');
  if (error) throw error;

  // A one-off whose date has passed is over; a recurring ride with no upcoming
  // date in the horizon is dormant rather than gone.
  return (data ?? []).filter((r) => {
    const ride = r as Ride;
    return !ride.one_off_date || ride.one_off_date >= todayIso();
  }) as Ride[];
}

export async function fetchRide(id: string): Promise<Ride | null> {
  const { data, error } = await supabase.from('rides').select(RIDE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Ride) ?? null;
}

/** Every request on one ride — driver's view. RLS keeps this to their own. */
export async function fetchRideRequests(rideId: string): Promise<RideRequest[]> {
  const { data, error } = await supabase
    .from('ride_requests')
    .select('*, rider:profiles!ride_requests_rider_user_id_fkey(name,flat,whatsapp)')
    .eq('ride_id', rideId)
    .gte('ride_date', todayIso())
    .order('ride_date')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as RideRequest[];
}

/** What this resident has asked for — the "pending until accepted" view. */
export async function fetchMyRideRequests(userId: string): Promise<RideRequest[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('ride_requests')
    .select(`*, ride:rides!ride_requests_ride_id_fkey(${'*, driver:profiles!rides_driver_user_id_fkey(name,flat,whatsapp)'})`)
    .eq('rider_user_id', userId)
    .gte('ride_date', todayIso())
    .order('ride_date');
  if (error) throw error;
  return (data ?? []) as RideRequest[];
}

/** Seats already promised, per journey. */
export function seatsTaken(requests: RideRequest[], date: string): number {
  return requests
    .filter((r) => r.ride_date === date && r.status === 'accepted')
    .reduce((s, r) => s + r.seats, 0);
}

// ── Writing ─────────────────────────────────────────────────────────

export async function createRide(input: {
  communityId?: string;
  driverUserId: string;
  fromText: string;
  toText: string;
  departTime: string;
  durationMin?: number | null;
  daysOfWeek: number[];
  oneOffDate?: string | null;
  seatsTotal: number;
  pricePerSeat?: number | null;
  preference: RidePreference;
  vehicle?: string | null;
  note?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from('rides')
    .insert({
      community_id: input.communityId ?? COMMUNITY_ID,
      driver_user_id: input.driverUserId,
      from_text: input.fromText.trim(),
      to_text: input.toText.trim(),
      depart_time: input.departTime,
      duration_min: input.durationMin ?? null,
      days_of_week: input.oneOffDate ? [] : input.daysOfWeek,
      one_off_date: input.oneOffDate ?? null,
      seats_total: input.seatsTotal,
      price_per_seat: input.pricePerSeat ?? null,
      preference: input.preference,
      vehicle: input.vehicle?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateRide(id: string, patch: Partial<{
  from_text: string; to_text: string; depart_time: string; duration_min: number | null;
  days_of_week: number[]; one_off_date: string | null; seats_total: number;
  price_per_seat: number | null; preference: RidePreference; vehicle: string | null;
  note: string | null; active: boolean;
}>): Promise<void> {
  const { error } = await supabase.from('rides').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRide(id: string): Promise<void> {
  const { error } = await supabase.from('rides').delete().eq('id', id);
  if (error) throw error;
}

/** Ask for a seat. Re-asking for the same journey edits the same row. */
export async function requestSeat(input: {
  rideId: string;
  riderUserId: string;
  rideDate: string;
  seats: number;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('ride_requests').upsert({
    ride_id: input.rideId,
    rider_user_id: input.riderUserId,
    ride_date: input.rideDate,
    seats: input.seats,
    note: input.note?.trim() || null,
    status: 'pending',
  }, { onConflict: 'ride_id,rider_user_id,ride_date' });
  if (error) throw error;
}

/**
 * The driver answers. 0098 refuses an acceptance that would oversubscribe the
 * car, so the "full" case surfaces as a thrown error rather than a bad row.
 */
export async function answerRequest(id: string, status: 'accepted' | 'declined'): Promise<void> {
  const { error } = await supabase.from('ride_requests').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function withdrawRequest(id: string): Promise<void> {
  const { error } = await supabase.from('ride_requests').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}
