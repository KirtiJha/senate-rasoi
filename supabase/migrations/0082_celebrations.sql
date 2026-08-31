-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0082: celebrations
-- Run AFTER 0001–0081.
--
-- 0069 built the bones: an event, a core team with roles, one contribution row
-- per flat, expenses with vendor and receipt, and totals. This adds what a
-- committee actually needs to run a Ganesh Chaturthi or a Diwali night without
-- a parallel WhatsApp group and a spreadsheet.
--
-- What is new: tasks with progress, per-person contributions, opting out,
-- budget line items, money carried forward from last time, and sponsorships.
-- ════════════════════════════════════════════════════════════════════

-- ─── How the money is split, and what is already in hand ────────────
alter table public.society_events
  add column if not exists contribution_basis text not null default 'flat'
    check (contribution_basis in ('flat', 'person'));

-- Money left over from a previous celebration, and how much of it this one is
-- actually using. Two columns rather than one because "we have ₹8,000 left"
-- and "we are spending ₹5,000 of it" are different facts, and a committee will
-- be asked both.
alter table public.society_events
  add column if not exists carry_in_available numeric(12,2) not null default 0
    check (carry_in_available >= 0);
alter table public.society_events
  add column if not exists carry_in_used numeric(12,2) not null default 0
    check (carry_in_used >= 0);
alter table public.society_events
  add column if not exists carry_in_note text;

-- ─── What the money is for ──────────────────────────────────────────
-- A budget of "₹60,000" is a number nobody can argue with or plan against.
-- Line items are what turn it into a decision: the pandal is ₹18,000, and that
-- is the row somebody can question before it is spent.
create table public.event_budget_items (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.society_events(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  category     text not null default 'misc'
                 check (category in ('decor','food','sound','priest','prizes','venue','gifts','misc')),
  estimated    numeric(12,2) not null check (estimated >= 0),
  note         text,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index event_budget_event_idx on public.event_budget_items (event_id);

-- ─── Who is doing what ──────────────────────────────────────────────
create table public.event_tasks (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.society_events(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  detail       text,
  -- Nullable: a task can exist before anyone has agreed to own it, and
  -- pretending otherwise means unowned work simply never gets written down.
  assignee_id  uuid references public.profiles(id) on delete set null,
  due_date     date,
  status       text not null default 'todo'
                 check (status in ('todo','doing','blocked','done')),
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index event_tasks_event_idx on public.event_tasks (event_id, due_date nulls last);
create index event_tasks_assignee_idx on public.event_tasks (assignee_id);

-- Progress as a thread, not a single status field.
--
-- "Sound system — done" tells you nothing when the speakers turn out to be
-- half the size promised. An update carries what changed, optionally a photo,
-- and the status it moved to — so the history of a task survives the task
-- being marked complete.
create table public.event_task_updates (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.event_tasks(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  note         text,
  photo_url    text,
  status_after text check (status_after in ('todo','doing','blocked','done')),
  created_at   timestamptz not null default now(),
  -- An update that says nothing and shows nothing is noise.
  check (note is not null or photo_url is not null or status_after is not null)
);

create index event_task_updates_idx on public.event_task_updates (task_id, created_at);

-- ─── Sponsorships ───────────────────────────────────────────────────
-- Money and things, in one table.
--
-- Someone paying for the sound system and someone donating prasad are the same
-- act of generosity and belong on the same list — but only the first can be
-- added to a collection total, which is why `kind` decides whether `amount`
-- means anything.
create table public.event_sponsorships (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.society_events(id) on delete cascade,
  community_id  uuid not null references public.communities(id) on delete cascade,
  kind          text not null check (kind in ('money','item')),
  -- Free text, because the most generous person in the society may not have an
  -- account, and the ledger still has to name them.
  sponsor_name  text not null,
  sponsor_user_id uuid references public.profiles(id) on delete set null,
  sponsor_flat  text,
  amount        numeric(12,2) check (amount is null or amount >= 0),
  item          text,
  quantity      text,
  note          text,
  receipt_url   text,
  status        text not null default 'pledged' check (status in ('pledged','received')),
  recorded_by   uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- Money needs an amount; an item needs a name. Neither is optional for the
  -- kind it belongs to, or the ledger stops adding up.
  check ((kind = 'money' and amount is not null) or (kind = 'item' and item is not null))
);

create index event_sponsor_event_idx on public.event_sponsorships (event_id);

-- ─── Contributions: opting out, and counting heads ──────────────────
alter table public.event_contributions
  add column if not exists opted_out boolean not null default false;

-- How many people this flat is contributing for, when the split is per person.
-- Null on a per-flat celebration, where the question does not arise.
alter table public.event_contributions
  add column if not exists head_count integer
    check (head_count is null or head_count > 0);

-- Contributions could record a method and a note but never a receipt, while
-- expenses could. The person paying deserves the same proof as the person
-- spending.
alter table public.event_contributions
  add column if not exists receipt_url text;

-- ─── Access ─────────────────────────────────────────────────────────
alter table public.event_budget_items  enable row level security;
alter table public.event_tasks         enable row level security;
alter table public.event_task_updates  enable row level security;
alter table public.event_sponsorships  enable row level security;

-- Who may run a celebration: its core team, or a society admin.
create or replace function public.can_manage_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_team t
     where t.event_id = p_event and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.society_events e
     join public.profiles p on p.id = auth.uid()
    where e.id = p_event and e.community_id = p.community_id and 'admin' = any(p.roles)
  );
$$;

revoke all on function public.can_manage_event(uuid) from public;
grant execute on function public.can_manage_event(uuid) to authenticated;

-- Everything about a celebration is readable by the society it belongs to.
-- A collection nobody can inspect is how a collection loses trust.
create or replace function public.can_see_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.society_events e
     join public.profiles p on p.id = auth.uid()
    where e.id = p_event and e.community_id = p.community_id
  );
$$;

revoke all on function public.can_see_event(uuid) from public;
grant execute on function public.can_see_event(uuid) to authenticated;

create policy budget_read   on public.event_budget_items for select using (public.can_see_event(event_id));
create policy budget_write  on public.event_budget_items for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy tasks_read    on public.event_tasks for select using (public.can_see_event(event_id));
create policy tasks_write   on public.event_tasks for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy sponsor_read  on public.event_sponsorships for select using (public.can_see_event(event_id));
create policy sponsor_write on public.event_sponsorships for all
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy task_updates_read on public.event_task_updates for select using (
  exists (select 1 from public.event_tasks t where t.id = task_id and public.can_see_event(t.event_id))
);

-- The assignee posts progress too, not only the committee. Someone given a job
-- who cannot report on it will report in WhatsApp instead, which is the thing
-- this replaces.
create policy task_updates_write on public.event_task_updates for insert with check (
  auth.uid() = author_id
  and exists (
    select 1 from public.event_tasks t
     where t.id = task_id
       and (public.can_manage_event(t.event_id) or t.assignee_id = auth.uid())
  )
);

-- Keep the task's own status and timestamp in step with its latest update, so
-- the board never disagrees with the thread underneath it.
create or replace function public.event_task_touch() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.event_tasks
     set status     = coalesce(NEW.status_after, status),
         updated_at = now()
   where id = NEW.task_id;
  return NEW;
end; $$;

drop trigger if exists trg_event_task_touch on public.event_task_updates;
create trigger trg_event_task_touch after insert on public.event_task_updates
  for each row execute function public.event_task_touch();
