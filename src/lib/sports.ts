import * as ImageManipulator from 'expo-image-manipulator';
import { COMMUNITY_ID, SPORT_LOGOS_BUCKET, supabase } from './supabase';

// ── Sport catalogue ──────────────────────────────────────────────────
// Adding a new sport = add one entry here. The screens read from this list.
export interface Sport {
  key: string;
  label: string;
  emoji: string;
  color: string;
}
export const SPORTS: Sport[] = [
  { key: 'badminton', label: 'Badminton', emoji: '🏸', color: '#16A34A' },
  { key: 'cricket', label: 'Cricket', emoji: '🏏', color: '#2563EB' },
];
export const getSport = (key: string): Sport | undefined => SPORTS.find((s) => s.key === key);

// ── Types ────────────────────────────────────────────────────────────
export interface SportGroup {
  id: string;
  community_id: string;
  sport: string;
  name: string;
  emoji: string | null;
  color: string | null;
  logo_url: string | null;
  description: string | null;
  practice_days: string | null;
  practice_time: string | null;
  practice_duration: string | null;
  practice_location: string | null;
  created_by: string | null;
  created_at: string;
}
export interface SportGroupWithMeta extends SportGroup {
  member_count: number;
  is_member: boolean;
}
export interface GroupMember {
  user_id: string;
  is_captain: boolean;
  joined_at: string;
  profile: { name: string | null; flat: string | null } | null;
}
export interface Tournament {
  id: string;
  group_id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
}

// ── Groups ───────────────────────────────────────────────────────────
export async function fetchGroups(communityId: string = COMMUNITY_ID, userId?: string | null): Promise<SportGroupWithMeta[]> {
  const [{ data: groups, error }, { data: members }] = await Promise.all([
    supabase.from('sport_groups').select('*').eq('community_id', communityId).order('sport').order('created_at'),
    supabase.from('sport_group_members').select('group_id, user_id'),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const m of (members ?? []) as { group_id: string; user_id: string }[]) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
    if (userId && m.user_id === userId) mine.add(m.group_id);
  }
  return ((groups ?? []) as SportGroup[]).map((g) => ({
    ...g,
    member_count: counts.get(g.id) ?? 0,
    is_member: mine.has(g.id),
  }));
}

export async function fetchGroup(id: string): Promise<SportGroup | null> {
  const { data, error } = await supabase.from('sport_groups').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as SportGroup) ?? null;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('sport_group_members')
    .select('user_id, is_captain, joined_at, profile:profiles!sport_group_members_user_id_fkey(name, flat)')
    .eq('group_id', groupId)
    .order('is_captain', { ascending: false })
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as GroupMember[];
}

export interface NewGroup {
  communityId: string;
  createdBy: string;
  sport: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
  description?: string | null;
  practiceDays?: string | null;
  practiceTime?: string | null;
  practiceDuration?: string | null;
  practiceLocation?: string | null;
}
export async function createGroup(input: NewGroup): Promise<SportGroup> {
  const { data, error } = await supabase
    .from('sport_groups')
    .insert({
      community_id: input.communityId,
      created_by: input.createdBy,
      sport: input.sport,
      name: input.name.trim(),
      emoji: input.emoji || null,
      color: input.color || null,
      description: input.description?.trim() || null,
      practice_days: input.practiceDays?.trim() || null,
      practice_time: input.practiceTime?.trim() || null,
      practice_duration: input.practiceDuration?.trim() || null,
      practice_location: input.practiceLocation?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  // creator joins as captain
  await supabase.from('sport_group_members').insert({ group_id: data.id, user_id: input.createdBy, is_captain: true });
  return data as SportGroup;
}

export async function updateGroup(id: string, patch: Partial<SportGroup>): Promise<void> {
  const { error } = await supabase.from('sport_groups').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('sport_groups').delete().eq('id', id);
  if (error) throw error;
}

/** Compress + upload a group logo to the sport-logos bucket. Returns the public URL. */
export async function uploadGroupLogo(localUri: string, groupId: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: false },
  );
  const res = await fetch(manipulated.uri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `${groupId}.jpg`;
  const { error } = await supabase.storage.from(SPORT_LOGOS_BUCKET).upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(SPORT_LOGOS_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`; // cache-bust on re-upload
}

export async function joinGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('sport_group_members').insert({ group_id: groupId, user_id: userId });
  if (error && error.code !== '23505') throw error; // ignore "already a member"
}
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('sport_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}
/** Admin/captain removing another member (same call shape as leave). */
export const removeMember = leaveGroup;
/** Admin/captain adding a member. */
export async function addMember(groupId: string, userId: string): Promise<void> {
  return joinGroup(groupId, userId);
}

// ── Tournaments ──────────────────────────────────────────────────────
export async function fetchTournaments(groupId: string): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('sport_tournaments')
    .select('*')
    .eq('group_id', groupId)
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Tournament[];
}
export async function addTournament(input: { groupId: string; title: string; eventDate?: string | null; location?: string | null; notes?: string | null }): Promise<void> {
  const { error } = await supabase.from('sport_tournaments').insert({
    group_id: input.groupId,
    title: input.title.trim(),
    event_date: input.eventDate || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw error;
}
export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from('sport_tournaments').delete().eq('id', id);
  if (error) throw error;
}
