import { supabase } from './supabase';

export type EmergencyRole = 'security' | 'maintenance' | 'medical' | 'fire' | 'electricity' | 'water' | 'other';

export interface EmergencyContact {
  id: string;
  community_id: string;
  name: string;
  phone: string;
  role: EmergencyRole;
  category: string | null; // free-text label, e.g. "Plumber", "Water tanker"
  order_pos: number;
  created_at: string;
}

export const EMERGENCY_ROLE_LABELS: Record<EmergencyRole, string> = {
  security: 'Security',
  maintenance: 'Maintenance',
  medical: 'Medical',
  fire: 'Fire',
  electricity: 'Electricity',
  water: 'Water / Plumbing',
  other: 'Other',
};

export const EMERGENCY_ROLE_ICONS: Record<EmergencyRole, string> = {
  security: 'shield-outline',
  maintenance: 'construct-outline',
  medical: 'medkit-outline',
  fire: 'flame-outline',
  electricity: 'flash-outline',
  water: 'water-outline',
  other: 'call-outline',
};

export const EMERGENCY_ROLE_COLORS: Record<EmergencyRole, string> = {
  security: '#3B82F6',
  maintenance: '#F59E0B',
  medical: '#EF4444',
  fire: '#F97316',
  electricity: '#EAB308',
  water: '#06B6D4',
  other: '#64748B',
};

export const ALL_EMERGENCY_ROLES: EmergencyRole[] = [
  'security', 'maintenance', 'medical', 'fire', 'electricity', 'water', 'other',
];

export async function fetchEmergencyContacts(communityId: string): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('community_id', communityId)
    .order('order_pos', { ascending: true });
  if (error) throw error;
  return (data ?? []) as EmergencyContact[];
}

export async function addEmergencyContact(input: {
  communityId: string;
  name: string;
  phone: string;
  role: EmergencyRole;
  category?: string | null;
  orderPos?: number;
}): Promise<EmergencyContact> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .insert({
      community_id: input.communityId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      category: input.category?.trim() || null,
      order_pos: input.orderPos ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmergencyContact;
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Correct a contact in place.
 *
 * The screen offered add and delete only, so a mistyped guard or plumber
 * number could be fixed only by deleting the row and retyping every field —
 * which also lost its position in the list. This is the list residents open
 * during an actual emergency, so a typo that survives is the worst kind.
 *
 * The RLS policy has always allowed it (0071's `for all` admin policy);
 * nothing ever called it.
 */
export async function updateEmergencyContact(
  id: string,
  patch: Partial<{ name: string; phone: string; role: EmergencyRole; category: string | null; order_pos: number }>,
): Promise<void> {
  const clean: Record<string, unknown> = { ...patch };
  if (typeof clean.name === 'string') clean.name = (clean.name as string).trim();
  if (typeof clean.phone === 'string') clean.phone = (clean.phone as string).trim();
  if (typeof clean.category === 'string') clean.category = (clean.category as string).trim() || null;

  const { error } = await supabase.from('emergency_contacts').update(clean).eq('id', id);
  if (error) throw error;
}
