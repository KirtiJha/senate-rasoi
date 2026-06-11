-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0044: society-roster fields (for bulk resident import)
-- Run AFTER 0001–0043.
--
-- Extra columns on directory_entries for the admin's resident roster, plus a
-- free-text category on emergency_contacts for service providers (plumber,
-- electrician, …) so the society "useful numbers" list can be imported too.
-- ════════════════════════════════════════════════════════════════════

alter table public.directory_entries add column if not exists native              text;
alter table public.directory_entries add column if not exists alt_phone           text;
alter table public.directory_entries add column if not exists email               text;
alter table public.directory_entries add column if not exists registration_status text not null default 'pending'
  check (registration_status in ('pending', 'done'));
alter table public.directory_entries add column if not exists shifted             boolean not null default false;

-- Service-provider label (e.g. "Plumber", "Electrician", "Water tanker").
alter table public.emergency_contacts add column if not exists category text;
