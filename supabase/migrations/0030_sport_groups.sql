-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0030: sports groups
-- Run AFTER 0001–0029.
--
-- Sports groups/teams per sport (badminton, cricket, … — the catalogue lives in
-- src/lib/sports.ts so adding a sport is a one-line code change). Each group has
-- a name, emoji+colour badge, practice schedule, members and upcoming
-- tournaments. Any member can join/leave; the group creator (captain) or a
-- society admin can manage members and tournaments.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.sport_groups (
  id                 uuid        primary key default gen_random_uuid(),
  community_id       uuid        not null references public.communities(id) on delete cascade,
  sport              text        not null,
  name               text        not null,
  emoji              text,
  color              text,
  description        text,
  practice_days      text,
  practice_time      text,
  practice_duration  text,
  practice_location  text,
  created_by         uuid        references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists sport_groups_comm_idx on public.sport_groups (community_id);

create table if not exists public.sport_group_members (
  group_id   uuid        not null references public.sport_groups(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  is_captain boolean     not null default false,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists sgm_user_idx on public.sport_group_members (user_id);

create table if not exists public.sport_tournaments (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.sport_groups(id) on delete cascade,
  title      text        not null,
  event_date date,
  location   text,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists sport_tournaments_group_idx on public.sport_tournaments (group_id);

-- ── Helpers ─────────────────────────────────────────────────────────
create or replace function public.is_my_community(p_community uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.community_id = p_community);
$$;

create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.sport_groups g where g.id = p_group and g.created_by = auth.uid());
$$;

create or replace function public.group_in_my_community(p_group uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.sport_groups g join public.profiles p on p.id = auth.uid()
    where g.id = p_group and g.community_id = p.community_id
  );
$$;

-- ── RLS: sport_groups ───────────────────────────────────────────────
alter table public.sport_groups enable row level security;

drop policy if exists sg_read on public.sport_groups;
create policy sg_read on public.sport_groups for select using (public.is_my_community(community_id));

drop policy if exists sg_insert on public.sport_groups;
create policy sg_insert on public.sport_groups for insert
  with check (created_by = auth.uid() and public.is_my_community(community_id));

drop policy if exists sg_update on public.sport_groups;
create policy sg_update on public.sport_groups for update
  using (created_by = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists sg_delete on public.sport_groups;
create policy sg_delete on public.sport_groups for delete
  using (created_by = auth.uid() or public.is_admin(auth.uid()));

-- ── RLS: sport_group_members ────────────────────────────────────────
alter table public.sport_group_members enable row level security;

drop policy if exists sgm_read on public.sport_group_members;
create policy sgm_read on public.sport_group_members for select
  using (public.group_in_my_community(group_id));

-- A member joins themselves; the group owner or an admin can add anyone.
drop policy if exists sgm_insert on public.sport_group_members;
create policy sgm_insert on public.sport_group_members for insert with check (
  public.group_in_my_community(group_id)
  and (user_id = auth.uid() or public.is_group_owner(group_id) or public.is_admin(auth.uid()))
);

-- A member leaves themselves; the group owner or an admin can remove anyone.
drop policy if exists sgm_delete on public.sport_group_members;
create policy sgm_delete on public.sport_group_members for delete using (
  user_id = auth.uid() or public.is_group_owner(group_id) or public.is_admin(auth.uid())
);

-- ── RLS: sport_tournaments ──────────────────────────────────────────
alter table public.sport_tournaments enable row level security;

drop policy if exists st_read on public.sport_tournaments;
create policy st_read on public.sport_tournaments for select
  using (public.group_in_my_community(group_id));

drop policy if exists st_write on public.sport_tournaments;
create policy st_write on public.sport_tournaments for all
  using (public.is_group_owner(group_id) or public.is_admin(auth.uid()))
  with check (public.is_group_owner(group_id) or public.is_admin(auth.uid()));
