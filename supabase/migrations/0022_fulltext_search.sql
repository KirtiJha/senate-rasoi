-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0022: full-text search on listings + posts
-- Run AFTER 0001–0021.
--
-- Adds a generated `search_tsv` tsvector column + GIN index to both
-- listings and posts so search can use ranked, stemmed full-text matching
-- (e.g. "tutor" matches "tutoring") instead of slow `ilike` scans. The
-- client still falls back to `ilike` for partial-token/substring queries.
-- Generated columns stay in sync automatically — no triggers to maintain.
-- ════════════════════════════════════════════════════════════════════

-- ── Listings: title + description ───────────────────────────────────
alter table public.listings
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

create index if not exists listings_search_idx
  on public.listings using gin (search_tsv);

-- ── Posts: title + body ─────────────────────────────────────────────
alter table public.posts
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored;

create index if not exists posts_search_idx
  on public.posts using gin (search_tsv);
