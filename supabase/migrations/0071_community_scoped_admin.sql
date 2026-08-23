-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0071: community-scoped admin authority
-- Run AFTER 0070.
--
-- WHY: every admin check in our RLS is `public.is_admin(auth.uid())`, which is
-- true if the caller has 'admin' ANYWHERE — it is NOT scoped to the community
-- of the row being touched. On a multi-tenant install that lets an admin of
-- society A edit/delete/read rows belonging to society B. This migration
-- introduces `public.is_admin_of(community_id)` (admin AND same community) and
-- swaps it into every RLS policy whose table has a DIRECT `community_id` column.
--
-- Child tables (post_comments, orders, subscriptions, listing_messages,
-- property_messages, property_referrals, reco_answers, borrow_requests,
-- sport_group_members, sport_tournaments, court_session_players, inquiries) are
-- reachable only via a community-scoped parent; scoping them needs a join and is
-- deferred to a later migration — they are LEFT UNCHANGED here (see the residual
-- list in the accompanying report). `communities` (scoped by its own `id`, no
-- `community_id` column) and `storage.objects` are likewise unchanged.
--
-- Also included: a set of contained hardening fixes (see sections D1–D5).
--
-- Everything is idempotent (drop policy if exists / create or replace function).
-- No existing migration file is modified.
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- A. Helper: admin OF a specific community
--    Mirrors how public.is_admin reads roles ('admin' = any(roles)); adds the
--    community equality so authority is tenant-scoped.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.is_admin_of(p_community uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and community_id = p_community
      and 'admin' = any(coalesce(roles, '{}'))
  );
$$;
-- Callable by the same roles as public.is_admin (0003): RLS policy expressions
-- run with the querying role's privileges, so authenticated/anon MUST be able to
-- execute this or every swapped policy would raise "permission denied".
grant execute on function public.is_admin_of(uuid) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- B. Swap is_admin(auth.uid()) → is_admin_of(community_id) on every policy
--    whose table has a DIRECT community_id column.
--    Each policy below is byte-identical to its LATEST prior definition
--    except for that single substitution.
-- ════════════════════════════════════════════════════════════════════

-- ── dishes (0001 create; 0003 update/delete; 0038 read) ──────────────
drop policy if exists dishes_read on public.dishes;
create policy dishes_read on public.dishes for select using (
  public.is_my_community(community_id) or public.is_admin_of(community_id)
);

drop policy if exists dishes_update on public.dishes;
create policy dishes_update on public.dishes
  for update using (auth.uid() = chef_user_id or public.is_admin_of(community_id));

drop policy if exists dishes_delete on public.dishes;
create policy dishes_delete on public.dishes
  for delete using (auth.uid() = chef_user_id or public.is_admin_of(community_id));

-- ── tiffin_plans (0007) ──────────────────────────────────────────────
drop policy if exists tiffin_plans_update on public.tiffin_plans;
create policy tiffin_plans_update on public.tiffin_plans
  for update using (auth.uid() = chef_user_id or public.is_admin_of(community_id));

drop policy if exists tiffin_plans_delete on public.tiffin_plans;
create policy tiffin_plans_delete on public.tiffin_plans
  for delete using (auth.uid() = chef_user_id or public.is_admin_of(community_id));

-- ── listings (0010) ──────────────────────────────────────────────────
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings
  for update using (auth.uid() = owner_user_id or public.is_admin_of(community_id));

drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings
  for delete using (auth.uid() = owner_user_id or public.is_admin_of(community_id));

-- ── posts (LATEST: 0017 posts_update_own_or_admin / posts_delete_own_or_admin) ──
drop policy if exists "posts_update_own_or_admin" on public.posts;
create policy "posts_update_own_or_admin" on public.posts
  for update using (
    author_id = auth.uid()
    or public.is_admin_of(community_id)
  );

drop policy if exists "posts_delete_own_or_admin" on public.posts;
create policy "posts_delete_own_or_admin" on public.posts
  for delete using (
    author_id = auth.uid()
    or public.is_admin_of(community_id)
  );

-- ── emergency_contacts (0019) ────────────────────────────────────────
drop policy if exists "ec_admin_all" on public.emergency_contacts;
create policy "ec_admin_all" on public.emergency_contacts
  for all using (public.is_admin_of(community_id))
  with check (
    community_id in (
      select community_id from public.profiles where id = auth.uid()
    )
  );

-- ── polls (0020) ─────────────────────────────────────────────────────
drop policy if exists "polls_manage" on public.polls;
create policy "polls_manage" on public.polls
  for update using (author_id = auth.uid() or public.is_admin_of(community_id));

drop policy if exists "polls_delete" on public.polls;
create policy "polls_delete" on public.polls
  for delete using (author_id = auth.uid() or public.is_admin_of(community_id));

-- ── directory_entries (0029) ─────────────────────────────────────────
drop policy if exists directory_entries_update on public.directory_entries;
create policy directory_entries_update on public.directory_entries
  for update using (added_by = auth.uid() or public.is_admin_of(community_id));

drop policy if exists directory_entries_delete on public.directory_entries;
create policy directory_entries_delete on public.directory_entries
  for delete using (added_by = auth.uid() or public.is_admin_of(community_id));

-- ── sport_groups (LATEST: 0057) ──────────────────────────────────────
drop policy if exists sg_update on public.sport_groups;
create policy sg_update on public.sport_groups for update
  using (public.is_group_owner(id) or public.is_group_captain(id) or public.is_admin_of(community_id));

drop policy if exists sg_delete on public.sport_groups;
create policy sg_delete on public.sport_groups for delete
  using (public.is_group_owner(id) or public.is_group_captain(id) or public.is_admin_of(community_id));

-- ── payments (0034) ──────────────────────────────────────────────────
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (payer_id = auth.uid() or payee_id = auth.uid() or public.is_admin_of(community_id));

-- ── property_listings (0036; property_update also gains WITH CHECK, see D3) ──
drop policy if exists property_read on public.property_listings;
create policy property_read on public.property_listings for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists property_update on public.property_listings;
create policy property_update on public.property_listings for update
  using (owner_user_id = auth.uid() or public.is_admin_of(community_id))
  with check (owner_user_id = auth.uid() or public.is_admin_of(community_id));

drop policy if exists property_delete on public.property_listings;
create policy property_delete on public.property_listings for delete
  using (owner_user_id = auth.uid() or public.is_admin_of(community_id));

-- ── reco_questions (0037 read/delete; 0062 update) ───────────────────
drop policy if exists reco_q_read on public.reco_questions;
create policy reco_q_read on public.reco_questions for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists reco_q_update on public.reco_questions;
create policy reco_q_update on public.reco_questions for update
  using (author_id = auth.uid() or public.is_admin_of(community_id));

drop policy if exists reco_q_delete on public.reco_questions;
create policy reco_q_delete on public.reco_questions for delete
  using (author_id = auth.uid() or public.is_admin_of(community_id));

-- ── lend_items (0037; lend_update also gains WITH CHECK, see D3) ──────
drop policy if exists lend_read on public.lend_items;
create policy lend_read on public.lend_items for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists lend_update on public.lend_items;
create policy lend_update on public.lend_items for update
  using (owner_user_id = auth.uid() or public.is_admin_of(community_id))
  with check (owner_user_id = auth.uid() or public.is_admin_of(community_id));

drop policy if exists lend_delete on public.lend_items;
create policy lend_delete on public.lend_items for delete
  using (owner_user_id = auth.uid() or public.is_admin_of(community_id));

-- ── court_bookings (0043) ────────────────────────────────────────────
drop policy if exists cb_update on public.court_bookings;
create policy cb_update on public.court_bookings for update
  using (booker_user_id = auth.uid() or public.is_admin_of(community_id));

drop policy if exists cb_delete on public.court_bookings;
create policy cb_delete on public.court_bookings for delete
  using (booker_user_id = auth.uid() or public.is_admin_of(community_id));

-- ── court_sessions (0043) ────────────────────────────────────────────
drop policy if exists cs_update on public.court_sessions;
create policy cs_update on public.court_sessions for update using (
  public.court_session_is_booker(id) or public.is_admin_of(community_id)
);

drop policy if exists cs_delete on public.court_sessions;
create policy cs_delete on public.court_sessions for delete using (
  public.court_session_is_booker(id) or public.is_admin_of(community_id)
);

-- ── court_payments (0043) ────────────────────────────────────────────
drop policy if exists cp_read on public.court_payments;
create policy cp_read on public.court_payments for select using (
  payer_user_id = auth.uid() or payee_user_id = auth.uid() or public.is_admin_of(community_id)
);

-- ── places (0060; places_update also gains WITH CHECK, see D3) ───────
drop policy if exists places_read on public.places;
create policy places_read on public.places for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists places_update on public.places;
create policy places_update on public.places for update
  using (created_by = auth.uid() or public.is_admin_of(community_id))
  with check (created_by = auth.uid() or public.is_admin_of(community_id));

drop policy if exists places_delete on public.places;
create policy places_delete on public.places for delete
  using (created_by = auth.uid() or public.is_admin_of(community_id));

-- ── documents (LATEST update: 0062) ──────────────────────────────────
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update
  using (owner_id = auth.uid() or public.is_admin_of(community_id));

-- ── lost_found_items (LATEST: 0067; lf_update also gains WITH CHECK, see D3) ──
drop policy if exists lf_read on public.lost_found_items;
create policy lf_read on public.lost_found_items for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists lf_update on public.lost_found_items;
create policy lf_update on public.lost_found_items for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin_of(community_id))
  with check (owner_user_id = auth.uid() or public.is_admin_of(community_id));

drop policy if exists lf_delete on public.lost_found_items;
create policy lf_delete on public.lost_found_items for delete to authenticated
  using (owner_user_id = auth.uid() or public.is_admin_of(community_id));

-- ── content_reports (0068 read; 0070 update) ─────────────────────────
drop policy if exists cr_read on public.content_reports;
create policy cr_read on public.content_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (public.is_admin_of(community_id) and public.is_my_community(community_id))
  );

drop policy if exists cr_update on public.content_reports;
create policy cr_update on public.content_reports for update to authenticated
  using (
    (public.is_admin_of(community_id) and public.is_my_community(community_id))
    or reporter_id = auth.uid()
  )
  with check (
    (public.is_admin_of(community_id) and public.is_my_community(community_id))
    or (reporter_id = auth.uid() and public.is_my_community(community_id))
  );

-- ── society_events (0069) ────────────────────────────────────────────
drop policy if exists ev_read on public.society_events;
create policy ev_read on public.society_events for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

-- ── event_contributions (0069 read; ec_update gains WITH CHECK, see D3) ──
drop policy if exists ec_read on public.event_contributions;
create policy ec_read on public.event_contributions for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists ec_update on public.event_contributions;
create policy ec_update on public.event_contributions for update to authenticated
  using (public.is_event_treasurer(event_id))
  with check (public.is_event_treasurer(event_id));

-- ── event_expenses (0069 read; ex_update gains WITH CHECK, see D3) ────
drop policy if exists ex_read on public.event_expenses;
create policy ex_read on public.event_expenses for select
  using (public.is_my_community(community_id) or public.is_admin_of(community_id));

drop policy if exists ex_update on public.event_expenses;
create policy ex_update on public.event_expenses for update to authenticated
  using (public.is_event_treasurer(event_id) or created_by = auth.uid())
  with check (public.is_event_treasurer(event_id) or created_by = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- D. Additional contained fixes
-- ════════════════════════════════════════════════════════════════════

-- ── D1. set_user_roles: add a same-community guard ───────────────────
-- 0003 only checked is_admin(auth.uid()) then updated ANY target — a cross-
-- tenant hole. Mirror admin_set_blocked (0025): compare caller's community_id
-- to the target's and refuse if different. Body/signature otherwise unchanged.
create or replace function public.set_user_roles(p_target uuid, p_roles text[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_comm     uuid;
  target_comm uuid;
begin
  if not public.is_admin(auth.uid()) then
    return false;
  end if;
  select community_id into my_comm     from public.profiles where id = auth.uid();
  select community_id into target_comm from public.profiles where id = p_target;
  if my_comm is null or my_comm is distinct from target_comm then return false; end if;
  update public.profiles set roles = p_roles where id = p_target;
  return found;
end;
$$;

-- ── D2. event_team.et_read: scope via parent society_events ──────────
-- 0069 shipped `using (true)`. event_team has no community_id; scope it through
-- its parent event (society_events.community_id).
drop policy if exists et_read on public.event_team;
create policy et_read on public.event_team for select to authenticated
  using (
    exists (
      select 1 from public.society_events e
       where e.id = event_id and public.is_my_community(e.community_id)
    )
  );

-- ── D3. WITH CHECK on owner-scoped UPDATE policies ───────────────────
-- Handled inline above (property_update, lend_update, places_update, lf_update,
-- ec_update, ex_update) — each WITH CHECK equals its (is_admin_of-swapped)
-- USING so an owner cannot reassign owner_user_id / community_id while keeping
-- identical semantics.

-- ── D4/D5. Harden SECURITY INVOKER helpers with search_path = public ─
-- Bodies reproduced exactly; only `set search_path = public` is added.
-- (Each of these was defined WITHOUT search_path.)

create or replace function public.is_my_community(p_community uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.community_id = p_community);
$$;

create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.sport_groups g where g.id = p_group and g.created_by = auth.uid());
$$;

create or replace function public.group_in_my_community(p_group uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.sport_groups g join public.profiles p on p.id = auth.uid()
    where g.id = p_group and g.community_id = p.community_id
  );
$$;

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.sport_group_members m where m.group_id = p_group and m.user_id = auth.uid());
$$;

create or replace function public.court_session_in_my_community(p_session uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.court_sessions s join public.profiles p on p.id = auth.uid()
    where s.id = p_session and s.community_id = p.community_id
  );
$$;

create or replace function public.court_session_is_booker(p_session uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from public.court_sessions s join public.court_bookings b on b.id = s.booking_id
    where s.id = p_session and b.booker_user_id = auth.uid()
  );
$$;
