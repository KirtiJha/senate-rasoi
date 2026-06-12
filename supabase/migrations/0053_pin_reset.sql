-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0053: PIN reset flow
-- Run AFTER 0001–0052.
--
-- Two RPCs:
--   1. request_pin_reset — anon-accessible; a member who forgot their PIN
--      submits their phone and the community admins get an in-app notification.
--   2. admin_reset_user_pin — admin-only; changes a member's auth password.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Member requests a PIN reset ────────────────────────────────────
create or replace function public.request_pin_reset(p_phone text)
returns text   -- 'sent' | 'not_found'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits   text;
  v_profile  public.profiles%rowtype;
  v_admin    record;
begin
  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if length(v_digits) < 10 then return 'not_found'; end if;

  select * into v_profile from public.profiles where phone = v_digits limit 1;
  if not found then return 'not_found'; end if;

  -- Notify every admin in that community.
  for v_admin in
    select id from public.profiles
    where community_id = v_profile.community_id
      and 'admin' = any(roles)
  loop
    insert into public.notifications
      (community_id, type, actor_id, target_user_id, title, body, route)
    values
      (v_profile.community_id,
       'pin_reset',
       null,
       v_admin.id,
       '🔑 PIN reset request',
       coalesce(v_profile.name, 'A member') ||
         coalesce(' (Flat ' || v_profile.flat || ')', '') ||
         ' has forgotten their PIN.',
       '/admin');
  end loop;

  return 'sent';
end;
$$;

grant execute on function public.request_pin_reset(text) to anon, authenticated;

-- ── 2. Admin resets another member's PIN ──────────────────────────────
create or replace function public.admin_reset_user_pin(p_target_id uuid, p_new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_comm     uuid;
  v_target_comm uuid;
begin
  -- Caller must be an admin.
  if not public.is_admin(auth.uid()) then return false; end if;

  -- Target must be in the same community.
  select community_id into v_my_comm     from public.profiles where id = auth.uid();
  select community_id into v_target_comm from public.profiles where id = p_target_id;
  if v_my_comm is null or v_my_comm is distinct from v_target_comm then return false; end if;

  -- PIN must be exactly 6 digits.
  if p_new_pin !~ '^\d{6}$' then return false; end if;

  -- Update the bcrypt-hashed password in auth.users.
  update auth.users
  set encrypted_password = crypt(p_new_pin, gen_salt('bf')),
      updated_at = now()
  where id = p_target_id;

  return found;
end;
$$;

grant execute on function public.admin_reset_user_pin(uuid, text) to authenticated;
