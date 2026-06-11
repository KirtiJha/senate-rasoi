-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0051: booker controls + manual settlement for courts
-- Run AFTER 0001–0050.
--
-- Shifts the cost-split to attendance-driven (computed client-side from who is
-- confirmed, at any time) and gives the booker the controls they need so they
-- never lose their share:
--   • court_set_attendance()  — booker/admin marks ANY player in/out, anytime.
--   • court_update_booking()  — booker/admin edits a booking; the change flows to
--       upcoming sessions, optionally resets RSVPs (re-confirm), and notifies the
--       group to confirm availability again.
--   • court_booker_settle()   — booker records a share as received (manual / cash),
--       even if the player never initiated a UPI payment.
-- (Members still confirm/decline themselves via direct upsert; the client locks
--  that 15 min after start. The booker overrides through the RPC, which bypasses
--  the lock by design.)
-- ════════════════════════════════════════════════════════════════════

-- ── Booker/admin sets any player's attendance ───────────────────────
create or replace function public.court_set_attendance(p_session uuid, p_user uuid, p_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_booker uuid;
begin
  if p_status not in ('confirmed', 'declined') then return false; end if;
  select b.booker_user_id into v_booker
    from public.court_sessions s join public.court_bookings b on b.id = s.booking_id
    where s.id = p_session;
  if v_booker is null then return false; end if;
  if not (v_booker = auth.uid() or public.is_admin(auth.uid())) then return false; end if;

  insert into public.court_session_players (session_id, user_id, status, responded_at)
    values (p_session, p_user, p_status, now())
    on conflict (session_id, user_id) do update set status = excluded.status, responded_at = now();
  return true;
end; $$;

-- ── Booker/admin edits a booking; propagate + (optionally) reset + notify ─
create or replace function public.court_update_booking(
  p_booking uuid, p_title text, p_location text, p_start_time text,
  p_duration_min int, p_charge numeric, p_reset boolean
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_booker uuid; v_group uuid; v_comm uuid; v_gname text; v_bname text;
begin
  select booker_user_id, group_id, community_id into v_booker, v_group, v_comm
    from public.court_bookings where id = p_booking;
  if v_booker is null then return false; end if;
  if not (v_booker = auth.uid() or public.is_admin(auth.uid())) then return false; end if;

  update public.court_bookings
    set title = p_title, location = p_location, start_time = p_start_time,
        duration_min = p_duration_min, charge = p_charge
    where id = p_booking;

  -- Flow editable fields onto upcoming (today+) scheduled sessions only.
  update public.court_sessions
    set start_time = p_start_time, duration_min = p_duration_min, charge = p_charge
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
         coalesce(p_title, coalesce(v_gname, 'Court')) || ' — please re-confirm if you can play',
         '/sports/' || v_group::text
  from public.sport_group_members m
  where m.group_id = v_group and m.user_id <> v_booker;
  return true;
end; $$;

-- ── Booker records a share as received (manual / cash) ──────────────
create or replace function public.court_booker_settle(p_session uuid, p_payer uuid, p_amount numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_booker uuid; v_group uuid; v_comm uuid;
begin
  select b.booker_user_id, s.group_id, s.community_id into v_booker, v_group, v_comm
    from public.court_sessions s join public.court_bookings b on b.id = s.booking_id
    where s.id = p_session;
  if v_booker is null or p_payer = v_booker then return false; end if;
  if not (v_booker = auth.uid() or public.is_admin(auth.uid())) then return false; end if;

  insert into public.court_payments (session_id, group_id, community_id, payer_user_id, payee_user_id, amount, status, paid_at)
    values (p_session, v_group, v_comm, p_payer, v_booker, p_amount, 'paid', now())
    on conflict (session_id, payer_user_id) do update set status = 'paid', amount = excluded.amount, paid_at = now();
  return true;
end; $$;
