-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0110: a cancelled order tells the other side
-- Run AFTER 0001–0109. Safe to re-run.
--
-- on_order_change announced a cancellation only when `cancelled_by = 'chef'`,
-- and then it told the buyer. Two of the three ways an order dies were silent:
--
--   • The buyer self-cancels (cancel_order writes 'orderer'). The chef is
--     never told. They buy the ingredients and cook a plate for somebody who
--     is not coming — the one message in this whole feature that costs real
--     money to miss.
--   • expire_stale_orders writes 'system'. It inserts its own inbox row, so
--     the buyer sees it eventually, but no push goes out and the two code
--     paths had to be kept in step by hand.
--
-- One rule now, in one place: whoever did not do it, hears about it. The
-- expiry function stops writing its own notice and lets the trigger speak.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_order_change()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_chef uuid;
  v_dish text;
  v_comm uuid;
  v_body text;
begin
  select d.chef_user_id, d.dish_name, d.community_id into v_chef, v_dish, v_comm
    from public.dishes d where d.id = NEW.dish_id;

  if TG_OP = 'INSERT' then
    perform public.notify_user(
      v_chef, 'New order 🛎️',
      coalesce(NEW.buyer_name, 'Someone') || ' ordered ' || NEW.qty || ' × ' || coalesce(v_dish, 'your dish'),
      '/food'
    );
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_comm, 'order', NEW.dish_id, NEW.orderer_user_id, v_chef, 'New order 🛎️',
            coalesce(NEW.buyer_name, 'Someone') || ' ordered ' || NEW.qty || ' × ' || coalesce(v_dish, 'your dish'), '/food');

  elsif TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then

    -- The buyer pulled out. The chef is the one who needs to know, and needs
    -- to know before they start cooking.
    if NEW.status = 'cancelled' and coalesce(NEW.cancelled_by, '') = 'orderer' then
      v_body := coalesce(NEW.buyer_name, 'A neighbour') || ' cancelled their order of '
                || NEW.qty || ' × ' || coalesce(v_dish, 'your dish');
      perform public.notify_user(v_chef, 'Order cancelled', v_body, '/food');
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (v_comm, 'order', NEW.dish_id, NEW.orderer_user_id, v_chef, 'Order cancelled', v_body, '/food');

    elsif NEW.status in ('accepted', 'rejected', 'cooking', 'delivered')
       or NEW.status = 'cancelled' then
      v_body := case
        when NEW.status = 'accepted'  then 'Your order for ' || coalesce(v_dish, 'a dish') || ' is confirmed ✅'
        when NEW.status = 'rejected'  then 'Your order for ' || coalesce(v_dish, 'a dish') || ' was declined'
        when NEW.status = 'cooking'   then coalesce(v_dish, 'Your dish') || ' is cooking now 🍳'
        when NEW.status = 'delivered' then coalesce(v_dish, 'Your dish') || ' is delivered — enjoy! 🍽️'
        when NEW.cancelled_by = 'system'
          then 'Your order for ' || coalesce(v_dish, 'a dish') || ' was never confirmed, so it has been cancelled'
        else 'Your order for ' || coalesce(v_dish, 'a dish') || ' was cancelled'
      end;
      perform public.notify_user(NEW.orderer_user_id, 'Order update', v_body, '/food');
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (v_comm, 'order', NEW.dish_id, v_chef, NEW.orderer_user_id, 'Order update', v_body, '/food');
    end if;
  end if;
  return NEW;
end;
$fn$;

-- The expiry sweep no longer writes its own notice: the trigger above now
-- covers 'system' cancellations, with a push the hand-written insert never had.
create or replace function public.expire_stale_orders()
returns integer language plpgsql security definer set search_path = public as $fn$
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

    n := n + 1;
  end loop;
  return n;
end; $fn$;
