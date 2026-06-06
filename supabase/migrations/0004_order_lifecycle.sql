-- ════════════════════════════════════════════════════════════════════
-- Senate Rasoi — migration 0004: authenticated order lifecycle
-- Run AFTER 0001–0003.
--
-- Reworks orders from the device-token model to real users (auth.uid()), and
-- adds the full status flow:
--   placed → accepted → cooking → delivered      (happy path, chef-driven)
--   placed → rejected                            (chef declines)
--   placed/accepted → cancelled                  (orderer within 5 min, or chef anytime)
-- Stock is reserved at `placed` and restored on `rejected`/`cancelled`.
-- ════════════════════════════════════════════════════════════════════

-- ── orders: add user ownership + richer status ──────────────────────
alter table public.orders add column if not exists orderer_user_id uuid references public.profiles (id) on delete set null;
alter table public.orders add column if not exists cancelled_by text check (cancelled_by in ('orderer', 'chef'));
alter table public.orders add column if not exists status_updated_at timestamptz not null default now();

-- Expand the status set.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('placed', 'accepted', 'rejected', 'cooking', 'delivered', 'cancelled'));
alter table public.orders alter column status set default 'placed';

create index if not exists orders_orderer_idx on public.orders (orderer_user_id, created_at desc);

-- ── RLS: readable by the orderer, the dish's chef, or an admin ──────
-- (writes still go only through the SECURITY DEFINER RPCs below)
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select using (
    orderer_user_id = auth.uid()
    or exists (select 1 from public.dishes d where d.id = dish_id and d.chef_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );

-- Live updates for both sides.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ── replace old token/anon RPCs ─────────────────────────────────────
drop function if exists public.place_order(uuid, integer, text, text);
drop function if exists public.set_order_status(uuid, text, text);
drop function if exists public.cancel_order(uuid);
drop function if exists public.list_chef_orders(uuid, text);
drop function if exists public.get_order_statuses(uuid[]);

-- How long an orderer may self-cancel after placing.
create or replace function public.cancel_window() returns interval
  language sql immutable as $$ select interval '5 minutes' $$;

-- Place an order as the signed-in user: reserve stock + create a 'placed' order.
create or replace function public.place_order(p_dish_id uuid, p_qty integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_flat text;
  v_order_by timestamptz;
  v_left integer;
  v_id uuid;
begin
  if v_uid is null or p_qty is null or p_qty < 1 then
    return null;
  end if;

  select name, flat into v_name, v_flat from public.profiles where id = v_uid;
  if v_name is null then
    return null; -- no profile
  end if;

  select order_by into v_order_by from public.dishes where id = p_dish_id;
  if v_order_by is not null and now() > v_order_by then
    return null; -- ordering window closed
  end if;

  update public.dishes
     set plates_left = plates_left - p_qty
   where id = p_dish_id and plates_left >= p_qty
  returning plates_left into v_left;
  if not found then
    return null;
  end if;

  insert into public.orders (dish_id, orderer_user_id, buyer_name, buyer_flat, qty, status)
  values (p_dish_id, v_uid, v_name, v_flat, p_qty, 'placed')
  returning id into v_id;
  return v_id;
end;
$$;

-- Chef changes an order's status (must own the dish). Restores stock on
-- reject/cancel from an active state.
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dish uuid;
  v_qty integer;
  v_old text;
begin
  if p_status not in ('accepted', 'rejected', 'cooking', 'delivered', 'cancelled') then
    return false;
  end if;

  select o.dish_id, o.qty, o.status into v_dish, v_qty, v_old
    from public.orders o
    join public.dishes d on d.id = o.dish_id
   where o.id = p_order_id and d.chef_user_id = v_uid;
  if not found then
    return false; -- not the chef for this order
  end if;

  update public.orders
     set status = p_status,
         status_updated_at = now(),
         cancelled_by = case when p_status = 'cancelled' then 'chef' else cancelled_by end
   where id = p_order_id;

  if p_status in ('rejected', 'cancelled') and v_old in ('placed', 'accepted', 'cooking') then
    update public.dishes set plates_left = plates_left + v_qty where id = v_dish;
  end if;
  return true;
end;
$$;

-- Orderer cancels their own order — only within the cancel window and before cooking.
create or replace function public.cancel_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dish uuid;
  v_qty integer;
  v_old text;
  v_at timestamptz;
begin
  select dish_id, qty, status, created_at into v_dish, v_qty, v_old, v_at
    from public.orders where id = p_order_id and orderer_user_id = v_uid;
  if not found then return false; end if;
  if v_old not in ('placed', 'accepted') then return false; end if;
  if now() - v_at > public.cancel_window() then return false; end if;

  update public.orders
     set status = 'cancelled', status_updated_at = now(), cancelled_by = 'orderer'
   where id = p_order_id;
  update public.dishes set plates_left = plates_left + v_qty where id = v_dish;
  return true;
end;
$$;

grant execute on function public.cancel_window() to anon, authenticated;
grant execute on function public.place_order(uuid, integer) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
