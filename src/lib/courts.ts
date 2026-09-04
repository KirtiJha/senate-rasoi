import { sessionEnded, upcomingDates } from './schedule';
import { isSupabaseConfigured, supabase } from './supabase';

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
  /** The point at which there is a game (0115). Not a cap. */
  min_players: number | null;
  /** Courts/tables/nets held by this booking; the charge covers them all (0125). */
  courts: number;
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
  min_players: number | null;
  /** How many courts/tables/nets this slot holds. The charge covers them all. */
  courts: number;
  attendance_settled_at: string | null;
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
  players: SessionPlayer[]; // everyone who responded (confirmed + declined)
  confirmedCount: number;
  myStatus: 'confirmed' | 'declined' | null;
  ended: boolean;
  perHead: number;
  /** Players needed, from the session or its booking. Null when unset. */
  needed: number | null;
  /** How many more are needed. 0 once the game is on. */
  short: number;
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
  /** The point at which there is a game. Not a cap — more can always join. */
  minPlayers?: number | null;
  /** Courts booked for the slot; the charge is for all of them together. */
  courts?: number;
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
      min_players: input.minPlayers ?? null,
      courts: input.courts ?? 1,
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
        min_players: input.minPlayers ?? null,
        courts: input.courts ?? 1,
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

/**
 * Recurring bookings that have run out of dates.
 *
 * createBooking generates a few weeks of sessions and nothing extends them.
 * 0114 tops up arrangements that are still being played, but one that has
 * already lapsed is deliberately left alone — putting a fixture back on nine
 * people's phones weeks later should be somebody's decision, not a sweep's.
 * This is how the booker finds out it lapsed, and restarts it.
 */
export async function fetchLapsedBookings(groupId: string): Promise<CourtBooking[]> {
  const today = new Date().toLocaleDateString('en-CA');
  const { data, error } = await supabase
    .from('court_bookings')
    .select('*, sessions:court_sessions(session_date)')
    .eq('group_id', groupId);
  if (error) throw error;
  return ((data ?? []) as any[])
    .filter((b) => (b.days_of_week ?? []).length > 0)
    .filter((b) => !((b.sessions ?? []) as { session_date: string }[]).some((s) => s.session_date >= today))
    .map(mapBooking);
}

/** Put the next few weeks of a recurring booking back on the calendar. */
export async function extendBooking(
  booking: CourtBooking,
  weeks = 4,
  bookerUserId?: string | null,
): Promise<number> {
  const dates = upcomingDates(booking.days_of_week ?? [], weeks);
  if (!dates.length) return 0;
  const { data, error } = await supabase
    .from('court_sessions')
    .upsert(dates.map((d) => ({
      booking_id: booking.id,
      group_id: booking.group_id,
      community_id: booking.community_id,
      session_date: d,
      start_time: booking.start_time,
      duration_min: booking.duration_min,
      charge: booking.charge,
      min_players: booking.min_players,
      courts: booking.courts ?? 1,
    })), { onConflict: 'booking_id,session_date', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  const made = (data ?? []) as { id: string }[];
  const who = bookerUserId ?? booking.booker_user_id;
  if (made.length && who) {
    await supabase.from('court_session_players').upsert(
      made.map((s) => ({ session_id: s.id, user_id: who, status: 'confirmed' as const })),
      { onConflict: 'session_id,user_id', ignoreDuplicates: true },
    );
  }
  return made.length;
}

/**
 * Who actually played.
 *
 * The cost splits by CONFIRMED, but confirming is a promise made days
 * earlier and in this society nobody has ever pressed "can't make it" — so
 * the split has always been "everyone who said yes", and two people who
 * turned up would be billed for four. The booker ticks the real list once
 * the game is over, and the split follows it.
 */
export async function settleAttendance(
  sessionId: string,
  played: string[],
  absent: string[],
): Promise<void> {
  if (played.length) {
    const { error } = await supabase.from('court_session_players').upsert(
      played.map((user_id) => ({ session_id: sessionId, user_id, status: 'confirmed' as const })),
      { onConflict: 'session_id,user_id' },
    );
    if (error) throw error;
  }
  if (absent.length) {
    const { error } = await supabase
      .from('court_session_players')
      .update({ status: 'declined' })
      .eq('session_id', sessionId)
      .in('user_id', absent);
    if (error) throw error;
  }
  const { error } = await supabase
    .from('court_sessions')
    .update({ attendance_settled_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * The next game the signed-in resident could be at, across every group they
 * belong to.
 *
 * A weekly game is the most time-bound thing in this app and the home screen
 * never mentioned it — the Sports tile said "Teams, practice & tournaments"
 * whether or not you were playing in twelve hours. To answer it you had to
 * open the group, scroll past the badge, the practice card and nine members.
 */
export interface NextGame {
  session_id: string;
  group_id: string;
  group_name: string;
  sport: string;
  session_date: string;
  start_time: string | null;
  confirmed: number;
  needed: number | null;
  myStatus: 'confirmed' | 'declined' | null;
}

export async function fetchMyNextGame(
  userId: string | null,
  withinDays = 3,
): Promise<NextGame | null> {
  if (!isSupabaseConfigured || !userId) return null;

  const { data: mem } = await supabase
    .from('sport_group_members')
    .select('group_id, group:sport_groups!sport_group_members_group_id_fkey(name, sport)')
    .eq('user_id', userId);
  const groups = (mem ?? []) as any[];
  if (!groups.length) return null;

  const today = new Date();
  const until = new Date();
  until.setDate(until.getDate() + withinDays);
  const iso = (d: Date) => d.toLocaleDateString('en-CA');

  const { data, error } = await supabase
    .from('court_sessions')
    .select('id, group_id, session_date, start_time, duration_min, min_players, booking:court_bookings!court_sessions_booking_id_fkey(min_players)')
    .in('group_id', groups.map((g) => g.group_id))
    .eq('status', 'scheduled')
    .gte('session_date', iso(today))
    .lte('session_date', iso(until))
    .order('session_date', { ascending: true })
    .limit(8);
  if (error || !data?.length) return null;

  // The first one that has not already finished.
  const live = (data as any[]).find((s) => !sessionEnded(s.session_date, s.start_time, s.duration_min));
  if (!live) return null;

  const { data: players } = await supabase
    .from('court_session_players')
    .select('user_id, status')
    .eq('session_id', live.id);
  const rows = (players ?? []) as { user_id: string; status: 'confirmed' | 'declined' }[];
  const g = groups.find((x) => x.group_id === live.group_id);

  return {
    session_id: live.id,
    group_id: live.group_id,
    group_name: g?.group?.name ?? 'Your group',
    sport: g?.group?.sport ?? '',
    session_date: live.session_date,
    start_time: live.start_time,
    confirmed: rows.filter((p) => p.status === 'confirmed').length,
    needed: live.min_players ?? live.booking?.min_players ?? null,
    myStatus: rows.find((p) => p.user_id === userId)?.status ?? null,
  };
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
    .select('*, booking:court_bookings!court_sessions_booking_id_fkey(booker_user_id, upi_id, title, location, min_players, booker:profiles!court_bookings_booker_user_id_fkey(name, upi))')
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
      players: all,
      confirmedCount: confirmed.length,
      myStatus: myBySession.get(s.id) ?? null,
      ended,
      min_players: s.min_players ?? null,
      courts: s.courts ?? 1,
      attendance_settled_at: s.attendance_settled_at ?? null,
      needed: s.min_players ?? s.booking?.min_players ?? null,
      short: Math.max(0, (s.min_players ?? s.booking?.min_players ?? 0) - confirmed.length),
      perHead: confirmed.length ? Math.ceil(charge / confirmed.length) : charge,
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

/** Booker (or admin) marks any player in/out for a session — overrides the member lock. */
export async function bookerSetAttendance(sessionId: string, userId: string, status: 'confirmed' | 'declined'): Promise<boolean> {
  const { data, error } = await supabase.rpc('court_set_attendance', { p_session: sessionId, p_user: userId, p_status: status });
  if (error) throw error;
  return Boolean(data);
}

/** Booker (or admin) edits a booking; flows to upcoming sessions, optionally resets RSVPs + notifies. */
export async function updateBooking(
  bookingId: string,
  f: { title: string | null; location: string | null; startTime: string | null; durationMin: number; charge: number; reset: boolean; minPlayers: number | null; courts: number },
): Promise<boolean> {
  const { data, error } = await supabase.rpc('court_update_booking', {
    p_booking: bookingId, p_title: f.title, p_location: f.location,
    p_start_time: f.startTime, p_duration_min: f.durationMin, p_charge: f.charge, p_reset: f.reset,
    // 0 clears the minimum; null would mean “leave it alone” (0125).
    p_min_players: f.minPlayers ?? 0, p_courts: f.courts,
  });
  if (error) throw error;
  return Boolean(data);
}

/** Booker records a player's share as received (manual / cash), even if never initiated. */
export async function bookerSettle(sessionId: string, payerId: string, amount: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('court_booker_settle', { p_session: sessionId, p_payer: payerId, p_amount: amount });
  if (error) throw error;
  return Boolean(data);
}

/** Revert a settlement (booker un-marks received, or payer un-marks paid) → owed again. */
export async function revertPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('court_payments').update({ status: 'cancelled' }).eq('id', paymentId);
  if (error) throw error;
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

  // Dues are attendance-driven: as soon as you're confirmed for a paid session you
  // owe your share (charge ÷ confirmed). No time gate — it updates as people change.
  const billable = (sessions ?? []).filter((s: any) =>
    s.booking?.booker_user_id !== userId && num(s.charge) > 0);
  if (!billable.length) return [];

  const endedIds = billable.map((s: any) => s.id);
  const [{ data: confirmRows }, { data: payRows }] = await Promise.all([
    supabase.from('court_session_players').select('session_id, status').in('session_id', endedIds).eq('status', 'confirmed'),
    supabase.from('court_payments').select('*').eq('payer_user_id', userId).in('session_id', endedIds),
  ]);

  const counts = new Map<string, number>();
  for (const r of (confirmRows ?? []) as { session_id: string }[]) counts.set(r.session_id, (counts.get(r.session_id) ?? 0) + 1);
  const payBySession = new Map<string, any>();
  for (const p of (payRows ?? []) as any[]) payBySession.set(p.session_id, p);

  return billable.map((s: any) => {
    const n = counts.get(s.id) ?? 1;
    const raw = payBySession.get(s.id);
    const pay = raw && raw.status !== 'cancelled' ? raw : null; // a reverted payment = owe again
    return {
      session_id: s.id, group_id: s.group_id, session_date: s.session_date,
      title: s.booking?.title ?? null,
      booker_user_id: s.booking?.booker_user_id,
      booker_name: s.booking?.booker?.name ?? null,
      booker_upi: s.booking?.upi_id || s.booking?.booker?.upi || null,
      amount: pay ? num(pay.amount) : Math.ceil(num(s.charge) / n),
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
  const billable = (sessions ?? []).filter((s: any) => num(s.charge) > 0);
  if (!billable.length) return [];

  const ids = billable.map((s: any) => s.id);
  const [{ data: players }, { data: pays }] = await Promise.all([
    supabase.from('court_session_players').select('session_id, user_id, status, profile:profiles!court_session_players_user_id_fkey(name, flat)').in('session_id', ids).eq('status', 'confirmed'),
    supabase.from('court_payments').select('*').eq('payee_user_id', userId).in('session_id', ids),
  ]);

  const counts = new Map<string, number>();
  for (const p of (players ?? []) as any[]) counts.set(p.session_id, (counts.get(p.session_id) ?? 0) + 1);
  const payByKey = new Map<string, any>();
  for (const p of (pays ?? []) as any[]) payByKey.set(`${p.session_id}:${p.payer_user_id}`, p);
  const sessById = new Map<string, any>();
  for (const s of billable) sessById.set(s.id, s);

  const out: CollectionPlayer[] = [];
  for (const p of (players ?? []) as any[]) {
    if (p.user_id === userId) continue; // skip the booker's own share
    const s = sessById.get(p.session_id);
    const n = counts.get(p.session_id) ?? 1;
    const raw = payByKey.get(`${p.session_id}:${p.user_id}`);
    const pay = raw && raw.status !== 'cancelled' ? raw : null; // a reverted payment = owed again
    out.push({
      session_id: p.session_id, session_date: s.session_date, title: s.booking?.title ?? null,
      user_id: p.user_id, name: p.profile?.name ?? null, flat: p.profile?.flat ?? null,
      amount: pay ? num(pay.amount) : Math.ceil(num(s.charge) / n),
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
  return { ...b, charge: num(b.charge), days_of_week: b.days_of_week ?? [], courts: b.courts ?? 1 };
}
