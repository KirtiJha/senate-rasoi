-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0093: blocks that apply everywhere, taps that land
-- Run AFTER 0001–0092.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Blocking someone actually blocks them ────────────────────────
--
-- 0068 added a block check as a trigger on `dm_messages` and nowhere else. So
-- blocking a harassing neighbour stopped their direct messages and left them
-- free to post under any of your listings or flats, where you would still see
-- them and still be notified. 0068's own header cites app-store UGC policy as
-- the reason it exists; a block that covers one of three message surfaces does
-- not meet it.
--
-- Both threads are public within the society, so the rule is narrower than for
-- a DM: the block applies between the writer and the thread's owner, which is
-- the pairing that produces the harassment.

create or replace function public.on_listing_message_check_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select l.owner_user_id into v_owner
    from public.listings l where l.id = NEW.listing_id;

  if v_owner is not null and v_owner <> NEW.author_id and exists (
    select 1 from public.user_blocks
     where (blocker_id = NEW.author_id and blocked_id = v_owner)
        or (blocker_id = v_owner       and blocked_id = NEW.author_id)
  ) then
    raise exception 'This conversation is unavailable.'
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

drop trigger if exists listing_message_block_check on public.listing_messages;
create trigger listing_message_block_check
  before insert on public.listing_messages
  for each row execute function public.on_listing_message_check_block();

create or replace function public.on_property_message_check_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select p.owner_user_id into v_owner
    from public.property_listings p where p.id = NEW.property_id;

  if v_owner is not null and v_owner <> NEW.author_id and exists (
    select 1 from public.user_blocks
     where (blocker_id = NEW.author_id and blocked_id = v_owner)
        or (blocker_id = v_owner       and blocked_id = NEW.author_id)
  ) then
    raise exception 'This conversation is unavailable.'
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

drop trigger if exists property_message_block_check on public.property_messages;
create trigger property_message_block_check
  before insert on public.property_messages
  for each row execute function public.on_property_message_check_block();

-- ─── 2. Tapping a push takes you to the thing ────────────────────────
--
-- notify_user builds its Expo payload with no `data` key, and the app's tap
-- handler navigates only when `data.route` is present. Everything pushed
-- through the newer fan-out carries a route; the two that still push directly
-- — a new order or order update, and a direct message — did not. So tapping
-- "Priya sent you a message" dropped you wherever you last were, while a push
-- about a flat for rent deep-linked correctly.
--
-- Replaced rather than overloaded: a second three-argument form would make
-- every existing call ambiguous. The new argument defaults to null, so all
-- current callers keep working untouched.
drop function if exists public.notify_user(uuid, text, text);

create or replace function public.notify_user(
  p_user  uuid,
  p_title text,
  p_body  text,
  p_route text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  t record;
begin
  if p_user is null then return; end if;
  for t in select token from public.push_tokens where user_id = p_user loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'to', t.token,
        'title', p_title,
        'body', p_body,
        'sound', 'default',
        'data', jsonb_build_object('route', p_route)
      )
    );
  end loop;
end;
$$;

-- ─── 3. Orders and DMs pass their route ──────────────────────────────
-- Rewritten from 0057 and 0023 with the route added; the logic is otherwise
-- unchanged, including which transitions notify at all.
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
      coalesce(NEW.buyer_name, 'Someone') || ' ordered ' || NEW.qty || ' × ' || coalesce(v_dish, 'your dish'),
      '/food'
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
      perform public.notify_user(NEW.orderer_user_id, 'Order update', v_body, '/food');
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (v_comm, 'order', NEW.dish_id, v_chef, NEW.orderer_user_id, 'Order update', v_body, '/food');
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.on_dm_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_other  uuid;
  v_sender text;
begin
  -- Keep the thread preview and ordering in step. This is not incidental: the
  -- inbox list reads last_message / last_message_at, so dropping it would
  -- leave every conversation showing a stale line in the wrong order.
  update public.dm_threads
     set last_message = left(NEW.body, 120), last_message_at = now()
   where id = NEW.thread_id;

  select case when t.user_a = NEW.sender_id then t.user_b else t.user_a end
    into v_other
    from public.dm_threads t
   where t.id = NEW.thread_id;

  select coalesce(p.name, 'Someone') into v_sender
    from public.profiles p where p.id = NEW.sender_id;

  -- Only the route is new; title and body are unchanged from 0023.
  perform public.notify_user(
    v_other,
    v_sender || ' sent you a message',
    left(NEW.body, 100),
    '/messages/' || NEW.thread_id
  );
  return NEW;
end;
$$;
