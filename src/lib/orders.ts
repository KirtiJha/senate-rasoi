import { supabase } from './supabase';
import type { MyOrder, Order, OrderStatus } from './types';

// Orders now live entirely on the server (keyed to auth users). The foodie sees
// their own orders; the chef sees orders on their dishes (RLS-enforced).

const CANCEL_WINDOW_MS = 5 * 60 * 1000;

/** The foodie's own orders, newest first, joined with the dish for display. */
export async function listMyOrders(userId: string): Promise<MyOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, dish:dishes(dish_name,slot,price,photo_url,chef_name,whatsapp,chef_user_id)')
    .eq('orderer_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyOrder[];
}

/** Orderer cancels their own order (server enforces the 5-min window). */
export async function cancelOrder(orderId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
  if (error) throw error;
  return Boolean(data);
}

/** Can the orderer still self-cancel? (placed/accepted + within the window) */
export function canSelfCancel(order: Order): boolean {
  if (order.status !== 'placed' && order.status !== 'accepted') return false;
  return Date.now() - new Date(order.created_at).getTime() < CANCEL_WINDOW_MS;
}

/** Live updates to orders relevant to this user (RLS scopes the stream). */
export function subscribeToOrders(onChange: () => void): () => void {
  const channel = supabase
    .channel('orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Friendly status copy (shared by both sides) ─────────────────────
export const STATUS_TEXT: Record<OrderStatus, string> = {
  placed: 'Waiting for the chef',
  accepted: 'Accepted by the chef',
  rejected: 'Declined by the chef',
  cooking: 'Cooking now',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
