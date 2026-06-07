import { isSupabaseConfigured, supabase } from './supabase';

export type PostCategory =
  | 'general'
  | 'announcement'
  | 'issue'
  | 'feedback'
  | 'suggestion'
  | 'event'
  | 'lost_found';

export interface PostAuthor {
  name: string;
  flat: string | null;
}

export interface PostRow {
  id: string;
  community_id: string;
  author_id: string;
  category: PostCategory;
  title: string | null;
  body: string;
  photos: string[];
  pinned: boolean;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  author?: PostAuthor;
}

export interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: PostAuthor;
}

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  general: 'General',
  announcement: 'Announcement',
  issue: 'Issue',
  feedback: 'Feedback',
  suggestion: 'Suggestion',
  event: 'Event',
  lost_found: 'Lost & Found',
};

export const POST_CATEGORY_ICONS: Record<PostCategory, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  general: 'chatbubble-outline',
  announcement: 'megaphone-outline',
  issue: 'warning-outline',
  feedback: 'thumbs-up-outline',
  suggestion: 'bulb-outline',
  event: 'calendar-outline',
  lost_found: 'search-outline',
};

export const POST_CATEGORY_COLORS: Record<PostCategory, string> = {
  general: '#64748B',
  announcement: '#F59E0B',
  issue: '#EF4444',
  feedback: '#10B981',
  suggestion: '#8B5CF6',
  event: '#3B82F6',
  lost_found: '#F97316',
};

export const ALL_POST_CATEGORIES: PostCategory[] = [
  'general', 'announcement', 'issue', 'feedback', 'suggestion', 'event', 'lost_found',
];

// ── Feed ─────────────────────────────────────────────────────────────

export async function fetchPosts(communityId: string, category?: PostCategory): Promise<PostRow[]> {
  let q = supabase
    .from('posts')
    .select('*, author:profiles!posts_author_id_fkey(name, flat)')
    .eq('community_id', communityId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60);
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PostRow[];
}

export async function fetchPostById(id: string): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, author:profiles!posts_author_id_fkey(name, flat)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PostRow | null;
}

export interface NewPostInput {
  communityId: string;
  authorId: string;
  category: PostCategory;
  title?: string;
  body: string;
}

export async function createPost(input: NewPostInput): Promise<PostRow> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      community_id: input.communityId,
      author_id: input.authorId,
      category: input.category,
      title: input.title?.trim() || null,
      body: input.body.trim(),
    })
    .select('*, author:profiles!posts_author_id_fkey(name, flat)')
    .single();
  if (error) throw error;
  return data as PostRow;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('posts').update({ pinned, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function setResolved(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase.from('posts').update({ resolved, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export function subscribeToFeed(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`posts-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ── Comments ─────────────────────────────────────────────────────────

export async function fetchComments(postId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, author:profiles!post_comments_author_id_fkey(name, flat)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommentRow[];
}

export async function createComment(postId: string, authorId: string, body: string): Promise<CommentRow> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, body: body.trim() })
    .select('*, author:profiles!post_comments_author_id_fkey(name, flat)')
    .single();
  if (error) throw error;
  return data as CommentRow;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToComments(postId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`comments-${postId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
