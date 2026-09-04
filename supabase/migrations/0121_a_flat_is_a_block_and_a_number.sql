-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0121: a flat is a block AND a number
-- Run AFTER 0001–0120. Safe to re-run.
--
-- CORRECTING 0106 AND 0107.
--
-- Those were built on a fact about ONE society. At DS Max Senate the flat
-- numbers happen to be unique across towers, so I made flat_key() throw the
-- block letter away and compare digits alone. That is fine there and wrong
-- everywhere else: A-101 and B-101 are two different homes in most societies,
-- and flat_key made them equal.
--
-- In is_my_flat_contribution that is not a display bug but an authorisation
-- one — the resident of B-101 could opt A-101 out of a collection, or change
-- what they owe. Aangan is about to be used by societies that number flats
-- per tower, so this had to be corrected before launch rather than after.
--
-- The model now fits both shapes without being configured:
--
--   • flat_addr(block, flat) is the address. Case, separators and leading
--     zeros are normalised away, so 'D-019', 'd 19' and (block D, flat 19)
--     all converge on 'D19' — while A101 and B101 stay apart.
--   • flat_key(flat) keeps its old meaning, the NUMBER alone, and is now only
--     a fallback.
--   • Two records match when their addresses match. When one side names no
--     block at all — a treasurer typing "19" on a collection sheet — the
--     number alone is accepted only if it can mean one home. Ambiguous fails
--     closed rather than guessing.
--
-- AND A FLAT IS A HOUSEHOLD. Several residents of one flat is normal: a
-- couple, an adult child, a tenant. "One home" is therefore decided by the
-- BLOCK, not by counting people — the first cut of this counted profiles and
-- would have locked every couple in the society out of their own row.
-- ════════════════════════════════════════════════════════════════════

-- Digits with leading zeros dropped, letters kept, separators removed.
-- Zeros are dropped wherever the number begins — at the start or after a
-- block letter — so 'D-019' and (block D, flat 19) reach the same string.
create or replace function public.flat_norm(p text)
returns text language sql immutable set search_path = public as $fn$
  select nullif(
    regexp_replace(
      upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')),
      '(^|[A-Z])0+([0-9])', '\1\2', 'g'
    ), '');
$fn$;

-- The full address. The block is prefixed only when the flat does not already
-- carry it, so (block 'D', flat 'D-19') does not become 'DD19'.
create or replace function public.flat_addr(p_block text, p_flat text)
returns text language sql immutable set search_path = public as $fn$
  select case
    when public.flat_norm(p_flat) is null then null
    when public.flat_norm(p_block) is null then public.flat_norm(p_flat)
    when public.flat_norm(p_flat) like public.flat_norm(p_block) || '%'
      then public.flat_norm(p_flat)
    else public.flat_norm(p_block) || public.flat_norm(p_flat)
  end;
$fn$;

-- Unchanged meaning, narrowed role: the number, for the ambiguity fallback.
create or replace function public.flat_key(p text)
returns text language sql immutable set search_path = public as $fn$
  select nullif(ltrim(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '0'), '');
$fn$;

-- Does this number name a single home here? Several residents of one flat is
-- normal and stays unambiguous; two different blocks using the same number is
-- not. A null block is "not stated", never a different building.
create or replace function public.flat_number_is_unique(p_community uuid, p_flat text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.flat_key(p_flat) is not null
     and coalesce((
       select count(distinct public.flat_norm(q.block))
         from public.profiles q
        where q.community_id = p_community
          and public.flat_key(q.flat) = public.flat_key(p_flat)
          and q.block is not null
     ), 0) <= 1;
$fn$;

comment on function public.flat_number_is_unique(uuid, text) is
  'Does this flat NUMBER name a single home in the community? Several residents of one flat is normal and stays unambiguous; two different blocks using the same number is not.';

create or replace function public.is_my_flat_contribution(p_row uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1
      from public.event_contributions ec
      join public.profiles p on p.id = auth.uid()
     where ec.id = p_row
       and p.community_id = ec.community_id
       and public.flat_addr(p.block, p.flat) is not null
       and (
         -- Both sides name the same address.
         public.flat_addr(p.block, p.flat) = public.flat_addr(null, ec.flat)
         or
         -- The sheet names only a number. Accept it when that number can only
         -- mean one home here; otherwise fail closed.
         (public.flat_norm(ec.flat) = public.flat_key(ec.flat)
          and public.flat_key(ec.flat) = public.flat_key(p.flat)
          and public.flat_number_is_unique(ec.community_id, ec.flat))
       )
  );
$fn$;
