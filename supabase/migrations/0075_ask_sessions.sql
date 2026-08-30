-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0075: Ask Aangan conversations that survive
-- Run AFTER 0001–0074.
--
-- Until now the chat lived in a module-level array in the app (askStore.ts).
-- It survived navigating away and back, and died on reload. Nothing was ever
-- written down: no history, nothing to return to, nothing to learn from.
-- ════════════════════════════════════════════════════════════════════

create table public.ask_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,

  -- Written from the first question, so the list reads as what you asked
  -- rather than "Chat 1, Chat 2". Nullable because the row is created before
  -- the first message lands.
  title        text,

  created_at   timestamptz not null default now(),
  -- Ordering key for the history list. Bumped on every new message, so an old
  -- chat you return to rises back to the top where you left it.
  updated_at   timestamptz not null default now()
);

-- The only query: my sessions, newest activity first.
create index ask_sessions_user_idx on public.ask_sessions (user_id, updated_at desc);

create table public.ask_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ask_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  text       text not null,

  -- The result cards that came with an assistant turn, exactly as rendered.
  -- Stored as jsonb rather than re-resolved on read: a card must still show
  -- what it showed at the time, even if the dish sold out or the listing was
  -- deleted since. Re-resolving would silently rewrite history.
  results    jsonb,

  created_at timestamptz not null default now()
);

create index ask_messages_session_idx on public.ask_messages (session_id, created_at);

alter table public.ask_sessions enable row level security;
alter table public.ask_messages enable row level security;

-- A conversation is private to the person who had it. No admin visibility:
-- an admin reading residents' questions to the assistant would be surveillance,
-- not moderation.
create policy ask_sessions_own on public.ask_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy ask_messages_own on public.ask_messages
  for all using (
    exists (select 1 from public.ask_sessions s where s.id = session_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.ask_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- Keep updated_at honest without the client having to remember.
create or replace function public.ask_touch_session() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.ask_sessions
     set updated_at = now(),
         -- First user message names the chat. Trimmed to something that fits
         -- one line in the history list.
         title = coalesce(title, case when NEW.role = 'user'
           then left(regexp_replace(NEW.text, '\s+', ' ', 'g'), 60) end)
   where id = NEW.session_id;
  return NEW;
end; $$;

drop trigger if exists trg_ask_touch on public.ask_messages;
create trigger trg_ask_touch after insert on public.ask_messages
  for each row execute function public.ask_touch_session();
