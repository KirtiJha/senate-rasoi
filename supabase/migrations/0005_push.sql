-- ════════════════════════════════════════════════════════════════════
-- Senate Rasoi — migration 0005: free push notifications (Expo)
-- Run AFTER 0001–0004.
--
-- Stores each user's Expo push token, and fires an Expo push from a Postgres
-- trigger (via pg_net) whenever an order is created or its status changes.
-- No paid service, no edge function. Push only delivers on native builds
-- (iOS/Android) where a real Expo token exists; on web it's a harmless no-op.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_rw on public.push_tokens;
create policy push_tokens_rw on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Send an Expo push to every device a user has registered.
create or replace function public.notify_user(p_user uuid, p_title text, p_body text)
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
        'sound', 'default'
      )
    );
  end loop;
end;
$$;

-- On new order → notify the chef. On status change → notify the orderer.
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
      perform public.notify_user(NEW.orderer_user_id, 'Senate Rasoi',
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

drop trigger if exists trg_order_notify on public.orders;
create trigger trg_order_notify
  after insert or update on public.orders
  for each row execute function public.on_order_change();
