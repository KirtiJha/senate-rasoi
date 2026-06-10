import { isSupabaseConfigured, supabase } from './supabase';

/** One message in a property's Q&A thread (ask the owner for details). */
export interface PropertyMessageRow {
  id: string;
  property_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { name: string; flat: string | null };
}

const SELECT = '*, author:profiles!property_messages_author_id_fkey(name, flat)';

export async function fetchPropertyMessages(propertyId: string): Promise<PropertyMessageRow[]> {
  const { data, error } = await supabase
    .from('property_messages')
    .select(SELECT)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PropertyMessageRow[];
}

export async function sendPropertyMessage(propertyId: string, authorId: string, body: string): Promise<PropertyMessageRow> {
  const { data, error } = await supabase
    .from('property_messages')
    .insert({ property_id: propertyId, author_id: authorId, body: body.trim() })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as PropertyMessageRow;
}

export async function deletePropertyMessage(id: string): Promise<void> {
  const { error } = await supabase.from('property_messages').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeToPropertyMessages(propertyId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`property-messages-${propertyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'property_messages', filter: `property_id=eq.${propertyId}` },
      onChange,
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
