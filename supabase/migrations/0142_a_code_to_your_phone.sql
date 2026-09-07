-- A code to your phone.
--
-- 0141 revoked `self_reset_pin`, which set any resident's password from
-- their phone number alone — a number printed next to their name in the
-- resident directory. The replacement was "ask an admin", which is safe but
-- slow, and strands a society whose only admin is the one locked out.
--
-- This restores self-service the way it should have worked: prove you hold
-- the phone. Twilio Verify sends a six-digit code by SMS; only after Twilio
-- says "approved" does anything touch the password. Sign-in stays exactly as
-- it was — no OTP, just the PIN — because that is the promise the app makes
-- and this is the one moment it cannot keep it.
--
-- The password write lives here rather than in the edge function so that the
-- service-role key is the only thing that can reach it, and so the rules for
-- what a PIN may be live beside every other rule about accounts.

-- ── Rate limit ───────────────────────────────────────────────────────
-- Twilio rate-limits its own endpoint, but an attacker spending someone
-- else's SMS budget is our problem, not Twilio's.
create table if not exists public.pin_reset_sends (
  id         bigserial primary key,
  phone      text not null,
  created_at timestamptz not null default now()
);
create index if not exists pin_reset_sends_recent on public.pin_reset_sends (phone, created_at desc);

alter table public.pin_reset_sends enable row level security;
-- No policies at all: only the service role, which bypasses RLS, ever reads
-- or writes this. A list of who is locked out is nobody else's business.

/**
 * How many codes have gone to this number in the last hour.
 * Service role only; the edge function decides what to do with the number.
 */
create or replace function public.pin_reset_send_count(p_phone text)
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from public.pin_reset_sends
   where phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
     and created_at > now() - interval '1 hour';
$$;
revoke execute on function public.pin_reset_send_count(text) from public, anon, authenticated;
grant execute on function public.pin_reset_send_count(text) to service_role;

create or replace function public.pin_reset_note_send(p_phone text)
returns void language sql security definer set search_path = public as $$
  insert into public.pin_reset_sends (phone)
  values (regexp_replace(p_phone, '[^0-9]', '', 'g'));
$$;
revoke execute on function public.pin_reset_note_send(text) from public, anon, authenticated;
grant execute on function public.pin_reset_note_send(text) to service_role;

/** Does an account exist for this number? Never exposed to the caller. */
create or replace function public.pin_reset_account_exists(p_phone text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
  );
$$;
revoke execute on function public.pin_reset_account_exists(text) from public, anon, authenticated;
grant execute on function public.pin_reset_account_exists(text) to service_role;

/**
 * Set the PIN. Only ever called after Twilio has approved a code.
 *
 * Service role only — this is the one door to a password, and nothing the
 * app ships may open it. The PIN rules are the same as everywhere else: six
 * digits, not all the same, not a run.
 */
create or replace function public.reset_pin_after_otp(p_phone text, p_new_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_user uuid;
begin
  if p_new_pin !~ '^\d{6}$' then return false; end if;
  if p_new_pin ~ '^(.)\1{5}$' then return false; end if;
  if p_new_pin in ('123456', '654321', '012345', '543210') then return false; end if;

  select id into v_user from public.profiles
   where phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
   limit 1;
  if v_user is null then return false; end if;

  update auth.users
     set encrypted_password = crypt(p_new_pin, gen_salt('bf')),
         updated_at = now()
   where id = v_user;

  -- A successful reset closes any outstanding "please help me in" request.
  update public.pin_reset_requests
     set handled_at = now()
   where user_id = v_user and handled_at is null;

  return true;
end; $$;
revoke execute on function public.reset_pin_after_otp(text, text) from public, anon, authenticated;
grant execute on function public.reset_pin_after_otp(text, text) to service_role;

-- The old door, bricked up rather than left locked.
drop function if exists public.self_reset_pin(text, text);
