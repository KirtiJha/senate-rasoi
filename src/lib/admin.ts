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
