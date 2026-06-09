import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addRole as addRoleSvc, getProfile, signOut as signOutSvc, updateProfile } from '../lib/auth';
import { Community, fetchCommunityById } from '../lib/communities';
import { registerPush } from '../lib/push';
import { COMMUNITY_ID, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { DbProfile, Profile, Role } from '../lib/types';

interface AuthValue {
  ready: boolean; // initial session check done
  session: Session | null;
  userId: string | null;
  profile: DbProfile | null;
  communityId: string;
  community: Community | null;
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
  community: null,
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
  const [community, setCommunity] = useState<Community | null>(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    try {
      const p = await getProfile(uid);
      // A member blocked while signed in is bounced back to sign-in.
      if (p?.blocked) {
        await signOutSvc();
        setProfile(null);
        setSession(null);
        return;
      }
      setProfile(p);
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
  const communityId = profile?.community_id ?? COMMUNITY_ID;

  // Register this device for push once signed in (native only; no-op on web).
  useEffect(() => {
    if (userId) registerPush(userId);
  }, [userId]);

  // Keep the current community (name etc.) loaded for the persistent chrome.
  useEffect(() => {
    if (!session || !isSupabaseConfigured) { setCommunity(null); return; }
    fetchCommunityById(communityId).then(setCommunity).catch(() => {});
  }, [session, communityId]);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      session,
      userId,
      profile,
      roles,
      communityId,
      community,
      // Roles collapsed to member + admin: every signed-in member can cook/post.
      isChef: !!profile,
      isFoodie: !!profile,
      isAdmin: roles.includes('admin'),
      // Read the live session id from Supabase rather than the closed-over
      // `userId`. Right after sign-up the closure can still hold the stale
      // pre-auth value (null), which would wipe the freshly-inserted profile.
      refreshProfile: async () => {
        const { data } = await supabase.auth.getSession();
        await loadProfile(data.session?.user.id);
      },
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
        // Clear local state + route to the public landing immediately so it
        // works from any screen (not just tab routes that gate on session),
        // then revoke the session in the background.
        setSession(null);
        setProfile(null);
        setCommunity(null);
        router.replace('/landing' as any);
        try { await signOutSvc(); } catch { /* best-effort */ }
      },
    }),
    [ready, session, userId, profile, roles, communityId, community, loadProfile]
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
