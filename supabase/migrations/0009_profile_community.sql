-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0009: profiles.community_id
-- Every member belongs to a community. Defaults existing rows to the
-- seed society so no existing user is broken.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists community_id uuid references public.communities(id);

-- Backfill existing profiles to the default community.
update public.profiles
set    community_id = '00000000-0000-0000-0000-000000000001'
where  community_id is null;
