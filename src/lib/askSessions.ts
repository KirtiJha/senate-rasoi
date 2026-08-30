import { AskResultItem } from './ai';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Persisted Ask Aangan conversations.
 *
 * Replaces the in-memory askStore, which held the chat in a module-level array:
 * it survived navigating away and back, and died on reload. Nothing was ever
 * written down, so there was no history to return to.
 *
 * Everything here is best-effort by design. Ask Aangan must keep working when
 * persistence fails — a resident who cannot save a chat should still get an
 * answer, so callers log and continue rather than surfacing a storage error on
 * top of a perfectly good reply.
 */

export interface AskSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AskMessage {
  role: 'user' | 'assistant';
  text: string;
  results?: AskResultItem[];
}

/** Newest activity first — an old chat you return to rises back to the top. */
export async function fetchSessions(userId: string, limit = 30): Promise<AskSession[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('ask_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AskSession[];
}

export async function fetchMessages(sessionId: string): Promise<AskMessage[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('ask_messages')
    .select('role, text, results')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    text: m.text as string,
    results: (m.results ?? undefined) as AskResultItem[] | undefined,
  }));
}

export async function createSession(userId: string, communityId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('ask_sessions')
    .insert({ user_id: userId, community_id: communityId })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Appends one turn. The session's title and updated_at are maintained by a
 * trigger, so the client never has to remember to touch them — and cannot get
 * them wrong when a write fails halfway.
 */
export async function appendMessage(sessionId: string, m: AskMessage): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('ask_messages').insert({
    session_id: sessionId,
    role: m.role,
    text: m.text,
    results: m.results ?? null,
  });
  if (error) throw error;
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('ask_sessions')
    .update({ title: title.trim().slice(0, 60) })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('ask_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}
