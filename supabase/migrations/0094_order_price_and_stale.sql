-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0094: the price that was agreed, and orders that
--                          stop disappearing
-- Run AFTER 0001–0093.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. An order remembers what it cost ──────────────────────────────
--
-- `orders` stores no amount. Every total is recomputed live from the dish's
-- CURRENT price, in three separate places — the order sheet, the buyer's list,
-- and the pre-filled UPI payment amount. A chef editing the price after taking
-- orders silently changed what every existing buyer saw and was asked to pay,
-- and the only durable record of the agreed figure was a WhatsApp message.
--
-- The price is now stamped on the order at the moment it is placed. Nothing
-- can rewrite it afterwards.
alter table public.orders
  add column if not exists unit_price integer;

-- Existing rows take the dish's current price. That is not necessarily what
-- was agreed — nobody recorded it — but it is what every screen has been
-- showing them, so it changes nothing visible while stopping the drift here.
update public.orders o
   set unit_price = d.price
  from public.dishes d
 where d.id = o.dish_id
   and o.unit_price is null;

create or replace function public.stamp_order_price() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.unit_price is null then
    select d.price into NEW.unit_price from public.dishes d where d.id = NEW.dish_id;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_stamp_order_price on public.orders;
create trigger trg_stamp_order_price
  before insert on public.orders
  for each row execute function public.stamp_order_price();

-- Once stamped it is history, not a field.
create or replace function public.freeze_order_price() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if OLD.unit_price is not null and NEW.unit_price is distinct from OLD.unit_price then
    NEW.unit_price := OLD.unit_price;
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_freeze_order_price on public.orders;
create trigger trg_freeze_order_price
  before update on public.orders
  for each row execute function public.freeze_order_price();

-- ─── 2. Orders the chef can still reach ──────────────────────────────
--
-- The Kitchen tab lists dishes from a query filtered to serve_date >= today,
-- and reads orders only from those. So an order placed at 9pm that the chef
-- did not act on vanished from their screen at midnight — permanently, while
-- still holding a reserved plate, with the buyer past the five-minute
-- self-cancel window and stuck on "waiting for chef".
--
-- This returns every order still awaiting the chef, whatever the dish's date.
create or replace function public.chef_open_orders()
returns table (
  order_id    uuid,
  dish_id     uuid,
  dish_name   text,
  serve_date  date,
  buyer_name  text,
  buyer_flat  text,
  qty         integer,
  unit_price  integer,
  status      text,
  created_at  timestamptz
)
language sql stable security definer set search_path = public as $$
  select o.id, d.id, d.dish_name, d.serve_date,
         o.buyer_name, o.buyer_flat, o.qty,
         coalesce(o.unit_price, d.price), o.status, o.created_at
    from public.orders o
    join public.dishes d on d.id = o.dish_id
   where d.chef_user_id = auth.uid()
     and o.status in ('placed', 'accepted', 'cooking')
   order by d.serve_date desc, o.created_at desc;
$$;

revoke all on function public.chef_open_orders() from public;
grant execute on function public.chef_open_orders() to authenticated;

-- ─── 3. A plate is not held forever ──────────────────────────────────
--
-- Even with the chef able to see it, an order nobody ever answers should not
-- keep a plate reserved indefinitely. Anything still 'placed' a full day after
-- its serve date is expired and its stock returned — the meal has been and
-- gone, and the buyer was never going to get it.
--
-- Only 'placed' is swept. An accepted or cooking order represents a real
-- agreement between two people and is theirs to resolve.
-- cancelled_by only allowed 'orderer' or 'chef'; the sweep is neither, and
-- recording it as one of them would put a cancellation in somebody's name
-- that they did not make.
alter table public.orders drop constraint if exists orders_cancelled_by_check;
alter table public.orders
  add constraint orders_cancelled_by_check
  check (cancelled_by is null or cancelled_by in ('orderer', 'chef', 'system'));

create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  r record;
begin
  for r in
    select o.id, o.dish_id, o.qty
      from public.orders o
      join public.dishes d on d.id = o.dish_id
     where o.status = 'placed'
       and d.serve_date < current_date - 1
  loop
    update public.orders
       set status = 'cancelled', cancelled_by = 'system', status_updated_at = now()
     where id = r.id;

    update public.dishes
       set plates_left = plates_left + r.qty
     where id = r.dish_id;

    -- The buyer has been staring at "waiting for chef" since the meal passed.
    -- on_order_change only announces chef cancellations, so say it here.
    insert into public.notifications
      (community_id, type, entity_id, target_user_id, title, body, route)
    select d.community_id, 'order', d.id, o.orderer_user_id,
           'Order expired',
           'Your order for ' || d.dish_name || ' was never confirmed, so it has been cancelled.',
           '/food'
      from public.orders o join public.dishes d on d.id = o.dish_id
     where o.id = r.id and o.orderer_user_id is not null;

    n := n + 1;
  end loop;
  return n;
end; $$;

revoke all on function public.expire_stale_orders() from public;

create extension if not exists pg_cron;

select cron.unschedule('aangan-expire-stale-orders')
  where exists (select 1 from cron.job where jobname = 'aangan-expire-stale-orders');

-- 20:00 UTC = 01:30 IST, well clear of the nightly dish materialisation.
select cron.schedule(
  'aangan-expire-stale-orders',
  '0 20 * * *',
  $cron$ select public.expire_stale_orders(); $cron$
);
