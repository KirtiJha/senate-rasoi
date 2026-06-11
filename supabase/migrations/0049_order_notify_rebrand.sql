-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0049: fix stale "Senate Rasoi" brand in order pushes
-- Run AFTER 0001–0048.
--
-- The order status-change push (0005) still titled itself "Senate Rasoi".
-- Re-create on_order_change() with a correct, informative title. Logic is
-- otherwise unchanged (chef gets "New order" on insert; orderer gets a status
-- update on accept/reject/cook/deliver/chef-cancel).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_order_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_chef uuid;
  v_dish text;
begin
  select d.chef_user_id, d.dish_name into v_chef, v_dish from public.dishes d where d.id = NEW.dish_id;

  if TG_OP = 'INSERT' then
    perform public.notify_user(
      v_chef, 'New order 🛎️',
      coalesce(NEW.buyer_name, 'Someone') || ' ordered ' || NEW.qty || ' × ' || coalesce(v_dish, 'your dish')
    );
  elsif TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    if NEW.status in ('accepted', 'rejected', 'cooking', 'delivered')
       or (NEW.status = 'cancelled' and NEW.cancelled_by = 'chef') then
      perform public.notify_user(NEW.orderer_user_id, 'Order update',
        case NEW.status
          when 'accepted'  then 'Your order for ' || coalesce(v_dish, 'a dish') || ' is confirmed ✅'
          when 'rejected'  then 'Your order for ' || coalesce(v_dish, 'a dish') || ' was declined'
          when 'cooking'   then coalesce(v_dish, 'Your dish') || ' is cooking now 🍳'
          when 'delivered' then coalesce(v_dish, 'Your dish') || ' is delivered — enjoy! 🍽️'
          when 'cancelled' then 'Your order for ' || coalesce(v_dish, 'a dish') || ' was cancelled'
        end);
    end if;
  end if;
  return NEW;
end;
$$;
