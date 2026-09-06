import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { AvatarLookupContext } from '../components/ui/Avatar';
import { fetchAvatarMap } from '../lib/avatar';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './auth';

/**
 * Faces for every Avatar in the app.
 *
 * Sixty-odd places draw an avatar from a name, and most of them know a user
 * id too. Rather than teach each query to join the photo, one small request
 * fetches "who in this society has a photo" and every Avatar with a user id
 * looks itself up. Your own profile answers first, so a photo you just set
 * shows before the map refreshes.
 */
export function AvatarProvider({ children }: { children: ReactNode }) {
  const { communityId, profile } = useAuth();
  const qc = useQueryClient();
  const map = useQuery({
    queryKey: ['avatars', communityId],
    queryFn: () => fetchAvatarMap(communityId),
    enabled: !!communityId && isSupabaseConfigured,
    staleTime: 10 * 60_000,
  });

  // A neighbour changing their photo is an update to profiles; refetch the map.
  useEffect(() => {
    if (!communityId || !isSupabaseConfigured) return;
    const ch = supabase
      .channel(`avatars-${communityId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `community_id=eq.${communityId}` }, (payload) => {
        const before = (payload.old as { avatar_url?: string | null })?.avatar_url;
        const after = (payload.new as { avatar_url?: string | null })?.avatar_url;
        if (before !== after) qc.invalidateQueries({ queryKey: ['avatars', communityId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [communityId, qc]);

  const data = map.data;
  const myId = profile?.id;
  const myUrl = profile?.avatar_url ?? null;
  const lookup = useCallback((userId: string) => {
    if (userId === myId) return myUrl ?? undefined;
    return data?.[userId];
  }, [data, myId, myUrl]);
  const value = useMemo(() => ({ lookup }), [lookup]);

  return <AvatarLookupContext.Provider value={value}>{children}</AvatarLookupContext.Provider>;
}
