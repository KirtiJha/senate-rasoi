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
  shifted: boolean;
  onboarded: boolean;       // has an Aangan account — the ONLY registration truth
  phoneHidden: boolean;     // member chose (or an admin chose) to hide their number
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
    // 0107: the block is its own optional column and the flat is the bare
    // number. splitFlat remains only for text somebody typed by hand.
    residents.push({
      key: `m:${m.id}`,
      name: m.name || 'Resident',
      block: m.block ?? splitFlat(m.flat).block,
      flat: splitFlat(m.flat).unit ?? m.flat,
      phone: hidePhone ? null : m.phone,
      whatsapp: hidePhone ? null : m.whatsapp,
      resident_type: m.resident_type,
      profession: m.profession,
      vehicle_no: m.vehicle_no,
      native: null,
      alt_phone: m.alt_phone ?? null,
      email: null,
      shifted: m.moved_in ?? false, // occupancy: has the member moved in
      onboarded: true,
      phoneHidden: hidePhone,
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
      shifted: e.shifted ?? false,
      // Rows that reach here are, by construction, roster rows whose phone
      // matched no member — so they are not on Aangan. `registration_status`
      // is a hand-typed column nobody maintained: 67 of 133 rows claim 'done'
      // while having no account, which rendered as "✓ Registered" and "Not on
      // Aangan" in the same row. Membership is derived now; the column is left
      // alone but no longer shown or filtered on.
      onboarded: false,
      phoneHidden: false,
      userId: null,
      entryId: e.id,
      removeKind: e.added_by === currentUserId || isAdmin ? 'entry' : null,
    });
  }

  // Block, then number. Sorting by number alone was right for one society
  // whose numbers happen to be unique and wrong for any society with an A-101
  // and a B-101, which would interleave two towers into one run.
  residents.sort((a, b) => {
    const ba = a.block ?? ''; const bb = b.block ?? '';
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
    // Stored as typed (normalised for case/spacing), because a society may
    // legitimately call a flat "A-101" or "101A". 0107 forced digits here.
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

/**
 * Correct a manually-added neighbour.
 *
 * 0029's own policy comment says "the adder or a society admin can edit /
 * remove an entry" — the update half was written and never called, so fixing a
 * typo'd phone number meant deleting the row and retyping the profession,
 * vehicle, native place and alternate number from scratch.
 */
export async function updateDirectoryEntry(
  id: string,
  patch: Partial<{
    name: string; block: string | null; flat: string | null; phone: string | null;
    resident_type: string | null; profession: string | null; vehicle_no: string | null;
    native: string | null; alt_phone: string | null; email: string | null;
  }>,
): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (typeof v !== 'string') { clean[k] = v; continue; }
    // Same normalisation the insert applies, so an edited row cannot end up in
    // a different shape than a created one.
    if (k === 'phone' || k === 'alt_phone') clean[k] = norm(v) || null;
    else if (k === 'block') clean[k] = v.trim().toUpperCase() || null;
    else if (k === 'flat') clean[k] = v.trim() || null;
    else clean[k] = v.trim() || null;
  }
  if (typeof patch.name === 'string') clean.name = patch.name.trim();

  const { error } = await supabase.from('directory_entries').update(clean).eq('id', id);
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
 * A flat's address, normalised — the client mirror of 0121's flat_addr.
 *
 * NOT digits alone. That was 0107, written when the only society in the app
 * happened to have unique numbers across its towers; A-101 and B-101 are two
 * different homes in most societies and collapsing them to "101" is wrong
 * everywhere else. Block and number together, with separators, case and
 * leading zeros normalised away so 'D-019', 'd 19' and (block D, flat 19) all
 * come out as 'D19'.
 */
export const flatNorm = (s: string | null | undefined): string | null =>
  ((s ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    .replace(/(^|[A-Z])0+([0-9])/g, '$1$2') || null);

export const flatAddr = (
  block: string | null | undefined,
  flat: string | null | undefined,
): string | null => {
  const f = flatNorm(flat);
  if (!f) return null;
  const b = flatNorm(block);
  if (!b || f.startsWith(b)) return f;
  return b + f;
};

/** Just the number. Used only where a society states no block at all. */
export const flatKey = (flat: string | null | undefined): string | null =>
  ((flat ?? '').replace(/[^0-9]/g, '').replace(/^0+/, '') || null);

/**
 * Find a roster entry that likely belongs to a just-registered member: same
 * flat, a similar name, and a DIFFERENT phone than the one they signed up
 * with. Used to offer a merge at sign-up.
 *
 * Matched on the whole ADDRESS. It briefly matched on the number alone, which
 * suited one society whose numbers happen to be unique across its towers and
 * would pair a new A-101 resident with B-101's roster row anywhere else.
 * flatAddr still converges the spellings that matter — a roster row saying
 * "E-209" and a sign-up saying block E, flat 209 are the same home — so the
 * original problem it solved stays solved.
 */
export async function findRosterMatch(
  communityId: string,
  name: string,
  block: string | null,
  flat: string | null,
  signupPhone: string,
): Promise<DirectoryEntry | null> {
  const addr = flatAddr(block, flat);
  if (!addr) return null;
  const sp = norm(signupPhone);
  const { data } = await supabase
    .from('directory_entries')
    .select('*')
    .eq('community_id', communityId);
  const entries = ((data ?? []) as DirectoryEntry[])
    .filter((e) => flatAddr(e.block, e.flat) === addr)
    .filter((e) => !(e.phone && norm(e.phone) === sp));
  if (!entries.length) return null;
  const first = name.trim().toLowerCase().split(/\s+/)[0];
  const byName = entries.filter((e) => e.name.toLowerCase().includes(first));
  const pool = byName.length ? byName : entries;
  const blockUp = block?.trim().toUpperCase() || null;
  return pool.find((e) => (e.block ?? null) === blockUp) ?? pool[0];
}

/** New member claims a matching roster entry: keep its number (alternate) or just replace it. */
export async function reconcileDirectoryEntry(entryId: string, keepNumber: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('reconcile_my_directory_entry', { p_entry_id: entryId, p_keep_number: keepNumber });
  if (error) throw error;
  return Boolean(data);
}

export interface PhoneDirectoryMatch {
  entryId: string | null;
  communityId: string;
  communityName: string;
  name: string;
  block: string | null;
  flat: string | null;
  residentType: 'owner' | 'tenant' | null;
  profession: string | null;
  vehicleNo: string | null;
  alreadyOnboarded: boolean; // true → a member account already exists for this number
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
    entryId: row.entry_id ?? null,
    communityId: row.community_id,
    communityName: row.community_name ?? 'Your society',
    name: row.res_name,
    block: row.block ?? null,
    flat: row.flat ?? null,
    residentType: (row.resident_type as 'owner' | 'tenant' | null) ?? null,
    profession: row.profession ?? null,
    vehicleNo: row.vehicle_no ?? null,
    alreadyOnboarded: Boolean(row.already_onboarded),
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
