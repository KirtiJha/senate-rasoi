-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0045: separate Block from Flat on the resident roster
-- Run AFTER 0001–0044.
--
-- `block` becomes its own column (e.g. 'E'); `flat` now holds just the unit
-- number (e.g. '004'). Floor is still derived as the first digit of the flat.
-- ════════════════════════════════════════════════════════════════════

alter table public.directory_entries add column if not exists block text;
