-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0100: a standing seat that can end
-- Run AFTER 0001–0099.
--
-- 0099 made a standing seat run until somebody gives it up, which is right for
-- an open-ended commute and wrong for every arrangement that has a known last
-- day: a school run that ends with the term, a project posting, someone
-- covering while a colleague is away.
--
-- Without an end date those arrangements are given up late or never, and a
-- lapsed regular keeps holding a seat nobody can book — the exact failure the
-- reserved-capacity rule makes worse, because a standing seat is deliberately
-- protected from casual requests.
--
-- Null still means open-ended. Nothing about an existing arrangement changes.
-- ════════════════════════════════════════════════════════════════════

alter table public.ride_standing
  add column if not exists ends_on date;

-- ─── An ended arrangement occupies nothing ───────────────────────────
-- Same shape as the skip check beside it: a seat is held for a date only if
-- the arrangement is live on that date and the rider has not opted out of it.
create or replace function public.ride_seats_taken(
  p_ride uuid,
  p_date date,
  p_exclude_request  uuid default null,
  p_exclude_standing uuid default null
)
returns integer
language sql stable security definer set search_path = public as $$
  select
    coalesce((
      select sum(seats) from public.ride_requests
       where ride_id = p_ride and ride_date = p_date and status = 'accepted'
         and (p_exclude_request is null or id <> p_exclude_request)
    ), 0)
  +
    coalesce((
      select sum(s.seats) from public.ride_standing s
       where s.ride_id = p_ride and s.status = 'accepted'
         and (p_exclude_standing is null or s.id <> p_exclude_standing)
         -- Past its last day, so it holds nothing.
         and (s.ends_on is null or s.ends_on >= p_date)
         and not exists (
           select 1 from public.ride_standing_skips k
            where k.standing_id = s.id and k.skip_date = p_date
         )
    ), 0);
$$;

-- ─── Capacity counts only live arrangements ──────────────────────────
--
-- An arrangement that ended last month must not stop a new one being agreed.
-- Checked against today rather than against each future date, for the same
-- reason 0099 gave: a standing seat is capacity for the arrangement as a
-- whole, and checking every future Tuesday is unbounded.
create or replace function public.guard_ride_standing() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_taken int;
  v_days  int;
begin
  if NEW.status <> 'accepted' then
    return NEW;
  end if;

  select seats_total, cardinality(days_of_week) into v_total, v_days
    from public.rides where id = NEW.ride_id;

  if coalesce(v_days, 0) = 0 then
    raise exception 'This ride runs once, so there is no weekly seat to hold.'
      using errcode = 'check_violation';
  end if;

  if NEW.ends_on is not null and NEW.ends_on < current_date then
    raise exception 'That last day has already passed.'
      using errcode = 'check_violation';
  end if;

  select coalesce(sum(seats), 0) into v_taken
    from public.ride_standing
   where ride_id = NEW.ride_id
     and status = 'accepted'
     and id <> NEW.id
     and (ends_on is null or ends_on >= current_date);

  if v_taken + NEW.seats > v_total then
    raise exception 'Only % regular seat(s) left on this ride.', greatest(v_total - v_taken, 0)
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

-- The rider owns the last day, like the seats and the note — a driver
-- answering a request must not quietly shorten it.
create or replace function public.guard_ride_standing_role() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid;
begin
  if auth.uid() is null then return NEW; end if;
  select driver_user_id into v_driver from public.rides where id = NEW.ride_id;

  if auth.uid() = v_driver then
    NEW.seats   := OLD.seats;
    NEW.note    := OLD.note;
    NEW.ends_on := OLD.ends_on;
    if NEW.status not in ('accepted', 'declined', 'pending') then
      NEW.status := OLD.status;
    end if;
  else
    if NEW.status is distinct from OLD.status and NEW.status <> 'cancelled' then
      NEW.status := OLD.status;
    end if;
  end if;

  return NEW;
end; $$;
