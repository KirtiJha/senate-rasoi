import { isSupabaseConfigured, supabase } from './supabase';
import { resolvePhoto, uploadContentPhoto } from './photoUpload';

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  position: number;
  vote_count: number;
}

export interface PollRow {
  id: string;
  community_id: string;
  author_id: string;
  question: string;
  image_url: string | null;
  expires_at: string | null;
  is_closed: boolean;
  created_at: string;
  options: PollOption[];
  my_vote: string | null;
  total_votes: number;
  author?: { name: string; flat: string | null };
}

/**
 * Closed, or past its own deadline.
 *
 * is_closed was the only thing the screens looked at, so a poll with a
 * deadline kept offering its buttons until somebody closed it by hand. The
 * server now refuses those votes and a job closes expired polls twice an
 * hour; this keeps the screen honest in between.
 */
export const pollEnded = (p: { is_closed: boolean; expires_at: string | null }): boolean =>
  p.is_closed || (!!p.expires_at && new Date(p.expires_at).getTime() <= Date.now());

export async function fetchPolls(communityId: string): Promise<PollRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const { data, error } = await supabase
    .from('polls')
    .select('*, author:profiles!polls_author_id_fkey(name, flat), options:poll_options(id, text, position)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  const polls = (data ?? []) as any[];
  if (!polls.length) return [];

  const pollIds = polls.map((p: any) => p.id as string);

  // Counts come from an aggregate that returns no identities (0128).
  //
  // They used to be tallied here, from every ballot in the society fetched row
  // by row. Two things were wrong with that. It read other people's votes —
  // which the database now refuses — and it was capped at 1000 rows by
  // PostgREST, so a society past a thousand votes would have been shown a
  // wrong result with no sign that anything was missing.
  const [tallyRes, myVotesRes] = await Promise.all([
    supabase.rpc('poll_tallies', { p_polls: pollIds }),
    userId
      ? supabase.from('poll_votes').select('poll_id, option_id').in('poll_id', pollIds).eq('user_id', userId)
      : Promise.resolve({ data: null }),
  ]);

  const tallies = (tallyRes.data ?? []) as { poll_id: string; option_id: string; votes: number }[];
  const myVotes = (myVotesRes.data ?? []) as { poll_id: string; option_id: string }[];

  const voteCounts: Record<string, number> = {};
  const totalVotes: Record<string, number> = {};
  for (const t of tallies) {
    const n = Number(t.votes) || 0;
    voteCounts[t.option_id] = n;
    totalVotes[t.poll_id] = (totalVotes[t.poll_id] ?? 0) + n;
  }
  const myVoteMap: Record<string, string> = {};
  for (const v of myVotes) {
    myVoteMap[v.poll_id] = v.option_id;
  }

  return polls.map((p: any) => ({
    ...p,
    options: ((p.options ?? []) as any[])
      .sort((a: any, b: any) => a.position - b.position)
      .map((opt: any) => ({ ...opt, vote_count: voteCounts[opt.id] ?? 0 })),
    my_vote: myVoteMap[p.id] ?? null,
    total_votes: totalVotes[p.id] ?? 0,
  })) as PollRow[];
}

export async function createPoll(input: {
  communityId: string;
  authorId: string;
  question: string;
  options: string[];
  expiresAt?: Date;
  imageUri?: string | null;
}): Promise<void> {
  const { data: poll, error } = await supabase
    .from('polls')
    .insert({
      community_id: input.communityId,
      author_id: input.authorId,
      question: input.question.trim(),
      expires_at: input.expiresAt?.toISOString() ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const optionRows = input.options
    .map((text: string, i: number) => ({ poll_id: poll.id, text: text.trim(), position: i }))
    .filter((o: { poll_id: string; text: string; position: number }) => o.text);
  const { error: optErr } = await supabase.from('poll_options').insert(optionRows);
  if (optErr) throw optErr;

  if (input.imageUri) {
    try {
      const url = await uploadContentPhoto(input.imageUri, `poll/${poll.id}/0.jpg`);
      await supabase.from('polls').update({ image_url: url }).eq('id', poll.id);
    } catch { /* skip bad image */ }
  }
}

export async function votePoll(pollId: string, optionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('poll_votes')
    .upsert({ poll_id: pollId, option_id: optionId, user_id: userId }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}

export async function deletePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('polls').delete().eq('id', pollId);
  if (error) throw error;
}

export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('polls').update({ is_closed: true }).eq('id', pollId);
  if (error) throw error;
}

/** Edit a poll's question + image (options are left intact to preserve votes). */
export async function updatePoll(pollId: string, patch: { question?: string; imageUri?: string | null }): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.question !== undefined) row.question = patch.question.trim();
  if (patch.imageUri !== undefined) row.image_url = await resolvePhoto(patch.imageUri, `poll/${pollId}/0.jpg`);
  const { error } = await supabase.from('polls').update(row).eq('id', pollId);
  if (error) throw error;
}

/**
 * Live changes to this society's polls.
 *
 * It used to listen to every vote row in the database, unfiltered — which is
 * how a vote in another society refreshed this screen. It also cannot work
 * any more: ballots are readable only by the person who cast them (0128), so
 * Realtime would never deliver anybody else's. Counts refresh when the screen
 * regains focus and after your own vote; what is live is the thing that
 * changes the screen's shape — a poll opening or closing.
 */
export function subscribeToPolls(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`polls-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `community_id=eq.${communityId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
