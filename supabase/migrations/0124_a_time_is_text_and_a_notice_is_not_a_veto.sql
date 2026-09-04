-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0124: a time is text, and a notice is not a veto
-- Run AFTER 0001–0123. Safe to re-run.
--
-- Cancelling a court booking failed. Every time, for everyone, with nothing
-- more useful on screen than "Could not cancel".
--
--   PATCH /court_sessions?id=eq.… →
--   42883: function to_char(text, unknown) does not exist
--
-- court_sessions.start_time is TEXT ('19:00'), not `time`. I wrote
-- to_char(NEW.start_time, 'FMHH12:MI am') into the cancellation notice, which
-- raises — and because it raises inside an AFTER trigger, it takes the UPDATE
-- down with it. The booking could not be cancelled because the message about
-- the cancellation could not be composed.
--
-- The same line is in two more places, so this was never only about cancel:
--
--   • on_court_session_filled  — fires when a game reaches its player count.
--     The RSVP that filled the game was the RSVP that failed.
--   • send_court_reminders     — the nightly "your game is tomorrow" job.
--     It threw on the first session it looked at and sent nothing, ever.
--
-- Two fixes, because one is not enough:
--
--   1. court_time_label() formats a text time and, if it cannot, hands back
--      what it was given. One place to be right.
--   2. The two triggers now treat their own notifications as best-effort. A
--      courtesy message must never overrule the thing it is reporting: if the
--      note cannot be written, the game is still cancelled, still full.
-- ════════════════════════════════════════════════════════════════════

-- '19:00' → '7:00 pm'. Unparseable input comes back unchanged rather than
-- raising: this runs inside triggers, where raising costs the user their act.
create or replace function public.court_time_label(p text)
returns text language plpgsql immutable set search_path = public as $fn$
begin
  if p is null or btrim(p) = '' then return null; end if;
  return to_char(p::time, 'FMHH12:MI am');
exception when others then
  return nullif(btrim(p), '');
end; $fn$;

comment on function public.court_time_label(text) is
  'Formats court_sessions.start_time, which is text and not a time. Never raises — it runs inside triggers.';

-- ── The cancellation notice ─────────────────────────────────────────
create or replace function public.on_court_session_cancelled()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_p record; v_title text; v_body text; v_booker uuid; v_place text; v_actor uuid := auth.uid();
begin
  if NEW.status is not distinct from OLD.status or NEW.status <> 'cancelled' then
    return NEW;
  end if;

  begin
    select cb.booker_user_id, coalesce(cb.title, cb.location, 'The court')
      into v_booker, v_place
      from public.court_bookings cb where cb.id = NEW.booking_id;

    v_title := 'Game off — ' || to_char(NEW.session_date, 'FMDay FMDD Mon');
    v_body  := v_place || ' is cancelled'
               || coalesce(' · was ' || public.court_time_label(NEW.start_time), '');

    for v_p in
      select user_id from public.court_session_players
       where session_id = NEW.id and status = 'confirmed'
    loop
      if v_p.user_id = coalesce(v_actor, v_booker) then continue; end if;
      insert into public.notifications
        (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (NEW.community_id, 'court', NEW.id, coalesce(v_actor, v_booker), v_p.user_id,
              v_title, v_body, '/sports/' || NEW.group_id::text);
    end loop;
  exception when others then
    -- The session is cancelled either way. Telling people is the courtesy,
    -- not the act.
    null;
  end;
  return NEW;
end; $fn$;

-- ── "The game is on" ────────────────────────────────────────────────
create or replace function public.on_court_session_filled()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  s record; v_need int; v_have int; v_before int;
  v_place text; v_title text; v_body text; v_p record;
begin
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
               || coalesce(' · ' || public.court_time_label(s.start_time), '')
               || ' · ' || v_have || ' playing';

    for v_p in
      select user_id from public.court_session_players
       where session_id = NEW.session_id and status = 'confirmed'
    loop
      insert into public.notifications
        (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (s.community_id, 'court', s.id, NEW.user_id, v_p.user_id,
              v_title, v_body, '/sports/' || s.group_id::text);
    end loop;
  exception when others then
    -- Somebody just said they are playing. That stands whether or not the
    -- celebration goes out.
    null;
  end;
  return NEW;
end; $fn$;

-- ── The nightly reminder ────────────────────────────────────────────
create or replace function public.send_court_reminders(p_date date default (current_date + 1))
returns integer language plpgsql security definer set search_path = public, extensions as $fn$
declare
  s record; v_need int; v_have int; v_short int;
  v_when text; v_place text; v_title text; v_body text; v_p record; v_sent int := 0;
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
    v_when  := coalesce(public.court_time_label(s.start_time), 'tomorrow');
    v_place := coalesce(nullif(s.title, ''), nullif(s.location, ''), s.group_name, 'Your game');

    v_title := v_place || ' tomorrow at ' || v_when;
    v_body  := v_have || ' playing'
               || case when v_short > 0 then ' · still ' || v_short || ' short' else '' end;
    for v_p in
      select user_id from public.court_session_players
       where session_id = s.id and status = 'confirmed'
    loop
      insert into public.notifications
        (community_id, type, entity_id, target_user_id, title, body, route)
      values (s.community_id, 'court', s.id, v_p.user_id, v_title, v_body,
              '/sports/' || s.group_id::text);
    end loop;

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
