-- ════════════════════════════════════════════════════════════════════
-- Senate Rasoi — migration 0006: future-date dishes
-- Run AFTER 0001–0005.
--
-- Lets chefs post for a future day; neighbours reserve ahead. Existing dishes
-- default to today.
-- ════════════════════════════════════════════════════════════════════

alter table public.dishes add column if not exists serve_date date not null default current_date;

create index if not exists dishes_serve_date_idx on public.dishes (community_id, serve_date, created_at desc);
