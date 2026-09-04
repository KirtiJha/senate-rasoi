-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0115: a game needs players, chases them, and reminds
-- them the night before
-- Run AFTER 0001–0114. Safe to re-run.
--
-- Eleven sessions have ever been created in this society and not one has had
-- more than two players — in groups of nine, eight and four. Badminton
-- doubles needs four. The booking is made, one person joins, and seven of the
-- eleven were cancelled. Nobody has ever pressed "can't make it": the RSVP is
-- only used one way, by the booker, on their own booking.
--
-- Nothing in the tile knew how many players a game takes, so there was
-- nothing to be short OF and nobody was ever asked to make up the numbers.
-- A booking now carries that number, the session says how short it is,
-- filling up is announced, and the evening before everybody hears about it.
-- ════════════════════════════════════════════════════════════════════

alter table public.court_bookings add column if not exists min_players int;
alter table public.court_sessions add column if not exists min_players int;
alter table public.court_sessions add column if not exists attendance_settled_at timestamptz;

comment on column public.court_bookings.min_players is
  'How many players the game actually needs (doubles = 4). Null means unset. See 0115.';
comment on column public.court_sessions.attendance_settled_at is
  'When the booker confirmed who actually played, so the cost split is based on attendance rather than on a promise made days earlier.';

-- ── The game is on ───────────────────────────────────────────────────
create or replace function public.on_court_session_filled()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  s        record;
  v_need   int;
  v_have   int;
  v_before int;
  v_place  text;
  v_title  text;
  v_body   text;
  v_p      record;
begin
  select cs.*, cb.title, cb.location, cb.min_players as booking_min
    into s
    from public.court_sessions cs
    join public.court_bookings cb on cb.id = cs.booking_id
   where cs.id = NEW.session_id;
  if not found or s.status <> 'scheduled' then return NEW; end if;

  v_need := coalesce(s.min_players, s.booking_min);
  if v_need is null or v_need < 2 then return NEW; end if;

  select count(*) into v_have
    from public.court_session_players
   where session_id = NEW.session_id and status = 'confirmed';

  -- Only at the moment it tips over, and only on the way up.
  v_before := v_have - (case when NEW.status = 'confirmed' then 1 else 0 end);
  if v_have < v_need or v_before >= v_need then return NEW; end if;

  v_place := coalesce(s.title, s.location, 'The game');
  v_title := v_place || ' is on 🎉';
  v_body  := to_char(s.session_date, 'FMDay FMDD Mon')
             || coalesce(' · ' || to_char(s.start_time, 'FMHH12:MI am'), '')
             || ' · ' || v_have || ' playing';

  for v_p in
    select user_id from public.court_session_players
     where session_id = NEW.session_id and status = 'confirmed'
  loop
    perform public.notify_user(v_p.user_id, v_title, v_body, '/sports/' || s.group_id::text);
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (s.community_id, 'court', s.id, NEW.user_id, v_p.user_id,
            v_title, v_body, '/sports/' || s.group_id::text);
  end loop;
  return NEW;
end; $fn$;

drop trigger if exists trg_court_session_filled on public.court_session_players;
create trigger trg_court_session_filled
  after insert or update on public.court_session_players
  for each row execute function public.on_court_session_filled();

-- ── The night before ─────────────────────────────────────────────────
create table if not exists public.court_reminders (
  session_id uuid primary key references public.court_sessions(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  confirmed  int not null default 0
);

alter table public.court_reminders enable row level security;

create or replace function public.send_court_reminders(p_date date default (current_date + 1))
returns integer language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  s        record;
  v_need   int;
  v_have   int;
  v_short  int;
  v_when   text;
  v_place  text;
  v_title  text;
  v_body   text;
  v_p      record;
  v_sent   int := 0;
begin
  for s in
    select cs.*, cb.title, cb.location, cb.min_players as booking_min, cb.booker_user_id,
           g.name as group_name
      from public.court_sessions cs
      join public.court_bookings cb on cb.id = cs.booking_id
      left join public.sport_groups g on g.id = cs.group_id
     where cs.session_date = p_date and cs.status = 'scheduled'
  loop
    select count(*) into v_have
      from public.court_session_players
     where session_id = s.id and status = 'confirmed';
    if v_have = 0 then continue; end if;

    begin
      insert into public.court_reminders (session_id, confirmed) values (s.id, v_have);
    exception when unique_violation then
      continue;
    end;

    v_need  := coalesce(s.min_players, s.booking_min);
    v_short := greatest(coalesce(v_need, 0) - v_have, 0);
    v_when  := coalesce(to_char(s.start_time, 'FMHH12:MI am'), 'tomorrow');
    -- A booking with no title and no venue read as "Your game", which is odd
    -- addressed to the people being ASKED to play. The group's own name is
    -- what everybody calls it.
    v_place := coalesce(nullif(s.title, ''), nullif(s.location, ''), s.group_name, 'Your game');

    -- Everyone who said they are coming.
    v_title := v_place || ' tomorrow at ' || v_when;
    v_body  := v_have || ' playing'
               || case when v_short > 0 then ' · still ' || v_short || ' short' else '' end;
    for v_p in
      select user_id from public.court_session_players
       where session_id = s.id and status = 'confirmed'
    loop
      perform public.notify_user(v_p.user_id, v_title, v_body, '/sports/' || s.group_id::text);
      insert into public.notifications
        (community_id, type, entity_id, target_user_id, title, body, route)
      values (s.community_id, 'court', s.id, v_p.user_id, v_title, v_body,
              '/sports/' || s.group_id::text);
    end loop;

    -- And, only when the game is actually short, the members who have not
    -- said either way. A full game does not pester anybody.
    if v_short > 0 then
      v_title := v_place || ' needs ' || v_short || ' more';
      v_body  := 'Tomorrow at ' || v_when || ' · ' || v_have || ' in so far. Can you play?';
      for v_p in
        select m.user_id
          from public.sport_group_members m
         where m.group_id = s.group_id
           and not exists (
             select 1 from public.court_session_players p
              where p.session_id = s.id and p.user_id = m.user_id
           )
      loop
        perform public.notify_user(v_p.user_id, v_title, v_body, '/sports/' || s.group_id::text);
        insert into public.notifications
          (community_id, type, entity_id, target_user_id, title, body, route)
        values (s.community_id, 'court', s.id, v_p.user_id, v_title, v_body,
                '/sports/' || s.group_id::text);
      end loop;
    end if;

    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end; $fn$;

revoke all on function public.send_court_reminders(date) from public;

create extension if not exists pg_cron;

select cron.unschedule('aangan-court-reminders')
  where exists (select 1 from cron.job where jobname = 'aangan-court-reminders');

select cron.schedule(
  'aangan-court-reminders',
  '30 13 * * *',                        -- 19:00 IST, the evening before
  $cron$ select public.send_court_reminders(); $cron$
);
