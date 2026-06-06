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

export async function setUserRoles(targetId: string, roles: Role[]): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_user_roles', {
    p_target: targetId,
    p_roles: roles,
  });
  if (error) throw error;
  return Boolean(data);
}
