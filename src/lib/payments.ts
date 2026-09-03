import { isSupabaseConfigured, supabase } from './supabase';

export type PaymentStatus = 'initiated' | 'received' | 'cancelled';

export interface PaymentRow {
  id: string;
  community_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  note: string | null;
  context_type: string | null;
  context_id: string | null;
  upi_id: string | null;
  status: PaymentStatus;
  created_at: string;
  received_at: string | null;
  payer?: { name: string | null; flat: string | null } | null;
  payee?: { name: string | null; flat: string | null } | null;
  source?: 'payment' | 'court'; // 'court' rows come from sports dues (managed there)
}

/** Build a UPI intent link that opens the payer's UPI app pre-filled. */
export function upiUri(upi: string, payeeName: string, amount: number, note?: string | null): string {
  const params = new URLSearchParams({ pa: upi, pn: payeeName || 'Neighbour', am: amount.toFixed(2), cu: 'INR' });
  if (note) params.set('tn', note.slice(0, 60));
  return `upi://pay?${params.toString()}`;
}

export interface NewPayment {
  communityId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  note?: string | null;
  contextType?: 'dish' | 'tiffin' | 'listing' | 'event' | 'other' | null;
  contextId?: string | null;
  upiId?: string | null;
}

export async function createPayment(input: NewPayment): Promise<void> {
  const { error } = await supabase.from('payments').insert({
    community_id: input.communityId,
    payer_id: input.payerId,
    payee_id: input.payeeId,
    amount: input.amount,
    note: input.note?.trim() || null,
    context_type: input.contextType ?? null,
    context_id: input.contextId ?? null,
    upi_id: input.upiId ?? null,
  });
  if (error) throw error;
}

/**
 * Which of these orders have already been paid for, and how far along.
 *
 * `received` wins over `initiated` when an order has more than one row —
 * someone recording a payment twice should not un-confirm the one the chef
 * already acknowledged. Cancelled rows are ignored, so a payment recorded by
 * mistake and withdrawn leaves the order payable again.
 *
 * Safe to call from either side: the `payments_read` policy limits rows to the
 * payer, the payee and admins.
 */
export interface OrderPayment {
  id: string;
  status: PaymentStatus;
}

export async function fetchOrderPayments(
  orderIds: string[],
): Promise<Record<string, OrderPayment>> {
  if (!isSupabaseConfigured || orderIds.length === 0) return {};
  const { data, error } = await supabase
    .from('payments')
    .select('id,context_id,status')
    .eq('context_type', 'dish')
    .in('context_id', orderIds)
    .neq('status', 'cancelled');
  if (error) throw error;

  const byOrder: Record<string, OrderPayment> = {};
  for (const row of (data ?? []) as { id: string; context_id: string | null; status: PaymentStatus }[]) {
    if (!row.context_id) continue;
    if (byOrder[row.context_id]?.status === 'received') continue;
    byOrder[row.context_id] = { id: row.id, status: row.status };
  }
  return byOrder;
}

/** Receiver confirms a payment (only the payee can; returns false if not allowed). */
export async function markReceived(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('payment_mark_received', { p_id: id });
  if (error) throw error;
  return Boolean(data);
}

/** Payer cancels a payment they initiated (e.g. recorded by mistake). */
export async function cancelPayment(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('payment_cancel', { p_id: id });
  if (error) throw error;
  return Boolean(data);
}

/** All payments the current user is party to (RLS limits to payer/payee). */
/** All of the user's payments across every category — the neighbour ledger
 *  (`payments`) PLUS sports court dues (`court_payments`), merged + sorted. */
export async function fetchMyPayments(): Promise<PaymentRow[]> {
  const [main, court] = await Promise.all([
    supabase
      .from('payments')
      .select('*, payer:profiles!payments_payer_id_fkey(name, flat), payee:profiles!payments_payee_id_fkey(name, flat)')
      .order('created_at', { ascending: false }),
    supabase
      .from('court_payments')
      .select('*, payer:profiles!court_payments_payer_user_id_fkey(name, flat), payee:profiles!court_payments_payee_user_id_fkey(name, flat), session:court_sessions!court_payments_session_id_fkey(session_date, booking:court_bookings!court_sessions_booking_id_fkey(title))')
      .order('created_at', { ascending: false }),
  ]);
  if (main.error) throw main.error;

  const rows: PaymentRow[] = ((main.data ?? []) as unknown as PaymentRow[]).map((p) => ({ ...p, source: 'payment' }));

  // Map court settlements into the common PaymentRow shape (view-only here).
  for (const cp of (court.error ? [] : (court.data ?? [])) as any[]) {
    const date = cp.session?.session_date as string | undefined;
    const title = cp.session?.booking?.title as string | undefined;
    rows.push({
      id: cp.id,
      community_id: cp.community_id,
      payer_id: cp.payer_user_id,
      payee_id: cp.payee_user_id,
      amount: Number(cp.amount),
      note: `🏸 ${title || 'Court'}${date ? ` · ${new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''} (Sports dues)`,
      context_type: 'court',
      context_id: cp.session_id,
      upi_id: cp.upi_id ?? null,
      status: cp.status === 'paid' ? 'received' : (cp.status as PaymentStatus), // court 'paid' == received
      created_at: cp.created_at,
      received_at: cp.paid_at ?? null,
      payer: cp.payer ?? null,
      payee: cp.payee ?? null,
      source: 'court',
    });
  }

  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function subscribePayments(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel('payments-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_payments' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
