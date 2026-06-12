-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0056: signup phone lookup also reports an existing account
-- Run AFTER 0001–0055.
--
-- Extends find_resident_by_phone (0052) so the sign-up screen can distinguish:
--   • the number already belongs to an ONBOARDED member  → ask them to sign in
--   • the number is in the roster but NOT onboarded yet   → pre-fill + continue
-- Adds an `already_onboarded` flag; a profile match takes priority over a roster
-- match (an onboarded member's roster entry may have been merged away).
-- ════════════════════════════════════════════════════════════════════

-- The return signature changed (added already_onboarded), and Postgres won't let
-- CREATE OR REPLACE change a function's OUT columns — so drop the old one first.
drop function if exists public.find_resident_by_phone(text);

create or replace function public.find_resident_by_phone(p_phone text)
returns table (
  entry_id          uuid,
  community_id      uuid,
  community_name    text,
  res_name          text,
  block             text,
  flat              text,
  resident_type     text,
  profession        text,
  vehicle_no        text,
  already_onboarded boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare v_digits text := regexp_replace(p_phone, '[^0-9]', '', 'g');
begin
  if length(v_digits) < 10 then return; end if;

  -- 1) Already has an Aangan account? (an onboarded profile) — they should sign in.
  return query
    select null::uuid, p.community_id, c.name, p.name,
           null::text, p.flat, p.resident_type, p.profession, p.vehicle_no, true
    from public.profiles p
    join public.communities c on c.id = p.community_id
    where p.phone = v_digits
    limit 1;
  if found then return; end if;

  -- 2) In the roster but not onboarded yet → return details for autofill.
  return query
    select de.id, de.community_id, c.name, de.name,
           de.block, de.flat, de.resident_type, de.profession, de.vehicle_no, false
    from public.directory_entries de
    join public.communities c on c.id = de.community_id
    where de.phone = v_digits
    limit 1;
end;
$$;

grant execute on function public.find_resident_by_phone(text) to anon, authenticated;
