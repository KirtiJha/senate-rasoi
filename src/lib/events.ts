import { COMMUNITY_ID, isSupabaseConfigured, supabase } from './supabase';

// Society functions (Diwali, Ganesh Chaturthi, Holi…) with two ledgers:
// contributions in (per flat) and expenses out (with bills). The report screen
// is a live view over both — never an authored document.
//
// Aangan never holds money: UPI goes resident → treasurer directly and these
// rows only record that it happened, same as court_payments.

export type EventStatus = 'draft' | 'collecting' | 'ongoing' | 'completed' | 'cancelled';
export type TeamRole = 'lead' | 'treasurer' | 'member';
export type ContributionStatus = 'pending' | 'initiated' | 'received' | 'waived';
export type PayMethod = 'upi' | 'cash' | 'bank';
export type ExpenseCategory = 'decor' | 'food' | 'sound' | 'priest' | 'prizes' | 'venue' | 'gifts' | 'misc';

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: string; color: string }[] = [
  { key: 'decor', label: 'Decoration', icon: 'color-palette', color: '#DB2777' },
  { key: 'food', label: 'Food', icon: 'restaurant', color: '#E8650A' },
  { key: 'sound', label: 'Sound & light', icon: 'musical-notes', color: '#6366F1' },
  { key: 'priest', label: 'Priest & puja', icon: 'flame', color: '#F59E0B' },
  { key: 'prizes', label: 'Prizes', icon: 'trophy', color: '#16A34A' },
  { key: 'venue', label: 'Venue & rent', icon: 'business', color: '#0891B2' },
  { key: 'gifts', label: 'Gifts', icon: 'gift', color: '#8B5CF6' },
  { key: 'misc', label: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

export const EVENT_STATUS_META: Record<EventStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6B7280' },
  collecting: { label: 'Collecting', color: '#F59E0B' },
  ongoing: { label: 'Ongoing', color: '#16A34A' },
  completed: { label: 'Completed', color: '#0891B2' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
};

export interface SocietyEvent {
  id: string;
  community_id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_date: string | null;
  venue: string | null;
  status: EventStatus;
  budget_amount: number | null;
  suggested_contribution: number | null;
  cover_photo_url: string | null;
  created_at: string;
  bump_at: string;
}

export interface EventTeamMember {
  event_id: string;
  user_id: string;
  role: TeamRole;
  added_at: string;
  profile?: { name: string; flat: string | null; whatsapp: string | null; upi: string | null };
}

export interface Contribution {
  id: string;
  event_id: string;
  community_id: string;
  flat: string;
  contributor_user_id: string | null;
  amount: number;
  status: ContributionStatus;
  method: PayMethod | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  received_at: string | null;
  contributor?: { name: string; flat: string | null };
}

export interface Expense {
  id: string;
  event_id: string;
  community_id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  vendor: string | null;
  spent_on: string | null;
  paid_by_user_id: string | null;
  receipt_url: string | null;
  status: 'pending' | 'approved';
  created_by: string;
  created_at: string;
  paid_by?: { name: string; flat: string | null };
}

// ─── Events ─────────────────────────────────────────────────────────

export async function fetchEvents(communityId: string = COMMUNITY_ID): Promise<SocietyEvent[]> {
  const { data, error } = await supabase
    .from('society_events')
    .select('*')
    .eq('community_id', communityId)
    .order('event_date', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as SocietyEvent[];
}

export async function fetchEvent(id: string): Promise<SocietyEvent | null> {
  const { data, error } = await supabase.from('society_events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as SocietyEvent) ?? null;
}

export async function createEvent(input: {
  communityId?: string;
  createdBy: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  venue: string | null;
  budgetAmount: number | null;
  suggestedContribution: number | null;
}): Promise<SocietyEvent> {
  const { data, error } = await supabase.from('society_events').insert({
    community_id: input.communityId ?? COMMUNITY_ID,
    created_by: input.createdBy,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    event_date: input.eventDate,
    venue: input.venue?.trim() || null,
    budget_amount: input.budgetAmount,
    suggested_contribution: input.suggestedContribution,
    status: 'draft',
  }).select().single();
  if (error) throw error;

  // The creator runs it until they hand over — otherwise nobody could edit it.
  const ev = data as SocietyEvent;
  await supabase.from('event_team').insert({ event_id: ev.id, user_id: input.createdBy, role: 'lead' });
  return ev;
}

export async function updateEvent(id: string, patch: Partial<{
  title: string; description: string | null; event_date: string | null; venue: string | null;
  budget_amount: number | null; suggested_contribution: number | null; status: EventStatus;
  cover_photo_url: string | null;
}>): Promise<void> {
  const { error } = await supabase.from('society_events').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('society_events').delete().eq('id', id);
  if (error) throw error;
}

// ─── Team ───────────────────────────────────────────────────────────

export async function fetchTeam(eventId: string): Promise<EventTeamMember[]> {
  const { data, error } = await supabase
    .from('event_team')
    .select('*, profile:profiles!event_team_user_id_fkey(name,flat,whatsapp,upi)')
    .eq('event_id', eventId);
  if (error) throw error;
  const rank: Record<TeamRole, number> = { lead: 0, treasurer: 1, member: 2 };
  return ((data ?? []) as unknown as EventTeamMember[]).sort((a, b) => rank[a.role] - rank[b.role]);
}

export async function setTeamMember(eventId: string, userId: string, role: TeamRole): Promise<void> {
  const { error } = await supabase
    .from('event_team')
    .upsert({ event_id: eventId, user_id: userId, role }, { onConflict: 'event_id,user_id' });
  if (error) throw error;
}

export async function removeTeamMember(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('event_team').delete().eq('event_id', eventId).eq('user_id', userId);
  if (error) throw error;
}

// ─── Contributions (money in) ───────────────────────────────────────

export async function fetchContributions(eventId: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from('event_contributions')
    .select('*, contributor:profiles!event_contributions_contributor_user_id_fkey(name,flat)')
    .eq('event_id', eventId)
    .order('flat', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Contribution[];
}

/**
 * Seed one row per flat from the resident directory, so "who hasn't paid yet"
 * works from day one. Existing rows are left untouched (ignoreDuplicates), so
 * this is safe to re-run when new residents join.
 */
export async function generateRoster(
  eventId: string,
  communityId: string,
  flats: { flat: string; userId: string | null }[],
  defaultAmount: number | null,
): Promise<number> {
  if (!flats.length) return 0;
  const rows = flats.map((f) => ({
    event_id: eventId,
    community_id: communityId,
    flat: f.flat,
    contributor_user_id: f.userId,
    amount: defaultAmount ?? 0,
    status: 'pending' as ContributionStatus,
  }));
  const { data, error } = await supabase
    .from('event_contributions')
    .upsert(rows, { onConflict: 'event_id,flat', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

export async function upsertContribution(input: {
  eventId: string;
  communityId?: string;
  flat: string;
  contributorUserId: string | null;
  amount: number;
  status: ContributionStatus;
  method: PayMethod | null;
  note: string | null;
  recordedBy: string;
}): Promise<void> {
  const { error } = await supabase.from('event_contributions').upsert({
    event_id: input.eventId,
    community_id: input.communityId ?? COMMUNITY_ID,
    flat: input.flat.trim(),
    contributor_user_id: input.contributorUserId,
    amount: input.amount,
    status: input.status,
    method: input.method,
    note: input.note?.trim() || null,
    recorded_by: input.recordedBy,
    received_at: input.status === 'received' ? new Date().toISOString() : null,
  }, { onConflict: 'event_id,flat' });
  if (error) throw error;
}

export async function setContributionStatus(
  id: string, status: ContributionStatus, recordedBy: string, method?: PayMethod | null,
): Promise<void> {
  const { error } = await supabase.from('event_contributions').update({
    status,
    recorded_by: recordedBy,
    ...(method !== undefined ? { method } : {}),
    received_at: status === 'received' ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteContribution(id: string): Promise<void> {
  const { error } = await supabase.from('event_contributions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Expenses (money out) ───────────────────────────────────────────

export async function fetchExpenses(eventId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('event_expenses')
    .select('*, paid_by:profiles!event_expenses_paid_by_user_id_fkey(name,flat)')
    .eq('event_id', eventId)
    .order('spent_on', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function addExpense(input: {
  eventId: string;
  communityId?: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  vendor: string | null;
  spentOn: string | null;
  paidByUserId: string | null;
  receiptUrl: string | null;
  createdBy: string;
}): Promise<Expense> {
  const { data, error } = await supabase.from('event_expenses').insert({
    event_id: input.eventId,
    community_id: input.communityId ?? COMMUNITY_ID,
    title: input.title.trim(),
    category: input.category,
    amount: input.amount,
    vendor: input.vendor?.trim() || null,
    spent_on: input.spentOn,
    paid_by_user_id: input.paidByUserId,
    receipt_url: input.receiptUrl,
    created_by: input.createdBy,
  }).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, patch: Partial<{
  title: string; category: ExpenseCategory; amount: number; vendor: string | null;
  spent_on: string | null; receipt_url: string | null; status: 'pending' | 'approved';
}>): Promise<void> {
  const { error } = await supabase.from('event_expenses').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('event_expenses').delete().eq('id', id);
  if (error) throw error;
}

// ─── Derived totals (the report) ────────────────────────────────────

export interface EventTotals {
  collected: number;
  pending: number;
  spent: number;
  balance: number;
  budget: number | null;
  flatsTotal: number;
  flatsPaid: number;
  byCategory: { category: ExpenseCategory; amount: number }[];
}

/** Everything the report screen shows, computed from the two ledgers. */
export function computeTotals(
  event: SocietyEvent | null,
  contributions: Contribution[],
  expenses: Expense[],
): EventTotals {
  const collected = contributions
    .filter((c) => c.status === 'received')
    .reduce((s, c) => s + Number(c.amount), 0);
  // 'waived' flats are deliberately excluded — they are not debts.
  const pending = contributions
    .filter((c) => c.status === 'pending' || c.status === 'initiated')
    .reduce((s, c) => s + Number(c.amount), 0);
  const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCat = new Map<ExpenseCategory, number>();
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));

  return {
    collected,
    pending,
    spent,
    balance: collected - spent,
    budget: event?.budget_amount != null ? Number(event.budget_amount) : null,
    flatsTotal: contributions.filter((c) => c.status !== 'waived').length,
    flatsPaid: contributions.filter((c) => c.status === 'received').length,
    byCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function subscribeEvent(eventId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`event-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_contributions', filter: `event_id=eq.${eventId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_expenses', filter: `event_id=eq.${eventId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
