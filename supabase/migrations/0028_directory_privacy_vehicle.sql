-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0028: directory opt-out + vehicle number
-- Run AFTER 0001–0027.
--
-- show_in_directory: a resident can hide themselves from the Resident Directory
-- (default visible). vehicle_no: optional parking/vehicle identifier shown in
-- the directory.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists show_in_directory boolean not null default true,
  add column if not exists vehicle_no        text;
