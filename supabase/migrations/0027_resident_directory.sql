-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0027: resident directory fields
-- Run AFTER 0001–0026.
--
-- Adds owner/tenant status + profession to profiles, powering the Resident
-- Directory (name · flat · owner/tenant · profession · contact). Reads use the
-- existing profiles RLS; the directory query scopes to the user's community.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists resident_type text check (resident_type in ('owner', 'tenant')),
  add column if not exists profession    text;
