-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0073: per-resident notification preferences
-- Run AFTER 0001–0072.
--
-- 0066 fans every broadcast notification to every member of the society: a new
-- listing, a new dish, a new poll, a new document, a new sport group. A
-- resident who wants notices but not marketplace chatter has exactly one
-- escape — turning Aangan's notifications off at the OS level — which is the
-- step immediately before uninstalling.
--
-- This adds an opt-OUT table. Absent row means "send it", so behaviour is
-- unchanged for everyone until they choose otherwise, and no backfill is
-- needed for existing residents.
--
-- DIRECT notifications are deliberately NOT mutable here: a direct message, an
-- order on your dish, a reply to your listing, or an emergency broadcast is
-- addressed to you personally. Muting a category should quiet the society's
-- noise, not hide someone talking to you.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.notification_mutes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Matches notifications.type. Text rather than an enum so a new notification
  -- type never needs a migration to become mutable.
  type        text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, type)
);

alter table public.notification_mutes enable row level security;

-- A resident manages only their own mutes. There is no admin override: an
-- admin being able to un-mute someone would defeat the point.
drop policy if exists nm_select on public.notification_mutes;
create policy nm_select on public.notification_mutes
  for select using (user_id = auth.uid());

drop policy if exists nm_insert on public.notification_mutes;
create policy nm_insert on public.notification_mutes
  for insert with check (user_id = auth.uid());

drop policy if exists nm_delete on public.notification_mutes;
create policy nm_delete on public.notification_mutes
  for delete using (user_id = auth.uid());

-- ── Teach the fan-out to respect them ───────────────────────────────
--
-- Same function as 0066 with one added condition on the broadcast branch.
-- Targeted rows are untouched: those are addressed to one person.
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
        -- targeted: the single recipient, always delivered
        (NEW.target_user_id is not null and pt.user_id = NEW.target_user_id)
        or
        -- broadcast: everyone in the community except the actor…
        (NEW.target_user_id is null
         and pt.user_id is distinct from NEW.actor_id
         and exists (
           select 1 from public.profiles p
           where p.id = pt.user_id and p.community_id = NEW.community_id
         )
         -- …minus anyone who muted this category.
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

-- The lookup runs once per recipient per broadcast, so it wants an index even
-- though the table is small.
create index if not exists notification_mutes_user_type_idx
  on public.notification_mutes (user_id, type);
