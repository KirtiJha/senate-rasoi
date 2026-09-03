-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0104: tell the chef when someone subscribes
-- Run AFTER 0001–0103. Safe to re-run.
--
-- Every other transaction in the app announces itself. A one-off order writes
-- a notification to the chef (0005, 0057) and each status change writes one
-- back to the buyer. A tiffin subscription — the bigger commitment of the two,
-- a plate a day for a month — wrote nothing at all.
--
-- It looked like it worked because the client opened WhatsApp straight after
-- subscribing, so the chef found out by message. That made an outside app
-- load-bearing for an in-app transaction: a chef with no number on their
-- profile got a silent subscriber, and the client cannot fix that on its own.
--
-- Same rule as 0090: write the row into `notifications` and let 0066's fan-out
-- turn it into a push. Calling notify_user() directly sends a push with no
-- route and leaves no trace in the bell.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_subscription_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_chef  uuid;
  v_comm  uuid;
  v_title text;
  v_who   text;
  v_flat  text;
begin
  select p.chef_user_id, p.community_id, p.title
    into v_chef, v_comm, v_title
    from public.tiffin_plans p
   where p.id = NEW.plan_id;

  -- No chef to tell, or no society to scope the row to: nothing to do.
  if v_chef is null or v_comm is null then
    return NEW;
  end if;

  -- A chef subscribing to their own plan needs no announcement.
  if v_chef = NEW.subscriber_user_id then
    return NEW;
  end if;

  select coalesce(pr.name, 'Someone'), pr.flat
    into v_who, v_flat
    from public.profiles pr
   where pr.id = NEW.subscriber_user_id;

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (
    v_comm, 'tiffin', NEW.plan_id, NEW.subscriber_user_id, v_chef,
    'New tiffin subscriber 🍱',
    coalesce(v_who, 'Someone')
      || coalesce(' · Flat ' || v_flat, '')
      || ' subscribed to ' || coalesce(v_title, 'your tiffin')
      || ' — ' || NEW.qty || '/day from ' || to_char(NEW.start_date, 'DD Mon'),
    '/food'
  );

  return NEW;
end;
$$;

-- INSERT only, not UPDATE. subscribe() upserts on (plan_id, subscriber_user_id),
-- so someone changing their quantity or resuming a paused plan comes through as
-- an UPDATE — notifying on that would turn a pause/resume into a stream of
-- "new subscriber" alerts for a person the chef already serves.
drop trigger if exists trg_subscription_notify on public.subscriptions;
create trigger trg_subscription_notify
  after insert on public.subscriptions
  for each row execute function public.on_subscription_notify();
