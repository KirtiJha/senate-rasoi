import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Public env vars are inlined into the bundle at build time. The anon key is
// safe to ship — security is enforced by RLS + RPCs (see supabase/migrations).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once real credentials are wired in. The UI shows a setup banner otherwise. */
export const isSupabaseConfigured =
  supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;

if (!isSupabaseConfigured && __DEV__) {
  console.warn(
    '[Aangan] Supabase is not configured. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  // Fall back to harmless placeholders so the client constructs without throwing;
  // every call is gated on `isSupabaseConfigured` in the UI.
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // Phone + 6-digit code auth via the Supabase email-alias trick.
      // Persist the session so users stay logged in across launches.
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

// ── Realtime channel-topic uniqueness ───────────────────────────────
// supabase-js returns an EXISTING channel when one with the same topic already
// exists. So when a subscribe effect re-runs (e.g. its deps change as auth/data
// settle) before the previous channel's async removal finishes, the second
// `supabase.channel('same-topic')` hands back the already-subscribed channel, and
// chaining `.on('postgres_changes', …)` throws:
//   "cannot add postgres_changes callbacks … after subscribe()".
// Make every topic process-unique so a fresh, unsubscribed channel is always
// created. Topic names are cosmetic for postgres_changes (the filter lives in the
// `.on()` config), so this is safe — and it fixes the whole class at one point.
{
  const origChannel = supabase.channel.bind(supabase);
  let seq = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabase as any).channel = (name: string, opts?: any) => origChannel(`${name}~${++seq}`, opts);
}

/** Build the alias email Supabase Auth stores for a phone number. */
export function phoneToEmail(phone: string): string {
  return `${phone.replace(/\D/g, '')}@senate.app`;
}

/** The default society (fallback when a logged-in user's own community is unknown). */
export const COMMUNITY_ID = 'd836e935-4622-4289-8136-11ca73b54a39';

/** Storage bucket for dish photos (create it in the Supabase dashboard). */
export const DISH_PHOTOS_BUCKET = 'dish-photos';

/** Storage bucket for listing photos (create in Supabase dashboard as a public bucket). */
export const LISTING_PHOTOS_BUCKET = 'listing-photos';

/** Storage bucket for sports group logos (create in Supabase dashboard as a public bucket). */
export const SPORT_LOGOS_BUCKET = 'sport-logos';

/** Storage bucket for the document vault — create as a PRIVATE bucket; access is
 *  granted per-file via signed URLs + RLS (public/owner/shared). */
export const DOCUMENTS_BUCKET = 'documents';

/** Max upload size for a document, in MB. */
export const MAX_DOCUMENT_MB = 20;
