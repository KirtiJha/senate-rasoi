// ════════════════════════════════════════════════════════════════════
// Aangan — pin-reset
//
// The one flow that cannot use the app's own auth, because the person
// calling it is locked out of it. So this function is deliberately public
// (verify_jwt: false) and carries its own protection:
//
//   • Twilio Verify owns the code — generating it, expiring it, counting
//     wrong guesses. Nothing here ever sees or stores a code.
//   • The password is written by a Postgres function that only the service
//     role may execute (0142). This function holds the only key.
//   • Three codes per number per hour, counted in our own table, because an
//     attacker burning somebody's SMS budget is our problem, not Twilio's.
//   • Every reply is the same whether or not the number has an account. An
//     endpoint that says "no such user" is a way to find out who lives here.
//
// Sign-in is untouched: still a PIN, still no OTP. This is the one moment
// the app cannot keep that promise, because the whole point is that the
// resident does not know the PIN.
//
// Deploy:  supabase functions deploy pin-reset --no-verify-jwt
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const VERIFY_SID = Deno.env.get('TWILIO_VERIFY_SERVICE_SID') ?? '';

/** Codes per number per hour. Twilio limits too; this protects the wallet. */
const SENDS_PER_HOUR = 3;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/**
 * Indian mobile numbers, in the form Twilio wants.
 *
 * The app stores digits only, and residents type them every way there is —
 * with spaces, with +91, with a leading 0. Ten digits starting 6-9 is the
 * whole of the Indian mobile range; anything else is not a number we can
 * text, and saying so early saves a Twilio error and a charge.
 */
function toE164(raw: string): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  const ten = d.length > 10 ? d.slice(-10) : d;
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return `+91${ten}`;
}

async function twilio(path: string, form: Record<string, string>): Promise<{ ok: boolean; status: string }> {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${VERIFY_SID}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Twilio's own message can name the number; keep it in the logs only.
    console.error('twilio', path, res.status, JSON.stringify(body).slice(0, 300));
    return { ok: false, status: 'error' };
  }
  return { ok: true, status: String((body as { status?: string }).status ?? '') };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!TWILIO_SID || !TWILIO_TOKEN || !VERIFY_SID) {
    console.error('pin-reset: Twilio secrets are not set');
    return json({ error: 'not_configured', message: 'Resetting by SMS is not switched on yet. Ask a society admin to set you a temporary PIN.' }, 503);
  }

  let body: { action?: string; phone?: string; code?: string; new_pin?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const phone = toE164(body.phone ?? '');
  // A malformed number is the one thing we can say plainly: it is about what
  // they typed, not about who exists.
  if (!phone) return json({ error: 'bad_number', message: 'Enter a 10-digit Indian mobile number.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Send a code ───────────────────────────────────────────────────
  if (body.action === 'start') {
    const { data: count } = await admin.rpc('pin_reset_send_count', { p_phone: phone });
    if ((count ?? 0) >= SENDS_PER_HOUR) {
      return json({ error: 'too_many', message: 'Too many codes sent to that number. Try again in an hour, or ask a society admin.' }, 429);
    }

    const { data: exists } = await admin.rpc('pin_reset_account_exists', { p_phone: phone });
    // Only a real account gets an SMS — there is no point texting a stranger,
    // and it would be a way to make Aangan send messages on request. But the
    // ANSWER is the same either way, so the caller learns nothing.
    if (exists) {
      await admin.rpc('pin_reset_note_send', { p_phone: phone });
      const r = await twilio('Verifications', { To: phone, Channel: 'sms' });
      if (!r.ok) return json({ error: 'send_failed', message: 'Could not send the code just now. Try again, or ask a society admin.' }, 502);
    }
    return json({ sent: true });
  }

  // ── Check it, then set the PIN ────────────────────────────────────
  if (body.action === 'verify') {
    const code = String(body.code ?? '').replace(/\D/g, '');
    const newPin = String(body.new_pin ?? '');
    if (code.length < 4) return json({ error: 'bad_code', message: 'Enter the 6-digit code from the SMS.' }, 400);
    if (!/^\d{6}$/.test(newPin)) return json({ error: 'bad_pin', message: 'Your new PIN must be 6 digits.' }, 400);

    const r = await twilio('VerificationCheck', { To: phone, Code: code });
    if (!r.ok || r.status !== 'approved') {
      return json({ error: 'wrong_code', message: 'That code is wrong or has expired. Ask for a new one.' }, 400);
    }

    const { data: done, error } = await admin.rpc('reset_pin_after_otp', { p_phone: phone, p_new_pin: newPin });
    if (error) {
      console.error('pin-reset: reset failed', error.message);
      return json({ error: 'failed', message: 'Could not set your PIN. Try again in a moment.' }, 502);
    }
    if (!done) {
      // The code was right, so the number is theirs; this is the PIN itself.
      return json({ error: 'weak_pin', message: 'Pick a different 6 digits — not all the same, and not a run like 123456.' }, 400);
    }
    return json({ reset: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
