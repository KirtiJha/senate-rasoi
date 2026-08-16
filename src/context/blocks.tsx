import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { fetchBlockedIds, subscribeBlocks } from '../lib/moderation';
import { isSupabaseConfigured } from '../lib/supabase';

// Single source of truth for "who can't I see". Mounted once in _layout so every
// list screen shares ONE subscription. Blocking is MUTUAL — this set contains
// both people you blocked and people who blocked you.

interface BlocksCtx {
  /** User ids to hide from every feed. */
  blockedIds: Set<string>;
  /** True when this user should be hidden from the current viewer. */
  isBlocked: (userId: string | null | undefined) => boolean;
  /** Drop any rows authored by a blocked user. */
  filterBlocked: <T>(rows: T[], ownerOf: (row: T) => string | null | undefined) => T[];
  refresh: () => void;
}

const Ctx = createContext<BlocksCtx>({
  blockedIds: new Set(),
  isBlocked: () => false,
  filterBlocked: (rows) => rows,
  refresh: () => {},
});

export function useBlocks(): BlocksCtx {
  return useContext(Ctx);
}

export function BlocksProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!userId || !isSupabaseConfigured) { setBlockedIds(new Set()); return; }
    fetchBlockedIds(userId).then(setBlockedIds).catch(() => {});
  }, [userId]);

  useEffect(() => {
    refresh();
    if (!userId || !isSupabaseConfigured) return;
    return subscribeBlocks(userId, refresh);
  }, [userId, refresh]);

  const value = useMemo<BlocksCtx>(() => ({
    blockedIds,
    isBlocked: (id) => (id ? blockedIds.has(id) : false),
    filterBlocked: (rows, ownerOf) => {
      if (!blockedIds.size) return rows;
      return rows.filter((r) => {
        const owner = ownerOf(r);
        return !owner || !blockedIds.has(owner);
      });
    },
    refresh,
  }), [blockedIds, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
