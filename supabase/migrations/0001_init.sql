-- ════════════════════════════════════════════════════════════════════
-- Senate Chef — initial schema, RLS, and RPCs
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Design goals (from PLAN.md §3/§4):
--   • No login. Identity is a device-stored profile.
--   • Ownership/delete secured by an on-device random token; only its
--     SHA-256 hash is stored server-side.
--   • Atomic plates_left decrement so a dish can never be oversold.
--   • Public can READ the feed and INSERT dishes; all mutations
--     (order / delete) go through SECURITY DEFINER RPCs, never raw
--     UPDATE/DELETE — so a client can't tamper with arbitrary rows.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto; -- for digest() / gen_random_uuid()

-- ── communities ─────────────────────────────────────────────────────
-- Single society for v1, but the table exists from day one so going
-- multi-society later is config, not a rewrite.
create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── dishes ──────────────────────────────────────────────────────────
create table if not exists public.dishes (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references public.communities (id) on delete cascade,
  chef_name         text not null,
  flat              text not null,
  whatsapp          text not null,                       -- used to build the wa.me order link
  upi               text,                                -- optional
  dish_name         text not null,
  slot              text not null check (slot in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  veg_type          text not null check (veg_type in ('Veg', 'Non-veg', 'Egg')),
  price             integer not null check (price >= 0),
  max_plates        integer not null check (max_plates > 0),
  plates_left       integer not null check (plates_left >= 0),
  description       text,
  photo_url         text,
  owner_token_hash  text not null,                       -- SHA-256 hex of the device's owner token
  created_at        timestamptz not null default now()
);

create index if not exists dishes_community_created_idx
  on public.dishes (community_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- Row-Level Security
-- ════════════════════════════════════════════════════════════════════
alter table public.communities enable row level security;
alter table public.dishes enable row level security;

-- Communities: anyone may read the (tiny) list; nobody writes from the client.
drop policy if exists communities_read on public.communities;
create policy communities_read on public.communities
  for select using (true);

-- Dishes: anyone may read the feed and post a new dish.
-- There is intentionally NO update/delete policy — those happen only
-- through the SECURITY DEFINER functions below, which enforce the token.
drop policy if exists dishes_read on public.dishes;
create policy dishes_read on public.dishes
  for select using (true);

drop policy if exists dishes_insert on public.dishes;
create policy dishes_insert on public.dishes
  for insert with check (
    -- A fresh post must start fully available and reference a real community.
    plates_left = max_plates
    and exists (select 1 from public.communities c where c.id = community_id)
  );

-- ════════════════════════════════════════════════════════════════════
-- RPCs (called from the client via supabase.rpc(...))
-- ════════════════════════════════════════════════════════════════════

-- Atomic order: decrement plates_left by p_qty only if enough remain.
-- Returns the new plates_left, or NULL if the order couldn't be filled
-- (sold out / not enough left / dish gone). No oversell possible because
-- the guard and the write are a single statement.
create or replace function public.order_plates(p_dish_id uuid, p_qty integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left integer;
begin
  if p_qty is null or p_qty < 1 then
    return null;
  end if;

  update public.dishes
     set plates_left = plates_left - p_qty
   where id = p_dish_id
     and plates_left >= p_qty
  returning plates_left into v_left;

  return v_left; -- NULL when the WHERE matched no row
end;
$$;

-- Secure delete: removes a dish only when the caller presents the raw
-- owner token whose SHA-256 hash matches the stored one. Returns true
-- when a row was deleted.
-- Note: `extensions` is on the search_path because Supabase installs pgcrypto
-- (which provides digest()) into the `extensions` schema, not `public`.
create or replace function public.delete_dish(p_dish_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted integer;
begin
  delete from public.dishes
   where id = p_dish_id
     and owner_token_hash = encode(digest(p_token, 'sha256'), 'hex');
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- Let the public (anon) role call these RPCs.
grant execute on function public.order_plates(uuid, integer) to anon, authenticated;
grant execute on function public.delete_dish(uuid, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- Realtime: publish dishes so the board updates live.
-- ════════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'dishes'
  ) then
    alter publication supabase_realtime add table public.dishes;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Seed the single community for v1.
-- ════════════════════════════════════════════════════════════════════
insert into public.communities (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Senate Society')
on conflict (id) do nothing;
