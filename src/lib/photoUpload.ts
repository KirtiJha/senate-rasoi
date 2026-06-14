import * as ImageManipulator from 'expo-image-manipulator';
import { LISTING_PHOTOS_BUCKET, supabase } from './supabase';

/**
 * Compress + upload an image to the public `listing-photos` bucket at `path`
 * (e.g. `tiffin/<id>/0.jpg`) and return its public URL. A `?v=` cache-buster is
 * appended so re-uploads to the same path (edits) refresh in the image cache.
 */
export async function uploadContentPhoto(localUri: string, path: string, width = 1200): Promise<string> {
  const m = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width } }], {
    compress: 0.7, format: ImageManipulator.SaveFormat.JPEG,
  });
  const res = await fetch(m.uri);
  const buf = await res.arrayBuffer();
  const { error } = await supabase.storage.from(LISTING_PHOTOS_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const url = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
  return `${url}?v=${Date.now()}`;
}

/**
 * Resolve a final photo URL for create/edit flows. `photoUri` may be an existing
 * public URL (kept), a new local URI (uploaded to `path`), or null (removed →
 * returns null).
 */
export async function resolvePhoto(photoUri: string | null, path: string): Promise<string | null> {
  if (photoUri == null) return null;
  if (/^https?:\/\//.test(photoUri)) return photoUri;
  return uploadContentPhoto(photoUri, path);
}
