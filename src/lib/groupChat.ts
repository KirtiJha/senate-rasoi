import { isSupabaseConfigured, supabase } from './supabase';

/**
 * The conversation inside a sports group.
 *
 * Twenty-one memberships across three groups and nowhere for any of them to
 * say "anyone for a game at seven?". Every arrangement in the tile is a form —
 * book a court, confirm a day, settle a due — and the talk that surrounds all
 * of it was happening on WhatsApp, which is why WhatsApp is still where this
 * society actually lives.
 *
 * Deliberately NOT a second DM system: same shape as `dm_messages`, same
 * bubbles, same composer. What differs is who can read it (0116 limits every
 * row to the group's own members) and that unread is tracked per member with
 * a read cursor rather than per message, because a message here has nine
 * readers rather than one.
 */

export interface GroupMessage {
  id: string;
  group_id: string;
  community_id: string;
  author_id: string;
  body: string | null;
  photo_url: string | null;
  created_at: string;
  author?: { name: string | null; flat: string | null } | null;
}

const SELECT = '*, author:profiles!group_messages_author_id_fkey(name,flat)';

export async function fetchGroupMessages(groupId: string, limit = 200): Promise<GroupMessage[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('group_messages')
    .select(SELECT)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Newest-first from the server (so the limit takes the RECENT ones), oldest
  // first on screen (so the thread reads downward like every other chat).
  return ((data ?? []) as unknown as GroupMessage[]).reverse();
}

export async function sendGroupMessage(input: {
  groupId: string;
  communityId: string;
  authorId: string;
  body: string;
  photoUrl?: string | null;
}): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: input.groupId,
      community_id: input.communityId,
      author_id: input.authorId,
      body: input.body.trim() || null,
      photo_url: input.photoUrl ?? null,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as GroupMessage;
}

/** Your own message, or anyone's if you are the captain or a society admin. */
export async function deleteGroupMessage(id: string): Promise<void> {
  const { error } = await supabase.from('group_messages').delete().eq('id', id);
  if (error) throw error;
}

/** Move this member's read cursor to now. */
export async function markGroupRead(groupId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('group_reads')
    .upsert({ group_id: groupId, user_id: userId, last_read_at: new Date().toISOString() },
            { onConflict: 'group_id,user_id' });
  if (error) throw error;
}

/** Unread count per group for the signed-in member. */
export async function fetchGroupUnread(): Promise<Map<string, number>> {
  if (!isSupabaseConfigured) return new Map();
  const { data, error } = await supabase.rpc('my_group_unread');
  if (error) throw error;
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { group_id: string; unread: number }[]) {
    out.set(r.group_id, Number(r.unread) || 0);
  }
  return out;
}

/** Total unread across every group the member belongs to. */
export async function fetchTotalGroupUnread(): Promise<number> {
  try {
    let n = 0;
    for (const v of (await fetchGroupUnread()).values()) n += v;
    return n;
  } catch { return 0; }
}

// A fresh channel name each time: supabase-js throws if postgres_changes
// callbacks are added to a channel that has already subscribed, which happens
// when the effect re-runs as userId loads.
let seq = 0;

export function subscribeGroupMessages(groupId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`group-chat-${groupId}-${++seq}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
