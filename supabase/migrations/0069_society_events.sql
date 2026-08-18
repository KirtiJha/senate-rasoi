-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0069: society functions & events (Phase 1)
-- Run AFTER 0001–0068.
--
-- One EVENT (a function like Diwali or Ganesh Chaturthi) with two ledgers:
--   • event_contributions — money IN, one row per FLAT
--   • event_expenses      — money OUT, each with a bill attached
-- The transparency report is a live view over those two ledgers, never an
-- authored document, so it cannot drift from what actually happened.
--
-- An event_team is per-function and disbands afterwards. It is NOT the society
-- managing committee — that concept deliberately does not exist in Aangan.
--
-- Aangan never holds money. UPI goes resident → treasurer directly; these
-- tables only RECORD that it happened, exactly like court_payments (0043).
-- ════════════════════════════════════════════════════════════════════

-- ─── The event ───────────────────────────────────────────────────────
create table if not exists public.society_events (
  id                    uuid        primary key default gen_random_uuid(),
  community_id          uuid        not null references public.communities(id) on delete cascade,
  created_by            uuid        not null references public.profiles(id)    on delete cascade,
  title                 text        not null,
  description           text,
  event_date            date,
  venue                 text,
  status                text        not null default 'draft'
                          check (status in ('draft','collecting','ongoing','completed','cancelled')),
  budget_amount         numeric(12,2) check (budget_amount    is null or budget_amount    >= 0),
  suggested_contribution numeric(10,2) check (suggested_contribution is null or suggested_contribution >= 0),
  cover_photo_url       text,
  created_at            timestamptz not null default now(),
  bump_at               timestamptz not null default now()
);

create index if not exists events_feed_idx on public.society_events (community_id, event_date desc nulls last);

-- ─── Core team ───────────────────────────────────────────────────────
create table if not exists public.event_team (
  event_id  uuid        not null references public.society_events(id) on delete cascade,
  user_id   uuid        not null references public.profiles(id)       on delete cascade,
  role      text        not null default 'member' check (role in ('lead','treasurer','member')),
  added_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_team_user_idx on public.event_team (user_id);

-- ─── Money in — one row per flat ─────────────────────────────────────
create table if not exists public.event_contributions (
  id                  uuid        primary key default gen_random_uuid(),
  event_id            uuid        not null references public.society_events(id) on delete cascade,
  community_id        uuid        not null references public.communities(id)    on delete cascade,
  flat                text        not null,
  -- Nullable on purpose: a flat may have no Aangan account yet, and the
  -- treasurer still needs to record their cash or the totals under-count.
  contributor_user_id uuid        references public.profiles(id) on delete set null,
  amount              numeric(10,2) not null default 0 check (amount >= 0),
  status              text        not null default 'pending'
                        check (status in ('pending','initiated','received','waived')),
  method              text        check (method in ('upi','cash','bank')),
  note                text,
  recorded_by         uuid        references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  received_at         timestamptz,
  unique (event_id, flat)   -- one contribution per flat; can't be collected twice
);

create index if not exists event_contrib_event_idx on public.event_contributions (event_id, status);
create index if not exists event_contrib_user_idx  on public.event_contributions (contributor_user_id);

-- ─── Money out — each with its bill ──────────────────────────────────
create table if not exists public.event_expenses (
  id              uuid        primary key default gen_random_uuid(),
  event_id        uuid        not null references public.society_events(id) on delete cascade,
  community_id    uuid        not null references public.communities(id)    on delete cascade,
  title           text        not null,
  category        text        not null default 'misc'
                    check (category in ('decor','food','sound','priest','prizes','venue','gifts','misc')),
  amount          numeric(12,2) not null check (amount >= 0),
  vendor          text,
  spent_on        date,
  paid_by_user_id uuid        references public.profiles(id) on delete set null,
  receipt_url     text,
  status          text        not null default 'pending' check (status in ('pending','approved')),
  created_by      uuid        not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index if not exists event_exp_event_idx on public.event_expenses (event_id, spent_on desc nulls last);

-- ─── Role helpers ────────────────────────────────────────────────────
-- SECURITY DEFINER so they can be used inside policies on event_team itself
-- without recursing through that table's own RLS.

create or replace function public.is_event_team(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_team where event_id = p_event and user_id = auth.uid())
      or public.is_admin(auth.uid());
$$;

create or replace function public.is_event_lead(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.event_team
            where event_id = p_event and user_id = auth.uid() and role = 'lead'
         )
      or public.is_admin(auth.uid());
$$;

-- Treasurer OR lead OR admin — the people who may touch the money in.
create or replace function public.is_event_treasurer(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from public.event_team
            where event_id = p_event and user_id = auth.uid() and role in ('treasurer','lead')
         )
      or public.is_admin(auth.uid());
$$;

-- A completed event's books are closed — see the trigger below.
create or replace function public.is_event_locked(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.society_events where id = p_event and status = 'completed');
$$;

grant execute on function public.is_event_team(uuid)       to authenticated;
grant execute on function public.is_event_lead(uuid)       to authenticated;
grant execute on function public.is_event_treasurer(uuid)  to authenticated;
grant execute on function public.is_event_locked(uuid)     to authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.society_events      enable row level security;
alter table public.event_team          enable row level security;
alter table public.event_contributions enable row level security;
alter table public.event_expenses      enable row level security;

-- Events: everyone in the society reads. Only admins create (they then appoint
-- a lead). Lead or admin edits.
drop policy if exists ev_read on public.society_events;
create policy ev_read on public.society_events for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

drop policy if exists ev_insert on public.society_events;
create policy ev_insert on public.society_events for insert to authenticated
  with check (public.is_admin(auth.uid()) and public.is_my_community(community_id));

drop policy if exists ev_update on public.society_events;
create policy ev_update on public.society_events for update to authenticated
  using (public.is_event_lead(id));

drop policy if exists ev_delete on public.society_events;
create policy ev_delete on public.society_events for delete to authenticated
  using (public.is_admin(auth.uid()));

-- Team: everyone reads (transparency — you can see who is running it).
drop policy if exists et_read on public.event_team;
create policy et_read on public.event_team for select to authenticated using (true);

drop policy if exists et_write on public.event_team;
create policy et_write on public.event_team for all to authenticated
  using (public.is_event_lead(event_id))
  with check (public.is_event_lead(event_id));

-- Contributions: EVERY resident reads every row — that is the whole point.
-- Only the treasurer/lead/admin writes.
drop policy if exists ec_read on public.event_contributions;
create policy ec_read on public.event_contributions for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

drop policy if exists ec_insert on public.event_contributions;
create policy ec_insert on public.event_contributions for insert to authenticated
  with check (public.is_event_treasurer(event_id) and public.is_my_community(community_id));

drop policy if exists ec_update on public.event_contributions;
create policy ec_update on public.event_contributions for update to authenticated
  using (public.is_event_treasurer(event_id));

drop policy if exists ec_delete on public.event_contributions;
create policy ec_delete on public.event_contributions for delete to authenticated
  using (public.is_event_treasurer(event_id));

-- Expenses: everyone reads. Any team member adds; lead/treasurer approves.
drop policy if exists ex_read on public.event_expenses;
create policy ex_read on public.event_expenses for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

drop policy if exists ex_insert on public.event_expenses;
create policy ex_insert on public.event_expenses for insert to authenticated
  with check (public.is_event_team(event_id) and created_by = auth.uid()
              and public.is_my_community(community_id));

drop policy if exists ex_update on public.event_expenses;
create policy ex_update on public.event_expenses for update to authenticated
  using (public.is_event_treasurer(event_id) or created_by = auth.uid());

drop policy if exists ex_delete on public.event_expenses;
create policy ex_delete on public.event_expenses for delete to authenticated
  using (public.is_event_treasurer(event_id) or created_by = auth.uid());

-- ─── Closing the books ───────────────────────────────────────────────
-- Once an event is 'completed' the published report must not be quietly
-- rewritten, or transparency is meaningless. Admins keep an escape hatch for
-- genuine corrections (re-open the event, fix, complete again).
create or replace function public.guard_event_locked()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
begin
  v_event := coalesce(new.event_id, old.event_id);
  if public.is_event_locked(v_event) and not public.is_admin(auth.uid()) then
    raise exception 'This function is completed — its accounts are closed.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists ec_lock_guard on public.event_contributions;
create trigger ec_lock_guard
  before insert or update or delete on public.event_contributions
  for each row execute function public.guard_event_locked();

drop trigger if exists ex_lock_guard on public.event_expenses;
create trigger ex_lock_guard
  before insert or update or delete on public.event_expenses
  for each row execute function public.guard_event_locked();

-- ─── Notifications ───────────────────────────────────────────────────
-- New function announced, and the report published. Both ride the 0066 push
-- fan-out automatically.
create or replace function public.on_society_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (new.community_id, 'event', new.id, new.created_by, null,
            '🎉 ' || new.title,
            'A new society function has been announced. Tap for details.',
            '/events/' || new.id);

  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'collecting' then
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (new.community_id, 'event', new.id, new.created_by, null,
              '💰 Contributions open — ' || new.title,
              case when new.suggested_contribution is not null
                   then 'Suggested contribution: ₹' || new.suggested_contribution::text || ' per flat.'
                   else 'Tap to see how to contribute.' end,
              '/events/' || new.id || '/contributions');

    elsif new.status = 'completed' then
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (new.community_id, 'event', new.id, new.created_by, null,
              '📊 Accounts published — ' || new.title,
              'The full income and expense report is now open to everyone.',
              '/events/' || new.id || '/report');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists society_event_notify on public.society_events;
create trigger society_event_notify
  after insert or update on public.society_events
  for each row execute function public.on_society_event_change();

-- Tell a contributor when their money is confirmed received — their receipt.
create or replace function public.on_contribution_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if new.contributor_user_id is not null
     and new.status = 'received'
     and old.status is distinct from 'received' then
    select title into v_title from public.society_events where id = new.event_id;
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (new.community_id, 'event', new.event_id, new.recorded_by, new.contributor_user_id,
            '✅ Contribution received',
            'Your ₹' || new.amount::text || ' for ' || coalesce(v_title, 'the function') || ' has been recorded.',
            '/events/' || new.event_id || '/report');
  end if;
  return new;
end;
$$;

drop trigger if exists contribution_received_notify on public.event_contributions;
create trigger contribution_received_notify
  after update on public.event_contributions
  for each row execute function public.on_contribution_received();
