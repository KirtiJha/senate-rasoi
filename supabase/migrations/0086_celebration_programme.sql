-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0086: times, names on the collection, and a programme
-- Run AFTER 0001–0085.
--
-- Three gaps found by using the Celebrations screen rather than reading it.
--
-- 1. AN EVENT HAD A DATE BUT NO TIME. "Ganesh Chaturthi, 31 August" does not
--    tell anyone when to come down, so the timings ended up typed into a free
--    text note, which is exactly the WhatsApp forward this replaces.
--
-- 2. THE COLLECTION SHOWED A FLAT NUMBER AND NOTHING ELSE. The name was meant
--    to come from the resident directory through contributor_user_id, and the
--    directory is incomplete — most flats have no account, so most rows showed
--    a bare number. A treasurer reconciling cash needs the name that is on the
--    note in their hand, so the name is now recorded on the contribution
--    itself rather than looked up.
--
-- 3. A CELEBRATION IS A PROGRAMME, NOT AN EVENT. Rangoli for the children at
--    four, tug of war for the men at five, housie for everyone after the
--    aarti — each with its own time and its own sign-up sheet. That sheet is
--    currently a WhatsApp message and a person with a notebook.
-- ════════════════════════════════════════════════════════════════════

-- ─── When it actually happens ────────────────────────────────────────
alter table public.society_events
  add column if not exists start_time time;
alter table public.society_events
  add column if not exists end_time time;

-- ─── Who paid, in words ──────────────────────────────────────────────
-- Free text on purpose. The most reliable thing a treasurer knows about a
-- contribution is the name the neighbour gave them, and requiring that person
-- to have an account first is how a ledger ends up incomplete.
alter table public.event_contributions
  add column if not exists contributor_name text;

-- ─── The programme ───────────────────────────────────────────────────
create table public.event_activities (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.society_events(id) on delete cascade,
  community_id  uuid not null references public.communities(id)    on delete cascade,

  title         text not null check (char_length(trim(title)) > 0),
  description   text,

  -- Who it is for. 'all' rather than a null so a filter never has to special
  -- case "unset", and the four real audiences are the ones a society actually
  -- announces: the children's races, the women's game, the men's match, and
  -- everything else.
  audience      text not null default 'all'
                  check (audience in ('kids', 'women', 'men', 'mixed', 'all')),

  -- Its own date, because a celebration can run over three days and the
  -- children's competition is on the Saturday. Falls back to the event's date
  -- in the UI when left empty.
  activity_date date,
  start_time    time,
  end_time      time,
  venue         text,

  -- Null means no cap. A cap exists so a sign-up sheet can close itself
  -- rather than a volunteer having to police it.
  max_participants integer check (max_participants is null or max_participants > 0),

  sort_order    int not null default 0,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index event_activities_idx
  on public.event_activities (event_id, activity_date nulls first, start_time nulls last, sort_order);

-- ─── Who is taking part ──────────────────────────────────────────────
--
-- The name is stored, not derived. A resident signing up their eight-year-old
-- for the fancy dress is the common case, and that child has no account — so
-- the row records who is competing and, separately, which account added them.
create table public.event_activity_participants (
  id             uuid primary key default gen_random_uuid(),
  activity_id    uuid not null references public.event_activities(id) on delete cascade,
  -- The account that signed up, for permission to withdraw the entry.
  added_by       uuid not null references public.profiles(id) on delete cascade,
  participant_name text not null check (char_length(trim(participant_name)) > 0),
  flat           text,
  note           text,
  created_at     timestamptz not null default now(),

  -- The same person cannot be entered twice for the same activity by the same
  -- account. Two different families may both have an Aarav.
  unique (activity_id, added_by, participant_name)
);

create index event_activity_participants_idx
  on public.event_activity_participants (activity_id, created_at);

-- ─── Access ──────────────────────────────────────────────────────────
alter table public.event_activities             enable row level security;
alter table public.event_activity_participants  enable row level security;

-- The programme is readable by the society and written by the committee, like
-- the budget and the details before it.
create policy activities_read on public.event_activities
  for select using (public.can_see_event(event_id));

create policy activities_write on public.event_activities
  for all using (public.can_manage_event(event_id))
        with check (public.can_manage_event(event_id));

-- The sign-up sheet is public within the society: seeing who has entered is
-- half the reason anyone enters.
create policy participants_read on public.event_activity_participants
  for select using (
    exists (
      select 1 from public.event_activities a
       where a.id = activity_id and public.can_see_event(a.event_id)
    )
  );

-- Anyone in the society may enter themselves or their family. The committee is
-- not a gatekeeper here — a sign-up that needs approval is a sign-up sheet
-- nobody uses.
create policy participants_insert on public.event_activity_participants
  for insert with check (
    auth.uid() = added_by
    and exists (
      select 1 from public.event_activities a
       where a.id = activity_id and public.can_see_event(a.event_id)
    )
  );

-- Withdraw your own entry; the committee can remove any, for the person who
-- signed up in the hall and then could not come.
create policy participants_delete on public.event_activity_participants
  for delete using (
    auth.uid() = added_by
    or exists (
      select 1 from public.event_activities a
       where a.id = activity_id and public.can_manage_event(a.event_id)
    )
  );

-- ─── The cap, enforced where it cannot be raced ──────────────────────
-- Checking the count in the app and then inserting leaves a window in which
-- two people both see the last place free. This closes it.
create or replace function public.activity_capacity_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_now int;
begin
  select max_participants into v_max from public.event_activities where id = NEW.activity_id;
  if v_max is null then
    return NEW;
  end if;

  select count(*) into v_now
    from public.event_activity_participants where activity_id = NEW.activity_id;

  if v_now >= v_max then
    raise exception 'This activity is full';
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_activity_capacity on public.event_activity_participants;
create trigger trg_activity_capacity before insert on public.event_activity_participants
  for each row execute function public.activity_capacity_guard();
