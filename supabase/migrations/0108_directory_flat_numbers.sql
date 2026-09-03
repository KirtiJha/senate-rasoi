-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0108: the roster stores flat numbers the same way
-- Run AFTER 0001–0107. Safe to re-run.
--
-- 0107 normalised profiles.flat to a bare, unpadded number. directory_entries
-- was left as typed, and 24 of its 133 rows are zero-padded ('019', '026').
--
-- That matters at exactly one moment, and it is the worst one: sign-up.
-- findRosterMatch looks for the new member's roster row with an exact
-- `flat = '19'`, so a neighbour whose row says '019' is never offered the merge
-- — they get a second listing in the directory instead, and the phone number
-- somebody already recorded for them is orphaned. The same padding also splits
-- the directory's block/flat grouping into '019' and '19' headers.
--
-- One shape everywhere: digits, no leading zeros.
-- ════════════════════════════════════════════════════════════════════

update public.directory_entries
   set flat = nullif(ltrim(regexp_replace(flat, '[^0-9]', '', 'g'), '0'), '')
 where flat is not null
   and (flat ~ '[^0-9]' or flat ~ '^0');

comment on column public.directory_entries.flat is
  'Flat NUMBER only, no block letter and no leading zeros — matches profiles.flat so a roster row and a new member resolve to the same home. See 0107/0108.';
