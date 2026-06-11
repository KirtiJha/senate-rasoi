-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0046: allow one owner across multiple flats
-- Run AFTER 0001–0045.
--
-- The roster had a unique index on (community_id, phone) which blocked an owner
-- who holds two flats from appearing in both. Widen it to include the flat, so
-- the same number can repeat across different flats (but still de-dupes an exact
-- same-person-same-flat re-add).
-- ════════════════════════════════════════════════════════════════════

drop index if exists public.directory_entries_phone_idx;
create unique index if not exists directory_entries_phone_flat_idx
  on public.directory_entries (community_id, phone, flat) where phone is not null;
