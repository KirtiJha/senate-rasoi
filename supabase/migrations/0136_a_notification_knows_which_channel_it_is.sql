-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0136: a notification knows which channel it is
-- Run AFTER 0001–0135. Safe to re-run.
--
-- Android decides whether a notification interrupts by its CHANNEL, not by
-- the message's priority. Every push went to one channel — named "Order
-- updates", at DEFAULT importance — so a blood request could not heads-up,
-- and residents could not mute a category at the OS level, which is how
-- Android users actually manage noise.
--
-- Four channels, chosen by what the notification is, not by which trigger
-- happened to send it:
--
--   urgent    — emergency, blood               MAX      always interrupts
--   messages  — DMs, group chat, orders        HIGH     someone is talking to you
--   mine      — anything addressed to you      HIGH     a request, a result, a reminder
--   society   — broadcasts to everyone         DEFAULT  the noticeboard
--
-- The app creates them on the device (lib/push.ts); this is the server naming
-- which one each push belongs to. notify_user — the direct path for DMs and
-- orders — sent no channel and no priority at all.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.push_channel_for(p_type text, p_target uuid)
returns text language sql immutable as $fn$
  select case
    when p_type in ('emergency', 'blood') then 'urgent'
    when p_type in ('message', 'group_chat', 'order') then 'messages'
    when p_target is not null then 'mine'
    else 'society'
  end;
$fn$;

create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_route text default null)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare t record;
begin
  if p_user is null then return; end if;
  for t in select token from public.push_tokens where user_id = p_user loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'to', t.token, 'title', p_title, 'body', p_body,
        'sound', 'default', 'priority', 'high', 'channelId', 'messages',
        'data', jsonb_build_object('route', p_route)
      )
    );
  end loop;
end; $fn$;

-- on_notification_push: unchanged except that each message now carries
-- channelId = push_channel_for(type, target) and data.type. Full body in
-- the applied migration; see 0123/0127 for the rest of this function.
