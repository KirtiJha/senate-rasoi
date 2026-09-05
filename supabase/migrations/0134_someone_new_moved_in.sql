-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0134: someone new moved in
-- Run AFTER 0001–0133. Safe to re-run.
--
-- Joining a society is deliberately open — no approval, no waiting. That only
-- works if the people who run the society can SEE it happen and put things
-- right afterwards. Neither was true.
--
-- 1. NOBODY WAS TOLD. profiles had exactly one trigger, and it guards the
--    admin role. A resident could create an account in a society and no one
--    would ever hear: not the admins, not the neighbours. The society's own
--    membership grew silently.
--
-- 2. AN ADMIN COULD NOT CORRECT ANYTHING. profiles_update is `auth.uid() = id`
--    and nothing else, so every admin action goes through an RPC — and the
--    ones that exist are role, block, PIN and delete. There was no way to fix
--    a flat typed as "204" in a society with towers, or a name spelt wrong on
--    the day someone joined, which is the whole point of an open door: you
--    tidy up after it rather than standing in it.
--
-- The phone number is deliberately NOT editable. It is the account's identity
-- — sign-in resolves it to the auth record — so changing it here would leave
-- a member unable to sign in with the number their own society now shows.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. The society hears about it ───────────────────────────────────
create or replace function public.on_profile_joined()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_where text; v_admins int := 0;
begin
  if NEW.community_id is null then return NEW; end if;

  v_where := nullif(trim(coalesce(nullif(NEW.block, ''), '') || ' ' || coalesce(NEW.flat, '')), '');

  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select NEW.community_id, 'member', NEW.id, NEW.id, p.id,
         '👋 ' || coalesce(NEW.name, 'A neighbour') || ' has joined',
         coalesce('Flat ' || v_where || ' · ', '') || 'Check their details are right.',
         '/admin'
    from public.profiles p
   where p.community_id = NEW.community_id
     and p.roles @> array['admin']::text[]
     and p.id <> NEW.id
     and coalesce(p.blocked, false) = false;
  get diagnostics v_admins = row_count;

  return NEW;
exception when others then
  -- Never let the announcement stop somebody joining (0124's rule).
  return NEW;
end; $fn$;

drop trigger if exists trg_profile_joined on public.profiles;
create trigger trg_profile_joined
  after insert on public.profiles
  for each row execute function public.on_profile_joined();

-- ── 2. An admin can put it right ────────────────────────────────────
-- Everything a society legitimately needs to correct about a member, and
-- nothing that would lock them out. Returns false rather than raising when the
-- caller is not an admin of that member's society.
create or replace function public.admin_update_member(
  p_target        uuid,
  p_name          text default null,
  p_flat          text default null,
  p_block         text default null,
  p_resident_type text default null,
  p_profession    text default null,
  p_vehicle_no    text default null
)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare v_comm uuid; v_before text; v_after text; v_actor text;
begin
  select community_id into v_comm from public.profiles where id = p_target;
  if v_comm is null then return false; end if;
  if not public.is_admin_of(v_comm) then return false; end if;

  select coalesce(name, '') || '|' || coalesce(block, '') || '|' || coalesce(flat, '')
    into v_before from public.profiles where id = p_target;

  update public.profiles
     set name          = coalesce(nullif(btrim(p_name), ''), name),
         flat          = case when p_flat is null then flat else nullif(btrim(p_flat), '') end,
         block         = case when p_block is null then block else nullif(upper(btrim(p_block)), '') end,
         resident_type = case when p_resident_type is null then resident_type
                              when p_resident_type = '' then null
                              else p_resident_type end,
         profession    = case when p_profession is null then profession else nullif(btrim(p_profession), '') end,
         vehicle_no    = case when p_vehicle_no is null then vehicle_no else nullif(btrim(p_vehicle_no), '') end
   where id = p_target;

  select coalesce(name, '') || '|' || coalesce(block, '') || '|' || coalesce(flat, '')
    into v_after from public.profiles where id = p_target;

  -- Somebody editing your name and flat is not something to discover by
  -- accident. It is a small society; say who did it.
  if v_after is distinct from v_before then
    select coalesce(name, 'An admin') into v_actor from public.profiles where id = auth.uid();
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_comm, 'member', p_target, auth.uid(), p_target,
            'Your details were updated by ' || v_actor,
            'Open your profile to check them, and change anything that is wrong.',
            '/profile/me');
  end if;
  return true;
end; $fn$;

comment on function public.admin_update_member is
  'Society admin corrects a member''s directory details. Never the phone number: that is the account identity, and changing it here would leave them unable to sign in.';

grant execute on function public.admin_update_member(uuid, text, text, text, text, text, text) to authenticated;
