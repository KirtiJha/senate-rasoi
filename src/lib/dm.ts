import { isSupabaseConfigured, supabase } from './supabase';

// Direct messages (Phase 12b). 1:1 neighbour DMs scoped to a community.
// Thread creation goes through the dm_get_or_create_thread RPC (atomic +
// same-community check); messages stream over realtime.

export interface DmParticipant {
  id: string;
  name: string;
  flat: string | null;
}

export interface DmThreadRow {
  id: string;
  community_id: string;
  user_a: string;
  user_b: string;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  a?: DmParticipant;
  b?: DmParticipant;
}

/** A thread from the current user's perspective: who the *other* person is. */
export interface InboxThread {
  id: string;
  other: DmParticipant;
  lastMessage: string | null;
  lastMessageAt: string;
}

export interface DmMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const THREAD_SELECT =
  '*, a:profiles!dm_threads_user_a_fkey(id,name,flat), b:profiles!dm_threads_user_b_fkey(id,name,flat)';

/** Society members you can start a conversation with (everyone but yourself). */
export async function fetchCommunityMembers(
  communityId: string,
  excludeUserId: string,
): Promise<DmParticipant[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, flat')
    .eq('community_id', communityId)
    .neq('id', excludeUserId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DmParticipant[];
}

/** Get (or create) the 1:1 thread with another user; returns its id. */
export async function getOrCreateThread(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('dm_get_or_create_thread', { p_other: otherUserId });
  if (error) throw error;
  return data as string;
}

/** The current user's inbox, newest activity first. */
export async function fetchInbox(userId: string): Promise<InboxThread[]> {
  const { data, error } = await supabase
    .from('dm_threads')
    .select(THREAD_SELECT)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DmThreadRow[]).map((t) => {
    const other = (t.user_a === userId ? t.b : t.a) ?? { id: '', name: 'Neighbour', flat: null };
    return { id: t.id, other, lastMessage: t.last_message, lastMessageAt: t.last_message_at };
  });
}

/** Load one thread's metadata (to show the other person in the header). */
export async function fetchThread(threadId: string, userId: string): Promise<InboxThread | null> {
  const { data, error } = await supabase
    .from('dm_threads')
    .select(THREAD_SELECT)
    .eq('id', threadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const t = data as DmThreadRow;
  const other = (t.user_a === userId ? t.b : t.a) ?? { id: '', name: 'Neighbour', flat: null };
  return { id: t.id, other, lastMessage: t.last_message, lastMessageAt: t.last_message_at };
}

export async function fetchMessages(threadId: string): Promise<DmMessageRow[]> {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DmMessageRow[];
}

export async function sendMessage(threadId: string, senderId: string, body: string): Promise<DmMessageRow> {
  const { data, error } = await supabase
    .from('dm_messages')
    .insert({ thread_id: threadId, sender_id: senderId, body: body.trim() })
    .select('*')
    .single();
  if (error) throw error;
  return data as DmMessageRow;
}

/** Mark the other person's unread messages in a thread as read. */
export async function markThreadRead(threadId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('dm_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/** Count threads with at least one unread message addressed to the user. */
export async function fetchUnreadThreadCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('thread_id')
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { thread_id: string }).thread_id)).size;
}

// Unique suffix per subscription so a re-subscribe (e.g. the effect re-running as
// userId loads) never reuses an existing, already-subscribed channel — which makes
// supabase-js throw "cannot add postgres_changes callbacks after subscribe()".
let channelSeq = 0;

export function subscribeToThread(threadId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`dm-${threadId}-${++channelSeq}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${threadId}` },
      onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeToInbox(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`dm-inbox-${++channelSeq}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_threads' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
