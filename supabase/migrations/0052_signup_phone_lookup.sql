-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0052: phone-based resident lookup for signup autofill
-- Run AFTER 0001–0051.
--
-- During sign-up an unauthenticated user cannot query directory_entries (RLS
-- blocks them). This SECURITY DEFINER function lets a prospective member check
-- whether they are already in their society's roster — so their name, flat,
-- and other details can be pre-filled without retyping.
--
-- Security notes:
--   • Exact 10-digit normalised match only — no enumeration via prefix search.
--   • Returns only the fields needed for autofill (no alt_phone, email, etc.).
--   • Granted to `anon` intentionally: at sign-up time the user is not yet
--     authenticated and cannot pass auth.uid().
-- ════════════════════════════════════════════════════════════════════

create or replace function public.find_resident_by_phone(p_phone text)
returns table (
  entry_id       uuid,
  community_id   uuid,
  community_name text,
  res_name       text,
  block          text,
  flat           text,
  resident_type  text,
  profession     text,
  vehicle_no     text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    de.id              as entry_id,
    de.community_id,
    c.name             as community_name,
    de.name            as res_name,
    de.block,
    de.flat,
    de.resident_type,
    de.profession,
    de.vehicle_no
  from public.directory_entries de
  join public.communities c on c.id = de.community_id
  where de.phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
    and length(regexp_replace(p_phone, '[^0-9]', '', 'g')) >= 10
  limit 1;
$$;

grant execute on function public.find_resident_by_phone(text) to anon, authenticated;
