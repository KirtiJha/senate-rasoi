import { NotificationType } from './notifications';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Which kinds of society-wide notification a resident wants.
 *
 * Stored as an opt-OUT: a row in `notification_mutes` means "don't send me
 * this". Absent means send, so nothing changes for anyone until they choose,
 * and no backfill was needed for existing residents.
 *
 * Only broadcast categories appear here. A direct message, an order on your
 * dish, a reply to your listing or an emergency is addressed to you
 * personally — muting a category should quiet the society, not hide someone
 * talking to you.
 */
export interface MutableCategory {
  type: NotificationType;
  label: string;
  blurb: string;
}

export const MUTABLE_CATEGORIES: MutableCategory[] = [
  { type: 'announcement', label: 'Announcements', blurb: 'Notices from your society admins' },
  { type: 'listing', label: 'Marketplace', blurb: 'New items and services listed' },
  { type: 'dish', label: 'Home food', blurb: 'New dishes and tiffins from neighbours' },
  { type: 'food_daily', label: 'Today’s menu', blurb: 'One reminder before each meal, only when there is something up' },
  { type: 'property', label: 'Flats', blurb: 'New flats to rent or buy' },
  { type: 'borrow', label: 'Borrow', blurb: 'Things neighbours are lending or need' },
  { type: 'lost_found', label: 'Lost & found', blurb: 'Items lost or found nearby' },
  { type: 'poll', label: 'Polls', blurb: 'New polls to vote in' },
  { type: 'event', label: 'Events', blurb: 'Society events and gatherings' },
  { type: 'sport', label: 'Sports', blurb: 'Sport groups and court bookings' },
  { type: 'document', label: 'Documents', blurb: 'New documents shared with the society' },
  { type: 'place', label: 'Places', blurb: 'New places added nearby' },
  { type: 'recommend', label: 'Recommendations', blurb: 'Questions and answers from neighbours' },
];

/** The categories this resident has muted. */
export async function fetchMutedTypes(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const { data, error } = await supabase
    .from('notification_mutes')
    .select('type')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { type: string }) => r.type));
}

/** Mute or unmute one category. */
export async function setMuted(userId: string, type: string, muted: boolean): Promise<void> {
  if (muted) {
    const { error } = await supabase
      .from('notification_mutes')
      .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('notification_mutes')
      .delete()
      .eq('user_id', userId)
      .eq('type', type);
    if (error) throw error;
  }
}
