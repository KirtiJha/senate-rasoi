-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0054: self-service PIN reset
-- Run AFTER 0001–0053.
--
-- Replaces the admin-notification approach from 0053 with a direct
-- self-service reset: user provides their registered phone + a new 6-digit
-- PIN and the RPC updates auth.users immediately.
--
-- Security note: identity is verified only by phone number. This is an
-- acceptable trade-off for a closed housing-society app where phone numbers
-- are known within the community. The admin fallback (admin_reset_user_pin
-- from 0053) remains for cases where the user can't self-reset.
-- ════════════════════════════════════════════════════════════════════

-- Drop the notification-based helper that is no longer part of the flow.
drop function if exists public.request_pin_reset(text);

create or replace function public.self_reset_pin(p_phone text, p_new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_new_pin !~ '^\d{6}$' then return false; end if;

  select id into v_user_id
  from public.profiles
  where phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1;

  if not found then return false; end if;

  update auth.users
  set encrypted_password = crypt(p_new_pin, gen_salt('bf')),
      updated_at          = now()
  where id = v_user_id;

  return found;
end;
$$;

-- Accessible before sign-in (anon role).
grant execute on function public.self_reset_pin(text, text) to anon, authenticated;
