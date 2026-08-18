-- ════════════════════════════════════════════════════════════════════
--  AANGAN — "what do I still need to run?"
--
--  Run this FIRST, on its own, in the Supabase SQL Editor.
--  It changes nothing — it only looks at what already exists.
--
--  Read the `status` column:
--    APPLIED  → that migration already ran, nothing to do
--    MISSING  → you still need to run it
--
--  Then open RUN_IN_SUPABASE.sql and run the whole thing. It is safe even
--  for the sections already applied — those become no-ops.
-- ════════════════════════════════════════════════════════════════════

select '0060 — Nearby places' as migration,
       case when to_regclass('public.places') is null
            then 'MISSING' else 'APPLIED' end as status
union all
select '0063 — photos on tiffins/polls/reco',
       case when exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'tiffin_plans'
                 and column_name = 'photo_url')
            then 'APPLIED' else 'MISSING' end
union all
select '0065 — Lost & Found',
       case when to_regclass('public.lost_found_items') is null
            then 'MISSING' else 'APPLIED' end
union all
select '0066 — push for every notification',
       case when exists (
              select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'on_notification_push')
            then 'APPLIED' else 'MISSING' end
union all
select '0067 — Lost & Found schema repair',
       case when exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'lost_found_items'
                 and column_name = 'community_id' and data_type = 'uuid')
            then 'APPLIED'
            when to_regclass('public.lost_found_items') is null
            then 'MISSING (0065 not run yet either)'
            else 'MISSING — Lost & Found is BROKEN until you run it' end
union all
select '0068 — report + block (Apple requires)',
       case when to_regclass('public.content_reports') is null
             or to_regclass('public.user_blocks') is null
            then 'MISSING' else 'APPLIED' end
union all
select '0069 — society functions',
       case when to_regclass('public.society_events') is null
            then 'MISSING' else 'APPLIED' end;

-- Note: migrations 0061 (place seed data), 0062 and 0064 only add row-level
-- security policies or seed rows, which cannot be detected reliably this way.
-- They are harmless to re-run, so if anything above is MISSING it is worth
-- re-running those three from supabase/migrations/ as well.
