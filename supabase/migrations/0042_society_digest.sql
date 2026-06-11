-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0042: weekly society digest cache
-- Run AFTER 0001–0041.
--
-- Backs the in-app "This week in your society" card. The ai-proxy `digest`
-- action summarises the week's activity once per society per week and caches it
-- here, so the first viewer generates it and everyone else reads it instantly.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.society_digests (
  community_id uuid not null references public.communities(id) on delete cascade,
  week_start   date not null,        -- Monday (UTC) of the week the digest covers
  content      text not null,        -- JSON: { summary, highlights[] }
  created_at   timestamptz not null default now(),
  primary key (community_id, week_start)
);

alter table public.society_digests enable row level security;
-- No policies: only the service-role Edge Function reads/writes this cache.
