import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * Resetting a PIN, for somebody who cannot sign in.
 *
 * Every other call in the app goes through the resident's session. This one
 * cannot: the whole reason they are here is that they are locked out. So it
 * posts to the `pin-reset` function directly with the anon key, and that
 * function does the proving — Twilio sends a code, Twilio checks it, and
 * only then does a service-role-only Postgres function touch the password.
 *
 * `supabase.functions.invoke` is not used because it attaches whatever
 * session happens to exist, and there is none.
 */

export class PinResetError extends Error {
  code: string;
  constructor(message: string, code = 'error') { super(message); this.code = code; }
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/pin-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PinResetError('Could not reach Aangan. Check your connection and try again.', 'offline');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok || data.error) {
    throw new PinResetError(data.message ?? 'Something went wrong. Try again.', data.error ?? 'error');
  }
  return data as Record<string, unknown>;
}

/**
 * Send a code. Resolves the same way whether or not that number has an
 * account — anything else would be a way to discover who lives here.
 */
export async function sendResetCode(phone: string): Promise<void> {
  await call({ action: 'start', phone });
}

/** Check the code and set the new PIN. Throws with a readable message. */
export async function confirmResetCode(phone: string, code: string, newPin: string): Promise<void> {
  await call({ action: 'verify', phone, code, new_pin: newPin });
}

/** Kept for the fallback: a number that has changed hands needs an admin. */
export async function askAdminToReset(phone: string): Promise<void> {
  const { error } = await supabase.rpc('request_pin_reset', { p_phone: phone });
  if (error) throw new PinResetError(error.message);
}
