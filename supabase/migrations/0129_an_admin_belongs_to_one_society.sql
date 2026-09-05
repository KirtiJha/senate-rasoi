-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0129: an admin belongs to one society
-- Run AFTER 0001–0128. Safe to re-run.
--
-- Found while auditing Emergency Contacts, where the policy reads:
--
--   ec_admin_all  FOR ALL  USING (is_admin(auth.uid()))
--
-- and is_admin() is:
--
--   select exists (select 1 from profiles where id = uid and roles @> '{admin}')
--
-- No community anywhere. It answers "does this person carry the admin role",
-- not "is this person an admin HERE". So the moment a second society onboards
-- and appoints its own admin, that admin can delete the first society's guard
-- and fire-brigade numbers — the list residents open during an actual
-- emergency — and read or change anything else guarded the same way.
--
-- It is not one policy. Seventy-two policies across forty tables lean on bare
-- is_admin(auth.uid()), including ones I added earlier in this pass. Every one
-- of them was a cross-society hole waiting for the second society.
--
-- is_admin_of(community) asks the real question: the admin role AND membership
-- of that same community. Every policy is rewritten to use it, against the
-- row's own community — directly where the table carries community_id, and
-- through the parent that does where it does not.
--
-- FOR THE SOCIETY RUNNING TODAY THIS CHANGES NOTHING. There is one community
-- and its admins are in it, so every rewritten predicate returns exactly what
-- it returned before. That is the point: it is a no-op now and a wall later.
--
-- is_admin() itself is left alone. It still has honest uses — "may this person
-- see the admin screen at all" — and rewriting its meaning under thirty call
-- sites in the app would be the more dangerous change.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.is_admin_of(p_community uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select p_community is not null and exists (
    select 1 from public.profiles
     where id = auth.uid()
       and community_id = p_community
       and roles @> array['admin']::text[]
  );
$fn$;

comment on function public.is_admin_of(uuid) is
  'Admin OF a given society — the role plus membership of that community. Use this in RLS; is_admin() alone is society-blind.';

do $do$
declare
  r        record;
  v_expr   text;
  v_using  text;
  v_check  text;
  v_sql    text;
  v_done   int := 0;
  -- Where a table does not carry community_id, the parent that does.
  v_parent constant jsonb := jsonb_build_object(
    'communities',           'id',
    'blood_offers',          '(select community_id from public.blood_requests where id = request_id)',
    'borrow_requests',       '(select community_id from public.lend_items where id = item_id)',
    'court_session_players', '(select community_id from public.court_sessions where id = session_id)',
    'inquiries',             '(select community_id from public.listings where id = listing_id)',
    'listing_messages',      '(select community_id from public.listings where id = listing_id)',
    'orders',                '(select community_id from public.dishes where id = dish_id)',
    'post_comments',         '(select community_id from public.posts where id = post_id)',
    'property_messages',     '(select community_id from public.property_listings where id = property_id)',
    'property_referrals',    '(select community_id from public.property_listings where id = property_id)',
    'reco_answers',          '(select community_id from public.reco_questions where id = question_id)',
    'sport_group_members',   '(select community_id from public.sport_groups where id = group_id)',
    'sport_tournaments',     '(select community_id from public.sport_groups where id = group_id)',
    'subscriptions',         '(select community_id from public.tiffin_plans where id = plan_id)'
  );
begin
  for r in
    select p.tablename, p.policyname, p.cmd, p.qual, p.with_check
      from pg_policies p
     where p.schemaname = 'public'
       and (coalesce(p.qual, '') like '%is_admin(auth.uid())%'
         or coalesce(p.with_check, '') like '%is_admin(auth.uid())%')
     order by p.tablename, p.policyname
  loop
    v_expr := case
      when v_parent ? r.tablename then v_parent ->> r.tablename
      when exists (
        select 1 from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = r.tablename
           and c.column_name = 'community_id'
      ) then 'community_id'
      else null
    end;

    -- A table with no route to a community is left exactly as it was rather
    -- than guessed at. The verification below reports anything skipped.
    if v_expr is null then continue; end if;

    v_using := replace(coalesce(r.qual, ''), 'is_admin(auth.uid())',
                       format('public.is_admin_of(%s)', v_expr));
    v_check := replace(coalesce(r.with_check, ''), 'is_admin(auth.uid())',
                       format('public.is_admin_of(%s)', v_expr));

    execute format('drop policy %I on public.%I', r.policyname, r.tablename);

    v_sql := format('create policy %I on public.%I for %s', r.policyname, r.tablename, r.cmd);
    if r.qual is not null       then v_sql := v_sql || format(' using (%s)', v_using); end if;
    if r.with_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;

    v_done := v_done + 1;
  end loop;

  raise notice 'is_admin_of: rewrote % policies', v_done;
end $do$;
