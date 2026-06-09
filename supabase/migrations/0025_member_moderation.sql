-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0025: member moderation (block / delete)
-- Run AFTER 0001–0024.
--
-- Adds a `blocked` flag to profiles and admin-only RPCs to block/unblock or
-- hard-delete a member of the admin's own community. Block is enforced at the
-- login layer (the app signs blocked users out with a message); delete removes
-- the auth user + profile (cascades), so the next login gets the normal
-- "no account" path.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists blocked boolean not null default false;

-- Admin blocks / unblocks a member in their OWN community.
create or replace function public.admin_set_blocked(p_target uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_comm     uuid;
  target_comm uuid;
begin
  if not public.is_admin(auth.uid()) then return false; end if;
  if p_target = auth.uid() then return false; end if;            -- can't block yourself
  select community_id into my_comm     from public.profiles where id = auth.uid();
  select community_id into target_comm from public.profiles where id = p_target;
  if my_comm is null or my_comm is distinct from target_comm then return false; end if;

  update public.profiles set blocked = p_blocked where id = p_target;
  return found;
end;
$$;

-- Admin hard-deletes a member (auth user + profile cascade) in their community.
create or replace function public.admin_delete_member(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_comm     uuid;
  target_comm uuid;
begin
  if not public.is_admin(auth.uid()) then return false; end if;
  if p_target = auth.uid() then return false; end if;
  select community_id into my_comm     from public.profiles where id = auth.uid();
  select community_id into target_comm from public.profiles where id = p_target;
  if my_comm is null or my_comm is distinct from target_comm then return false; end if;

  delete from public.profiles where id = p_target;
  delete from auth.users    where id = p_target;
  return true;
end;
$$;

grant execute on function public.admin_set_blocked(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_member(uuid)        to authenticated;
