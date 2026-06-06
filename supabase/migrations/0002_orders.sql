-- ════════════════════════════════════════════════════════════════════
-- Senate Chef — migration 0002: order lifecycle + order-by deadline
-- Run this in the Supabase SQL editor AFTER 0001_init.sql.
--
-- Adds a real orders table so the loop no longer "leaks" into WhatsApp:
--   • Placing an order atomically RESERVES plates (no oversell) and records
--     a pending order. WhatsApp is still opened for the actual chat/payment.
--   • The chef can confirm / decline; declining/cancelling RESTORES the stock.
--   • Buyers keep their order id on-device and can poll its live status.
--   • Dishes gain an optional `order_by` deadline (order before cooking starts).
--
-- Security model (consistent with 0001): the orders table is NOT directly
-- readable/writable by clients. Everything goes through SECURITY DEFINER RPCs.
-- Chef actions are authorised by the same device-token hash used for delete.
-- ════════════════════════════════════════════════════════════════════

-- ── order-by deadline on dishes ─────────────────────────────────────
alter table public.dishes add column if not exists order_by timestamptz;

-- ── orders ──────────────────────────────────────────────────────────
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references public.dishes (id) on delete cascade,
  buyer_name  text not null,
  buyer_flat  text,
  qty         integer not null check (qty > 0),
  status      text not null default 'pending'
              check (status in ('pending', 'confirmed', 'ready', 'cancelled', 'declined')),
  created_at  timestamptz not null default now()
);

create index if not exists orders_dish_idx on public.orders (dish_id, created_at desc);

-- Lock the table down: no direct client access. RPCs (definer) do everything.
alter table public.orders enable row level security;
-- (intentionally no policies → all direct selects/writes denied)

-- ════════════════════════════════════════════════════════════════════
-- RPCs
-- ════════════════════════════════════════════════════════════════════

-- Place an order: reserve stock atomically + record a pending order.
-- Returns the new order id, or NULL if it couldn't be filled / ordering closed.
create or replace function public.place_order(
  p_dish_id uuid,
  p_qty integer,
  p_buyer_name text,
  p_buyer_flat text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left integer;
  v_order_by timestamptz;
  v_order_id uuid;
begin
  if p_qty is null or p_qty < 1 or coalesce(trim(p_buyer_name), '') = '' then
    return null;
  end if;

  select order_by into v_order_by from public.dishes where id = p_dish_id;
  if v_order_by is not null and now() > v_order_by then
    return null; -- ordering window has closed
  end if;

  update public.dishes
     set plates_left = plates_left - p_qty
   where id = p_dish_id
     and plates_left >= p_qty
  returning plates_left into v_left;

  if not found then
    return null; -- not enough plates / dish gone
  end if;

  insert into public.orders (dish_id, buyer_name, buyer_flat, qty, status)
  values (p_dish_id, trim(p_buyer_name), nullif(trim(p_buyer_flat), ''), p_qty, 'pending')
  returning id into v_order_id;

  return v_order_id;
end;
$$;

-- Chef changes an order's status. Authorised by the dish's owner token.
-- Cancelling/declining an active order restores the reserved plates.
create or replace function public.set_order_status(
  p_order_id uuid,
  p_token text,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_dish uuid;
  v_qty integer;
  v_old text;
begin
  if p_status not in ('pending', 'confirmed', 'ready', 'cancelled', 'declined') then
    return false;
  end if;

  select o.dish_id, o.qty, o.status into v_dish, v_qty, v_old
    from public.orders o
    join public.dishes d on d.id = o.dish_id
   where o.id = p_order_id
     and d.owner_token_hash = encode(digest(p_token, 'sha256'), 'hex');

  if not found then
    return false; -- not the owner, or no such order
  end if;

  update public.orders set status = p_status where id = p_order_id;

  if p_status in ('cancelled', 'declined') and v_old in ('pending', 'confirmed') then
    update public.dishes set plates_left = plates_left + v_qty where id = v_dish;
  elsif p_status in ('pending', 'confirmed') and v_old in ('cancelled', 'declined') then
    update public.dishes set plates_left = greatest(0, plates_left - v_qty) where id = v_dish;
  end if;

  return true;
end;
$$;

-- Buyer cancels their own order (they hold the order id locally).
create or replace function public.cancel_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dish uuid;
  v_qty integer;
  v_old text;
begin
  select dish_id, qty, status into v_dish, v_qty, v_old
    from public.orders where id = p_order_id;
  if not found then return false; end if;
  if v_old in ('cancelled', 'declined') then return true; end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  if v_old in ('pending', 'confirmed') then
    update public.dishes set plates_left = plates_left + v_qty where id = v_dish;
  end if;
  return true;
end;
$$;

-- Chef lists the orders for one of their dishes (owner-checked).
create or replace function public.list_chef_orders(p_dish_id uuid, p_token text)
returns setof public.orders
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.dishes d
     where d.id = p_dish_id
       and d.owner_token_hash = encode(digest(p_token, 'sha256'), 'hex')
  ) then
    return; -- not the owner → empty set
  end if;
  return query
    select * from public.orders o where o.dish_id = p_dish_id order by o.created_at desc;
end;
$$;

-- Buyer polls live status for the orders they placed (by id).
create or replace function public.get_order_statuses(p_ids uuid[])
returns table (id uuid, status text)
language sql
security definer
set search_path = public
as $$
  select id, status from public.orders where id = any (p_ids);
$$;

grant execute on function public.place_order(uuid, integer, text, text) to anon, authenticated;
grant execute on function public.set_order_status(uuid, text, text) to anon, authenticated;
grant execute on function public.cancel_order(uuid) to anon, authenticated;
grant execute on function public.list_chef_orders(uuid, text) to anon, authenticated;
grant execute on function public.get_order_statuses(uuid[]) to anon, authenticated;
