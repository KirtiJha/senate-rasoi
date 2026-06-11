-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0043: sports court bookings, attendance & cost-split
-- Run AFTER 0001–0042.
--
-- A group member books a court (recurring weekly / daily / one-off). Each
-- occurrence is a "session". Group members confirm or decline each session; the
-- confirmed set are the players. After a session ends, its charge is split
-- equally among the confirmed players (incl. the booker). Non-booker players
-- settle their share to the booker over UPI; the booker confirms receipt.
--
-- Dues are computed dynamically (charge / confirmed-count after the session
-- ends), so no cron is needed. court_payments records each settlement.
-- ════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────
create table if not exists public.court_bookings (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.sport_groups(id) on delete cascade,
  community_id   uuid not null references public.communities(id) on delete cascade,
  booker_user_id uuid not null references public.profiles(id) on delete cascade,
  title          text,
  location       text,
  days_of_week   int[] not null default '{}',   -- 0=Sun … 6=Sat
  start_time     text,                            -- 'HH:MM' (24h)
  duration_min   int  not null default 60,
  charge         numeric(10,2) not null default 0, -- per session
  upi_id         text,
  created_at     timestamptz not null default now()
);
create index if not exists court_bookings_group_idx on public.court_bookings (group_id);

create table if not exists public.court_sessions (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.court_bookings(id) on delete cascade,
  group_id     uuid not null references public.sport_groups(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  session_date date not null,
  start_time   text,
  duration_min int  not null default 60,
  charge       numeric(10,2) not null default 0,
  status       text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at   timestamptz not null default now(),
  unique (booking_id, session_date)
);
create index if not exists court_sessions_group_date_idx on public.court_sessions (group_id, session_date);

create table if not exists public.court_session_players (
  session_id   uuid not null references public.court_sessions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null check (status in ('confirmed', 'declined')),
  responded_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index if not exists csp_user_idx on public.court_session_players (user_id);

create table if not exists public.court_payments (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.court_sessions(id) on delete cascade,
  group_id       uuid not null references public.sport_groups(id) on delete cascade,
  community_id   uuid not null references public.communities(id) on delete cascade,
  payer_user_id  uuid not null references public.profiles(id) on delete cascade,
  payee_user_id  uuid not null references public.profiles(id) on delete cascade,
  amount         numeric(10,2) not null,
  status         text not null default 'initiated' check (status in ('initiated', 'paid', 'cancelled')),
  upi_id         text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  unique (session_id, payer_user_id)
);
create index if not exists court_payments_payer_idx on public.court_payments (payer_user_id);
create index if not exists court_payments_payee_idx on public.court_payments (payee_user_id);

-- ── Helpers ─────────────────────────────────────────────────────────
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.sport_group_members m where m.group_id = p_group and m.user_id = auth.uid());
$$;

create or replace function public.court_session_in_my_community(p_session uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.court_sessions s join public.profiles p on p.id = auth.uid()
    where s.id = p_session and s.community_id = p.community_id
  );
$$;

create or replace function public.court_session_is_booker(p_session uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.court_sessions s join public.court_bookings b on b.id = s.booking_id
    where s.id = p_session and b.booker_user_id = auth.uid()
  );
$$;

-- ── RLS: court_bookings ─────────────────────────────────────────────
alter table public.court_bookings enable row level security;
drop policy if exists cb_read on public.court_bookings;
create policy cb_read on public.court_bookings for select using (public.group_in_my_community(group_id));
drop policy if exists cb_insert on public.court_bookings;
create policy cb_insert on public.court_bookings for insert
  with check (booker_user_id = auth.uid() and public.group_in_my_community(group_id));
drop policy if exists cb_update on public.court_bookings;
create policy cb_update on public.court_bookings for update
  using (booker_user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists cb_delete on public.court_bookings;
create policy cb_delete on public.court_bookings for delete
  using (booker_user_id = auth.uid() or public.is_admin(auth.uid()));

-- ── RLS: court_sessions ─────────────────────────────────────────────
alter table public.court_sessions enable row level security;
drop policy if exists cs_read on public.court_sessions;
create policy cs_read on public.court_sessions for select using (public.group_in_my_community(group_id));
drop policy if exists cs_insert on public.court_sessions;
create policy cs_insert on public.court_sessions for insert with check (
  exists (select 1 from public.court_bookings b where b.id = booking_id and b.booker_user_id = auth.uid())
);
drop policy if exists cs_update on public.court_sessions;
create policy cs_update on public.court_sessions for update using (
  public.court_session_is_booker(id) or public.is_admin(auth.uid())
);
drop policy if exists cs_delete on public.court_sessions;
create policy cs_delete on public.court_sessions for delete using (
  public.court_session_is_booker(id) or public.is_admin(auth.uid())
);

-- ── RLS: court_session_players (confirm / decline yourself) ─────────
alter table public.court_session_players enable row level security;
drop policy if exists csp_read on public.court_session_players;
create policy csp_read on public.court_session_players for select using (public.court_session_in_my_community(session_id));
drop policy if exists csp_insert on public.court_session_players;
create policy csp_insert on public.court_session_players for insert
  with check (user_id = auth.uid() and public.court_session_in_my_community(session_id));
drop policy if exists csp_update on public.court_session_players;
create policy csp_update on public.court_session_players for update using (user_id = auth.uid());
drop policy if exists csp_delete on public.court_session_players;
create policy csp_delete on public.court_session_players for delete using (
  user_id = auth.uid() or public.court_session_is_booker(session_id) or public.is_admin(auth.uid())
);

-- ── RLS: court_payments ─────────────────────────────────────────────
alter table public.court_payments enable row level security;
drop policy if exists cp_read on public.court_payments;
create policy cp_read on public.court_payments for select using (
  payer_user_id = auth.uid() or payee_user_id = auth.uid() or public.is_admin(auth.uid())
);
drop policy if exists cp_insert on public.court_payments;
create policy cp_insert on public.court_payments for insert with check (payer_user_id = auth.uid());
drop policy if exists cp_update on public.court_payments;
create policy cp_update on public.court_payments for update using (
  payee_user_id = auth.uid() or payer_user_id = auth.uid()
);
drop policy if exists cp_delete on public.court_payments;
create policy cp_delete on public.court_payments for delete using (payer_user_id = auth.uid());

-- Booker confirms a payment was received (payee-only), marks it paid.
create or replace function public.court_payment_mark_paid(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update public.court_payments
    set status = 'paid', paid_at = now()
    where id = p_id and payee_user_id = auth.uid() and status <> 'cancelled'
    returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

-- ── Notify group members when a court is booked ─────────────────────
create or replace function public.notify_court_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_gname text; v_booker text;
begin
  select name into v_gname from public.sport_groups where id = NEW.group_id;
  select name into v_booker from public.profiles where id = NEW.booker_user_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select NEW.community_id, 'court', NEW.id, NEW.booker_user_id, m.user_id,
         coalesce(v_booker, 'A member') || ' booked the court',
         coalesce(NEW.title, coalesce(v_gname, 'Court')) || ' — confirm the days you can play',
         '/sports/' || NEW.group_id::text
  from public.sport_group_members m
  where m.group_id = NEW.group_id and m.user_id <> NEW.booker_user_id;
  return NEW;
end; $$;
drop trigger if exists trg_court_booking_notify on public.court_bookings;
create trigger trg_court_booking_notify after insert on public.court_bookings
  for each row execute function public.notify_court_booking();

-- ── Realtime ────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.court_bookings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.court_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.court_session_players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.court_payments; exception when duplicate_object then null; end $$;
