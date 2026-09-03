import { COMMUNITY_ID, isSupabaseConfigured, supabase } from './supabase';

// Reporting + peer blocking. Required by App Store Guideline 1.2 (UGC) and
// Google Play's UGC policy.
//
// NOTE: peer blocking (`user_blocks`) is one member hiding another. It is NOT
// the same as `profiles.blocked`, which is an admin ban from the society.

export type ReportTargetType =
  | 'post' | 'comment' | 'listing' | 'dish' | 'borrow'
  | 'lost_found' | 'recommend' | 'property' | 'place' | 'message' | 'profile'
  // A roster row somebody was added to without being asked. Not abuse — a
  // correction request — but it belongs in the same admin queue.
  | 'directory_entry';

export type ReportReason =
  | 'csae'
  | 'spam' | 'harassment' | 'hate' | 'scam'
  | 'adult' | 'violence' | 'illegal' | 'other';

export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export const REPORT_REASONS: { key: ReportReason; label: string; blurb: string }[] = [
  // First on purpose: Google Play's Child Safety Standards policy expects an
  // obvious in-app CSAE reporting path, and /child-safety points users here.
  { key: 'csae', label: 'Child safety (CSAE)', blurb: 'Sexualises, endangers or exploits a child' },
  { key: 'spam', label: 'Spam or misleading', blurb: 'Repetitive, fake or misleading content' },
  { key: 'harassment', label: 'Harassment or bullying', blurb: 'Targeting or intimidating someone' },
  { key: 'hate', label: 'Hate speech', blurb: 'Attacks a group or identity' },
  { key: 'scam', label: 'Scam or fraud', blurb: 'Trying to cheat neighbours out of money' },
  { key: 'adult', label: 'Adult content', blurb: 'Sexual or explicit material' },
  { key: 'violence', label: 'Violence or threats', blurb: 'Threatening or graphic content' },
  { key: 'illegal', label: 'Illegal goods', blurb: 'Selling prohibited or illegal items' },
  { key: 'other', label: 'Something else', blurb: "Tell us what's wrong" },
];

export interface ContentReport {
  id: string;
  community_id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  target_owner_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: { name: string; flat: string | null };
  target_owner?: { name: string; flat: string | null };
}

const REPORT_SELECT =
  '*, reporter:profiles!content_reports_reporter_id_fkey(name,flat), target_owner:profiles!content_reports_target_owner_id_fkey(name,flat)';

/** File a report. Re-reporting the same item updates the existing row. */
export async function reportContent(input: {
  communityId?: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string | null;
  reason: ReportReason;
  details: string | null;
}): Promise<void> {
  const { error } = await supabase.from('content_reports').upsert({
    community_id: input.communityId ?? COMMUNITY_ID,
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    target_owner_id: input.targetOwnerId,
    reason: input.reason,
    details: input.details?.trim() || null,
    status: 'open',
  }, { onConflict: 'reporter_id,target_type,target_id' });
  if (error) throw error;
}

/** Admin: the review queue for this society. */
export async function fetchReports(
  communityId: string = COMMUNITY_ID,
  status?: ReportStatus,
): Promise<ContentReport[]> {
  let q = supabase.from('content_reports').select(REPORT_SELECT).eq('community_id', communityId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as ContentReport[];
}

/** Admin: triage a report. */
export async function setReportStatus(id: string, status: ReportStatus, reviewerId: string): Promise<void> {
  const { error } = await supabase.from('content_reports').update({
    status,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

// ─── Peer blocking ──────────────────────────────────────────────────

export interface BlockedUser {
  blocked_id: string;
  created_at: string;
  profile?: { name: string; flat: string | null };
}

/**
 * Every user id this person can't see, in either direction — people they
 * blocked AND people who blocked them. Blocking is mutual: neither party sees
 * the other's content, which is what App Review expects.
 */
export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id,blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw error;
  const ids = new Set<string>();
  for (const r of (data ?? []) as { blocker_id: string; blocked_id: string }[]) {
    ids.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
  }
  return ids;
}

/** Only the people this user actively blocked — for the manage-blocks screen. */
export async function fetchMyBlocks(userId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id,created_at,profile:profiles!user_blocks_blocked_id_fkey(name,flat)')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BlockedUser[];
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

export function subscribeBlocks(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`user-blocks-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
