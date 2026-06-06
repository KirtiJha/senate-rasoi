import { phoneToEmail, supabase } from './supabase';
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
  };
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .insert(row)
    .select()
    .single();
  if (pErr) throw pErr;
  return profile as DbProfile;
}

export async function signIn(phone: string, code: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password: code,
  });
  if (error) throw mapAuthError(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
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

/** Self-service: add a role to your own profile (admin is blocked server-side). */
export async function addRole(profile: DbProfile, role: Role): Promise<void> {
  if (profile.roles.includes(role)) return;
  await updateProfile(profile.id, { roles: [...profile.roles, role] });
}

function mapAuthError(msg: string): Error {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists'))
    return new Error('That phone number already has an account — sign in instead.');
  if (m.includes('invalid login')) return new Error('Wrong phone number or code.');
  if (m.includes('password')) return new Error('Your code must be 6 digits.');
  return new Error(msg);
}
