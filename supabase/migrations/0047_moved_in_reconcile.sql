-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0047: moved-in status + sign-up directory reconcile
-- Run AFTER 0001–0046.
--
--   • profiles.moved_in  — has this member moved into the society (occupancy)?
--   • profiles.alt_phone — a second contact number (Phase 1 of multi-number).
--   • reconcile_my_directory_entry() — a newly-signed-up member claims a pre-
--     existing roster entry (same flat) that has a different number: optionally
--     keep that number as their alternate, then delete the stale entry. Needed
--     because entry-delete RLS is added_by/admin-only.
--   • admin_set_moved_in() — admin changes any member's moved-in (profiles_update
--     is self-only).
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists moved_in  boolean not null default false;
alter table public.profiles add column if not exists alt_phone text;

create or replace function public.reconcile_my_directory_entry(p_entry_id uuid, p_keep_number boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_entry public.directory_entries; v_me public.profiles;
begin
  select * into v_entry from public.directory_entries where id = p_entry_id;
  if v_entry.id is null then return false; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.id is null or v_me.community_id is distinct from v_entry.community_id then return false; end if;
  -- guard: the caller may only claim an entry whose flat number is part of their own flat
  if coalesce(v_entry.flat, '') <> '' and position(v_entry.flat in coalesce(v_me.flat, '')) = 0 then
    return false;
  end if;
  if p_keep_number and coalesce(v_entry.phone, '') <> '' then
    update public.profiles set alt_phone = v_entry.phone
      where id = auth.uid() and coalesce(alt_phone, '') = '';
  end if;
  delete from public.directory_entries where id = p_entry_id;
  return true;
end; $$;

create or replace function public.admin_set_moved_in(p_target uuid, p_value boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then return false; end if;
  update public.profiles set moved_in = p_value
    where id = p_target and community_id = public.current_community_id();
  return found;
end; $$;
