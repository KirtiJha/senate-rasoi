import { supabase } from './supabase';

export interface Community {
  id: string;
  name: string;
  slug: string;
  address: string | null;
}

export async function fetchCommunities(): Promise<Community[]> {
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, slug, address')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Community[];
}

export async function fetchCommunityById(id: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, slug, address')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Community | null;
}

export async function submitJoinRequest(input: {
  societyName: string;
  societyAddress: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail?: string;
}): Promise<void> {
  const { error } = await supabase.from('society_join_requests').insert({
    society_name: input.societyName.trim(),
    society_address: input.societyAddress.trim(),
    requester_name: input.requesterName.trim(),
    requester_phone: input.requesterPhone.replace(/\D/g, ''),
    requester_email: input.requesterEmail?.trim() || null,
  });
  if (error) throw error;
}
