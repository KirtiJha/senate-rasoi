-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0021: per-listing chat / Q&A threads (Phase 12a)
-- Run AFTER 0001–0020.
--
-- An in-app message thread attached to each listing so neighbours can ask the
-- owner questions ("Are you free on Saturdays?") and the owner can reply —
-- without leaking phone numbers into WhatsApp. The thread is visible to the
-- whole society (like post_comments), so answers help everyone.
-- Private 1:1 DMs are a separate, later phase (12b).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.listing_messages (
  id          uuid        primary key default gen_random_uuid(),
  listing_id  uuid        not null references public.listings(id) on delete cascade,
  author_id   uuid        not null references public.profiles(id) on delete cascade,
  body        text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists listing_messages_idx
  on public.listing_messages (listing_id, created_at);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.listing_messages enable row level security;

-- Society members can read messages on listings in their own community.
drop policy if exists listing_messages_read on public.listing_messages;
create policy listing_messages_read on public.listing_messages
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1
        from public.listings l
        join public.profiles p on p.id = auth.uid()
       where l.id = listing_id
         and l.community_id = p.community_id
    )
  );

-- Members post as themselves, only on listings in their community.
drop policy if exists listing_messages_insert on public.listing_messages;
create policy listing_messages_insert on public.listing_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1
        from public.listings l
        join public.profiles p on p.id = auth.uid()
       where l.id = listing_id
         and l.community_id = p.community_id
    )
  );

-- Author or a society admin can delete a message.
drop policy if exists listing_messages_delete on public.listing_messages;
create policy listing_messages_delete on public.listing_messages
  for delete using (
    author_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- ── Realtime ────────────────────────────────────────────────────────
-- Guarded so re-running the migration doesn't error if already added.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'listing_messages'
  ) then
    alter publication supabase_realtime add table public.listing_messages;
  end if;
end $$;

-- ── Push notification on new message ────────────────────────────────
-- Reuses notify_user() + pg_net from migration 0005.
--   • A neighbour messages   → notify the listing owner.
--   • The owner replies       → notify every other neighbour in the thread.
create or replace function public.on_listing_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner  uuid;
  v_title  text;
  v_author text;
  r        record;
begin
  select l.owner_user_id, l.title
    into v_owner, v_title
    from public.listings l
   where l.id = NEW.listing_id;

  select coalesce(p.name, 'Someone')
    into v_author
    from public.profiles p
   where p.id = NEW.author_id;

  if NEW.author_id is distinct from v_owner then
    -- Neighbour → owner
    perform public.notify_user(
      v_owner,
      v_author || ' messaged you',
      'Re "' || left(coalesce(v_title, 'your listing'), 50) || '": ' || left(NEW.body, 80)
    );
  else
    -- Owner → everyone else who has posted in this thread
    for r in
      select distinct author_id
        from public.listing_messages
       where listing_id = NEW.listing_id
         and author_id is distinct from v_owner
    loop
      perform public.notify_user(
        r.author_id,
        v_author || ' replied',
        'Re "' || left(coalesce(v_title, 'a listing'), 50) || '": ' || left(NEW.body, 80)
      );
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_listing_message_notify on public.listing_messages;
create trigger trg_listing_message_notify
  after insert on public.listing_messages
  for each row execute function public.on_listing_message();
