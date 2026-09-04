-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0126: a group says what it costs to leave
-- Run AFTER 0001–0125. Safe to re-run.
--
-- Sweeping the rest of Sports after the booking fixes.
--
-- 1. A TOURNAMENT WAS ANNOUNCED TO NOBODY. sport_tournaments is the only
--    table in this tile with no notification of any kind. The captain adds
--    the one fixture the group exists for, and it lands silently on a screen
--    nobody has a reason to open. Now the group is told, and told again if
--    the date moves.
--
-- 2. DELETING A GROUP TAKES THE MONEY WITH IT. court_payments cascades from
--    sport_groups, so deleting a group erases who owes whom — while the
--    confirmation said only "removes all members and tournaments". There is
--    now a function that reports exactly what a delete would destroy, so the
--    screen can say it, and members are told before the row disappears.
--
-- 3. LEAVING LEFT YOU IN THE SPLIT. Leaving a group removed the membership
--    and nothing else: your "I'm in" on Friday's game stood, you stayed in
--    the head-count the charge divides by, and the booker was still expecting
--    you. Leaving now withdraws you from every session that has not happened.
--
-- 4. sport_groups had an UPDATE policy with no WITH CHECK — a captain could
--    move a group into another society.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. The fixture reaches the team ─────────────────────────────────
create or replace function public.on_sport_tournament()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_group record; v_when text; v_head text; v_body text;
begin
  select g.id, g.name, g.community_id, g.created_by into v_group
    from public.sport_groups g where g.id = NEW.group_id;
  if v_group.id is null then return NEW; end if;

  if TG_OP = 'UPDATE' then
    -- Only a moved date or a renamed fixture is worth interrupting anyone for.
    if NEW.event_date is not distinct from OLD.event_date
       and NEW.title is not distinct from OLD.title then
      return NEW;
    end if;
  end if;

  v_when := case when NEW.event_date is null then null
                 else to_char(NEW.event_date, 'FMDay FMDD Mon') end;
  v_head := case when TG_OP = 'INSERT'
                 then '🏆 ' || left(NEW.title, 50) || ' — ' || coalesce(v_group.name, 'your group')
                 else '📅 ' || left(NEW.title, 50) || ' has moved' end;
  v_body := coalesce(v_when, 'Date to be confirmed')
            || coalesce(' · ' || nullif(NEW.location, ''), '');

  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select v_group.community_id, 'sport', NEW.id, auth.uid(), m.user_id, v_head, v_body,
         '/sports/' || v_group.id::text
    from public.sport_group_members m
   where m.group_id = v_group.id
     and m.user_id is distinct from auth.uid();
  return NEW;
end; $fn$;

drop trigger if exists trg_sport_tournament on public.sport_tournaments;
create trigger trg_sport_tournament
  after insert or update on public.sport_tournaments
  for each row execute function public.on_sport_tournament();

-- ── 2. What a delete would take ─────────────────────────────────────
-- So the confirmation can name it instead of guessing.
create or replace function public.sport_group_delete_impact(p_group uuid)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'members',   (select count(*) from public.sport_group_members where group_id = p_group),
    'upcoming',  (select count(*) from public.court_sessions
                   where group_id = p_group and status = 'scheduled' and session_date >= current_date),
    'unsettled', (select coalesce(sum(amount), 0) from public.court_payments
                   where group_id = p_group and status <> 'paid'),
    'tournaments', (select count(*) from public.sport_tournaments where group_id = p_group)
  );
$fn$;

create or replace function public.on_sport_group_delete()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select OLD.community_id, 'sport', OLD.id, auth.uid(), m.user_id,
         coalesce(OLD.name, 'Your group') || ' has been closed',
         'Its bookings and records have been removed.',
         '/sports'
    from public.sport_group_members m
   where m.group_id = OLD.id
     and m.user_id is distinct from auth.uid();
  return OLD;
exception when others then
  -- Never let the notice block the deletion (0124's rule).
  return OLD;
end; $fn$;

drop trigger if exists trg_sport_group_delete on public.sport_groups;
create trigger trg_sport_group_delete
  before delete on public.sport_groups
  for each row execute function public.on_sport_group_delete();

-- ── 3. Leaving takes you out of the games too ───────────────────────
-- Deleting the membership row alone left the leaver confirmed for sessions
-- that had not happened: still counted in the head-count the charge divides
-- by, still expected by the booker.
create or replace function public.sport_group_leave(p_group uuid)
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_me uuid := auth.uid(); v_dropped int := 0;
begin
  if v_me is null then return 0; end if;

  with mine as (
    update public.court_session_players p
       set status = 'declined', responded_at = now()
      from public.court_sessions s
     where p.session_id = s.id
       and s.group_id = p_group
       and s.status = 'scheduled'
       and s.session_date >= current_date
       and p.user_id = v_me
       and p.status = 'confirmed'
    returning 1
  ) select count(*) into v_dropped from mine;

  delete from public.sport_group_members where group_id = p_group and user_id = v_me;
  return v_dropped;
end; $fn$;

comment on function public.sport_group_leave(uuid) is
  'Leave a sports group and stand down from every session of it that has not happened yet. Returns how many.';

-- ── 4. A group stays in its society ─────────────────────────────────
drop policy if exists sg_update on public.sport_groups;
create policy sg_update on public.sport_groups
  for update using (
    public.is_group_owner(id) or public.is_group_captain(id) or public.is_admin(auth.uid())
  )
  with check (
    public.is_my_community(community_id)
    and (public.is_group_owner(id) or public.is_group_captain(id) or public.is_admin(auth.uid()))
  );
