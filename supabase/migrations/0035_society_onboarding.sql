-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0035: society onboarding
-- Run AFTER 0001–0034.
--
-- Lets a resident onboard their own society (instead of admin-seeding it).
-- Adds map/location fields + an OpenStreetMap place id used to PREVENT
-- duplicate societies, and an RLS insert policy so the founder can create the
-- community during sign-up (they become its first admin).
-- ════════════════════════════════════════════════════════════════════

alter table public.communities
  add column if not exists lat          numeric,
  add column if not exists lon          numeric,
  add column if not exists osm_place_id text,
  add column if not exists city         text,
  add column if not exists created_by   uuid references public.profiles(id) on delete set null;

-- One society per real-world place (dedupe key from OpenStreetMap).
create unique index if not exists communities_osm_idx
  on public.communities (osm_place_id) where osm_place_id is not null;

-- Founder creates the community during sign-up (they then insert their own
-- admin profile pointing at it). Read stays open (the existing communities_read).
drop policy if exists communities_insert on public.communities;
create policy communities_insert on public.communities for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists communities_update on public.communities;
create policy communities_update on public.communities for update
  using (created_by = auth.uid() or public.is_admin(auth.uid()));
