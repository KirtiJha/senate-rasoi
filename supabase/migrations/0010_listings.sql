-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0010: listings table (the shared engine)
-- Covers tuitions, tailoring, tax, clinic, catering, decoration,
-- job referrals, buy & sell, and trusted service-person directory.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.listings (
  id               uuid        primary key default gen_random_uuid(),
  community_id     uuid        not null references public.communities(id)  on delete cascade,
  category         text        not null,
  owner_user_id    uuid        not null references public.profiles(id)     on delete cascade,

  title            text        not null,
  description      text,
  photos           text[]      not null default '{}',

  price            integer,
  price_unit       text,        -- 'fixed'|'per_hour'|'per_month'|'per_plate'|'negotiable'|null

  contact_whatsapp text,
  contact_phone    text,
  location         text,

  status           text        not null default 'active'
                   check (status in ('active', 'closed', 'sold', 'expired')),

  -- Trusted-directory mode: recommending a third-party (not the member themselves).
  is_referral      boolean     not null default false,
  referral_name    text,
  referral_phone   text,

  attributes       jsonb       not null default '{}',
  expires_at       timestamptz,
  bump_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- Main feed index: community → category → active → newest first.
create index if not exists listings_feed_idx
  on public.listings (community_id, category, status, bump_at desc);

create index if not exists listings_owner_idx
  on public.listings (owner_user_id);

-- GIN index for JSONB attribute queries (Phase 3+).
create index if not exists listings_attrs_idx
  on public.listings using gin (attributes);

-- ── RLS (mirrors the dishes conventions) ────────────────────────────
alter table public.listings enable row level security;

drop policy if exists listings_read   on public.listings;
create policy listings_read on public.listings
  for select using (auth.role() = 'authenticated');

drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings
  for insert with check (
    auth.uid() = owner_user_id
    and exists (select 1 from public.communities c where c.id = community_id)
  );

drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings
  for update using (auth.uid() = owner_user_id or public.is_admin(auth.uid()));

drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings
  for delete using (auth.uid() = owner_user_id or public.is_admin(auth.uid()));

-- ── Realtime ────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'listings'
  ) then
    alter publication supabase_realtime add table public.listings;
  end if;
end $$;

-- ── Storage bucket note ──────────────────────────────────────────────
-- Create a public bucket named "listing-photos" in the Supabase dashboard
-- (Storage → New bucket → listing-photos → Public). The client uploads
-- to path: {community_id}/{listing_id}/{n}.jpg
