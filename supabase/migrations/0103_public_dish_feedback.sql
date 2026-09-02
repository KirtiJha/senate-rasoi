-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0103: dish feedback becomes public to the society
-- Run AFTER 0001–0102. Safe to re-run.
--
-- 0079 kept feedback private: readable only by the rater and the chef, with
-- the note never surfaced at all and the aggregate hidden until five ratings
-- so nobody could be identified. The reasoning was sound, but the effect was
-- that a resident left feedback and it vanished — no screen ever read the note
-- back, not even for the chef it was written for.
--
-- Product decision: feedback is now PUBLIC to the society, attached to the
-- dish, showing who said it. A neighbour deciding whether to order should see
-- what other neighbours said, the same way they would ask in the lift.
--
-- What does NOT change: one order = one opinion (order_id is still the PK),
-- writes still go only through leave_dish_feedback, and you still cannot
-- review your own cooking (guard_self_review, 0092).
-- ════════════════════════════════════════════════════════════════════

-- ─── Read: anyone in the same society ────────────────────────────────
drop policy if exists dish_feedback_read on public.dish_feedback;

create policy dish_feedback_read on public.dish_feedback
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = dish_feedback.chef_user_id
        and public.is_my_community(p.community_id)
    )
  );

-- Feedback is read per dish, and the path from a dish to its feedback runs
-- through orders — which has no index for that direction.
create index if not exists dish_feedback_rater_idx on public.dish_feedback (rater_id);
create index if not exists orders_dish_idx         on public.orders        (dish_id);

-- ─── Every opinion on one dish ───────────────────────────────────────
create or replace function public.dish_feedback_for_dish(p_dish uuid)
returns table (
  order_id     uuid,
  rater_id     uuid,
  rater_name   text,
  rater_flat   text,
  would_repeat boolean,
  note         text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.order_id, f.rater_id, p.name, p.flat,
         f.would_repeat, f.note, f.created_at
    from public.dish_feedback f
    join public.orders   o on o.id = f.order_id
    join public.dishes   d on d.id = o.dish_id
    join public.profiles p on p.id = f.rater_id
   where o.dish_id = p_dish
     -- SECURITY DEFINER bypasses RLS, so the society check has to be here.
     and public.is_my_community(d.community_id)
   order by f.created_at desc;
$$;

revoke all on function public.dish_feedback_for_dish(uuid) from public;
grant execute on function public.dish_feedback_for_dish(uuid) to authenticated;

-- ─── Everything said about my cooking ────────────────────────────────
-- The chef's own view, across every dish they have cooked.
create or replace function public.chef_feedback()
returns table (
  order_id     uuid,
  dish_id      uuid,
  dish_name    text,
  rater_name   text,
  rater_flat   text,
  would_repeat boolean,
  note         text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.order_id, d.id, d.dish_name, p.name, p.flat,
         f.would_repeat, f.note, f.created_at
    from public.dish_feedback f
    join public.orders   o on o.id = f.order_id
    join public.dishes   d on d.id = o.dish_id
    join public.profiles p on p.id = f.rater_id
   where f.chef_user_id = auth.uid()
   order by f.created_at desc
   limit 100;
$$;

revoke all on function public.chef_feedback() from public;
grant execute on function public.chef_feedback() to authenticated;

-- ─── The badge shows from the first opinion ──────────────────────────
-- The five-rating threshold existed to protect anonymity. Feedback is now
-- attributed on the dish itself, so withholding the count protects nobody and
-- only hides a real signal from someone deciding what to order.
create or replace function public.chef_reputations(p_chefs uuid[])
returns table (chef_user_id uuid, total int, repeat_count int, enough boolean)
language sql
stable
security definer
set search_path = public
as $$
  select f.chef_user_id,
         count(*)::int,
         count(*) filter (where f.would_repeat)::int,
         count(*) >= 1
    from public.dish_feedback f
   where f.chef_user_id = any(p_chefs)
   group by f.chef_user_id;
$$;

revoke all on function public.chef_reputations(uuid[]) from public;
grant execute on function public.chef_reputations(uuid[]) to authenticated;
