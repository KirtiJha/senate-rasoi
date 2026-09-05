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
  /** Self-reported; a donor who gave last week is resting, not available. */
  donor_last_donated: string | null;
}

/**
 * The opted-in donors and emergency helpers of one society.
 *
 * The filter used to run on the device: every profile in the community was
 * fetched — names, flats, WhatsApp and phone numbers, all 2000 of them — and
 * the ones who had not opted in were dropped afterwards. Their numbers had
 * already been sent. It is a registry of people who volunteered; nobody
 * else's contact details belong in the response at all.
 *
 * The 2000 cap went with it: a large society would have been silently cut off
 * mid-list, which in this tile means a donor who exists and cannot be found.
 */
export async function fetchRegistry(communityId: string = COMMUNITY_ID): Promise<RegistryPerson[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,flat,whatsapp,phone,blood_group,donor_available,helper_skills,donor_last_donated')
    .eq('community_id', communityId)
    .or('donor_available.eq.true,helper_skills.neq.{}')
    .order('name');
  if (error) throw error;
  return (data ?? []) as RegistryPerson[];
}

export async function updateHelperProfile(
  userId: string,
  patch: {
    blood_group: string | null;
    donor_available: boolean;
    helper_skills: string[];
    donor_last_donated?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
