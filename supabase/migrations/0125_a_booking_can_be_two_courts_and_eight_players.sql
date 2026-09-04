-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0125: a booking can be two courts and eight players
-- Run AFTER 0001–0124. Safe to re-run.
--
-- The booking form was built around one society's Friday doubles: one court,
-- four players. Neither holds.
--
--   • Groups book TWO courts for the same slot when enough people are coming.
--     There was no way to say so. You had to make two bookings, which put two
--     identical cards on the same evening, asked everyone to RSVP twice, and
--     split each court's charge among only the people who happened to tap
--     that card.
--   • More than four play. min_players was set once at booking and could
--     never be changed afterwards — the edit sheet had no field for it — so a
--     group that grew was stuck being told "needs 1 more" forever.
--
-- So: a booking carries how many courts it is, and the number of players is
-- editable like everything else about it.
--
-- The number was never a cap in the database and is not one now. It is the
-- point at which there is a game; more can always join. (The screens said
-- "6 of 4", which read like a limit — that is fixed alongside this.)
-- ════════════════════════════════════════════════════════════════════

alter table public.court_bookings add column if not exists courts int not null default 1;
alter table public.court_sessions add column if not exists courts int not null default 1;

alter table public.court_bookings drop constraint if exists court_bookings_courts_check;
alter table public.court_bookings add constraint court_bookings_courts_check check (courts between 1 and 20);
alter table public.court_sessions drop constraint if exists court_sessions_courts_check;
alter table public.court_sessions add constraint court_sessions_courts_check check (courts between 1 and 20);

comment on column public.court_bookings.courts is
  'How many courts/tables/nets this booking holds. The charge is for all of them together.';

-- The booker's edit now reaches the two fields it could not.
--
--   p_courts       null → leave as it is (an older app build sends nothing)
--   p_min_players  null → leave as it is; 0 → no minimum at all
--
-- Both are read that way rather than overwritten blindly, so a client that
-- predates this migration cannot silently wipe either one.
create or replace function public.court_update_booking(
  p_booking uuid, p_title text, p_location text, p_start_time text,
  p_duration_min integer, p_charge numeric, p_reset boolean,
  p_min_players integer default null, p_courts integer default null
)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_booker uuid; v_group uuid; v_comm uuid; v_gname text; v_bname text;
  v_players int; v_courts int;
begin
  select booker_user_id, group_id, community_id,
         case when p_min_players is null then min_players
              when p_min_players <= 0 then null
              else p_min_players end,
         coalesce(p_courts, courts)
    into v_booker, v_group, v_comm, v_players, v_courts
    from public.court_bookings where id = p_booking;
  if v_booker is null then return false; end if;
  if not (v_booker = auth.uid() or public.is_admin(auth.uid())) then return false; end if;

  update public.court_bookings
     set title = p_title, location = p_location, start_time = p_start_time,
         duration_min = p_duration_min, charge = p_charge,
         min_players = v_players, courts = v_courts
   where id = p_booking;

  -- Flow editable fields onto upcoming (today+) scheduled sessions only.
  update public.court_sessions
     set start_time = p_start_time, duration_min = p_duration_min, charge = p_charge,
         min_players = v_players, courts = v_courts
   where booking_id = p_booking and status = 'scheduled' and session_date >= current_date;

  if p_reset then
    -- Clear non-booker responses on upcoming sessions so they re-confirm…
    delete from public.court_session_players p
      using public.court_sessions s
      where p.session_id = s.id and s.booking_id = p_booking
        and s.status = 'scheduled' and s.session_date >= current_date
        and p.user_id <> v_booker;
    -- …and keep the booker confirmed.
    insert into public.court_session_players (session_id, user_id, status, responded_at)
      select s.id, v_booker, 'confirmed', now() from public.court_sessions s
      where s.booking_id = p_booking and s.status = 'scheduled' and s.session_date >= current_date
        on conflict (session_id, user_id) do update set status = 'confirmed', responded_at = now();
  end if;

  select name into v_gname from public.sport_groups where id = v_group;
  select name into v_bname from public.profiles where id = v_booker;
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select v_comm, 'court', p_booking, v_booker, m.user_id,
         coalesce(v_bname, 'A member') || ' updated the booking',
         coalesce(nullif(p_title, ''), coalesce(v_gname, 'Court'))
         -- Asking everyone to re-confirm when nothing was cleared sent people
         -- to a screen where their answer was already recorded.
         || case when p_reset then ' — please re-confirm if you can play'
                 else ' — check the new details' end,
         '/sports/' || v_group::text
  from public.sport_group_members m
  where m.group_id = v_group and m.user_id <> v_booker;
  return true;
end; $fn$;
