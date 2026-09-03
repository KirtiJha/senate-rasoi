-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0114: a weekly game keeps happening, and calling one
-- off says so
-- Run AFTER 0001–0113. Safe to re-run.
--
-- court_bookings stores days_of_week, and createBooking generates sessions
-- for a few weeks and then nothing ever again. "Friday Doubles" was booked on
-- 12 June and its last session was 3 July: the arrangement is still in the
-- table, the group still has nine members, and the fixture quietly stopped
-- existing. Nobody deleted it and nobody was told.
--
-- And cancelSession sets status = 'cancelled' in silence, so the people who
-- confirmed turn up with racquets.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.materialise_court_sessions(p_horizon_days int default 21)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  b        record;
  d        date;
  n        int := 0;
  v_new_id uuid;
begin
  for b in
    select cb.*
      from public.court_bookings cb
     where cardinality(cb.days_of_week) > 0
       -- Only arrangements that are still alive. A fixture nobody has played
       -- for three weeks is over; resurrecting it would put a game back on
       -- nine people's phones that none of them asked for. A lapsed one is
       -- restarted deliberately, from the banner in the Sports tile.
       and exists (
         select 1 from public.court_sessions s
          where s.booking_id = cb.id
            and s.session_date >= current_date - 21
       )
  loop
    d := current_date;
    while d <= current_date + p_horizon_days loop
      if extract(dow from d)::int = any (b.days_of_week) then
        begin
          insert into public.court_sessions
            (booking_id, group_id, community_id, session_date, start_time, duration_min, charge)
          values (b.id, b.group_id, b.community_id, d, b.start_time, b.duration_min, b.charge)
          returning id into v_new_id;

          -- The booker plays in what they book, same as at creation.
          insert into public.court_session_players (session_id, user_id, status)
          values (v_new_id, b.booker_user_id, 'confirmed')
          on conflict do nothing;

          n := n + 1;
        exception when unique_violation then
          null; -- already there
        end;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return n;
end; $fn$;

revoke all on function public.materialise_court_sessions(int) from public;

create extension if not exists pg_cron;

select cron.unschedule('aangan-materialise-court-sessions')
  where exists (select 1 from cron.job where jobname = 'aangan-materialise-court-sessions');

select cron.schedule(
  'aangan-materialise-court-sessions',
  '45 18 * * *',                       -- 00:15 IST
  $cron$ select public.materialise_court_sessions(); $cron$
);

-- Calling a game off tells the people who said they were coming.
create or replace function public.on_court_session_cancelled()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_p record; v_title text; v_body text; v_booker uuid; v_place text; v_actor uuid := auth.uid();
begin
  if NEW.status is not distinct from OLD.status or NEW.status <> 'cancelled' then
    return NEW;
  end if;

  select cb.booker_user_id, coalesce(cb.title, cb.location, 'The court')
    into v_booker, v_place
    from public.court_bookings cb where cb.id = NEW.booking_id;

  v_title := 'Game off — ' || to_char(NEW.session_date, 'FMDay FMDD Mon');
  v_body  := v_place || ' is cancelled'
             || coalesce(' · was ' || to_char(NEW.start_time, 'FMHH12:MI am'), '');

  for v_p in
    select user_id from public.court_session_players
     where session_id = NEW.id and status = 'confirmed'
  loop
    if v_p.user_id = coalesce(v_actor, v_booker) then continue; end if;
    perform public.notify_user(v_p.user_id, v_title, v_body, '/sports/' || NEW.group_id::text);
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (NEW.community_id, 'court', NEW.id, coalesce(v_actor, v_booker), v_p.user_id,
            v_title, v_body, '/sports/' || NEW.group_id::text);
  end loop;
  return NEW;
end; $fn$;

drop trigger if exists trg_court_session_cancelled on public.court_sessions;
create trigger trg_court_session_cancelled
  after update on public.court_sessions
  for each row execute function public.on_court_session_cancelled();

-- The booking notice never pushed either — it wrote a bell row and stopped.
create or replace function public.notify_court_booking()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_gname text; v_booker text; v_title text; v_body text; v_m record;
begin
  select name into v_gname from public.sport_groups where id = NEW.group_id;
  select name into v_booker from public.profiles where id = NEW.booker_user_id;
  v_title := coalesce(v_booker, 'A member') || ' booked the court';
  v_body  := coalesce(NEW.title, coalesce(v_gname, 'Court')) || ' — confirm the days you can play';

  for v_m in
    select m.user_id from public.sport_group_members m
     where m.group_id = NEW.group_id and m.user_id <> NEW.booker_user_id
  loop
    perform public.notify_user(v_m.user_id, v_title, v_body, '/sports/' || NEW.group_id::text);
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (NEW.community_id, 'court', NEW.id, NEW.booker_user_id, v_m.user_id,
            v_title, v_body, '/sports/' || NEW.group_id::text);
  end loop;
  return NEW;
end; $fn$;
