-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0066: OS push for every meaningful notification
-- Run AFTER 0001–0065.
--
-- Until now only orders (0057), DMs (0023), listing inquiries (0011) and
-- listing messages (0021) fired a real Expo push. Every other event only wrote
-- an in-app `notifications` row for the bell — no push when the app is closed.
--
-- This adds ONE trigger on `notifications` that fans an Expo push to the right
-- devices for every row, so all future event types are covered automatically:
--   • targeted row (target_user_id set) → push that one user
--   • broadcast row (target_user_id null) → push every member of the community
--     except the actor (you don't get pinged for your own post)
--
-- Skips, to avoid double-push / noise:
--   • 'order' and 'message' — already pushed by their own triggers (0057 / 0023)
--   • broadcast 'post'      — regular feed chatter; announcements still push
--
-- Batched (≤100 messages per request, per Expo's limit) via the pg_net pipeline
-- from 0005. Only SECURITY DEFINER triggers insert into `notifications`, so this
-- can't be abused by clients.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;

-- Send one batch (≤100) of pre-built Expo push messages.
create or replace function public._expo_push(p_messages jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_messages is null or jsonb_array_length(p_messages) = 0 then return; end if;
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := p_messages
  );
end;
$$;

create or replace function public.on_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_priority text;
  v_batch    jsonb;
begin
  -- Already pushed by their own triggers → don't duplicate.
  if NEW.type in ('order', 'message') then return NEW; end if;
  -- Regular feed posts broadcast to everyone would be noise; announcements push.
  if NEW.target_user_id is null and NEW.type = 'post' then return NEW; end if;

  -- Urgent types wake the device; everything else is normal priority.
  v_priority := case
    when NEW.type in ('emergency', 'announcement', 'payment', 'court', 'property')
    then 'high' else 'default'
  end;

  -- Resolve recipient tokens, build messages, chunk into batches of 100, send.
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
        -- targeted: the single recipient
        (NEW.target_user_id is not null and pt.user_id = NEW.target_user_id)
        or
        -- broadcast: everyone in the community except the actor
        (NEW.target_user_id is null
         and pt.user_id is distinct from NEW.actor_id
         and exists (
           select 1 from public.profiles p
           where p.id = pt.user_id and p.community_id = NEW.community_id
         ))
    ) s
    group by grp
  loop
    perform public._expo_push(v_batch);
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notification_push on public.notifications;
create trigger trg_notification_push
  after insert on public.notifications
  for each row execute function public.on_notification_push();
