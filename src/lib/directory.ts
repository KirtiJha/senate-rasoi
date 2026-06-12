import { supabase } from './supabase';
import type { DbProfile } from './types';

export interface DirectoryEntry {
  id: string;
  community_id: string;
  name: string;
  block: string | null;
  flat: string | null;
  phone: string | null;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
  native: string | null;
  alt_phone: string | null;
  email: string | null;
  registration_status: 'pending' | 'done';
  shifted: boolean;
  added_by: string | null;
  created_at: string;
}

/** Split a free-typed flat like "E-101" / "E 101" into block + unit number. */
export function splitFlat(flat: string | null): { block: string | null; unit: string | null } {
  if (!flat) return { block: null, unit: null };
  const m = /^([A-Za-z]+)?[-\s]*(.*)$/.exec(flat.trim());
  if (!m) return { block: null, unit: flat.trim() };
  return { block: m[1] ? m[1].toUpperCase() : null, unit: (m[2] || '').trim() || null };
}

/** A unified directory row — a registered member OR a manually-added resident. */
export interface Resident {
  key: string;
  name: string;
  block: string | null;
  flat: string | null;
  phone: string | null;
  whatsapp: string | null;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
  native: string | null;
  alt_phone: string | null;
  email: string | null;
  registration_status: 'pending' | 'done';
  shifted: boolean;
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
    const mf = splitFlat(m.flat);
    residents.push({
      key: `m:${m.id}`,
      name: m.name || 'Resident',
      block: mf.block,
      flat: mf.block ? mf.unit : m.flat, // strip the block prefix if the member typed one
      phone: hidePhone ? null : m.phone,
      whatsapp: hidePhone ? null : m.whatsapp,
      resident_type: m.resident_type,
      profession: m.profession,
      vehicle_no: m.vehicle_no,
      native: null,
      alt_phone: m.alt_phone ?? null,
      email: null,
      registration_status: 'done', // a registered member
      shifted: m.moved_in ?? false, // occupancy: has the member moved in
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
      block: e.block,
      flat: e.flat,
      phone: e.phone,
      whatsapp: e.phone,
      resident_type: e.resident_type,
      profession: e.profession,
      vehicle_no: e.vehicle_no,
      native: e.native,
      alt_phone: e.alt_phone,
      email: e.email,
      registration_status: e.registration_status ?? 'pending',
      shifted: e.shifted ?? false,
      onboarded: false,
      userId: null,
      entryId: e.id,
      removeKind: e.added_by === currentUserId || isAdmin ? 'entry' : null,
    });
  }

  residents.sort((a, b) => {
    const ba = a.block ?? '~'; const bb = b.block ?? '~';
    if (ba !== bb) return ba.localeCompare(bb);
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
  block?: string | null;
  flat: string | null;
  phone: string | null;
  resident_type: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicle_no: string | null;
  native?: string | null;
  alt_phone?: string | null;
  email?: string | null;
  registration_status?: 'pending' | 'done';
  shifted?: boolean;
}

/** Add a non-member resident. Throws 'duplicate' if the phone already exists. */
export async function addDirectoryEntry(input: NewDirectoryEntry): Promise<void> {
  const { error } = await supabase.from('directory_entries').insert({
    community_id: input.communityId,
    added_by: input.addedBy,
    name: input.name.trim(),
    block: input.block?.trim().toUpperCase() || null,
    flat: input.flat?.trim() || null,
    phone: input.phone?.replace(/\D/g, '') || null,
    resident_type: input.resident_type,
    profession: input.profession?.trim() || null,
    vehicle_no: input.vehicle_no?.trim() || null,
    native: input.native?.trim() || null,
    alt_phone: input.alt_phone?.replace(/\D/g, '') || null,
    email: input.email?.trim() || null,
    registration_status: input.registration_status ?? 'pending',
    shifted: input.shifted ?? false,
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

/**
 * Find a roster entry that likely belongs to a just-registered member: same
 * block + flat, a similar name, and a DIFFERENT phone than the one they signed
 * up with. Used to offer a merge at sign-up.
 */
export async function findRosterMatch(
  communityId: string,
  name: string,
  block: string | null,
  flat: string | null,
  signupPhone: string,
): Promise<DirectoryEntry | null> {
  if (!flat) return null;
  const sp = norm(signupPhone);
  const { data } = await supabase
    .from('directory_entries')
    .select('*')
    .eq('community_id', communityId)
    .eq('flat', flat);
  const entries = ((data ?? []) as DirectoryEntry[]).filter((e) => {
    if ((e.block ?? null) !== (block ?? null)) return false;
    if (e.phone && norm(e.phone) === sp) return false; // already the same number — nothing to merge
    return true;
  });
  if (!entries.length) return null;
  // Prefer a name match; otherwise the first same-flat entry.
  const first = name.trim().toLowerCase().split(/\s+/)[0];
  return entries.find((e) => e.name.toLowerCase().includes(first)) ?? entries[0];
}

/** New member claims a matching roster entry: keep its number (alternate) or just replace it. */
export async function reconcileDirectoryEntry(entryId: string, keepNumber: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('reconcile_my_directory_entry', { p_entry_id: entryId, p_keep_number: keepNumber });
  if (error) throw error;
  return Boolean(data);
}

export interface PhoneDirectoryMatch {
  entryId: string;
  communityId: string;
  communityName: string;
  name: string;
  block: string | null;
  flat: string | null;
  residentType: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicleNo: string | null;
}

/**
 * Look up a pre-loaded resident by their exact phone number.
 * Safe to call before sign-in (uses a SECURITY DEFINER RPC accessible to anon).
 */
export async function findDirectoryByPhone(phone: string): Promise<PhoneDirectoryMatch | null> {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const { data, error } = await supabase.rpc('find_resident_by_phone', { p_phone: digits });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    entryId: row.entry_id,
    communityId: row.community_id,
    communityName: row.community_name ?? 'Your society',
    name: row.res_name,
    block: row.block ?? null,
    flat: row.flat ?? null,
    residentType: (row.resident_type as 'owner' | 'tenant' | null) ?? null,
    profession: row.profession ?? null,
    vehicleNo: row.vehicle_no ?? null,
  };
}

/** Admin sets a member's moved-in (occupancy) status. */
export async function adminSetMovedIn(targetId: string, value: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_set_moved_in', { p_target: targetId, p_value: value });
  if (error) throw error;
  return Boolean(data);
}

/** Admin hides/shows a registered member in the directory. */
export async function adminSetDirectoryVisibility(targetId: string, visible: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_set_directory_visibility', { p_target: targetId, p_visible: visible });
  if (error) throw error;
  return Boolean(data);
}
