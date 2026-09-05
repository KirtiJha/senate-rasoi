import { COMMUNITY_ID, isSupabaseConfigured, supabase } from './supabase';

/**
 * Asking for blood, and answering.
 *
 * The registry in donors.ts is the address book: who has opted in, and what
 * they can give. This is the part that was missing — the moment somebody
 * actually needs it, and the society has to hear about it now.
 */

export type BloodUrgency = 'now' | 'today' | 'days';
export type BloodStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired';

export const URGENCY_LABELS: Record<BloodUrgency, string> = {
  now: 'Right now',
  today: 'Today',
  days: 'In the next few days',
};

export interface BloodRequest {
  id: string;
  community_id: string;
  requester_id: string;
  blood_group: string;
  units: number | null;
  hospital: string | null;
  note: string | null;
  urgency: BloodUrgency;
  status: BloodStatus;
  created_at: string;
  closed_at: string | null;
  requester?: { name: string | null; flat: string | null; whatsapp: string | null; phone: string | null } | null;
}

export interface BloodOffer {
  id: string;
  request_id: string;
  donor_id: string;
  note: string | null;
  created_at: string;
  donor?: { name: string | null; flat: string | null; whatsapp: string | null; phone: string | null } | null;
}

const REQ = '*, requester:profiles!blood_requests_requester_id_fkey(name,flat,whatsapp,phone)';
const OFF = '*, donor:profiles!blood_offers_donor_id_fkey(name,flat,whatsapp,phone)';

/**
 * Who can give to whom — the same table the database uses to decide whose
 * phone rings. Kept in both places on purpose: the server decides who is
 * notified, this decides what the screen tells you before you ask.
 */
const CAN_GIVE_TO: Record<string, string[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

export const canDonateTo = (donor: string | null | undefined, patient: string): boolean =>
  !!donor && (CAN_GIVE_TO[donor.trim().toUpperCase()] ?? []).includes(patient);

/** Every group whose donors could answer a request for this one. */
export const donorGroupsFor = (patient: string): string[] =>
  Object.keys(CAN_GIVE_TO).filter((g) => CAN_GIVE_TO[g].includes(patient));

export async function fetchOpenRequests(communityId: string = COMMUNITY_ID): Promise<BloodRequest[]> {
  const { data, error } = await supabase
    .from('blood_requests').select(REQ)
    .eq('community_id', communityId).eq('status', 'open')
    .order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as BloodRequest[];
}

export async function createRequest(input: {
  communityId: string; requesterId: string; bloodGroup: string;
  units: number | null; hospital: string | null; note: string | null; urgency: BloodUrgency;
}): Promise<BloodRequest> {
  const { data, error } = await supabase.from('blood_requests').insert({
    community_id: input.communityId,
    requester_id: input.requesterId,
    blood_group: input.bloodGroup,
    units: input.units,
    hospital: input.hospital?.trim() || null,
    note: input.note?.trim() || null,
    urgency: input.urgency,
  }).select(REQ).single();
  if (error) throw error;
  return data as BloodRequest;
}

export async function closeRequest(id: string, status: 'fulfilled' | 'cancelled'): Promise<void> {
  const { error } = await supabase
    .from('blood_requests')
    .update({ status, closed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchOffers(requestIds: string[]): Promise<Map<string, BloodOffer[]>> {
  const out = new Map<string, BloodOffer[]>();
  if (!requestIds.length) return out;
  const { data } = await supabase.from('blood_offers').select(OFF).in('request_id', requestIds);
  for (const o of (data ?? []) as BloodOffer[]) {
    const list = out.get(o.request_id) ?? [];
    list.push(o);
    out.set(o.request_id, list);
  }
  return out;
}

/** "I can give." Reaches the person who asked straight away (0127). */
export async function offerToDonate(requestId: string, donorId: string, note: string | null): Promise<void> {
  const { error } = await supabase.from('blood_offers')
    .insert({ request_id: requestId, donor_id: donorId, note: note?.trim() || null });
  // 23505 = already offered. Saying it twice is not an error worth showing.
  if (error && error.code !== '23505') throw error;
}

/** Taking back an offer, because a promise you cannot keep is worse than none. */
export async function withdrawOffer(requestId: string, donorId: string): Promise<void> {
  const { error } = await supabase.from('blood_offers')
    .delete().eq('request_id', requestId).eq('donor_id', donorId);
  if (error) throw error;
}

export function subscribeBlood(communityId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase.channel(`blood-${communityId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_requests', filter: `community_id=eq.${communityId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_offers' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

/**
 * Whole blood cannot be given again for about three months. A donor who gave
 * last week should not be listed exactly like one who is ready today.
 */
export const RECOVERY_DAYS = 90;

export function donorRest(lastDonated: string | null | undefined): { resting: boolean; label: string } | null {
  if (!lastDonated) return null;
  const days = Math.floor((Date.now() - new Date(lastDonated + 'T00:00:00').getTime()) / 86400000);
  if (Number.isNaN(days) || days < 0) return null;
  if (days >= RECOVERY_DAYS) return { resting: false, label: 'Ready to donate' };
  const left = RECOVERY_DAYS - days;
  return { resting: true, label: `Donated recently · ready in ~${left} ${left === 1 ? 'day' : 'days'}` };
}
