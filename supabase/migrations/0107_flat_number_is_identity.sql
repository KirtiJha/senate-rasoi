-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0107: the flat number is the identity; block is a label
-- Run AFTER 0001–0106. Safe to re-run.
--
-- Flat numbers are unique across this society, so the number alone identifies a
-- home. The block letter is decoration — and being decoration crammed into the
-- same free-text field as the identity, it drifted:
--
--   209 and E-209 are one home, typed by two people.
--   B-107 and E-107 are one home, with the block letter guessed differently.
--   D-019 and 19 are one home, one of them zero-padded.
--
-- Every downstream match then had to guess. 0087's flat_key compared digit
-- strings and failed on the padded ones (fixed in 0106); the directory parses
-- the block back out of the same string with a regex; and a resident editing
-- their profile could silently drop themselves out of their own block group.
--
-- So: the number moves to `flat` on its own, normalised without leading zeros,
-- and the block letter gets a column of its own where it is optional and
-- cannot corrupt the identity. directory_entries has worked this way since
-- 0029 — profiles are being brought into line with it, not the other way
-- round.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists block text;

-- Split what is already there. Runs once meaningfully: after it, `flat` holds
-- only digits, so the prefix match finds nothing to move on a re-run.
update public.profiles
   set block = nullif(upper(substring(flat from '^\s*([A-Za-z]+)')), ''),
       flat  = nullif(ltrim(regexp_replace(flat, '[^0-9]', '', 'g'), '0'), '')
 where flat is not null
   and (flat ~ '[^0-9]' or flat ~ '^0');

-- With `flat` now holding the bare number, flat_key is an identity function on
-- stored values rather than a repair function — kept as it is so anything
-- typed by hand later (a stray 'B-' prefix, a zero) still resolves.
comment on column public.profiles.flat is
  'Flat NUMBER only, no block letter and no leading zeros — the unique identity of a home in this society. See 0107.';
comment on column public.profiles.block is
  'Optional block/tower label. Display only: never used to identify a flat, because numbers are unique and block letters were entered inconsistently.';
