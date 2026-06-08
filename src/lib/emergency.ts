import { supabase } from './supabase';

export type EmergencyRole = 'security' | 'maintenance' | 'medical' | 'fire' | 'electricity' | 'water' | 'other';

export interface EmergencyContact {
  id: string;
  community_id: string;
  name: string;
  phone: string;
  role: EmergencyRole;
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
  orderPos?: number;
}): Promise<EmergencyContact> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .insert({
      community_id: input.communityId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
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
