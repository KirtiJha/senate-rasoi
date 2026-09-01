-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0101: the reminder the evening before
-- Run AFTER 0001–0100.
--
-- A confirmed seat currently produces exactly one notification, at the moment
-- it is confirmed, and then nothing. Agree a lift on Sunday for Thursday and
-- by Thursday morning nobody has been reminded it exists — so the driver texts
-- the group to check, which is the thing this feature exists to stop.
--
-- MODELLED ON THE FOOD NUDGE (0081), which got the rules right:
--   • Never when there is nobody to tell. Silence is a feature.
--   • At most one per journey, however often the job runs.
--   • Not sent to somebody about their own arrangement twice.
--
-- Deliberately NOT muteable. Every other reminder in this app announces
-- something to the society; this one is about a seat you personally agreed to
-- take, in a car leaving at nine. That is the same class as an order update or
-- a direct message, and those are not muteable either.
-- ════════════════════════════════════════════════════════════════════

-- ─── A proper type for carpool notifications ─────────────────────────
-- 0098 and 0099 reused 'listing', which meant a seat confirmation rendered
-- with a marketplace icon and sat under the marketplace mute.
update public.notifications
   set type = 'carpool'
 where type = 'listing'
   and route like '/rides/%';

-- ─── One reminder per journey ────────────────────────────────────────
create table public.ride_reminders (
  ride_id     uuid not null references public.rides(id) on delete cascade,
  ride_date   date not null,
  sent_at     timestamptz not null default now(),
  rider_count integer not null,
  primary key (ride_id, ride_date)
);

alter table public.ride_reminders enable row level security;
-- No policies: only the SECURITY DEFINER job below touches this.

create or replace function public.send_ride_reminders(p_date date default (current_date + 1))
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_riders uuid[];
  v_count  int;
  v_sent   int := 0;
  v_when   text;
begin
  for r in
    select rd.*
      from public.rides rd
     where rd.active
       and (
         (cardinality(rd.days_of_week) > 0 and extract(dow from p_date)::int = any(rd.days_of_week))
         or rd.one_off_date = p_date
       )
  loop
    -- Everyone with a seat on this journey: dated acceptances, plus standing
    -- arrangements that are live and not being skipped. Deduplicated, because
    -- somebody holding both should be told once.
    select array_agg(distinct uid) into v_riders from (
      select o.rider_user_id as uid
        from public.ride_requests o
       where o.ride_id = r.id and o.ride_date = p_date and o.status = 'accepted'
      union
      select s.rider_user_id
        from public.ride_standing s
       where s.ride_id = r.id
         and s.status = 'accepted'
         and (s.ends_on is null or s.ends_on >= p_date)
         and not exists (
           select 1 from public.ride_standing_skips k
            where k.standing_id = s.id and k.skip_date = p_date
         )
    ) x
    where uid is not null;

    v_count := coalesce(cardinality(v_riders), 0);

    -- An empty car needs no reminder, and neither does its driver.
    if v_count = 0 then
      continue;
    end if;

    begin
      insert into public.ride_reminders (ride_id, ride_date, rider_count)
        values (r.id, p_date, v_count);
    exception when unique_violation then
      -- Already reminded for this journey.
      continue;
    end;

    v_when := to_char(p_date + r.depart_time, 'FMHH12:MI am');

    -- The driver, told how many to expect.
    insert into public.notifications
      (community_id, type, entity_id, target_user_id, title, body, route)
    values (
      r.community_id, 'carpool', r.id, r.driver_user_id,
      'Lift tomorrow at ' || v_when,
      v_count || ' confirmed · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || r.id
    );

    -- And each rider, told when to be downstairs.
    insert into public.notifications
      (community_id, type, entity_id, target_user_id, title, body, route)
    select
      r.community_id, 'carpool', r.id, x.user_id,
      'Your lift is tomorrow at ' || v_when,
      r.from_text || ' → ' || r.to_text,
      '/rides/' || r.id
    from unnest(v_riders) as x(user_id);

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end; $$;

revoke all on function public.send_ride_reminders(date) from public;

-- ─── Schedule ────────────────────────────────────────────────────────
create extension if not exists pg_cron;

select cron.unschedule('aangan-ride-reminders')
  where exists (select 1 from cron.job where jobname = 'aangan-ride-reminders');

-- 14:30 UTC = 20:00 IST. Late enough that plans for tomorrow are settled,
-- early enough that somebody who cannot make it can still say so.
select cron.schedule(
  'aangan-ride-reminders',
  '30 14 * * *',
  $cron$ select public.send_ride_reminders(); $cron$
);

-- ─── Carpool notifications carry their own type from here on ─────────
create or replace function public.on_ride_request() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  r      record;
  v_who  text;
begin
  select rd.driver_user_id, rd.community_id, rd.from_text, rd.to_text
    into r
    from public.rides rd where rd.id = NEW.ride_id;

  select coalesce(p.name, 'A neighbour') into v_who
    from public.profiles p
   where p.id = case when TG_OP = 'INSERT' then NEW.rider_user_id else r.driver_user_id end;

  if TG_OP = 'INSERT' then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      r.community_id, 'carpool', NEW.ride_id, NEW.rider_user_id, r.driver_user_id,
      v_who || ' wants a seat',
      to_char(NEW.ride_date, 'FMDay FMDD Mon') || ' · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );

  elsif NEW.status is distinct from OLD.status and NEW.status in ('accepted', 'declined') then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      r.community_id, 'carpool', NEW.ride_id, r.driver_user_id, NEW.rider_user_id,
      case NEW.status when 'accepted' then 'Seat confirmed 🚗' else 'Ride declined' end,
      to_char(NEW.ride_date, 'FMDay FMDD Mon') || ' · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );
  end if;

  return NEW;
end; $$;

create or replace function public.on_ride_standing() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  r     record;
  v_who text;
begin
  select rd.driver_user_id, rd.community_id, rd.from_text, rd.to_text
    into r from public.rides rd where rd.id = NEW.ride_id;

  select coalesce(p.name, 'A neighbour') into v_who
    from public.profiles p
   where p.id = case when TG_OP = 'INSERT' then NEW.rider_user_id else r.driver_user_id end;

  if TG_OP = 'INSERT' then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      r.community_id, 'carpool', NEW.ride_id, NEW.rider_user_id, r.driver_user_id,
      v_who || ' wants a regular seat',
      'Every week · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );

  elsif NEW.status is distinct from OLD.status and NEW.status in ('accepted', 'declined') then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      r.community_id, 'carpool', NEW.ride_id, r.driver_user_id, NEW.rider_user_id,
      case NEW.status when 'accepted' then 'Regular seat confirmed 🚗' else 'Regular seat declined' end,
      'Every week · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );
  end if;

  return NEW;
end; $$;
