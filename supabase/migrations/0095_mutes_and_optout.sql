-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0095: mutes that mute, and an opt-out that sticks
-- Run AFTER 0001–0094.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. The opt-out guard contradicted itself ────────────────────────
--
-- 0087/0088 let a resident set two things on their own flat's row: whether
-- they are taking part, and how many of them there are. The guard restores
-- every other column from OLD — including `amount`.
--
-- But opting out is supposed to zero the amount. Everywhere else in this
-- schema a flat that owes nothing must not sit in the shortfall inventing one,
-- and setContributionFacts zeroes it for exactly that reason. So the moment a
-- resident-facing opt-out screen calls it, the guard would silently put the
-- old amount back and leave a flat marked "not taking part" while still owing
-- money.
--
-- Zeroing on opt-out is therefore allowed. Setting any other amount is not:
-- what a flat owes is still the treasurer's to decide.
create or replace function public.contribution_self_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return NEW;
  end if;

  if public.is_event_treasurer(NEW.event_id) then
    return NEW;
  end if;

  NEW.flat            := OLD.flat;
  NEW.community_id    := OLD.community_id;
  NEW.event_id        := OLD.event_id;
  NEW.status          := OLD.status;
  NEW.method          := OLD.method;
  NEW.note            := OLD.note;
  NEW.receipt_url     := OLD.receipt_url;
  NEW.recorded_by     := OLD.recorded_by;
  NEW.received_at     := OLD.received_at;
  NEW.contributor_name := OLD.contributor_name;
  NEW.contributor_user_id := OLD.contributor_user_id;

  -- Opting out clears what is owed; opting back in restores nothing, because
  -- only the treasurer knows what the figure should become.
  if NEW.opted_out and not OLD.opted_out then
    NEW.amount := 0;
  else
    NEW.amount := OLD.amount;
  end if;

  return NEW;
end; $$;

-- ─── 2. Muting a category that is delivered per person ───────────────
--
-- The mute filter in on_notification_push only applies to broadcast rows
-- (target_user_id is null). That is right for a direct message or an order —
-- muting a category should quiet the society, not hide somebody talking to
-- you — but two categories are announcements that happen to be addressed
-- individually:
--
--   • court bookings, inserted one row per group member
--   • recommendation answers, addressed to the question's author
--
-- Both appear in the settings list with their own switch, and neither switch
-- did anything at all. The daily menu nudge already solved this by filtering
-- at insert time; doing it here fixes both without touching their triggers,
-- and any future category-that-is-targeted gets it for free.
create or replace function public.on_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_priority text;
  v_batch    jsonb;
  -- Addressed to one person, but still a category rather than a conversation.
  v_muteable_targeted boolean := NEW.type in ('court', 'recommend', 'event');
begin
  if NEW.type in ('order', 'message') then return NEW; end if;
  if NEW.target_user_id is null and NEW.type = 'post' then return NEW; end if;

  -- A targeted category notification the recipient has muted stops here.
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
$$;
