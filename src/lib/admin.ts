import { supabase } from './supabase';
import type { DbProfile, Role } from './types';

// Admin-only helpers. Reads are allowed for any authenticated user (RLS), but
// set_user_roles is a SECURITY DEFINER RPC that enforces caller is_admin.

export async function listProfiles(): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}

/** Members of a single community (admins only manage their own society). */
export async function listCommunityMembers(communityId: string): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('community_id', communityId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbProfile[];
}

export async function setUserRoles(targetId: string, roles: Role[]): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_user_roles', {
    p_target: targetId,
    p_roles: roles,
  });
  if (error) throw error;
  return Boolean(data);
}

/** Block / unblock a member (admin-only; enforced server-side). */
export async function setMemberBlocked(targetId: string, blocked: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_set_blocked', { p_target: targetId, p_blocked: blocked });
  if (error) throw error;
  return Boolean(data);
}

/** Hard-delete a member (admin-only; removes auth user + profile). */
export async function deleteMember(targetId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_delete_member', { p_target: targetId });
  if (error) throw error;
  return Boolean(data);
}

/**
 * Correct a member's directory details.
 *
 * Joining a society is open — no approval — which only works if the people who
 * run it can put things right afterwards: a flat typed as "204" in a society
 * with towers, a name spelt wrong on the day. Until now the only admin actions
 * were role, block, PIN and delete.
 *
 * The phone number is deliberately not here. It is the account's identity, so
 * changing it would leave the member unable to sign in with the number their
 * own society shows for them.
 */
export async function adminUpdateMember(
  targetId: string,
  patch: {
    name?: string;
    flat?: string | null;
    block?: string | null;
    residentType?: 'owner' | 'tenant' | null;
    profession?: string | null;
    vehicleNo?: string | null;
  },
): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_update_member', {
    p_target: targetId,
    p_name: patch.name ?? null,
    p_flat: patch.flat ?? null,
    p_block: patch.block ?? null,
    p_resident_type: patch.residentType === undefined ? null : (patch.residentType ?? ''),
    p_profession: patch.profession ?? null,
    p_vehicle_no: patch.vehicleNo ?? null,
  });
  if (error) throw error;
  return Boolean(data);
}

/** How many people are actually on Aangan in this society (not roster rows). */
export async function fetchMemberCount(communityId: string): Promise<number> {
  const { count } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).eq('community_id', communityId);
  return count ?? 0;
}
