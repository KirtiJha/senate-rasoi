import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { uploadContentPhoto } from './photoUpload';
import { COMMUNITY_ID, isSupabaseConfigured, supabase } from './supabase';

/**
 * Bugs, feature requests and feedback — with a thread, so a report is answered
 * rather than filed.
 *
 * Visible to its author and to the society's admins only. See 0085 for why: a
 * public board collapses duplicate feature requests but silences the honest
 * bug report, and the honest report is the one worth having.
 */

export type FeedbackKind = 'bug' | 'feature' | 'feedback';
export type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'done' | 'declined';

export const FEEDBACK_KINDS: { key: FeedbackKind; label: string; blurb: string; icon: string }[] = [
  { key: 'bug', label: 'Something is broken', blurb: 'A screen, a button or a number that is wrong', icon: 'bug-outline' },
  { key: 'feature', label: 'I wish it could…', blurb: 'Something Aangan does not do yet', icon: 'bulb-outline' },
  { key: 'feedback', label: 'Just telling you', blurb: 'Confusing, slow, or something you liked', icon: 'chatbubble-ellipses-outline' },
];

export const FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; tone: 'accent' | 'success' | 'neutral' }> = {
  open:        { label: 'Open',        tone: 'neutral' },
  planned:     { label: 'Planned',     tone: 'accent'  },
  in_progress: { label: 'In progress', tone: 'accent'  },
  done:        { label: 'Done',        tone: 'success' },
  declined:    { label: 'Closed',      tone: 'neutral' },
};

/** The order an admin moves a report through, for the status picker. */
export const FEEDBACK_FLOW: FeedbackStatus[] = ['open', 'planned', 'in_progress', 'done', 'declined'];

export interface FeedbackItem {
  id: string;
  community_id: string;
  author_id: string;
  kind: FeedbackKind;
  title: string;
  body: string | null;
  photo_urls: string[];
  status: FeedbackStatus;
  app_version: string | null;
  platform: string | null;
  created_at: string;
  updated_at: string;
  author?: { name: string; flat: string | null } | null;
}

export interface FeedbackComment {
  id: string;
  item_id: string;
  author_id: string;
  body: string;
  status_after: FeedbackStatus | null;
  created_at: string;
  author?: { name: string } | null;
}

const SELECT = '*, author:profiles!feedback_items_author_id_fkey(name,flat)';

/** What the reporter cannot be expected to know, gathered without asking. */
function appContext(): { app_version: string | null; platform: string | null } {
  const version = Constants.expoConfig?.version ?? null;
  const runtime = (Constants.expoConfig as { runtimeVersion?: unknown })?.runtimeVersion;
  return {
    app_version: version ? `${version}${typeof runtime === 'string' ? ` (${runtime})` : ''}` : null,
    platform: `${Platform.OS} ${Platform.Version}`,
  };
}

export async function fetchMyFeedback(userId: string): Promise<FeedbackItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('feedback_items')
    .select(SELECT)
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeedbackItem[];
}

/**
 * The admin queue. Open work first, then everything else — a dashboard that
 * buries the untouched reports under last month's fixed ones is a dashboard
 * that stops being opened.
 */
export async function fetchFeedbackQueue(
  communityId: string = COMMUNITY_ID,
  filter?: { status?: FeedbackStatus; kind?: FeedbackKind },
): Promise<FeedbackItem[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from('feedback_items')
    .select(SELECT)
    .eq('community_id', communityId);
  if (filter?.status) q = q.eq('status', filter.status);
  if (filter?.kind) q = q.eq('kind', filter.kind);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;

  const rows = (data ?? []) as FeedbackItem[];
  const RANK: Record<FeedbackStatus, number> = {
    open: 0, in_progress: 1, planned: 2, done: 3, declined: 4,
  };
  return rows.sort((a, b) => RANK[a.status] - RANK[b.status]);
}

export async function fetchFeedbackItem(id: string): Promise<FeedbackItem | null> {
  const { data, error } = await supabase.from('feedback_items').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as FeedbackItem) ?? null;
}

export async function createFeedback(input: {
  kind: FeedbackKind;
  title: string;
  body?: string;
  photoUris?: string[];
  userId: string;
  communityId?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('feedback_items')
    .insert({
      community_id: input.communityId ?? COMMUNITY_ID,
      author_id: input.userId,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      ...appContext(),
    })
    .select('id')
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;

  // Photos are filed under the report, so they need its id first. A failed
  // upload must not lose the report itself — the words matter more than the
  // screenshot, and a resident who has to retype their bug will not.
  if (input.photoUris?.length) {
    try {
      const urls: string[] = [];
      for (let i = 0; i < input.photoUris.length; i++) {
        urls.push(await uploadContentPhoto(input.photoUris[i], `feedback/${id}/${i}.jpg`));
      }
      await supabase.from('feedback_items').update({ photo_urls: urls }).eq('id', id);
    } catch {
      /* keep the report */
    }
  }
  return id;
}

export async function fetchFeedbackComments(itemId: string): Promise<FeedbackComment[]> {
  const { data, error } = await supabase
    .from('feedback_comments')
    .select('*, author:profiles!feedback_comments_author_id_fkey(name)')
    .eq('item_id', itemId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as FeedbackComment[];
}

/**
 * Reply, optionally moving the report at the same time.
 *
 * Status travels with a comment rather than on its own, so the reporter always
 * gets a reason alongside the label. The trigger in 0085 applies it and
 * notifies them.
 */
export async function addFeedbackComment(input: {
  itemId: string;
  userId: string;
  body: string;
  statusAfter?: FeedbackStatus | null;
}): Promise<void> {
  const { error } = await supabase.from('feedback_comments').insert({
    item_id: input.itemId,
    author_id: input.userId,
    body: input.body.trim(),
    status_after: input.statusAfter ?? null,
  });
  if (error) throw error;
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from('feedback_items').delete().eq('id', id);
  if (error) throw error;
}

/** Counts for the admin dashboard's header. */
export async function fetchFeedbackCounts(
  communityId: string = COMMUNITY_ID,
): Promise<Record<FeedbackStatus, number>> {
  const empty: Record<FeedbackStatus, number> = {
    open: 0, planned: 0, in_progress: 0, done: 0, declined: 0,
  };
  if (!isSupabaseConfigured) return empty;
  const { data, error } = await supabase
    .from('feedback_items')
    .select('status')
    .eq('community_id', communityId)
    .limit(2000);
  if (error) return empty;
  for (const r of (data ?? []) as { status: FeedbackStatus }[]) empty[r.status] += 1;
  return empty;
}
