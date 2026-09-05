-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0133: a society can say which blocks it has
-- Run AFTER 0001–0132. Safe to re-run.
--
-- Sign-up happens before there is a session, so the form cannot read profiles
-- to find out whether the society it is joining has towers. Without that it
-- cannot ask for the block — and a resident of a per-tower society arrives
-- with a flat number that names two homes. That is the fault 0121 corrected
-- everywhere except the one form where the number is first typed in.
--
-- This returns nothing but the block labels already in use: no names, no
-- numbers, nothing that is not painted on the buildings.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.community_blocks(p_community uuid)
returns text[] language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(distinct upper(btrim(block)) order by upper(btrim(block))), '{}')
    from public.profiles
   where community_id = p_community
     and block is not null and btrim(block) <> '';
$fn$;

comment on function public.community_blocks(uuid) is
  'Block labels in use in a society. Callable before sign-in so the sign-up form knows whether to ask for one.';

grant execute on function public.community_blocks(uuid) to anon, authenticated;
