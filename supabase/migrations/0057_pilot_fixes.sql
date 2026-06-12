-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0057: pilot end-to-end review fixes
-- Run AFTER 0001–0056.
--
--   1. PIN-reset functions couldn't find crypt()/gen_salt() — those live in the
--      `extensions` schema but the functions only set search_path = public, so
--      every PIN reset raised "function gen_salt does not exist". Add extensions.
--   2. Captains could see Edit/Delete-group + tournament controls, but the RLS
--      still only allowed the group owner/admin → silent failures. Extend to
--      captains (0055 covered members but not sport_groups / sport_tournaments).
--   3. Orders only sent an Expo push (dead on web) and never wrote an in-app
--      notification. Add notifications rows so the bell works for orders too.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. PIN reset: pgcrypto is in the extensions schema ──────────────
alter function public.self_reset_pin(text, text)        set search_path = public, extensions;
alter function public.admin_reset_user_pin(uuid, text)  set search_path = public, extensions;

-- ── 2. Let captains manage the group + tournaments (match the UI) ────
drop policy if exists sg_update on public.sport_groups;
create policy sg_update on public.sport_groups for update
  using (public.is_group_owner(id) or public.is_group_captain(id) or public.is_admin(auth.uid()));

drop policy if exists sg_delete on public.sport_groups;
create policy sg_delete on public.sport_groups for delete
  using (public.is_group_owner(id) or public.is_group_captain(id) or public.is_admin(auth.uid()));

drop policy if exists st_write on public.sport_tournaments;
create policy st_write on public.sport_tournaments for all
  using  (public.is_group_owner(group_id) or public.is_group_captain(group_id) or public.is_admin(auth.uid()))
  with check (public.is_group_owner(group_id) or public.is_group_captain(group_id) or public.is_admin(auth.uid()));

-- ── 3. Orders → in-app notifications (not just push) ────────────────
create or replace function public.on_order_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
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
      coalesce(NEW.buyer_name, 'Someone') || ' ordered ' || NEW.qty || ' × ' || coalesce(v_dish, 'your dish')
    );
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_comm, 'order', NEW.dish_id, NEW.orderer_user_id, v_chef, 'New order 🛎️',
            coalesce(NEW.buyer_name, 'Someone') || ' ordered ' || NEW.qty || ' × ' || coalesce(v_dish, 'your dish'), '/food');

  elsif TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    if NEW.status in ('accepted', 'rejected', 'cooking', 'delivered')
       or (NEW.status = 'cancelled' and NEW.cancelled_by = 'chef') then
      v_body := case NEW.status
        when 'accepted'  then 'Your order for ' || coalesce(v_dish, 'a dish') || ' is confirmed ✅'
        when 'rejected'  then 'Your order for ' || coalesce(v_dish, 'a dish') || ' was declined'
        when 'cooking'   then coalesce(v_dish, 'Your dish') || ' is cooking now 🍳'
        when 'delivered' then coalesce(v_dish, 'Your dish') || ' is delivered — enjoy! 🍽️'
        when 'cancelled' then 'Your order for ' || coalesce(v_dish, 'a dish') || ' was cancelled'
      end;
      perform public.notify_user(NEW.orderer_user_id, 'Order update', v_body);
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (v_comm, 'order', NEW.dish_id, v_chef, NEW.orderer_user_id, 'Order update', v_body, '/food');
    end if;
  end if;
  return NEW;
end;
$$;
