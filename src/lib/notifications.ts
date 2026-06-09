import { isSupabaseConfigured, supabase } from './supabase';

export type NotificationType =
  | 'post' | 'announcement' | 'listing' | 'poll' | 'message'
  | 'dish' | 'tiffin' | 'sport' | 'document';

export interface NotificationRow {
  id: string;
  community_id: string;
  type: NotificationType;
  entity_id: string | null;
  actor_id: string | null;
  target_user_id: string | null;
  title: string;
  body: string | null;
  route: string | null;
  created_at: string;
}

export interface NotificationItem extends NotificationRow {
  read: boolean;
}

/**
 * Notifications visible to the user (community broadcasts + DMs to them) since
 * they joined — including their own actions — each flagged read/unread from
 * their own notification_reads rows.
 */
export async function fetchNotifications(
  userId: string,
  joinedAt: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const [notifRes, readRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .gte('created_at', joinedAt)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase.from('notification_reads').select('notification_id').eq('user_id', userId),
  ]);
  if (notifRes.error) throw notifRes.error;
  if (readRes.error) throw readRes.error;
  const readSet = new Set((readRes.data ?? []).map((r) => (r as { notification_id: string }).notification_id));
  return ((notifRes.data ?? []) as NotificationRow[]).map((n) => ({ ...n, read: readSet.has(n.id) }));
}

/** Mark specific notifications read for a user (idempotent). */
export async function markRead(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const rows = ids.map((id) => ({ notification_id: id, user_id: userId }));
  const { error } = await supabase
    .from('notification_reads')
    .upsert(rows, { onConflict: 'notification_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Mark notifications unread again for a user (removes the read rows). */
export async function markUnread(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from('notification_reads')
    .delete()
    .eq('user_id', userId)
    .in('notification_id', ids);
  if (error) throw error;
}

/** "Clear all" — hide every notification up to now from this user's own bell. */
export async function clearAllNotifications(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ notifications_cleared_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export function subscribeNotifications(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel('notifications-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, onChange)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notification_reads', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
