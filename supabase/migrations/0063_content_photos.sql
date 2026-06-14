-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0063: optional photos for more content types
-- Run AFTER 0062.
--
-- Adds an optional image to tiffin plans, polls, recommendation questions &
-- answers, and sport tournaments. Images reuse the existing public
-- `listing-photos` bucket under per-type prefixes (tiffin/, poll/, reco-q/,
-- reco-a/, tournament/), so no new bucket is required and uploads/reads already
-- work via the bucket-level write/read policies from 0050.
-- ════════════════════════════════════════════════════════════════════

alter table public.tiffin_plans      add column if not exists photo_url text;
alter table public.polls             add column if not exists image_url text;
alter table public.reco_questions    add column if not exists photo_url text;
alter table public.reco_answers      add column if not exists photo_url text;
alter table public.sport_tournaments add column if not exists photo_url text;
