-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0083: celebration details
-- Run AFTER 0001–0082.
--
-- A celebration is not only money and tasks. Somebody has to write down the
-- schedule, the list of what is needed, who has sponsored what, and the note
-- thanking them — and today all of that lives in a WhatsApp message that
-- scrolls away by evening and cannot be corrected once sent.
--
-- WHY A LIST OF NOTES RATHER THAN MORE COLUMNS ON THE EVENT.
-- The obvious move is `schedule text` and `requirements text` on
-- society_events. It is wrong: every celebration wants a different set of
-- sections — a Ganesh Chaturthi has a visarjan route, a Diwali night has a
-- rangoli competition — and each new one would be a migration. A list of
-- titled notes lets a committee write whatever their celebration actually
-- needs, in the order they choose.
--
-- Photos are an array on the note rather than their own table: they are always
-- read with the note, never on their own, and a poster or a sponsor's card is
-- one of the most useful things to pin here.
-- ════════════════════════════════════════════════════════════════════

create table public.event_notes (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.society_events(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,

  title        text,
  body         text,
  photo_urls   text[] not null default '{}',

  -- Explicit order, because a schedule above a thank-you note is not the same
  -- page as the reverse. Ties fall back to creation time.
  sort_order   int not null default 0,

  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A note with no title, no words and no picture is not a note.
  constraint event_notes_not_empty
    check (title is not null or body is not null or cardinality(photo_urls) > 0)
);

create index event_notes_event_idx
  on public.event_notes (event_id, sort_order, created_at);

alter table public.event_notes enable row level security;

-- Readable by the society, editable by the people running the celebration —
-- the same rule as the budget and the task board, reusing the same helpers so
-- there is one answer to "who may change this", not four.
create policy event_notes_read on public.event_notes
  for select using (public.can_see_event(event_id));

create policy event_notes_write on public.event_notes
  for all using (public.can_manage_event(event_id))
        with check (public.can_manage_event(event_id));

create or replace function public.event_note_touch() returns trigger
  language plpgsql set search_path = public as $$
begin
  NEW.updated_at := now();
  return NEW;
end; $$;

drop trigger if exists trg_event_note_touch on public.event_notes;
create trigger trg_event_note_touch before update on public.event_notes
  for each row execute function public.event_note_touch();
