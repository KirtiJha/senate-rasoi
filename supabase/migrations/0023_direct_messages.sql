-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0023: direct messages (Phase 12b)
-- Run AFTER 0001–0022.
--
-- 1:1 neighbour DMs, scoped to a community. One thread per unordered pair
-- (enforced by canonical user_a < user_b + unique). A SECURITY DEFINER RPC
-- atomically gets-or-creates the thread (and checks same-community). A trigger
-- bumps the thread + push-notifies the recipient on each new message.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.dm_threads (
  id              uuid        primary key default gen_random_uuid(),
  community_id    uuid        not null references public.communities(id) on delete cascade,
  user_a          uuid        not null references public.profiles(id)    on delete cascade,
  user_b          uuid        not null references public.profiles(id)    on delete cascade,
  last_message    text,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists dm_threads_a_idx on public.dm_threads (user_a, last_message_at desc);
create index if not exists dm_threads_b_idx on public.dm_threads (user_b, last_message_at desc);

create table if not exists public.dm_messages (
  id         uuid        primary key default gen_random_uuid(),
  thread_id  uuid        not null references public.dm_threads(id) on delete cascade,
  sender_id  uuid        not null references public.profiles(id)   on delete cascade,
  body       text        not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at);

-- ── RLS: only the two participants ──────────────────────────────────
alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists dm_threads_read on public.dm_threads;
create policy dm_threads_read on public.dm_threads
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- Direct inserts are also allowed for a participant, but the RPC is preferred.
drop policy if exists dm_threads_insert on public.dm_threads;
create policy dm_threads_insert on public.dm_threads
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists dm_messages_read on public.dm_messages;
create policy dm_messages_read on public.dm_messages
  for select using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

drop policy if exists dm_messages_insert on public.dm_messages;
create policy dm_messages_insert on public.dm_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.dm_threads t
      where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- Recipient marks messages read (read_at). Only a participant can update.
drop policy if exists dm_messages_update on public.dm_messages;
create policy dm_messages_update on public.dm_messages
  for update using (
    exists (
      select 1 from public.dm_threads t
      where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- ── Get-or-create a thread atomically (same-community enforced) ─────
create or replace function public.dm_get_or_create_thread(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  a         uuid;
  b         uuid;
  tid       uuid;
  my_comm   uuid;
  other_comm uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_other = me then raise exception 'cannot message yourself'; end if;

  select community_id into my_comm    from public.profiles where id = me;
  select community_id into other_comm from public.profiles where id = p_other;
  if my_comm is null or my_comm is distinct from other_comm then
    raise exception 'users are not in the same community';
  end if;

  if me < p_other then a := me; b := p_other; else a := p_other; b := me; end if;

  select id into tid from public.dm_threads where user_a = a and user_b = b;
  if tid is null then
    insert into public.dm_threads (community_id, user_a, user_b)
    values (my_comm, a, b)
    returning id into tid;
  end if;
  return tid;
end;
$$;

-- ── On new message: bump thread + push the recipient ────────────────
create or replace function public.on_dm_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_other  uuid;
  v_sender text;
begin
  update public.dm_threads
     set last_message = left(NEW.body, 120), last_message_at = now()
   where id = NEW.thread_id;

  select case when t.user_a = NEW.sender_id then t.user_b else t.user_a end
    into v_other
    from public.dm_threads t
   where t.id = NEW.thread_id;

  select coalesce(p.name, 'Someone') into v_sender
    from public.profiles p where p.id = NEW.sender_id;

  perform public.notify_user(v_other, v_sender || ' sent you a message', left(NEW.body, 100));
  return NEW;
end;
$$;

drop trigger if exists trg_dm_message on public.dm_messages;
create trigger trg_dm_message
  after insert on public.dm_messages
  for each row execute function public.on_dm_message();

-- ── Realtime ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dm_messages') then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dm_threads') then
    alter publication supabase_realtime add table public.dm_threads;
  end if;
end $$;
