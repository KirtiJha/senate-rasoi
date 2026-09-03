-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0106: flat_key compares numbers, not digit strings
-- Run AFTER 0001–0105. Safe to re-run.
--
-- 0087 matches a resident to their flat's contribution row by stripping every
-- non-digit from both sides and comparing the result as TEXT. That was written
-- against an assumption about how flats are typed, and the real data disagrees.
--
-- Profiles here hold 'B-026', 'D-019', 'A-233', '209'. Contributions hold
-- '4', '19', '209'. So:
--
--   'D-019'  →  '019'
--   '19'     →  '19'      and '019' <> '19'.
--
-- Five of thirty-one residents have a zero-padded flat, and for every one of
-- them is_my_flat_contribution returns false — so the opt-out screen built in
-- 0096 silently does nothing, and the resident cannot say they are not taking
-- part. It fails closed rather than loudly, which is why nothing surfaced it.
--
-- Comparing the NUMBER fixes it: 019 and 19 are the same flat, which is what a
-- person reading either of them would say. Text comparison was never the right
-- test; it only looked like one because the examples I checked had no leading
-- zeros.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.flat_key(p text)
returns text language sql immutable set search_path = public as $$
  -- Digits only, then leading zeros dropped, so '019', '19' and 'D-019' all
  -- become '19'. Null when there is no digit at all, so a blank flat never
  -- matches another blank flat.
  select nullif(ltrim(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '0'), '');
$$;
