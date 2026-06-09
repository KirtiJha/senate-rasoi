-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0026: in-app notifications + read tracking
-- Run AFTER 0001–0025.
--
-- One notifications row per event (broadcast to a community, or targeted at a
-- single user for DMs). Read state is tracked per-user in notification_reads,
-- so "unread for me" = rows in my community/targeted at me, not by me, after I
-- joined, with no read row for me. Triggers fan events in from posts, listings,
-- polls, and direct messages. Realtime-enabled so the bell badge updates live.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id             uuid        primary key default gen_random_uuid(),
  community_id   uuid        not null references public.communities(id) on delete cascade,
  type           text        not null,   -- 'post' | 'announcement' | 'listing' | 'poll' | 'message'
  entity_id      uuid,
  actor_id       uuid        references public.profiles(id) on delete set null,
  target_user_id uuid        references public.profiles(id) on delete cascade,  -- null = broadcast
  title          text        not null,
  body           text,
  route          text,
  created_at     timestamptz not null default now()
);

create index if not exists notifications_comm_idx   on public.notifications (community_id, created_at desc);
create index if not exists notifications_target_idx on public.notifications (target_user_id, created_at desc);

create table if not exists public.notification_reads (
  notification_id uuid        not null references public.notifications(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;

-- A member sees broadcasts in their community + notifications targeted at them.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (
    target_user_id = auth.uid()
    or (
      target_user_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.community_id = notifications.community_id
      )
    )
  );
-- No client insert/update/delete policy: only SECURITY DEFINER triggers write.

drop policy if exists notification_reads_rw on public.notification_reads;
create policy notification_reads_rw on public.notification_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Event triggers ──────────────────────────────────────────────────
create or replace function public.on_post_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.author_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (
    NEW.community_id,
    case when NEW.category = 'announcement' then 'announcement' else 'post' end,
    NEW.id, NEW.author_id,
    case when NEW.category = 'announcement'
         then '📢 ' || v_actor || ' posted an announcement'
         else v_actor || ' posted in the feed' end,
    coalesce(NEW.title, left(NEW.body, 80)),
    '/feed/' || NEW.id::text
  );
  return NEW;
end; $$;

drop trigger if exists trg_post_notify on public.posts;
create trigger trg_post_notify after insert on public.posts
  for each row execute function public.on_post_notify();

create or replace function public.on_listing_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.owner_user_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'listing', NEW.id, NEW.owner_user_id,
          v_actor || ' posted a new listing', left(NEW.title, 80), '/listing/' || NEW.id::text);
  return NEW;
end; $$;

drop trigger if exists trg_listing_notify on public.listings;
create trigger trg_listing_notify after insert on public.listings
  for each row execute function public.on_listing_notify();

create or replace function public.on_poll_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.author_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'poll', NEW.id, NEW.author_id,
          v_actor || ' started a poll', left(NEW.question, 80), '/polls');
  return NEW;
end; $$;

drop trigger if exists trg_poll_notify on public.polls;
create trigger trg_poll_notify after insert on public.polls
  for each row execute function public.on_poll_notify();

create or replace function public.on_dm_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid; v_comm uuid; v_sender text;
begin
  select case when t.user_a = NEW.sender_id then t.user_b else t.user_a end, t.community_id
    into v_other, v_comm
    from public.dm_threads t where t.id = NEW.thread_id;
  select coalesce(name, 'Someone') into v_sender from public.profiles where id = NEW.sender_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_comm, 'message', NEW.thread_id, NEW.sender_id, v_other,
          v_sender || ' sent you a message', left(NEW.body, 80), '/messages/' || NEW.thread_id::text);
  return NEW;
end; $$;

drop trigger if exists trg_dm_notify on public.dm_messages;
create trigger trg_dm_notify after insert on public.dm_messages
  for each row execute function public.on_dm_message_notify();

-- ── Realtime ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_reads') then
    alter publication supabase_realtime add table public.notification_reads;
  end if;
end $$;
