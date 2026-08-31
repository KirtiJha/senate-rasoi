-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0092: a review a chef cannot delete
-- Run AFTER 0001–0091.
--
-- 0079 built kitchen reputation on the premise that it cannot be gamed: one
-- opinion per order, only after delivery, attached to the cook rather than the
-- dish. Two holes went straight through that.
--
-- 1. DELETING A DISH DELETED ITS REVIEWS. orders.dish_id cascades on delete,
--    and dish_feedback.order_id cascades again — so removing a dish erased
--    every order on it and every rating with them. A chef who got a "would not
--    order again" could raise their own percentage by deleting that dish, and
--    take other buyers' order history with it.
--
-- 2. A CHEF COULD ORDER AND REVIEW THEIR OWN FOOD. The app hides the button,
--    but place_order and leave_dish_feedback never checked, and a resident
--    holds a normal authenticated session — five self-orders and five self
--    "yes" answers is a five-star kitchen that has fed nobody.
--
-- Both are fixed in the database, because both were only ever prevented by
-- the client.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. A dish with history cannot be deleted ────────────────────────
--
-- Withdrawing an unsold dish is normal and stays instant. Once someone has
-- actually eaten, the record belongs to them as much as to the cook: their
-- order history, their rating, their payment. Closing it hides it from the
-- board without destroying any of that.
alter table public.dishes
  add column if not exists withdrawn_at timestamptz;

create or replace function public.guard_dish_delete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_orders int;
begin
  -- An admin clearing genuinely abusive content is not what this guards.
  if public.is_admin(auth.uid()) then
    return OLD;
  end if;

  select count(*) into v_orders
    from public.orders o
   where o.dish_id = OLD.id
     and o.status in ('accepted', 'cooking', 'delivered');

  if v_orders > 0 then
    raise exception
      'This dish has been ordered — withdraw it instead of deleting, so orders and reviews are kept.'
      using errcode = 'check_violation';
  end if;

  return OLD;
end; $$;

drop trigger if exists trg_guard_dish_delete on public.dishes;
create trigger trg_guard_dish_delete
  before delete on public.dishes
  for each row execute function public.guard_dish_delete();

-- Withdrawing: off the board, everything kept. plates_left goes to zero so no
-- query that filters on availability has to learn about the new column.
create or replace function public.withdraw_dish(p_dish uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_chef uuid;
begin
  select chef_user_id into v_chef from public.dishes where id = p_dish;
  if v_chef is null then return false; end if;
  if v_chef <> auth.uid() and not public.is_admin(auth.uid()) then
    return false;
  end if;

  update public.dishes
     set withdrawn_at = now(),
         plates_left  = 0
   where id = p_dish;

  return true;
end; $$;

revoke all on function public.withdraw_dish(uuid) from public;
grant execute on function public.withdraw_dish(uuid) to authenticated;

-- ─── 2. You cannot order, or rate, your own cooking ──────────────────
create or replace function public.guard_self_order() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_chef uuid;
begin
  select d.chef_user_id into v_chef from public.dishes d where d.id = NEW.dish_id;
  if v_chef is not null and v_chef = NEW.orderer_user_id then
    raise exception 'You cannot order your own dish.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_guard_self_order on public.orders;
create trigger trg_guard_self_order
  before insert on public.orders
  for each row execute function public.guard_self_order();

-- Belt and braces on the rating itself: even if an order predates the trigger
-- above, its own cook may not be the one answering for it.
create or replace function public.guard_self_review() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.chef_user_id = NEW.rater_id then
    raise exception 'You cannot review your own cooking.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_guard_self_review on public.dish_feedback;
create trigger trg_guard_self_review
  before insert or update on public.dish_feedback
  for each row execute function public.guard_self_review();

-- Any self-reviews already recorded are removed: they were counted in
-- chef_reputations and are exactly the figure this migration exists to protect.
delete from public.dish_feedback where chef_user_id = rater_id;
