import { COMMUNITY_ID, phoneToEmail, supabase } from './supabase';
import type { DbProfile, Role } from './types';

// Phone + 6-digit code auth, implemented on top of Supabase Auth via an
// email alias (<digits>@senate.app). The code is the password — Supabase
// bcrypt-hashes it and manages sessions, so RLS works off auth.uid().

export interface SignUpInput {
  phone: string;
  code: string; // 6 digits
  name: string;
  flat: string;
  whatsapp: string;
  upi: string;
  roles: Role[];
  communityId?: string; // selected at sign-up; falls back to the seeded default
  residentType?: 'owner' | 'tenant' | null;
  profession?: string;
  vehicleNo?: string;
}

export async function signUp(input: SignUpInput): Promise<DbProfile> {
  const email = phoneToEmail(input.phone);
  const { data, error } = await supabase.auth.signUp({ email, password: input.code });
  if (error) throw mapAuthError(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign-up failed — please try again.');

  // If "Confirm email" isn't disabled, there will be no session yet.
  if (!data.session) {
    throw new Error(
      'Account created, but email confirmation is still ON in Supabase. ' +
        'Disable it (Auth → Email → Confirm email) and sign in.'
    );
  }

  const row = {
    id: userId,
    phone: input.phone.replace(/\D/g, ''),
    name: input.name.trim(),
    flat: input.flat.trim() || null,
    whatsapp: input.whatsapp.trim() || null,
    upi: input.upi.trim() || null,
    roles: input.roles.length ? input.roles : (['foodie'] as Role[]),
    community_id: input.communityId ?? COMMUNITY_ID,
  };
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .insert(row)
    .select()
    .single();
  if (pErr) throw pErr;

  // Best-effort resident-directory fields — kept out of the core insert so a
  // missing column (migration 0027/0028 not yet run) can never break sign-up.
  if (input.residentType || input.profession?.trim() || input.vehicleNo?.trim()) {
    await updateResidentInfo(userId, {
      resident_type: input.residentType ?? null,
      profession: input.profession?.trim() || null,
      vehicle_no: input.vehicleNo?.trim() || null,
    }); // error (if column absent) is intentionally ignored
  }
  return profile as DbProfile;
}

/** Thrown when a blocked member tries to sign in (the screen shows the message). */
export class BlockedError extends Error {
  constructor() {
    super('Your access has been blocked. Please contact your society admin to restore it.');
    this.name = 'BlockedError';
  }
}

export async function signIn(phone: string, code: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password: code,
  });
  if (error) throw mapAuthError(error.message);

  // Refuse blocked accounts: sign back out and surface a clear message.
  // Defensive: if the `blocked` column isn't there yet (migration 0025 not run),
  // the query errors — never let that break sign-in.
  const uid = data.user?.id;
  if (uid) {
    try {
      const { data: prof, error: pErr } = await supabase
        .from('profiles').select('blocked').eq('id', uid).maybeSingle();
      if (!pErr && (prof as { blocked?: boolean } | null)?.blocked) {
        await supabase.auth.signOut();
        throw new BlockedError();
      }
    } catch (e) {
      if (e instanceof BlockedError) throw e;
      // column missing / transient — allow sign-in.
    }
  }
}

export async function signOut(): Promise<void> {
  // Local scope clears the on-device session instantly (no network round-trip
  // that can hang); the refresh token simply expires server-side.
  await supabase.auth.signOut({ scope: 'local' });
}

export async function getProfile(userId: string): Promise<DbProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as DbProfile) ?? null;
}

export async function updateProfile(userId: string, patch: Partial<DbProfile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

/** Best-effort write of resident-directory fields; ignores a missing column (pre-0027/0028). */
export async function updateResidentInfo(
  userId: string,
  fields: {
    resident_type?: 'owner' | 'tenant' | null;
    profession?: string | null;
    vehicle_no?: string | null;
    show_in_directory?: boolean;
  },
): Promise<void> {
  await supabase.from('profiles').update(fields).eq('id', userId);
}

/** Self-service: add a role to your own profile (admin is blocked server-side). */
export async function addRole(profile: DbProfile, role: Role): Promise<void> {
  if (profile.roles.includes(role)) return;
  await updateProfile(profile.id, { roles: [...profile.roles, role] });
}

/** Change the user's 6-digit PIN (Supabase password). */
export async function changePin(newCode: string): Promise<void> {
  if (!/^\d{6}$/.test(newCode)) throw new Error('New code must be exactly 6 digits.');
  const { error } = await supabase.auth.updateUser({ password: newCode });
  if (error) throw new Error(error.message);
}

/** Hard-delete the current user's auth record (cascades to profile via FK). */
export async function deleteAccount(): Promise<void> {
  // Call an RPC that deletes auth.users row using service-role privileges.
  // If this RPC doesn't exist yet, fall back to signing out (account stays).
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
}

function mapAuthError(msg: string): Error {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists'))
    return new Error('That phone number already has an account — sign in instead.');
  if (m.includes('invalid login')) return new Error('Wrong phone number or code.');
  if (m.includes('password')) return new Error('Your code must be 6 digits.');
  return new Error(msg);
}
