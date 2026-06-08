import { isSupabaseConfigured, supabase } from './supabase';

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
  expires_at: string | null;
  is_closed: boolean;
  created_at: string;
  options: PollOption[];
  my_vote: string | null;
  total_votes: number;
  author?: { name: string; flat: string | null };
}

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

  const [votesRes, myVotesRes] = await Promise.all([
    supabase.from('poll_votes').select('poll_id, option_id').in('poll_id', pollIds),
    userId
      ? supabase.from('poll_votes').select('poll_id, option_id').in('poll_id', pollIds).eq('user_id', userId)
      : Promise.resolve({ data: null }),
  ]);

  const allVotes = (votesRes.data ?? []) as { poll_id: string; option_id: string }[];
  const myVotes = (myVotesRes.data ?? []) as { poll_id: string; option_id: string }[];

  const voteCounts: Record<string, number> = {};
  const totalVotes: Record<string, number> = {};
  for (const v of allVotes) {
    voteCounts[v.option_id] = (voteCounts[v.option_id] ?? 0) + 1;
    totalVotes[v.poll_id] = (totalVotes[v.poll_id] ?? 0) + 1;
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

export function subscribeToPolls(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`polls-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
