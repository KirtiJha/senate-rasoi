-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0029: manually-added residents + directory moderation
-- Run AFTER 0001–0028.
--
-- directory_entries lets any member add a neighbour who hasn't signed up yet
-- (so the directory is complete). Registered members come from `profiles`; an
-- entry whose phone matches a member is treated as "onboarded" and the profile
-- wins. Admins (or whoever added it) can remove an entry; admins can also hide
-- a registered member from the directory.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.directory_entries (
  id            uuid        primary key default gen_random_uuid(),
  community_id  uuid        not null references public.communities(id) on delete cascade,
  name          text        not null,
  flat          text,
  phone         text,
  resident_type text        check (resident_type in ('owner', 'tenant')),
  profession    text,
  vehicle_no    text,
  added_by      uuid        references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- One entry per phone per community (dedupe).
create unique index if not exists directory_entries_phone_idx
  on public.directory_entries (community_id, phone) where phone is not null;
create index if not exists directory_entries_comm_idx
  on public.directory_entries (community_id);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.directory_entries enable row level security;

drop policy if exists directory_entries_read on public.directory_entries;
create policy directory_entries_read on public.directory_entries
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.community_id = directory_entries.community_id)
  );

-- Any member can add a resident to their own community.
drop policy if exists directory_entries_insert on public.directory_entries;
create policy directory_entries_insert on public.directory_entries
  for insert with check (
    added_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.community_id = directory_entries.community_id)
  );

-- The adder or a society admin can edit / remove an entry.
drop policy if exists directory_entries_update on public.directory_entries;
create policy directory_entries_update on public.directory_entries
  for update using (added_by = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists directory_entries_delete on public.directory_entries;
create policy directory_entries_delete on public.directory_entries
  for delete using (added_by = auth.uid() or public.is_admin(auth.uid()));

-- ── Admin hides/shows a registered member in the directory ──────────
create or replace function public.admin_set_directory_visibility(p_target uuid, p_visible boolean)
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
  select community_id into my_comm     from public.profiles where id = auth.uid();
  select community_id into target_comm from public.profiles where id = p_target;
  if my_comm is null or my_comm is distinct from target_comm then return false; end if;
  update public.profiles set show_in_directory = p_visible where id = p_target;
  return found;
end;
$$;

grant execute on function public.admin_set_directory_visibility(uuid, boolean) to authenticated;
