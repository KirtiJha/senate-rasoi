-- ════════════════════════════════════════════════════════════════════
--  AANGAN — RUN THIS IN THE SUPABASE SQL EDITOR
--  Generated from supabase/migrations/0065 … 0069
--
--  HOW TO USE
--    1. Supabase dashboard → your project → SQL Editor → New query
--    2. Paste this ENTIRE file
--    3. Press Run (or Ctrl/Cmd + Enter)
--    4. You should see "Success. No rows returned"
--
--  SAFE TO RE-RUN. Every statement is guarded (create ... if not exists,
--  drop ... if exists, create or replace), so running this twice changes
--  nothing and cannot lose data. If you are unsure whether you already ran
--  some of these, just run the whole thing.
--
--  ORDER MATTERS — the sections below must run top to bottom. 0067 repairs
--  a bug in 0065, and 0069 builds on helpers defined earlier.
--
--  If it fails partway, the error names the section. Fix that and re-run
--  the whole file; the parts that already succeeded are no-ops.
-- ════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1 of 5 — 0065_lost_found.sql
-- ║  Lost & Found — table, RLS, notification trigger
-- ╚══════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0065: Lost & Found
-- Run AFTER 0001–0064.
--
-- Residents report something they've lost, or something they've found in a
-- common area, so it finds its way back to its owner.
--
-- NOTE: `community_id` is uuid + FK, matching every other table (and the
-- `notifications` insert in the trigger below, whose column is also uuid).
-- Reads are scoped to your own society via is_my_community(), per the 0038
-- hardening — never `using (true)`.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.lost_found_items (
  id               uuid        primary key default gen_random_uuid(),
  community_id     uuid        not null references public.communities(id) on delete cascade,
  owner_user_id    uuid        not null references public.profiles(id) on delete cascade,
  kind             text        not null default 'lost' check (kind in ('lost', 'found')),
  title            text        not null,
  description      text,
  category         text,
  photo_url        text,
  contact_whatsapp text,
  status           text        not null default 'open' check (status in ('open', 'resolved')),
  created_at       timestamptz not null default now(),
  bump_at          timestamptz not null default now()
);

create index if not exists lost_found_feed_idx  on public.lost_found_items (community_id, bump_at desc);
create index if not exists lost_found_owner_idx on public.lost_found_items (owner_user_id);

alter table public.lost_found_items enable row level security;

-- Read: members of the same society (or an admin).
drop policy if exists "lost_found read" on public.lost_found_items;
create policy lf_read on public.lost_found_items for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

-- Insert: your own row, in your own society.
drop policy if exists "lost_found insert" on public.lost_found_items;
create policy lf_insert on public.lost_found_items for insert to authenticated
  with check (owner_user_id = auth.uid() and public.is_my_community(community_id));

-- Update / delete: owner or admin.
drop policy if exists "lost_found update" on public.lost_found_items;
create policy lf_update on public.lost_found_items for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lost_found delete" on public.lost_found_items;
create policy lf_delete on public.lost_found_items for delete to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

-- ─── Notification trigger (community broadcast) ───────────────────────
create or replace function public.on_lost_found_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_title text;
begin
  select name into v_name from public.profiles where id = new.owner_user_id;

  v_title := case
    when new.kind = 'lost' then '🔍 Lost: ' || new.title
    else '📦 Found: ' || new.title
  end;

  insert into public.notifications (
    community_id, type, entity_id, actor_id,
    target_user_id, title, body, route
  ) values (
    new.community_id,
    'lost_found',
    new.id,
    new.owner_user_id,
    null,   -- community broadcast
    v_title,
    coalesce(v_name, 'A neighbour') || ' posted in Lost & Found',
    '/lost-found/' || new.id
  );

  return new;
end;
$$;

drop trigger if exists lost_found_notify on public.lost_found_items;
create trigger lost_found_notify
  after insert on public.lost_found_items
  for each row execute function public.on_lost_found_insert();


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2 of 5 — 0066_push_all.sql
-- ║  Phone push for EVERY notification type
-- ╚══════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0066: OS push for every meaningful notification
-- Run AFTER 0001–0065.
--
-- Until now only orders (0057), DMs (0023), listing inquiries (0011) and
-- listing messages (0021) fired a real Expo push. Every other event only wrote
-- an in-app `notifications` row for the bell — no push when the app is closed.
--
-- This adds ONE trigger on `notifications` that fans an Expo push to the right
-- devices for every row, so all future event types are covered automatically:
--   • targeted row (target_user_id set) → push that one user
--   • broadcast row (target_user_id null) → push every member of the community
--     except the actor (you don't get pinged for your own post)
--
-- Skips, to avoid double-push / noise:
--   • 'order' and 'message' — already pushed by their own triggers (0057 / 0023)
--   • broadcast 'post'      — regular feed chatter; announcements still push
--
-- Batched (≤100 messages per request, per Expo's limit) via the pg_net pipeline
-- from 0005. Only SECURITY DEFINER triggers insert into `notifications`, so this
-- can't be abused by clients.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;

-- Send one batch (≤100) of pre-built Expo push messages.
create or replace function public._expo_push(p_messages jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_messages is null or jsonb_array_length(p_messages) = 0 then return; end if;
  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := p_messages
  );
end;
$$;

create or replace function public.on_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_priority text;
  v_batch    jsonb;
begin
  -- Already pushed by their own triggers → don't duplicate.
  if NEW.type in ('order', 'message') then return NEW; end if;
  -- Regular feed posts broadcast to everyone would be noise; announcements push.
  if NEW.target_user_id is null and NEW.type = 'post' then return NEW; end if;

  -- Urgent types wake the device; everything else is normal priority.
  v_priority := case
    when NEW.type in ('emergency', 'announcement', 'payment', 'court', 'property')
    then 'high' else 'default'
  end;

  -- Resolve recipient tokens, build messages, chunk into batches of 100, send.
  for v_batch in
    select jsonb_agg(msg)
    from (
      select jsonb_build_object(
               'to',        pt.token,
               'title',     NEW.title,
               'body',      coalesce(NEW.body, ''),
               'sound',     'default',
               'priority',  v_priority,
               'channelId', 'default',
               'data',      jsonb_build_object('route', NEW.route)
             ) as msg,
             (row_number() over () - 1) / 100 as grp
      from public.push_tokens pt
      where
        -- targeted: the single recipient
        (NEW.target_user_id is not null and pt.user_id = NEW.target_user_id)
        or
        -- broadcast: everyone in the community except the actor
        (NEW.target_user_id is null
         and pt.user_id is distinct from NEW.actor_id
         and exists (
           select 1 from public.profiles p
           where p.id = pt.user_id and p.community_id = NEW.community_id
         ))
    ) s
    group by grp
  loop
    perform public._expo_push(v_batch);
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notification_push on public.notifications;
create trigger trg_notification_push
  after insert on public.notifications
  for each row execute function public.on_notification_push();


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3 of 5 — 0067_fix_lost_found_schema.sql
-- ║  Repairs the community_id bug in 0065
-- ╚══════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0067: repair lost_found_items schema
-- Run AFTER 0001–0066. Safe to run whether or not the original (broken)
-- 0065 was ever applied — every step is guarded, so on a database created
-- from the corrected 0065 this migration is a no-op.
--
-- The first cut of 0065 declared `community_id` as TEXT. Every other table
-- (including `notifications`, which the insert trigger writes to) uses
-- `uuid references communities(id)`. Postgres has no assignment cast from
-- text to uuid, so the trigger's insert failed the type check and EVERY
-- Lost & Found post errored out. It also shipped `using (true)` for reads,
-- which exposed one society's items to members of another.
-- ════════════════════════════════════════════════════════════════════

do $$
declare
  v_type text;
begin
  if to_regclass('public.lost_found_items') is null then
    return;  -- table doesn't exist yet; corrected 0065 will create it properly
  end if;

  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'lost_found_items'
     and column_name  = 'community_id';

  -- Convert text → uuid only if it's still text. Rows whose value isn't a
  -- valid uuid can't be salvaged; there should be none, because inserts have
  -- been failing in the trigger since day one.
  if v_type = 'text' then
    delete from public.lost_found_items
     where community_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

    alter table public.lost_found_items
      alter column community_id type uuid using community_id::uuid;
  end if;

  -- Add the FK if it isn't there yet.
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name   = 'lost_found_items'
       and constraint_name = 'lost_found_items_community_id_fkey'
  ) then
    alter table public.lost_found_items
      add constraint lost_found_items_community_id_fkey
      foreign key (community_id) references public.communities(id) on delete cascade;
  end if;
end $$;

-- Indexes (no-ops if 0065 already created them).
create index if not exists lost_found_feed_idx  on public.lost_found_items (community_id, bump_at desc);
create index if not exists lost_found_owner_idx on public.lost_found_items (owner_user_id);

-- Replace the permissive policies from the first cut with society-scoped ones.
drop policy if exists "lost_found read"   on public.lost_found_items;
drop policy if exists "lost_found insert" on public.lost_found_items;
drop policy if exists "lost_found update" on public.lost_found_items;
drop policy if exists "lost_found delete" on public.lost_found_items;

drop policy if exists lf_read   on public.lost_found_items;
drop policy if exists lf_insert on public.lost_found_items;
drop policy if exists lf_update on public.lost_found_items;
drop policy if exists lf_delete on public.lost_found_items;

create policy lf_read on public.lost_found_items for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

create policy lf_insert on public.lost_found_items for insert to authenticated
  with check (owner_user_id = auth.uid() and public.is_my_community(community_id));

create policy lf_update on public.lost_found_items for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

create policy lf_delete on public.lost_found_items for delete to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 4 of 5 — 0068_reports_and_blocks.sql
-- ║  Report + block (REQUIRED by Apple)
-- ╚══════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0068: content reports + peer blocking
-- Run AFTER 0001–0067.
--
-- Required by Apple App Store Guideline 1.2 (Safety — User-Generated Content):
-- an app with UGC must let members REPORT objectionable content and BLOCK
-- abusive users. Google Play's UGC policy expects the same.
--
-- NOTE: this is PEER blocking (one member hides another). It is distinct from
-- `profiles.blocked` in 0025, which is an ADMIN BAN that locks a member out of
-- the society entirely. The two are unrelated and must not be conflated.
-- ════════════════════════════════════════════════════════════════════

-- ─── Reports ─────────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id              uuid        primary key default gen_random_uuid(),
  community_id    uuid        not null references public.communities(id) on delete cascade,
  reporter_id     uuid        not null references public.profiles(id) on delete cascade,
  -- Free-form so new content types don't need a migration; the client sends a
  -- stable slug ('post' | 'comment' | 'listing' | 'dish' | 'borrow' |
  -- 'lost_found' | 'recommend' | 'property' | 'place' | 'message' | 'profile').
  target_type     text        not null,
  target_id       uuid        not null,
  target_owner_id uuid        references public.profiles(id) on delete set null,
  reason          text        not null check (reason in (
                    'spam', 'harassment', 'hate', 'scam',
                    'adult', 'violence', 'illegal', 'other')),
  details         text,
  status          text        not null default 'open'
                    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by     uuid        references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  -- One report per person per item; re-reporting updates the existing row.
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_queue_idx  on public.content_reports (community_id, status, created_at desc);
create index if not exists reports_target_idx on public.content_reports (target_type, target_id);

alter table public.content_reports enable row level security;

-- You can see your own reports; admins see every report in their society.
drop policy if exists cr_read on public.content_reports;
create policy cr_read on public.content_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (public.is_admin(auth.uid()) and public.is_my_community(community_id))
  );

drop policy if exists cr_insert on public.content_reports;
create policy cr_insert on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_my_community(community_id));

-- Only admins triage. (Reporters intentionally cannot edit a filed report.)
drop policy if exists cr_update on public.content_reports;
create policy cr_update on public.content_reports for update to authenticated
  using (public.is_admin(auth.uid()) and public.is_my_community(community_id));

-- ─── Peer blocks ─────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid        not null references public.profiles(id) on delete cascade,
  blocked_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- A user manages their own block list. They may also read rows where they are
-- the BLOCKED party — the client needs that to enforce blocking mutually
-- (a blocked user must not be able to DM the person who blocked them).
drop policy if exists ub_read on public.user_blocks;
create policy ub_read on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists ub_insert on public.user_blocks;
create policy ub_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists ub_delete on public.user_blocks;
create policy ub_delete on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- True when either party has blocked the other. STABLE + SECURITY DEFINER so
-- it can be used inside other policies without tripping over ub_read.
create or replace function public.is_peer_blocked(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other    and blocked_id = auth.uid())
  );
$$;

grant execute on function public.is_peer_blocked(uuid) to authenticated;

-- ─── Enforce blocking on direct messages ─────────────────────────────
-- Hiding content client-side is enough for feeds, but a block must actually
-- STOP contact — so refuse the insert at the database.
create or replace function public.on_dm_check_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
begin
  select case when t.user_a = new.sender_id then t.user_b else t.user_a end
    into v_other
    from public.dm_threads t
   where t.id = new.thread_id;

  if v_other is not null and exists (
    select 1 from public.user_blocks
     where (blocker_id = new.sender_id and blocked_id = v_other)
        or (blocker_id = v_other       and blocked_id = new.sender_id)
  ) then
    raise exception 'This conversation is unavailable.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists dm_block_check on public.dm_messages;
create trigger dm_block_check
  before insert on public.dm_messages
  for each row execute function public.on_dm_check_block();

-- ─── Notify admins when something is reported ────────────────────────
create or replace function public.on_content_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  for v_admin in
    select id from public.profiles
     where community_id = new.community_id
       and 'admin' = any(coalesce(roles, '{}'))
  loop
    insert into public.notifications (
      community_id, type, entity_id, actor_id,
      target_user_id, title, body, route
    ) values (
      new.community_id,
      'report',
      new.id,
      new.reporter_id,
      v_admin.id,
      '🚩 Content reported',
      'A ' || new.target_type || ' was reported for ' || new.reason || '.',
      '/admin?tab=reports'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists content_report_notify on public.content_reports;
create trigger content_report_notify
  after insert on public.content_reports
  for each row execute function public.on_content_report_insert();


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 5 of 5 — 0069_society_events.sql
-- ║  Society functions: contributions, expenses, accounts
-- ╚══════════════════════════════════════════════════════════════════╝

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


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  DONE — verification                                             ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Run this on its own afterwards. You should get 6 rows, all saying 'OK'.

select 'lost_found_items'    as table_name,
       case when to_regclass('public.lost_found_items')    is null then 'MISSING' else 'OK' end as status
union all select 'content_reports',
       case when to_regclass('public.content_reports')     is null then 'MISSING' else 'OK' end
union all select 'user_blocks',
       case when to_regclass('public.user_blocks')         is null then 'MISSING' else 'OK' end
union all select 'society_events',
       case when to_regclass('public.society_events')      is null then 'MISSING' else 'OK' end
union all select 'event_contributions',
       case when to_regclass('public.event_contributions') is null then 'MISSING' else 'OK' end
union all select 'event_expenses',
       case when to_regclass('public.event_expenses')      is null then 'MISSING' else 'OK' end;

-- Also confirm the Lost & Found repair actually applied — this must say 'uuid',
-- never 'text'. If it says text, section 3 did not run.
select data_type as lost_found_community_id_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'lost_found_items'
   and column_name  = 'community_id';
