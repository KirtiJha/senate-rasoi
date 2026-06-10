import { supabase } from './supabase';
import type { DbProfile } from './types';

export interface DirectoryEntry {
  id: string;
  community_id: string;
  name: string;
  flat: string | null;
  phone: string | null;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
  added_by: string | null;
  created_at: string;
}

/** A unified directory row — a registered member OR a manually-added resident. */
export interface Resident {
  key: string;
  name: string;
  flat: string | null;
  phone: string | null;
  whatsapp: string | null;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
  onboarded: boolean;       // has an Aangan account
  userId: string | null;    // member id (DM / public profile)
  entryId: string | null;   // directory_entries id (delete)
  removeKind: 'entry' | 'hide' | null; // how the current user may remove this row
}

const norm = (p: string | null | undefined) => (p ?? '').replace(/\D/g, '');

/** Members (profiles) + manual entries, merged & de-duped by phone. */
export async function fetchDirectory(
  communityId: string,
  currentUserId: string | null,
  isAdmin: boolean,
): Promise<Resident[]> {
  const [memberRes, entryRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('community_id', communityId).limit(2000),
    supabase.from('directory_entries').select('*').eq('community_id', communityId).limit(2000),
  ]);
  if (memberRes.error) throw memberRes.error;
  const members = (memberRes.data ?? []) as DbProfile[];
  const entries = (entryRes.error ? [] : (entryRes.data ?? [])) as DirectoryEntry[];

  const memberPhones = new Set(members.map((m) => norm(m.phone)).filter(Boolean));

  const residents: Resident[] = [];

  for (const m of members) {
    // `show_in_directory === false` now means "hide my phone number" — the
    // member still appears in the directory, just without a contactable number.
    const hidePhone = m.show_in_directory === false;
    residents.push({
      key: `m:${m.id}`,
      name: m.name || 'Resident',
      flat: m.flat,
      phone: hidePhone ? null : m.phone,
      whatsapp: hidePhone ? null : m.whatsapp,
      resident_type: m.resident_type,
      profession: m.profession,
      vehicle_no: m.vehicle_no,
      onboarded: true,
      userId: m.id,
      entryId: null,
      removeKind: isAdmin && m.id !== currentUserId ? 'hide' : null,
    });
  }

  for (const e of entries) {
    if (e.phone && memberPhones.has(norm(e.phone))) continue; // member already represents them
    residents.push({
      key: `e:${e.id}`,
      name: e.name,
      flat: e.flat,
      phone: e.phone,
      whatsapp: e.phone,
      resident_type: e.resident_type,
      profession: e.profession,
      vehicle_no: e.vehicle_no,
      onboarded: false,
      userId: null,
      entryId: e.id,
      removeKind: e.added_by === currentUserId || isAdmin ? 'entry' : null,
    });
  }

  residents.sort((a, b) => {
    const fa = a.flat ?? '~'; const fb = b.flat ?? '~';
    if (fa !== fb) return fa.localeCompare(fb, undefined, { numeric: true });
    return a.name.localeCompare(b.name);
  });
  return residents;
}

export interface NewDirectoryEntry {
  communityId: string;
  addedBy: string;
  name: string;
  flat: string | null;
  phone: string | null;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
}

/** Add a non-member resident. Throws 'duplicate' if the phone already exists. */
export async function addDirectoryEntry(input: NewDirectoryEntry): Promise<void> {
  const { error } = await supabase.from('directory_entries').insert({
    community_id: input.communityId,
    added_by: input.addedBy,
    name: input.name.trim(),
    flat: input.flat?.trim() || null,
    phone: input.phone?.replace(/\D/g, '') || null,
    resident_type: input.resident_type,
    profession: input.profession?.trim() || null,
    vehicle_no: input.vehicle_no?.trim() || null,
  });
  if (error) {
    if (error.code === '23505') throw new Error('duplicate');
    throw error;
  }
}

export async function deleteDirectoryEntry(id: string): Promise<void> {
  const { error } = await supabase.from('directory_entries').delete().eq('id', id);
  if (error) throw error;
}

/** Admin hides/shows a registered member in the directory. */
export async function adminSetDirectoryVisibility(targetId: string, visible: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_set_directory_visibility', { p_target: targetId, p_visible: visible });
  if (error) throw error;
  return Boolean(data);
}
