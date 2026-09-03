-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0113: a driver can say "not today", and carpool
-- notices actually reach a phone
-- Run AFTER 0001–0112. Safe to re-run.
--
-- Three holes in the same tile.
--
-- 1. A recurring lift is a promise about Mondays, and there was no way to
--    suspend one journey. The driver's only control was Remove — which
--    cascades every request and every standing seat away. So a driver who
--    could not drive on Friday either deleted the arrangement or said nothing
--    and did not turn up, and the riders found out at the gate.
--
-- 2. Every carpool notification wrote a bell row and never called
--    notify_user. "Seat confirmed" for tomorrow at eight is exactly the kind
--    of message that has to arrive on the phone.
--
-- 3. A rider pulling out told the driver nothing at all: on_ride_request only
--    announced 'accepted' and 'declined', while withdrawRequest writes
--    'cancelled'. The same fault the food orders had — the person left
--    holding the cost is the one nobody speaks to.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.ride_skips (
  ride_id    uuid not null references public.rides(id) on delete cascade,
  skip_date  date not null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (ride_id, skip_date)
);

comment on table public.ride_skips is
  'Days a recurring ride is NOT running, set by the driver. Riders keep their standing seat; only this journey is off. See 0113.';

alter table public.ride_skips enable row level security;

drop policy if exists rs_read on public.ride_skips;
create policy rs_read on public.ride_skips for select
  using (exists (select 1 from public.rides r
                  where r.id = ride_id and public.is_my_community(r.community_id)));

drop policy if exists rs_write on public.ride_skips;
create policy rs_write on public.ride_skips for all
  using (exists (select 1 from public.rides r
                  where r.id = ride_id and r.driver_user_id = auth.uid()))
  with check (exists (select 1 from public.rides r
                       where r.id = ride_id and r.driver_user_id = auth.uid()));

-- Everyone holding a seat that day hears about it.
create or replace function public.on_ride_skip()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  r record; v_rider record; v_title text; v_body text; v_dow int;
begin
  select rd.driver_user_id, rd.community_id, rd.from_text, rd.to_text
    into r from public.rides rd where rd.id = NEW.ride_id;

  v_title := 'No ride on ' || to_char(NEW.skip_date, 'FMDay FMDD Mon');
  v_body  := coalesce(nullif(NEW.reason, ''), r.from_text || ' → ' || r.to_text || ' is not running that day');
  v_dow   := extract(dow from NEW.skip_date);

  for v_rider in
    select distinct q.rider_user_id as uid
      from public.ride_requests q
     where q.ride_id = NEW.ride_id and q.ride_date = NEW.skip_date
       and q.status in ('pending', 'accepted')
    union
    select distinct s.rider_user_id
      from public.ride_standing s
      join public.rides rd on rd.id = s.ride_id
     where s.ride_id = NEW.ride_id and s.status = 'accepted'
       and (s.ends_on is null or s.ends_on >= NEW.skip_date)
       and v_dow = any (rd.days_of_week)
       and not exists (select 1 from public.ride_standing_skips k
                        where k.standing_id = s.id and k.skip_date = NEW.skip_date)
  loop
    if v_rider.uid = r.driver_user_id then continue; end if;
    perform public.notify_user(v_rider.uid, v_title, v_body, '/rides/' || NEW.ride_id);
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (r.community_id, 'carpool', NEW.ride_id, r.driver_user_id, v_rider.uid,
            v_title, v_body, '/rides/' || NEW.ride_id);
  end loop;
  return NEW;
end; $fn$;

drop trigger if exists trg_on_ride_skip on public.ride_skips;
create trigger trg_on_ride_skip
  after insert on public.ride_skips
  for each row execute function public.on_ride_skip();

-- ── every carpool notice pushes, and a withdrawal tells the driver ───

create or replace function public.on_ride_request()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  r record; v_who text; v_title text; v_body text; v_target uuid; v_actor uuid;
begin
  select rd.driver_user_id, rd.community_id, rd.from_text, rd.to_text
    into r from public.rides rd where rd.id = NEW.ride_id;
  v_body := to_char(NEW.ride_date, 'FMDay FMDD Mon') || ' · ' || r.from_text || ' → ' || r.to_text;

  if TG_OP = 'INSERT' then
    select coalesce(p.name, 'A neighbour') into v_who from public.profiles p where p.id = NEW.rider_user_id;
    v_target := r.driver_user_id; v_actor := NEW.rider_user_id;
    v_title := v_who || ' wants a seat';

  elsif NEW.status is distinct from OLD.status and NEW.status in ('accepted', 'declined') then
    v_target := NEW.rider_user_id; v_actor := r.driver_user_id;
    v_title := case NEW.status when 'accepted' then 'Seat confirmed 🚗' else 'Ride declined' end;

  elsif NEW.status is distinct from OLD.status and NEW.status = 'cancelled' then
    -- A rider pulling out at seven in the morning is the one message a driver
    -- cannot afford to miss; this used to say nothing at all.
    select coalesce(p.name, 'A neighbour') into v_who from public.profiles p where p.id = NEW.rider_user_id;
    v_target := r.driver_user_id; v_actor := NEW.rider_user_id;
    v_title := v_who || ' cancelled their seat';
  else
    return NEW;
  end if;

  if v_target is null or v_target = v_actor then return NEW; end if;
  perform public.notify_user(v_target, v_title, v_body, '/rides/' || NEW.ride_id);
  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (r.community_id, 'carpool', NEW.ride_id, v_actor, v_target, v_title, v_body,
          '/rides/' || NEW.ride_id);
  return NEW;
end; $fn$;

create or replace function public.on_ride_standing()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  r record; v_who text; v_title text; v_body text; v_target uuid; v_actor uuid;
begin
  select rd.driver_user_id, rd.community_id, rd.from_text, rd.to_text
    into r from public.rides rd where rd.id = NEW.ride_id;
  v_body := 'Every week · ' || r.from_text || ' → ' || r.to_text;

  if TG_OP = 'INSERT' then
    select coalesce(p.name, 'A neighbour') into v_who from public.profiles p where p.id = NEW.rider_user_id;
    v_target := r.driver_user_id; v_actor := NEW.rider_user_id;
    v_title := v_who || ' wants a regular seat';

  elsif NEW.status is distinct from OLD.status and NEW.status in ('accepted', 'declined') then
    v_target := NEW.rider_user_id; v_actor := r.driver_user_id;
    v_title := case NEW.status when 'accepted' then 'Regular seat confirmed 🚗' else 'Regular seat declined' end;

  elsif NEW.status is distinct from OLD.status and NEW.status = 'cancelled' then
    select coalesce(p.name, 'A neighbour') into v_who from public.profiles p where p.id = NEW.rider_user_id;
    v_target := r.driver_user_id; v_actor := NEW.rider_user_id;
    v_title := v_who || ' gave up their regular seat';
  else
    return NEW;
  end if;

  if v_target is null or v_target = v_actor then return NEW; end if;
  perform public.notify_user(v_target, v_title, v_body, '/rides/' || NEW.ride_id);
  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (r.community_id, 'carpool', NEW.ride_id, v_actor, v_target, v_title, v_body,
          '/rides/' || NEW.ride_id);
  return NEW;
end; $fn$;

-- ── the reminder sweep pushes too, and leaves a cancelled day alone ──
create or replace function public.send_ride_reminders(p_date date default (current_date + 1))
returns integer language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  r        record;
  v_riders uuid[];
  v_count  int;
  v_sent   int := 0;
  v_when   text;
  v_title  text;
  v_body   text;
  v_uid    uuid;
begin
  for r in
    select rd.*
      from public.rides rd
     where rd.active
       and (
         (cardinality(rd.days_of_week) > 0 and extract(dow from p_date)::int = any(rd.days_of_week))
         or rd.one_off_date = p_date
       )
       -- A journey the driver has called off is not one to remind anybody about.
       and not exists (select 1 from public.ride_skips k
                        where k.ride_id = rd.id and k.skip_date = p_date)
  loop
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
    if v_count = 0 then
      continue;
    end if;

    begin
      insert into public.ride_reminders (ride_id, ride_date, rider_count)
        values (r.id, p_date, v_count);
    exception when unique_violation then
      continue;
    end;

    v_when := to_char(p_date + r.depart_time, 'FMHH12:MI am');

    v_title := 'Lift tomorrow at ' || v_when;
    v_body  := v_count || ' confirmed · ' || r.from_text || ' → ' || r.to_text;
    perform public.notify_user(r.driver_user_id, v_title, v_body, '/rides/' || r.id);
    insert into public.notifications
      (community_id, type, entity_id, target_user_id, title, body, route)
    values (r.community_id, 'carpool', r.id, r.driver_user_id, v_title, v_body, '/rides/' || r.id);

    v_title := 'Your lift is tomorrow at ' || v_when;
    v_body  := r.from_text || ' → ' || r.to_text;
    foreach v_uid in array v_riders loop
      perform public.notify_user(v_uid, v_title, v_body, '/rides/' || r.id);
      insert into public.notifications
        (community_id, type, entity_id, target_user_id, title, body, route)
      values (r.community_id, 'carpool', r.id, v_uid, v_title, v_body, '/rides/' || r.id);
    end loop;

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end; $fn$;
