import { COMMUNITY_ID, supabase } from './supabase';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const HELPER_SKILLS = [
  'Drive to hospital',
  'First aid / CPR',
  'Doctor / nurse',
  'Elder care',
  'Spare wheelchair',
  'Night emergency',
];

export interface RegistryPerson {
  id: string;
  name: string;
  flat: string | null;
  whatsapp: string | null;
  phone: string | null;
  blood_group: string | null;
  donor_available: boolean;
  helper_skills: string[];
}

/** All opted-in donors + emergency helpers in the community (one fetch, split client-side). */
export async function fetchRegistry(communityId: string = COMMUNITY_ID): Promise<RegistryPerson[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,flat,whatsapp,phone,blood_group,donor_available,helper_skills')
    .eq('community_id', communityId)
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as RegistryPerson[]).filter((p) => p.donor_available || (p.helper_skills?.length ?? 0) > 0);
}

export async function updateHelperProfile(
  userId: string,
  patch: { blood_group: string | null; donor_available: boolean; helper_skills: string[] },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
