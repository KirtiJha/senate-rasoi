-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0008: communities metadata
-- Adds slug + address for multi-society display. Safe on the live DB.
-- ════════════════════════════════════════════════════════════════════

alter table public.communities add column if not exists slug    text unique;
alter table public.communities add column if not exists address text;

-- Backfill the existing seeded society row.
update public.communities
set    slug = 'senate-society'
where  id   = '00000000-0000-0000-0000-000000000001'
  and  slug is null;
