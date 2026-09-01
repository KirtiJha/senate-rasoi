-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0099: a standing seat
-- Run AFTER 0001–0098.
--
-- 0098 made a ride bookable one journey at a time, which is right for "I need
-- a lift on Thursday" and wrong for the case carpooling actually exists for:
-- the same four people going to the same office every weekday. Asking twenty
-- times a month, and being confirmed twenty times a month, is not a commute —
-- it is a chore.
--
-- THREE QUESTIONS THIS HAS TO ANSWER, and the answers are the design:
--
--   Approved once, or every week?  ONCE. A standing seat is an agreement
--   between two people, not a recurring application. The driver says yes to
--   the arrangement.
--
--   What if a week is full?  IT CANNOT BE. Standing seats are reserved
--   capacity, checked against the car when the arrangement is agreed. One-off
--   requests then fill whatever is left on a given day. A rider who commutes
--   with you every day does not lose their seat to someone who asked on
--   Tuesday — which is also how a real carpool behaves.
--
--   What if I'm away on Thursday?  SKIP IT, exactly like a tiffin. The
--   arrangement survives, and the seat is released for that one day so
--   somebody else can have it.
-- ════════════════════════════════════════════════════════════════════

create table public.ride_standing (
  id            uuid primary key default gen_random_uuid(),
  ride_id       uuid not null references public.rides(id) on delete cascade,
  rider_user_id uuid not null references public.profiles(id) on delete cascade,

  seats         integer not null default 1 check (seats > 0 and seats <= 8),
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One arrangement per person per ride. Wanting a different number of seats
  -- edits this, rather than queueing a second standing claim behind the first.
  unique (ride_id, rider_user_id)
);

create index ride_standing_ride_idx  on public.ride_standing (ride_id, status);
create index ride_standing_rider_idx on public.ride_standing (rider_user_id);

-- The days a standing rider is not coming.
create table public.ride_standing_skips (
  standing_id uuid not null references public.ride_standing(id) on delete cascade,
  skip_date   date not null,
  created_at  timestamptz not null default now(),
  primary key (standing_id, skip_date)
);

-- ─── Seat arithmetic, in one place ───────────────────────────────────
--
-- Both guards below and the app all need the same answer to "how full is this
-- car on this date", and three implementations of that is how two screens end
-- up disagreeing about whether a seat exists.
create or replace function public.ride_seats_taken(
  p_ride uuid,
  p_date date,
  p_exclude_request  uuid default null,
  p_exclude_standing uuid default null
)
returns integer
language sql stable security definer set search_path = public as $$
  select
    -- Seats promised for this one journey.
    coalesce((
      select sum(seats) from public.ride_requests
       where ride_id = p_ride and ride_date = p_date and status = 'accepted'
         and (p_exclude_request is null or id <> p_exclude_request)
    ), 0)
  +
    -- Plus every standing arrangement not skipping this date.
    coalesce((
      select sum(s.seats) from public.ride_standing s
       where s.ride_id = p_ride and s.status = 'accepted'
         and (p_exclude_standing is null or s.id <> p_exclude_standing)
         and not exists (
           select 1 from public.ride_standing_skips k
            where k.standing_id = s.id and k.skip_date = p_date
         )
    ), 0);
$$;

revoke all on function public.ride_seats_taken(uuid, date, uuid, uuid) from public;
grant execute on function public.ride_seats_taken(uuid, date, uuid, uuid) to authenticated;

-- ─── A one-off request now counts standing riders too ────────────────
-- Replaces 0098's guard, which only saw dated requests and would happily have
-- sold a seat that a commuter already had every day.
create or replace function public.guard_ride_seats() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_taken int;
begin
  if NEW.status <> 'accepted' then
    return NEW;
  end if;

  select seats_total into v_total from public.rides where id = NEW.ride_id;
  v_taken := public.ride_seats_taken(NEW.ride_id, NEW.ride_date, NEW.id, null);

  if v_taken + NEW.seats > v_total then
    raise exception 'Only % seat(s) left on this journey.', greatest(v_total - v_taken, 0)
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

-- ─── Agreeing a standing seat ────────────────────────────────────────
--
-- Checked against the car itself rather than against any particular date: a
-- standing seat is capacity set aside for the whole arrangement, so the only
-- question is whether the car has room for all its regulars at once. Bounded,
-- unlike checking every future Tuesday.
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

  -- A one-off ride has no weeks to stand for.
  if coalesce(v_days, 0) = 0 then
    raise exception 'This ride runs once, so there is no weekly seat to hold.'
      using errcode = 'check_violation';
  end if;

  select coalesce(sum(seats), 0) into v_taken
    from public.ride_standing
   where ride_id = NEW.ride_id and status = 'accepted' and id <> NEW.id;

  if v_taken + NEW.seats > v_total then
    raise exception 'Only % regular seat(s) left on this ride.', greatest(v_total - v_taken, 0)
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_guard_ride_standing on public.ride_standing;
create trigger trg_guard_ride_standing
  before insert or update on public.ride_standing
  for each row execute function public.guard_ride_standing();

create or replace function public.ride_standing_touch() returns trigger
  language plpgsql set search_path = public as $$
begin NEW.updated_at := now(); return NEW; end; $$;

drop trigger if exists trg_ride_standing_touch on public.ride_standing;
create trigger trg_ride_standing_touch before update on public.ride_standing
  for each row execute function public.ride_standing_touch();

-- ─── Access ──────────────────────────────────────────────────────────
alter table public.ride_standing       enable row level security;
alter table public.ride_standing_skips enable row level security;

-- Same rule as a dated request: between the rider and the driver, nobody else.
create policy ride_standing_read on public.ride_standing for select using (
  rider_user_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.driver_user_id = auth.uid())
);

create policy ride_standing_insert on public.ride_standing for insert to authenticated
  with check (
    rider_user_id = auth.uid()
    and exists (
      select 1 from public.rides r
       where r.id = ride_id and r.active and public.is_my_community(r.community_id)
    )
  );

create policy ride_standing_update on public.ride_standing for update to authenticated
  using (
    rider_user_id = auth.uid()
    or exists (select 1 from public.rides r where r.id = ride_id and r.driver_user_id = auth.uid())
  );

create policy ride_standing_delete on public.ride_standing for delete to authenticated
  using (rider_user_id = auth.uid());

-- The driver answers; the rider asks and withdraws. Neither does the other's
-- job — the same split 0098 enforces for dated requests.
create or replace function public.guard_ride_standing_role() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid;
begin
  if auth.uid() is null then return NEW; end if;
  select driver_user_id into v_driver from public.rides where id = NEW.ride_id;

  if auth.uid() = v_driver then
    NEW.seats := OLD.seats;
    NEW.note  := OLD.note;
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

drop trigger if exists trg_guard_ride_standing_role on public.ride_standing;
create trigger trg_guard_ride_standing_role
  before update on public.ride_standing
  for each row execute function public.guard_ride_standing_role();

-- Skips belong to the rider whose arrangement they are.
create policy ride_standing_skips_rw on public.ride_standing_skips for all to authenticated
  using (
    exists (select 1 from public.ride_standing s where s.id = standing_id and s.rider_user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.ride_standing s where s.id = standing_id and s.rider_user_id = auth.uid())
  );

-- The driver needs to see who is not coming tomorrow, or the skip is private
-- information about their own car.
create policy ride_standing_skips_driver_read on public.ride_standing_skips for select using (
  exists (
    select 1 from public.ride_standing s
      join public.rides r on r.id = s.ride_id
     where s.id = standing_id and r.driver_user_id = auth.uid()
  )
);

-- ─── Telling people ──────────────────────────────────────────────────
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
      r.community_id, 'listing', NEW.ride_id, NEW.rider_user_id, r.driver_user_id,
      v_who || ' wants a regular seat',
      'Every week · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );

  elsif NEW.status is distinct from OLD.status and NEW.status in ('accepted', 'declined') then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      r.community_id, 'listing', NEW.ride_id, r.driver_user_id, NEW.rider_user_id,
      case NEW.status when 'accepted' then 'Regular seat confirmed 🚗' else 'Regular seat declined' end,
      'Every week · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_on_ride_standing on public.ride_standing;
create trigger trg_on_ride_standing
  after insert or update on public.ride_standing
  for each row execute function public.on_ride_standing();
