-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0117: one push per event, and mutes work again
-- Run AFTER 0001–0116. Safe to re-run.
--
-- MY MISTAKE, CORRECTED.
--
-- Inserting a row into `notifications` ALREADY sends the push. 0073 put a
-- trigger there that batches to Expo, deliberately skips 'order' and
-- 'message' (which have their own paths), and — crucially — drops the push
-- for anybody who muted that category.
--
-- Across 0111–0116 I added `perform notify_user(...)` NEXT TO those inserts,
-- on the belief that the bell row was silent. It was not. The result was two
-- pushes for every payment, court due, task assignment, ride request,
-- cancelled game, reminder and group message — and, because notify_user talks
-- to Expo directly, the second one ignored the recipient's mutes entirely. A
-- resident who had turned Sports notifications off still got buzzed.
--
-- This strips the redundant call back out of every function I touched. The
-- notification rows, the wording and the routes are unchanged; each one now
-- arrives once, and a muted category stays muted.
--
-- on_order_change and on_dm_message keep their notify_user calls: 'order' and
-- 'message' are exactly the two types the 0073 trigger ignores.
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  fn   text;
  src  text;
  next text;
begin
  foreach fn in array array[
    'on_payment_notify', 'payment_mark_received', 'payment_cancel',
    'on_court_payment_notify', 'court_payment_mark_paid',
    'on_event_task_assigned', 'on_event_task_update_notify',
    'on_activity_deleted', 'on_contribution_received',
    'on_ride_skip', 'on_ride_request', 'on_ride_standing', 'send_ride_reminders',
    'on_court_session_cancelled', 'notify_court_booking',
    'on_court_session_filled', 'send_court_reminders',
    'on_group_message'
  ]
  loop
    src  := pg_get_functiondef(('public.' || fn)::regproc);
    next := regexp_replace(src, 'perform public\.notify_user\([^;]*\);\s*', '', 'g');
    if next <> src then
      execute next;
    end if;
  end loop;
end $$;

-- Group chatter is addressed to one person but is still a category rather
-- than a conversation with them — so it belongs with the targeted types a
-- member is allowed to mute.
create or replace function public.on_notification_push()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_priority text;
  v_batch    jsonb;
  v_muteable_targeted boolean := NEW.type in ('court', 'recommend', 'event', 'group_chat');
begin
  if NEW.type in ('order', 'message') then return NEW; end if;
  if NEW.target_user_id is null and NEW.type = 'post' then return NEW; end if;

  if NEW.target_user_id is not null and v_muteable_targeted and exists (
    select 1 from public.notification_mutes nm
     where nm.user_id = NEW.target_user_id and nm.type = NEW.type
  ) then
    return NEW;
  end if;

  v_priority := case
    when NEW.type in ('emergency', 'announcement', 'payment', 'court', 'property')
    then 'high' else 'default'
  end;

  for v_batch in
    select jsonb_agg(msg)
    from (
      select jsonb_build_object(
               'to',        pt.token,
               'title',     NEW.title,
               'body',      coalesce(NEW.body, ''),
               'sound',     'default',
               'priority',  v_priority,
               'channelId', 'default',
               'data',      jsonb_build_object('route', NEW.route)
             ) as msg,
             (row_number() over () - 1) / 100 as grp
      from public.push_tokens pt
      where
        (NEW.target_user_id is not null and pt.user_id = NEW.target_user_id)
        or
        (NEW.target_user_id is null
         and pt.user_id is distinct from NEW.actor_id
         and exists (
           select 1 from public.profiles p
           where p.id = pt.user_id and p.community_id = NEW.community_id
         )
         and not exists (
           select 1 from public.notification_mutes nm
           where nm.user_id = pt.user_id and nm.type = NEW.type
         ))
    ) s
    group by grp
  loop
    perform public._expo_push(v_batch);
  end loop;

  return NEW;
end;
$fn$;
