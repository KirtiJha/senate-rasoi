import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

export const AVATARS_BUCKET = 'avatars';

/**
 * Put a square, 512px copy of the picked image in the person's own folder
 * and point their profile at it. The path is fixed per person, so a new
 * photo overwrites the old; the `?v=` keeps every image cache honest.
 */
export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  const m = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 512 } }], {
    compress: 0.8, format: ImageManipulator.SaveFormat.JPEG,
  });
  const buf = await (await fetch(m.uri)).arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const url = `${supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  await setAvatarUrl(userId, url);
  return url;
}

export async function removeAvatar(userId: string): Promise<void> {
  await supabase.storage.from(AVATARS_BUCKET).remove([`${userId}/avatar.jpg`]);
  await setAvatarUrl(userId, null);
}

async function setAvatarUrl(userId: string, url: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) throw error;
}

/** Everyone in the society who has a photo: one small request, cached. */
export async function fetchAvatarMap(communityId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .eq('community_id', communityId)
    .not('avatar_url', 'is', null);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; avatar_url: string }[]) out[r.id] = r.avatar_url;
  return out;
}
