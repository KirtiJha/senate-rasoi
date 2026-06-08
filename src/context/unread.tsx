import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { fetchUnreadThreadCount } from '../lib/dm';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// Single source of truth for the unread-DM count. Mounted once (in _layout) so
// every consumer (NavRail, Home tile) shares ONE realtime subscription instead
// of each opening its own.
const Ctx = createContext<number>(0);

export function useUnreadDms(): number {
  return useContext(Ctx);
}

export function UnreadDmsProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) { setCount(0); return; }
    let alive = true;
    const refresh = () =>
      fetchUnreadThreadCount(userId).then((n) => { if (alive) setCount(n); }).catch(() => {});

    refresh();
    // Any insert (new message) or update (read_at set) can change the count.
    const ch = supabase
      .channel('dm-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, refresh)
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, [userId]);

  return <Ctx.Provider value={count}>{children}</Ctx.Provider>;
}
