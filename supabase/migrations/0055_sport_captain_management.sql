-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0055: captain management for sport groups
-- Run AFTER 0001–0054.
--
-- Extends sport_group_members so the captain (not just the group creator)
-- can manage members, and so captaincy can be transferred via the UI.
-- ════════════════════════════════════════════════════════════════════

-- Helper: is the calling user currently the captain of this group?
create or replace function public.is_group_captain(p_group uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.sport_group_members
    where group_id = p_group and user_id = auth.uid() and is_captain = true
  );
$$;

-- Allow captains (not just group creator) to add members.
drop policy if exists sgm_insert on public.sport_group_members;
create policy sgm_insert on public.sport_group_members for insert with check (
  public.group_in_my_community(group_id)
  and (
    user_id = auth.uid()
    or public.is_group_owner(group_id)
    or public.is_group_captain(group_id)
    or public.is_admin(auth.uid())
  )
);

-- Allow captains (not just group creator) to remove members.
drop policy if exists sgm_delete on public.sport_group_members;
create policy sgm_delete on public.sport_group_members for delete using (
  user_id = auth.uid()
  or public.is_group_owner(group_id)
  or public.is_group_captain(group_id)
  or public.is_admin(auth.uid())
);

-- Allow group owner / captain / admin to update is_captain.
drop policy if exists sgm_update on public.sport_group_members;
create policy sgm_update on public.sport_group_members for update
  using (
    public.is_group_owner(group_id)
    or public.is_group_captain(group_id)
    or public.is_admin(auth.uid())
  )
  with check (
    public.is_group_owner(group_id)
    or public.is_group_captain(group_id)
    or public.is_admin(auth.uid())
  );

-- Atomic captain transfer: unsets all captains then sets the new one.
create or replace function public.set_group_captain(p_group_id uuid, p_new_captain_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_group_owner(p_group_id)
    or public.is_group_captain(p_group_id)
    or public.is_admin(auth.uid())
  ) then return false; end if;

  -- New captain must already be a group member.
  if not exists (
    select 1 from sport_group_members
    where group_id = p_group_id and user_id = p_new_captain_id
  ) then return false; end if;

  update sport_group_members set is_captain = false where group_id = p_group_id;
  update sport_group_members set is_captain = true  where group_id = p_group_id and user_id = p_new_captain_id;
  return true;
end;
$$;

grant execute on function public.set_group_captain(uuid, uuid) to authenticated;
