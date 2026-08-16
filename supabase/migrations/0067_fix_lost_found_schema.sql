-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0067: repair lost_found_items schema
-- Run AFTER 0001–0066. Safe to run whether or not the original (broken)
-- 0065 was ever applied — every step is guarded, so on a database created
-- from the corrected 0065 this migration is a no-op.
--
-- The first cut of 0065 declared `community_id` as TEXT. Every other table
-- (including `notifications`, which the insert trigger writes to) uses
-- `uuid references communities(id)`. Postgres has no assignment cast from
-- text to uuid, so the trigger's insert failed the type check and EVERY
-- Lost & Found post errored out. It also shipped `using (true)` for reads,
-- which exposed one society's items to members of another.
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_type text;
begin
  if to_regclass('public.lost_found_items') is null then
    return;  -- table doesn't exist yet; corrected 0065 will create it properly
  end if;

  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'lost_found_items'
     and column_name  = 'community_id';

  -- Convert text → uuid only if it's still text. Rows whose value isn't a
  -- valid uuid can't be salvaged; there should be none, because inserts have
  -- been failing in the trigger since day one.
  if v_type = 'text' then
    delete from public.lost_found_items
     where community_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

    alter table public.lost_found_items
      alter column community_id type uuid using community_id::uuid;
  end if;

  -- Add the FK if it isn't there yet.
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'lost_found_items'
       and constraint_name = 'lost_found_items_community_id_fkey'
  ) then
    alter table public.lost_found_items
      add constraint lost_found_items_community_id_fkey
      foreign key (community_id) references public.communities(id) on delete cascade;
  end if;
end $$;

-- Indexes (no-ops if 0065 already created them).
create index if not exists lost_found_feed_idx  on public.lost_found_items (community_id, bump_at desc);
create index if not exists lost_found_owner_idx on public.lost_found_items (owner_user_id);

-- Replace the permissive policies from the first cut with society-scoped ones.
drop policy if exists "lost_found read"   on public.lost_found_items;
drop policy if exists "lost_found insert" on public.lost_found_items;
drop policy if exists "lost_found update" on public.lost_found_items;
drop policy if exists "lost_found delete" on public.lost_found_items;

drop policy if exists lf_read   on public.lost_found_items;
drop policy if exists lf_insert on public.lost_found_items;
drop policy if exists lf_update on public.lost_found_items;
drop policy if exists lf_delete on public.lost_found_items;

create policy lf_read on public.lost_found_items for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

create policy lf_insert on public.lost_found_items for insert to authenticated
  with check (owner_user_id = auth.uid() and public.is_my_community(community_id));

create policy lf_update on public.lost_found_items for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

create policy lf_delete on public.lost_found_items for delete to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));
