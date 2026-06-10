import * as Crypto from 'expo-crypto';
import { DOCUMENTS_BUCKET, supabase } from './supabase';

export interface DocRow {
  id: string;
  community_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  is_public: boolean;
  created_at: string;
  owner?: { name: string | null; flat: string | null } | null;
}

export interface ShareUser {
  user_id: string;
  profile: { name: string | null; flat: string | null } | null;
}

/** All documents the current user may access (RLS = public-in-community / owner / shared). */
export async function fetchDocuments(communityId: string): Promise<DocRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, owner:profiles!documents_owner_id_fkey(name, flat)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as DocRow[];
}

export interface UploadDocInput {
  communityId: string;
  ownerId: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  file: { uri: string; mimeType?: string | null; size?: number | null };
}

export async function uploadDocument(input: UploadDocInput): Promise<void> {
  const id = Crypto.randomUUID();
  const path = `${input.communityId}/${id}`;
  const res = await fetch(input.file.uri);
  const arrayBuffer = await res.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, arrayBuffer, { contentType: input.file.mimeType ?? 'application/octet-stream', upsert: false });
  if (upErr) throw upErr;

  const { error } = await supabase.from('documents').insert({
    id,
    community_id: input.communityId,
    owner_id: input.ownerId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    storage_path: path,
    file_size: input.file.size ?? null,
    mime_type: input.file.mimeType ?? null,
    is_public: input.isPublic,
  });
  if (error) {
    // roll back the orphaned object
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => {});
    throw error;
  }
}

export async function deleteDocument(doc: DocRow): Promise<void> {
  // Remove the object first — the storage delete policy needs the row to still exist.
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]).catch(() => {});
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  if (error) throw error;
}

export async function setDocPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from('documents').update({ is_public: isPublic }).eq('id', id);
  if (error) throw error;
}

/** A short-lived signed URL. Pass `downloadAs` to force a download with that filename. */
export async function getDocumentUrl(storagePath: string, downloadAs?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600, downloadAs ? { download: downloadAs } : undefined);
  if (error || !data) throw error ?? new Error('Could not get file URL');
  return data.signedUrl;
}

export async function fetchShares(docId: string): Promise<ShareUser[]> {
  const { data, error } = await supabase
    .from('document_shares')
    .select('user_id, profile:profiles!document_shares_user_id_fkey(name, flat)')
    .eq('document_id', docId);
  if (error) throw error;
  return (data ?? []) as unknown as ShareUser[];
}

export async function shareDocument(docId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('document_shares').insert({ document_id: docId, user_id: userId });
  if (error && error.code !== '23505') throw error; // ignore "already shared"
}

export async function unshareDocument(docId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('document_shares').delete().eq('document_id', docId).eq('user_id', userId);
  if (error) throw error;
}

// ── Display helpers ──────────────────────────────────────────────────
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** An Ionicon name + colour for a file, by mime type. */
export function fileGlyph(mime: string | null | undefined): { icon: string; color: string } {
  const m = mime ?? '';
  if (m.startsWith('image/')) return { icon: 'image-outline', color: '#0891B2' };
  if (m === 'application/pdf') return { icon: 'document-text-outline', color: '#DC2626' };
  if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return { icon: 'grid-outline', color: '#16A34A' };
  if (m.includes('word') || m.includes('document')) return { icon: 'document-outline', color: '#2563EB' };
  if (m.includes('zip') || m.includes('compressed') || m.includes('rar')) return { icon: 'file-tray-full-outline', color: '#CA8A04' };
  if (m.startsWith('video/')) return { icon: 'videocam-outline', color: '#9333EA' };
  if (m.startsWith('audio/')) return { icon: 'musical-notes-outline', color: '#DB2777' };
  return { icon: 'document-attach-outline', color: '#64748B' };
}
