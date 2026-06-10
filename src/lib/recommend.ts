import { COMMUNITY_ID, isSupabaseConfigured, supabase } from './supabase';

export const RECO_CATEGORIES = [
  { key: 'health', label: 'Health & doctors', icon: 'medkit', color: '#EF4444' },
  { key: 'repairs', label: 'Repairs & services', icon: 'construct', color: '#F59E0B' },
  { key: 'schools', label: 'Schools & classes', icon: 'school', color: '#6366F1' },
  { key: 'home', label: 'Home & maid help', icon: 'home', color: '#0EA5E9' },
  { key: 'shopping', label: 'Shopping & vendors', icon: 'bag-handle', color: '#8B5CF6' },
  { key: 'travel', label: 'Travel & cabs', icon: 'car', color: '#14B8A6' },
  { key: 'other', label: 'Other', icon: 'help-circle', color: '#6B7280' },
] as const;

export function recoCategory(key: string) {
  return RECO_CATEGORIES.find((c) => c.key === key) ?? RECO_CATEGORIES[RECO_CATEGORIES.length - 1];
}

export interface RecoQuestion {
  id: string;
  community_id: string;
  author_id: string;
  category: string;
  title: string;
  detail: string | null;
  answer_count: number;
  created_at: string;
  bump_at: string;
  author?: { name: string; flat: string | null };
}

export interface RecoAnswer {
  id: string;
  question_id: string;
  author_id: string;
  body: string;
  provider_name: string | null;
  provider_phone: string | null;
  vote_count: number;
  created_at: string;
  author?: { name: string; flat: string | null };
  voted?: boolean; // set client-side
}

const Q_SELECT = '*, author:profiles!reco_questions_author_id_fkey(name,flat)';
const A_SELECT = '*, author:profiles!reco_answers_author_id_fkey(name,flat)';

export async function fetchQuestions(category?: string, communityId: string = COMMUNITY_ID): Promise<RecoQuestion[]> {
  let q = supabase.from('reco_questions').select(Q_SELECT).eq('community_id', communityId);
  if (category && category !== 'all') q = q.eq('category', category);
  const { data, error } = await q.order('bump_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as RecoQuestion[];
}

export async function fetchQuestion(id: string): Promise<RecoQuestion | null> {
  const { data, error } = await supabase.from('reco_questions').select(Q_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as RecoQuestion) ?? null;
}

export async function fetchAnswers(questionId: string, userId?: string): Promise<RecoAnswer[]> {
  const { data, error } = await supabase
    .from('reco_answers').select(A_SELECT)
    .eq('question_id', questionId).order('vote_count', { ascending: false }).order('created_at', { ascending: true }).limit(200);
  if (error) throw error;
  const answers = (data ?? []) as RecoAnswer[];
  if (userId && answers.length) {
    const { data: votes } = await supabase.from('reco_votes').select('answer_id').eq('user_id', userId).in('answer_id', answers.map((a) => a.id));
    const voted = new Set((votes ?? []).map((v) => v.answer_id));
    answers.forEach((a) => { a.voted = voted.has(a.id); });
  }
  return answers;
}

export async function askQuestion(input: { communityId?: string; authorId: string; category: string; title: string; detail: string | null }): Promise<RecoQuestion> {
  const { data, error } = await supabase
    .from('reco_questions')
    .insert({ community_id: input.communityId ?? COMMUNITY_ID, author_id: input.authorId, category: input.category, title: input.title.trim(), detail: input.detail?.trim() || null })
    .select(Q_SELECT).single();
  if (error) throw error;
  return data as RecoQuestion;
}

export async function postAnswer(input: { questionId: string; authorId: string; body: string; providerName: string | null; providerPhone: string | null }): Promise<RecoAnswer> {
  const { data, error } = await supabase
    .from('reco_answers')
    .insert({ question_id: input.questionId, author_id: input.authorId, body: input.body.trim(), provider_name: input.providerName?.trim() || null, provider_phone: input.providerPhone?.replace(/\D/g, '') || null })
    .select(A_SELECT).single();
  if (error) throw error;
  return data as RecoAnswer;
}

export async function deleteAnswer(id: string): Promise<void> {
  const { error } = await supabase.from('reco_answers').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('reco_questions').delete().eq('id', id);
  if (error) throw error;
}

/** Toggle the current user's upvote on an answer. Returns the new voted state. */
export async function toggleVote(answerId: string, userId: string, currentlyVoted: boolean): Promise<boolean> {
  if (currentlyVoted) {
    const { error } = await supabase.from('reco_votes').delete().eq('answer_id', answerId).eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('reco_votes').insert({ answer_id: answerId, user_id: userId });
  if (error) throw error;
  return true;
}

export function subscribeQuestions(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase.channel(`reco-questions-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reco_questions', filter: `community_id=eq.${communityId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function subscribeAnswers(questionId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase.channel(`reco-answers-${questionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reco_answers', filter: `question_id=eq.${questionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reco_votes' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
