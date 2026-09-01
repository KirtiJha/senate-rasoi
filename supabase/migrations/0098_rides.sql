-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0098: rides you can actually book
-- Run AFTER 0001–0097.
--
-- Carpooling was a classified ad. "Join ride" wrote an *inquiry* — a message
-- with no accept, no decline and no state — so a neighbour who asked to join
-- saw "Sent" forever and the driver had no button to say yes. `seats` was a
-- number nobody decremented. `schedule` was the text "Daily" with no rides
-- behind it, so nothing could list what was on tomorrow. `departure_time` was
-- free text like "9am", which cannot be sorted or reminded on.
--
-- A ride is a booking, so it needs to be one.
--
-- TWO TABLES, NOT THREE. A recurring ride is one row plus a set of weekdays;
-- the individual journeys are never materialised. A request carries the DATE
-- it is for, which is what turns "Tuesdays at 9" into "this Tuesday, two
-- seats". Materialising every future journey would mean a nightly job and a
-- table that grows forever, to store rows almost all of which nobody books.
-- ════════════════════════════════════════════════════════════════════

create table public.rides (
  id             uuid primary key default gen_random_uuid(),
  community_id   uuid not null references public.communities(id) on delete cascade,
  driver_user_id uuid not null references public.profiles(id)    on delete cascade,

  -- Free text on purpose. The map is a Google Maps deep link, and Google
  -- geocodes "DS Max Senate gate" better than a resident can pick a pin.
  from_text      text not null check (char_length(trim(from_text)) > 0),
  to_text        text not null check (char_length(trim(to_text)) > 0),

  depart_time    time not null,
  -- Roughly how long, so a rider knows whether this fits their morning.
  duration_min   integer check (duration_min is null or duration_min > 0),

  -- Recurring (0 = Sunday, matching tiffin_plans) or a single date. Exactly
  -- one of the two.
  days_of_week   int[] not null default '{}',
  one_off_date   date,

  seats_total    integer not null check (seats_total > 0 and seats_total <= 8),
  -- Null means "we'll sort it out" — plenty of society lifts are free.
  price_per_seat integer check (price_per_seat is null or price_per_seat >= 0),

  preference     text not null default 'all' check (preference in ('all', 'women', 'men')),
  vehicle        text,
  note           text,

  active         boolean not null default true,
  created_at     timestamptz not null default now(),

  constraint rides_when check (
    (cardinality(days_of_week) > 0 and one_off_date is null)
    or (cardinality(days_of_week) = 0 and one_off_date is not null)
  )
);

create index rides_live_idx on public.rides (community_id, active, depart_time);
create index rides_driver_idx on public.rides (driver_user_id);

-- ─── Asking for a seat ───────────────────────────────────────────────
create table public.ride_requests (
  id             uuid primary key default gen_random_uuid(),
  ride_id        uuid not null references public.rides(id) on delete cascade,
  rider_user_id  uuid not null references public.profiles(id) on delete cascade,

  -- Which journey. This is what makes a recurring ride bookable without
  -- inventing a row for every future Tuesday.
  ride_date      date not null,
  seats          integer not null default 1 check (seats > 0 and seats <= 8),

  status         text not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- One ask per person per journey. Asking again edits the same row rather
  -- than queueing a second seat behind the first.
  unique (ride_id, rider_user_id, ride_date)
);

create index ride_requests_ride_idx  on public.ride_requests (ride_id, ride_date, status);
create index ride_requests_rider_idx on public.ride_requests (rider_user_id, ride_date desc);

-- ─── Seats are finite ────────────────────────────────────────────────
--
-- Checked here rather than in the app: two riders accepting into the last seat
-- at the same moment would both pass a client-side check.
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

  select coalesce(sum(seats), 0) into v_taken
    from public.ride_requests
   where ride_id = NEW.ride_id
     and ride_date = NEW.ride_date
     and status = 'accepted'
     and id <> NEW.id;

  if v_taken + NEW.seats > v_total then
    raise exception 'Only % seat(s) left on this ride.', greatest(v_total - v_taken, 0)
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_guard_ride_seats on public.ride_requests;
create trigger trg_guard_ride_seats
  before insert or update on public.ride_requests
  for each row execute function public.guard_ride_seats();

create or replace function public.ride_request_touch() returns trigger
  language plpgsql set search_path = public as $$
begin NEW.updated_at := now(); return NEW; end; $$;

drop trigger if exists trg_ride_request_touch on public.ride_requests;
create trigger trg_ride_request_touch before update on public.ride_requests
  for each row execute function public.ride_request_touch();

-- ─── Access ──────────────────────────────────────────────────────────
alter table public.rides         enable row level security;
alter table public.ride_requests enable row level security;

create policy rides_read on public.rides for select using (public.is_my_community(community_id));

create policy rides_write on public.rides for all to authenticated
  using (driver_user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (
    (driver_user_id = auth.uid() or public.is_admin(auth.uid()))
    and public.is_my_community(community_id)
  );

-- A request is between two people: the rider and the driver. Nobody else in
-- the society needs to see who asked for a lift and was turned down.
create policy ride_requests_read on public.ride_requests for select using (
  rider_user_id = auth.uid()
  or exists (select 1 from public.rides r where r.id = ride_id and r.driver_user_id = auth.uid())
);

create policy ride_requests_insert on public.ride_requests for insert to authenticated
  with check (
    rider_user_id = auth.uid()
    and exists (
      select 1 from public.rides r
       where r.id = ride_id and r.active and public.is_my_community(r.community_id)
    )
  );

-- The driver decides accepted/declined; the rider may withdraw. The guard
-- below stops either from doing the other's job.
create policy ride_requests_update on public.ride_requests for update to authenticated
  using (
    rider_user_id = auth.uid()
    or exists (select 1 from public.rides r where r.id = ride_id and r.driver_user_id = auth.uid())
  );

create policy ride_requests_delete on public.ride_requests for delete to authenticated
  using (rider_user_id = auth.uid());

create or replace function public.guard_ride_request_role() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid;
begin
  if auth.uid() is null then return NEW; end if;
  select driver_user_id into v_driver from public.rides where id = NEW.ride_id;

  if auth.uid() = v_driver then
    -- The driver answers; they do not get to rewrite the ask itself.
    NEW.seats := OLD.seats;
    NEW.note  := OLD.note;
    if NEW.status not in ('accepted', 'declined', 'pending') then
      NEW.status := OLD.status;
    end if;
  else
    -- The rider may change their own ask or withdraw, never approve it.
    if NEW.status is distinct from OLD.status and NEW.status <> 'cancelled' then
      NEW.status := OLD.status;
    end if;
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_guard_ride_request_role on public.ride_requests;
create trigger trg_guard_ride_request_role
  before update on public.ride_requests
  for each row execute function public.guard_ride_request_role();

-- ─── Telling people ──────────────────────────────────────────────────
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
      r.community_id, 'listing', NEW.ride_id, NEW.rider_user_id, r.driver_user_id,
      v_who || ' wants a seat',
      to_char(NEW.ride_date, 'FMDay FMDD Mon') || ' · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );

  elsif NEW.status is distinct from OLD.status and NEW.status in ('accepted', 'declined') then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      r.community_id, 'listing', NEW.ride_id, r.driver_user_id, NEW.rider_user_id,
      case NEW.status when 'accepted' then 'Seat confirmed 🚗' else 'Ride declined' end,
      to_char(NEW.ride_date, 'FMDay FMDD Mon') || ' · ' || r.from_text || ' → ' || r.to_text,
      '/rides/' || NEW.ride_id
    );
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_on_ride_request on public.ride_requests;
create trigger trg_on_ride_request
  after insert or update on public.ride_requests
  for each row execute function public.on_ride_request();
