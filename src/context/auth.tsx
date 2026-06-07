import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addRole as addRoleSvc, getProfile, signOut as signOutSvc, updateProfile } from '../lib/auth';
import { registerPush } from '../lib/push';
import { COMMUNITY_ID, supabase } from '../lib/supabase';
import type { DbProfile, Profile, Role } from '../lib/types';

interface AuthValue {
  ready: boolean; // initial session check done
  session: Session | null;
  userId: string | null;
  profile: DbProfile | null;
  communityId: string;
  roles: Role[];
  isChef: boolean;
  isFoodie: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  saveProfile: (patch: Partial<DbProfile>) => Promise<void>;
  addRole: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  ready: false,
  session: null,
  userId: null,
  profile: null,
  communityId: COMMUNITY_ID,
  roles: [],
  isChef: false,
  isFoodie: false,
  isAdmin: false,
  refreshProfile: async () => {},
  saveProfile: async () => {},
  addRole: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await getProfile(uid));
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadProfile(s?.user.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const userId = session?.user.id ?? null;
  const roles = profile?.roles ?? [];

  // Register this device for push once signed in (native only; no-op on web).
  useEffect(() => {
    if (userId) registerPush(userId);
  }, [userId]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      session,
      userId,
      profile,
      roles,
      communityId: profile?.community_id ?? COMMUNITY_ID,
      isChef: roles.includes('chef'),
      isFoodie: roles.includes('foodie'),
      isAdmin: roles.includes('admin'),
      refreshProfile: () => loadProfile(userId ?? undefined),
      saveProfile: async (patch) => {
        if (!userId) return;
        await updateProfile(userId, patch);
        await loadProfile(userId);
      },
      addRole: async (role) => {
        if (!profile) return;
        await addRoleSvc(profile, role);
        await loadProfile(profile.id);
      },
      signOut: async () => {
        await signOutSvc();
        setProfile(null);
      },
    }),
    [ready, session, userId, profile, roles, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Legacy compatibility shim ──────────────────────────────────────────
// Existing post/order/discover code uses useProfile() returning the old
// {chefName, flat, whatsapp, upi} shape. Back it with the auth profile.
export function useProfile(): {
  profile: Profile;
  ready: boolean;
  update: (next: Profile) => Promise<void>;
} {
  const { profile, ready, saveProfile } = useAuth();
  return {
    ready,
    profile: {
      chefName: profile?.name ?? '',
      flat: profile?.flat ?? '',
      whatsapp: profile?.whatsapp ?? '',
      upi: profile?.upi ?? '',
    },
    update: async (next) => {
      await saveProfile({
        name: next.chefName,
        flat: next.flat,
        whatsapp: next.whatsapp,
        upi: next.upi,
      });
    },
  };
}
