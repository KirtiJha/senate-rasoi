import { uploadContentPhoto } from './photoUpload';
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
  // Added in 0082. Optional so screens written before celebrations still
  // typecheck against rows selected without them.
  contribution_basis?: ContributionBasis;
  carry_in_available?: number;
  carry_in_used?: number;
  carry_in_note?: string | null;
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
  // Added in 0082.
  opted_out?: boolean;
  head_count?: number | null;
  receipt_url?: string | null;
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
  /** Contributions received, plus cash sponsorships in hand. */
  collected: number;
  pending: number;
  spent: number;
  balance: number;
  budget: number | null;
  flatsTotal: number;
  flatsPaid: number;
  byCategory: { category: ExpenseCategory; amount: number }[];
  /** Broken out as well as included, because a committee is asked both. */
  fromFlats: number;
  fromSponsors: number;
  carryIn: number;
  /** Flats that chose not to take part. Not a debt, and not a shortfall. */
  optedOut: number;
  /** Sponsored goods — real support, but never money. Counted, never summed. */
  itemsSponsored: number;
}

/** Everything the report screen shows, computed from the two ledgers. */
export function computeTotals(
  event: SocietyEvent | null,
  contributions: Contribution[],
  expenses: Expense[],
  sponsorships: Sponsorship[] = [],
): EventTotals {
  const fromFlats = contributions
    .filter((c) => c.status === 'received')
    .reduce((s, c) => s + Number(c.amount), 0);

  // Cash sponsorship is collection — the sound system is paid for either way,
  // and a total that omits it makes the committee look short of money it
  // actually has. Only what is in hand: a pledge is a promise, not a rupee.
  const fromSponsors = sponsorships
    .filter((s) => s.kind === 'money' && s.status === 'received')
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  const carryIn = Number(event?.carry_in_used ?? 0);
  const collected = fromFlats + fromSponsors + carryIn;
  // 'waived' flats are deliberately excluded — they are not debts.
  // Opted-out flats are excluded alongside waived ones: neither owes anything,
  // and showing them as outstanding invents a shortfall that does not exist.
  const pending = contributions
    .filter((c) => !c.opted_out && (c.status === 'pending' || c.status === 'initiated'))
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
    flatsTotal: contributions.filter((c) => c.status !== 'waived' && !c.opted_out).length,
    flatsPaid: contributions.filter((c) => c.status === 'received').length,
    fromFlats,
    fromSponsors,
    carryIn,
    optedOut: contributions.filter((c) => c.opted_out).length,
    itemsSponsored: sponsorships.filter((s) => s.kind === 'item').length,
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

// ════════════════════════════════════════════════════════════════════
// Celebrations — tasks, budget lines, sponsorships, and the split
// ════════════════════════════════════════════════════════════════════

export type ContributionBasis = 'flat' | 'person';
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type SponsorKind = 'money' | 'item';

export interface BudgetItem {
  id: string;
  title: string;
  category: ExpenseCategory;
  estimated: number;
  note: string | null;
}

export interface EventTask {
  id: string;
  title: string;
  detail: string | null;
  assignee_id: string | null;
  assignee?: { name: string; flat: string | null } | null;
  due_date: string | null;
  status: TaskStatus;
  updated_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  author?: { name: string } | null;
  note: string | null;
  photo_url: string | null;
  status_after: TaskStatus | null;
  created_at: string;
}

export interface Sponsorship {
  id: string;
  kind: SponsorKind;
  sponsor_name: string;
  sponsor_flat: string | null;
  amount: number | null;
  item: string | null;
  quantity: string | null;
  note: string | null;
  receipt_url: string | null;
  status: 'pledged' | 'received';
}

// ── Budget lines ────────────────────────────────────────────────────

export async function fetchBudgetItems(eventId: string): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from('event_budget_items')
    .select('id, title, category, estimated, note')
    .eq('event_id', eventId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as BudgetItem[];
}

export async function addBudgetItem(input: {
  eventId: string; communityId: string; createdBy: string;
  title: string; category: ExpenseCategory; estimated: number; note?: string | null;
}): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from('event_budget_items')
    .insert({
      event_id: input.eventId, community_id: input.communityId, created_by: input.createdBy,
      title: input.title.trim(), category: input.category,
      estimated: input.estimated, note: input.note?.trim() || null,
    })
    .select('id, title, category, estimated, note')
    .single();
  if (error) throw error;
  return data as BudgetItem;
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const { error } = await supabase.from('event_budget_items').delete().eq('id', id);
  if (error) throw error;
}

// ── Tasks ───────────────────────────────────────────────────────────

export async function fetchTasks(eventId: string): Promise<EventTask[]> {
  const { data, error } = await supabase
    .from('event_tasks')
    .select('id, title, detail, assignee_id, due_date, status, updated_at, assignee:profiles!event_tasks_assignee_id_fkey(name, flat)')
    .eq('event_id', eventId)
    // Unfinished first, then by when it is due. A board that buries the overdue
    // thing under three completed ones is a board nobody reads.
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as EventTask[];
}

export async function addTask(input: {
  eventId: string; communityId: string; createdBy: string;
  title: string; detail?: string | null; assigneeId?: string | null; dueDate?: string | null;
}): Promise<EventTask> {
  const { data, error } = await supabase
    .from('event_tasks')
    .insert({
      event_id: input.eventId, community_id: input.communityId, created_by: input.createdBy,
      title: input.title.trim(), detail: input.detail?.trim() || null,
      assignee_id: input.assigneeId ?? null, due_date: input.dueDate ?? null,
    })
    .select('id, title, detail, assignee_id, due_date, status, updated_at')
    .single();
  if (error) throw error;
  return data as EventTask;
}

export async function updateTask(id: string, patch: Partial<{
  title: string; detail: string | null; assignee_id: string | null; due_date: string | null; status: TaskStatus;
}>): Promise<void> {
  const { error } = await supabase.from('event_tasks').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('event_tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
  const { data, error } = await supabase
    .from('event_task_updates')
    .select('id, task_id, author_id, note, photo_url, status_after, created_at, author:profiles!event_task_updates_author_id_fkey(name)')
    .eq('task_id', taskId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as TaskUpdate[];
}

/**
 * Post progress on a task.
 *
 * The task's own status follows the update, via a trigger — so the board can
 * never disagree with the thread beneath it.
 */
export async function addTaskUpdate(input: {
  taskId: string; authorId: string;
  note?: string | null; photoUrl?: string | null; statusAfter?: TaskStatus | null;
}): Promise<void> {
  const { error } = await supabase.from('event_task_updates').insert({
    task_id: input.taskId,
    author_id: input.authorId,
    note: input.note?.trim() || null,
    photo_url: input.photoUrl ?? null,
    status_after: input.statusAfter ?? null,
  });
  if (error) throw error;
}

// ── Sponsorships ────────────────────────────────────────────────────

export async function fetchSponsorships(eventId: string): Promise<Sponsorship[]> {
  const { data, error } = await supabase
    .from('event_sponsorships')
    .select('id, kind, sponsor_name, sponsor_flat, amount, item, quantity, note, receipt_url, status')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sponsorship[];
}

export async function addSponsorship(input: {
  eventId: string; communityId: string; recordedBy: string;
  kind: SponsorKind; sponsorName: string; sponsorFlat?: string | null;
  sponsorUserId?: string | null;
  amount?: number | null; item?: string | null; quantity?: string | null;
  note?: string | null; receiptUrl?: string | null; status?: 'pledged' | 'received';
}): Promise<Sponsorship> {
  const { data, error } = await supabase
    .from('event_sponsorships')
    .insert({
      event_id: input.eventId, community_id: input.communityId, recorded_by: input.recordedBy,
      kind: input.kind,
      sponsor_name: input.sponsorName.trim(),
      sponsor_user_id: input.sponsorUserId ?? null,
      sponsor_flat: input.sponsorFlat?.trim() || null,
      amount: input.kind === 'money' ? (input.amount ?? 0) : null,
      item: input.kind === 'item' ? (input.item?.trim() ?? null) : null,
      quantity: input.quantity?.trim() || null,
      note: input.note?.trim() || null,
      receipt_url: input.receiptUrl ?? null,
      status: input.status ?? 'pledged',
    })
    .select('id, kind, sponsor_name, sponsor_flat, amount, item, quantity, note, receipt_url, status')
    .single();
  if (error) throw error;
  return data as Sponsorship;
}

export async function setSponsorshipStatus(id: string, status: 'pledged' | 'received'): Promise<void> {
  const { error } = await supabase.from('event_sponsorships').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteSponsorship(id: string): Promise<void> {
  const { error } = await supabase.from('event_sponsorships').delete().eq('id', id);
  if (error) throw error;
}

// ── The split ───────────────────────────────────────────────────────

export interface SplitPlan {
  /** What each flat, or each head, is being asked for. */
  perUnit: number;
  /** Flats actually taking part — opt-outs and waivers excluded. */
  units: number;
  /** What still needs raising from residents, after everything already in hand. */
  target: number;
  rows: { id: string; flat: string; amount: number }[];
}

/**
 * Work out what to ask each flat for.
 *
 * The target is the budget MINUS everything already in hand: money carried
 * forward from a previous celebration, and cash sponsorships. Asking a society
 * for the full budget while sitting on eight thousand rupees from last Diwali
 * and a sponsored sound system is how a collection loses its credibility — and
 * credibility is the only thing that makes people pay at all.
 *
 * Per flat, every participating flat pays the same. Per person, every head
 * pays the same, so a family of five pays more than a couple — which is the
 * entire reason a committee picks that basis.
 *
 * Opted-out and waived flats are excluded from the divisor and from the
 * result. A flat that opted out is not a debt and must never be shown as one.
 */
export function computeSplit(
  event: SocietyEvent,
  contributions: Contribution[],
  sponsorships: Sponsorship[],
): SplitPlan {
  const budget = Number(event.budget_amount ?? 0);
  const carry = Number(event.carry_in_used ?? 0);
  const sponsoredCash = sponsorships
    .filter((s) => s.kind === 'money')
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  const target = Math.max(0, budget - carry - sponsoredCash);

  const participating = contributions.filter((c) => !c.opted_out && c.status !== 'waived');
  const basis = event.contribution_basis ?? 'flat';

  const units = basis === 'person'
    ? participating.reduce((sum, c) => sum + (c.head_count ?? 1), 0)
    : participating.length;

  // Rounded up to the rupee. Asking for 1333.33 collects 1333 and leaves the
  // committee short by the remainder times the number of flats.
  const perUnit = units > 0 ? Math.ceil(target / units) : 0;

  return {
    perUnit,
    units,
    target,
    rows: participating.map((c) => ({
      id: c.id,
      flat: c.flat,
      amount: basis === 'person' ? perUnit * (c.head_count ?? 1) : perUnit,
    })),
  };
}

/**
 * Apply a computed split.
 *
 * Only touches flats that have not paid yet. Rewriting the amount on a flat
 * that has already handed over cash would conjure a debt or a refund out of an
 * arithmetic change — the one thing a treasurer can never explain to a
 * neighbour.
 */
export async function applySplit(plan: SplitPlan, contributions: Contribution[]): Promise<number> {
  const unpaid = new Set(
    contributions.filter((c) => c.status === 'pending' || c.status === 'initiated').map((c) => c.id),
  );
  const rows = plan.rows.filter((r) => unpaid.has(r.id));
  if (!rows.length) return 0;

  await Promise.all(rows.map((r) =>
    supabase.from('event_contributions').update({ amount: r.amount }).eq('id', r.id)));
  return rows.length;
}

export async function setOptedOut(id: string, optedOut: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_contributions')
    // Opting out zeroes the amount: a flat that is not taking part must not
    // appear to owe anything, in any total or any report.
    .update(optedOut ? { opted_out: true, amount: 0 } : { opted_out: false })
    .eq('id', id);
  if (error) throw error;
}

export async function setHeadCount(id: string, heads: number): Promise<void> {
  const { error } = await supabase
    .from('event_contributions')
    .update({ head_count: Math.max(1, Math.round(heads)) })
    .eq('id', id);
  if (error) throw error;
}

export async function setContributionReceipt(id: string, receiptUrl: string): Promise<void> {
  const { error } = await supabase
    .from('event_contributions')
    .update({ receipt_url: receiptUrl })
    .eq('id', id);
  if (error) throw error;
}

// ── Details: schedule, requirements, thank-yous ──────────────────────
//
// The free-form half of a celebration. See 0083 for why this is a list of
// notes rather than fixed columns on the event.

export interface EventNote {
  id: string;
  title: string | null;
  body: string | null;
  photo_urls: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function fetchEventNotes(eventId: string): Promise<EventNote[]> {
  const { data, error } = await supabase
    .from('event_notes')
    .select('id, title, body, photo_urls, sort_order, created_at, updated_at')
    .eq('event_id', eventId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((n) => ({
    ...(n as EventNote),
    // Postgres gives back null for an array column that was never written.
    photo_urls: (n as EventNote).photo_urls ?? [],
  }));
}

export async function addEventNote(input: {
  eventId: string;
  title?: string | null;
  body?: string | null;
  photoUrls?: string[];
  sortOrder?: number;
  userId: string;
  communityId?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('event_notes')
    .insert({
      event_id: input.eventId,
      community_id: input.communityId ?? COMMUNITY_ID,
      title: input.title?.trim() || null,
      body: input.body?.trim() || null,
      photo_urls: input.photoUrls ?? [],
      sort_order: input.sortOrder ?? 0,
      created_by: input.userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateEventNote(
  id: string,
  patch: Partial<{ title: string | null; body: string | null; photo_urls: string[]; sort_order: number }>,
): Promise<void> {
  const { error } = await supabase.from('event_notes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteEventNote(id: string): Promise<void> {
  const { error } = await supabase.from('event_notes').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Upload one photo for a note. Indexed by position so re-uploading the same
 * slot replaces rather than accumulates, matching how posts and listings work.
 */
export async function uploadNotePhoto(localUri: string, noteId: string, index: number): Promise<string> {
  return uploadContentPhoto(localUri, `event-note/${noteId}/${index}.jpg`);
}
