import { sessionEnded, upcomingDates } from './schedule';
import { supabase } from './supabase';

/**
 * Court bookings, attendance and cost-splitting for sports groups.
 * Dues are computed on the client from the confirmed-player count once a
 * session has ended (charge ÷ players), so there's no server cron; settlements
 * live in court_payments.
 */

export interface CourtBooking {
  id: string;
  group_id: string;
  community_id: string;
  booker_user_id: string;
  title: string | null;
  location: string | null;
  days_of_week: number[];
  start_time: string | null;
  duration_min: number;
  charge: number;
  upi_id: string | null;
  created_at: string;
}

export interface CourtSession {
  id: string;
  booking_id: string;
  group_id: string;
  community_id: string;
  session_date: string;
  start_time: string | null;
  duration_min: number;
  charge: number;
  status: 'scheduled' | 'cancelled';
}

export interface SessionPlayer {
  user_id: string;
  status: 'confirmed' | 'declined';
  profile?: { name: string | null; flat: string | null } | null;
}

export type SettleStatus = 'due' | 'initiated' | 'paid' | 'cancelled';

/** A session shown in the group, with my response + the live split. */
export interface SessionView extends CourtSession {
  booker_user_id: string;
  booker_name: string | null;
  booker_upi: string | null;
  title: string | null;
  location: string | null;
  confirmed: SessionPlayer[];
  confirmedCount: number;
  myStatus: 'confirmed' | 'declined' | null;
  ended: boolean;
  perHead: number;
}

const num = (v: unknown): number => (typeof v === 'string' ? parseFloat(v) : (v as number)) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Bookings ────────────────────────────────────────────────────────
export interface NewBooking {
  groupId: string;
  communityId: string;
  bookerUserId: string;
  title?: string | null;
  location?: string | null;
  days: number[];
  startTime: string; // HH:MM
  durationMin: number;
  charge: number;
  weeks: number;
  oneOffDate?: string | null; // YYYY-MM-DD; when set, ignores days/weeks
  upi?: string | null;
}

export async function createBooking(input: NewBooking): Promise<CourtBooking> {
  const { data: booking, error } = await supabase
    .from('court_bookings')
    .insert({
      group_id: input.groupId,
      community_id: input.communityId,
      booker_user_id: input.bookerUserId,
      title: input.title?.trim() || null,
      location: input.location?.trim() || null,
      days_of_week: input.oneOffDate ? [] : input.days,
      start_time: input.startTime || null,
      duration_min: input.durationMin,
      charge: input.charge,
      upi_id: input.upi?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;

  const dates = input.oneOffDate ? [input.oneOffDate] : upcomingDates(input.days, input.weeks);
  if (dates.length) {
    const { data: sessions, error: sErr } = await supabase
      .from('court_sessions')
      .insert(dates.map((d) => ({
        booking_id: booking.id,
        group_id: input.groupId,
        community_id: input.communityId,
        session_date: d,
        start_time: input.startTime || null,
        duration_min: input.durationMin,
        charge: input.charge,
      })))
      .select('id');
    if (sErr) throw sErr;
    // The booker is a player on every session they book.
    const rows = (sessions ?? []).map((s: { id: string }) => ({ session_id: s.id, user_id: input.bookerUserId, status: 'confirmed' as const }));
    if (rows.length) await supabase.from('court_session_players').insert(rows);
  }
  return mapBooking(booking);
}

export async function updateBookingUpi(bookingId: string, upi: string): Promise<void> {
  const { error } = await supabase.from('court_bookings').update({ upi_id: upi.trim() || null }).eq('id', bookingId);
  if (error) throw error;
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.from('court_bookings').delete().eq('id', bookingId);
  if (error) throw error;
}

export async function cancelSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('court_sessions').update({ status: 'cancelled' }).eq('id', sessionId);
  if (error) throw error;
}

// ── Sessions for a group (confirm / decline + live split) ───────────
export async function fetchGroupSessions(groupId: string, userId: string | null): Promise<SessionView[]> {
  const from = new Date();
  from.setDate(from.getDate() - 14);
  const fromISO = from.toLocaleDateString('en-CA');

  const { data: sessions, error } = await supabase
    .from('court_sessions')
    .select('*, booking:court_bookings!court_sessions_booking_id_fkey(booker_user_id, upi_id, title, location, booker:profiles!court_bookings_booker_user_id_fkey(name, upi))')
    .eq('group_id', groupId)
    .eq('status', 'scheduled')
    .gte('session_date', fromISO)
    .order('session_date', { ascending: true });
  if (error) throw error;

  const list = (sessions ?? []) as any[];
  if (!list.length) return [];

  const ids = list.map((s) => s.id);
  const { data: players } = await supabase
    .from('court_session_players')
    .select('session_id, user_id, status, profile:profiles!court_session_players_user_id_fkey(name, flat)')
    .in('session_id', ids);

  const bySession = new Map<string, SessionPlayer[]>();
  const myBySession = new Map<string, 'confirmed' | 'declined'>();
  for (const p of (players ?? []) as any[]) {
    if (!bySession.has(p.session_id)) bySession.set(p.session_id, []);
    bySession.get(p.session_id)!.push({ user_id: p.user_id, status: p.status, profile: p.profile });
    if (userId && p.user_id === userId) myBySession.set(p.session_id, p.status);
  }

  return list.map((s) => {
    const all = bySession.get(s.id) ?? [];
    const confirmed = all.filter((p) => p.status === 'confirmed');
    const charge = num(s.charge);
    const ended = sessionEnded(s.session_date, s.start_time, s.duration_min);
    return {
      id: s.id, booking_id: s.booking_id, group_id: s.group_id, community_id: s.community_id,
      session_date: s.session_date, start_time: s.start_time, duration_min: s.duration_min,
      charge, status: s.status,
      booker_user_id: s.booking?.booker_user_id ?? '',
      booker_name: s.booking?.booker?.name ?? null,
      booker_upi: s.booking?.upi_id || s.booking?.booker?.upi || null,
      title: s.booking?.title ?? null,
      location: s.booking?.location ?? null,
      confirmed,
      confirmedCount: confirmed.length,
      myStatus: myBySession.get(s.id) ?? null,
      ended,
      perHead: confirmed.length ? round2(charge / confirmed.length) : charge,
    } as SessionView;
  });
}

/** Confirm or decline a session for myself. */
export async function respondToSession(sessionId: string, userId: string, status: 'confirmed' | 'declined'): Promise<void> {
  const { error } = await supabase
    .from('court_session_players')
    .upsert({ session_id: sessionId, user_id: userId, status, responded_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });
  if (error) throw error;
}

/**
 * Live updates for one group's bookings: re-runs `onChange` whenever a session,
 * booking or RSVP changes. (court_session_players has no group_id column, so it's
 * subscribed unfiltered — a re-fetch scopes back to this group.)
 */
export function subscribeGroupSessions(groupId: string, onChange: () => void): () => void {
  const ch = supabase
    .channel(`court-${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_session_players' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_sessions', filter: `group_id=eq.${groupId}` }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_bookings', filter: `group_id=eq.${groupId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/** Live updates for the dues screen — payments and RSVPs that change what's owed/collected. */
export function subscribeCourtPayments(onChange: () => void): () => void {
  const ch = supabase
    .channel('court-payments-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_payments' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_session_players' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ── Dues (member's perspective) ─────────────────────────────────────
export interface DueItem {
  session_id: string;
  group_id: string;
  session_date: string;
  title: string | null;
  booker_user_id: string;
  booker_name: string | null;
  booker_upi: string | null;
  amount: number;
  status: SettleStatus;
  payment_id: string | null;
}

/** Sessions I confirmed that have ended and I owe a share for (incl. settled). */
export async function fetchMyDues(userId: string): Promise<DueItem[]> {
  const { data: mine } = await supabase
    .from('court_session_players')
    .select('session_id')
    .eq('user_id', userId).eq('status', 'confirmed');
  const sessionIds = (mine ?? []).map((r: { session_id: string }) => r.session_id);
  if (!sessionIds.length) return [];

  const { data: sessions } = await supabase
    .from('court_sessions')
    .select('id, group_id, session_date, start_time, duration_min, charge, status, booking:court_bookings!court_sessions_booking_id_fkey(booker_user_id, upi_id, title, booker:profiles!court_bookings_booker_user_id_fkey(name, upi))')
    .in('id', sessionIds).eq('status', 'scheduled');

  const ended = (sessions ?? []).filter((s: any) =>
    s.booking?.booker_user_id !== userId && sessionEnded(s.session_date, s.start_time, s.duration_min));
  if (!ended.length) return [];

  const endedIds = ended.map((s: any) => s.id);
  const [{ data: confirmRows }, { data: payRows }] = await Promise.all([
    supabase.from('court_session_players').select('session_id, status').in('session_id', endedIds).eq('status', 'confirmed'),
    supabase.from('court_payments').select('*').eq('payer_user_id', userId).in('session_id', endedIds),
  ]);

  const counts = new Map<string, number>();
  for (const r of (confirmRows ?? []) as { session_id: string }[]) counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + 1);
  const payBySession = new Map<string, any>();
  for (const p of (payRows ?? []) as any[]) payBySession.set(p.session_id, p);

  return ended.map((s: any) => {
    const n = counts.get(s.id) ?? 1;
    const pay = payBySession.get(s.id);
    return {
      session_id: s.id, group_id: s.group_id, session_date: s.session_date,
      title: s.booking?.title ?? null,
      booker_user_id: s.booking?.booker_user_id,
      booker_name: s.booking?.booker?.name ?? null,
      booker_upi: s.booking?.upi_id || s.booking?.booker?.upi || null,
      amount: pay ? num(pay.amount) : round2(num(s.charge) / n),
      status: (pay?.status as SettleStatus) ?? 'due',
      payment_id: pay?.id ?? null,
    } as DueItem;
  }).sort((a, b) => (a.session_date < b.session_date ? 1 : -1));
}

/** Record a UPI settlement for one or more sessions (status: initiated). */
export async function payDues(
  items: { sessionId: string; groupId: string; amount: number }[],
  payerId: string, payeeId: string, communityId: string, upi: string | null,
): Promise<void> {
  if (!items.length) return;
  const { error } = await supabase.from('court_payments').upsert(
    items.map((it) => ({
      session_id: it.sessionId, group_id: it.groupId, community_id: communityId,
      payer_user_id: payerId, payee_user_id: payeeId, amount: it.amount,
      status: 'initiated', upi_id: upi, created_at: new Date().toISOString(), paid_at: null,
    })),
    { onConflict: 'session_id,payer_user_id' },
  );
  if (error) throw error;
}

/** Payer cancels a settlement they recorded by mistake. */
export async function cancelMyPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('court_payments').update({ status: 'cancelled' }).eq('id', paymentId);
  if (error) throw error;
}

// ── Collections (booker's perspective) ──────────────────────────────
export interface CollectionPlayer {
  session_id: string;
  session_date: string;
  title: string | null;
  user_id: string;
  name: string | null;
  flat: string | null;
  amount: number;
  status: SettleStatus;
  payment_id: string | null;
}

/** For sessions I booked that have ended: who owes / has paid me. */
export async function fetchBookerCollections(userId: string): Promise<CollectionPlayer[]> {
  const { data: bookings } = await supabase.from('court_bookings').select('id').eq('booker_user_id', userId);
  const bookingIds = (bookings ?? []).map((b: { id: string }) => b.id);
  if (!bookingIds.length) return [];

  const { data: sessions } = await supabase
    .from('court_sessions')
    .select('id, session_date, start_time, duration_min, charge, status, booking:court_bookings!court_sessions_booking_id_fkey(title)')
    .in('booking_id', bookingIds).eq('status', 'scheduled');
  const ended = (sessions ?? []).filter((s: any) => sessionEnded(s.session_date, s.start_time, s.duration_min));
  if (!ended.length) return [];

  const ids = ended.map((s: any) => s.id);
  const [{ data: players }, { data: pays }] = await Promise.all([
    supabase.from('court_session_players').select('session_id, user_id, status, profile:profiles!court_session_players_user_id_fkey(name, flat)').in('session_id', ids).eq('status', 'confirmed'),
    supabase.from('court_payments').select('*').eq('payee_user_id', userId).in('session_id', ids),
  ]);

  const counts = new Map<string, number>();
  for (const p of (players ?? []) as any[]) counts.set(p.session_id, (counts.get(p.session_id) ?? 0) + 1);
  const payByKey = new Map<string, any>();
  for (const p of (pays ?? []) as any[]) payByKey.set(`${p.session_id}:${p.payer_user_id}`, p);
  const sessById = new Map<string, any>();
  for (const s of ended) sessById.set(s.id, s);

  const out: CollectionPlayer[] = [];
  for (const p of (players ?? []) as any[]) {
    if (p.user_id === userId) continue; // skip the booker's own share
    const s = sessById.get(p.session_id);
    const n = counts.get(p.session_id) ?? 1;
    const pay = payByKey.get(`${p.session_id}:${p.user_id}`);
    out.push({
      session_id: p.session_id, session_date: s.session_date, title: s.booking?.title ?? null,
      user_id: p.user_id, name: p.profile?.name ?? null, flat: p.profile?.flat ?? null,
      amount: pay ? num(pay.amount) : round2(num(s.charge) / n),
      status: (pay?.status as SettleStatus) ?? 'due',
      payment_id: pay?.id ?? null,
    });
  }
  return out.sort((a, b) => (a.session_date < b.session_date ? 1 : -1));
}

/** Booker confirms receipt of a settlement. */
export async function markPaymentReceived(paymentId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('court_payment_mark_paid', { p_id: paymentId });
  if (error) throw error;
  return Boolean(data);
}

function mapBooking(b: any): CourtBooking {
  return { ...b, charge: num(b.charge), days_of_week: b.days_of_week ?? [] };
}
