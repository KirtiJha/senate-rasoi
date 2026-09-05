-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0131: a message belongs to whoever said it
-- Run AFTER 0001–0130. Safe to re-run.
--
-- THE HOLE. dm_messages had this UPDATE policy:
--
--   USING (you are a participant of the thread)   -- and no WITH CHECK
--
-- The app only ever writes read_at with it. The API does not know that. Any
-- participant could update any row in their thread, columns included — so
-- either person could rewrite the OTHER person's words, in a private
-- conversation, leaving no trace that the text had ever been different. Then
-- screenshot it. The anon key ships inside the app; this was one request away.
--
-- Marking somebody's message as read is the only thing a recipient needs to
-- do to it, so that is now the only thing they may do: read_at, once, on a
-- message they did not send. Nobody edits anybody's text, including their own
-- — a message that has been read cannot be quietly changed underneath the
-- person who read it.
--
-- AND YOU COULD NOT TAKE ANYTHING BACK. There was no DELETE policy at all on
-- either table, so nothing said in a private conversation could ever be
-- removed by anyone — not a message sent to the wrong thread, not one sent in
-- anger, not by its author. You can unsend your own message now. It leaves a
-- tombstone rather than a hole, because a conversation that silently loses
-- lines is its own kind of dishonest.
-- ════════════════════════════════════════════════════════════════════

-- A withdrawn message keeps its place in the conversation and loses its words.
alter table public.dm_messages add column if not exists deleted_at timestamptz;

create or replace function public.guard_dm_message_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- The author, withdrawing what they said. The body is emptied here rather
  -- than by the client, so "deleted" cannot mean "replaced with something
  -- else".
  if auth.uid() = OLD.sender_id
     and NEW.deleted_at is not null and OLD.deleted_at is null then
    NEW.body := '';
    NEW.sender_id := OLD.sender_id;
    NEW.thread_id := OLD.thread_id;
    NEW.created_at := OLD.created_at;
    NEW.read_at := OLD.read_at;
    return NEW;
  end if;

  -- Everyone else: read_at, and nothing else, and only on a message addressed
  -- to them.
  if NEW.body is distinct from OLD.body
     or NEW.sender_id is distinct from OLD.sender_id
     or NEW.thread_id is distinct from OLD.thread_id
     or NEW.created_at is distinct from OLD.created_at
     or NEW.deleted_at is distinct from OLD.deleted_at then
    raise exception 'A message cannot be changed after it is sent.';
  end if;

  if NEW.read_at is distinct from OLD.read_at and auth.uid() = OLD.sender_id then
    raise exception 'Only the person a message was sent to can mark it read.';
  end if;

  return NEW;
end; $fn$;

drop trigger if exists trg_guard_dm_message_update on public.dm_messages;
create trigger trg_guard_dm_message_update
  before update on public.dm_messages
  for each row execute function public.guard_dm_message_update();

-- The policy still decides WHO may reach the row; the trigger decides WHAT
-- they may do to it. Both are needed: WITH CHECK cannot see the old row.
drop policy if exists dm_messages_update on public.dm_messages;
create policy dm_messages_update on public.dm_messages
  for update using (
    exists (
      select 1 from public.dm_threads t
       where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.dm_threads t
       where t.id = thread_id and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

-- Unsending is an update, not a delete: the row stays so the thread keeps its
-- shape and the other person sees that something was withdrawn rather than
-- finding a silent gap. No DELETE policy is added — there is deliberately no
-- way to erase a conversation out from under the person you had it with.

-- The inbox preview must not keep quoting a message that has been withdrawn.
create or replace function public.on_dm_message_deleted()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_last record;
begin
  if NEW.deleted_at is null or OLD.deleted_at is not null then return NEW; end if;

  select body, created_at into v_last
    from public.dm_messages
   where thread_id = NEW.thread_id and deleted_at is null
   order by created_at desc limit 1;

  update public.dm_threads
     set last_message = coalesce(left(v_last.body, 120), 'Message withdrawn')
   where id = NEW.thread_id;
  return NEW;
exception when others then
  return NEW;
end; $fn$;

drop trigger if exists trg_dm_message_deleted on public.dm_messages;
create trigger trg_dm_message_deleted
  after update on public.dm_messages
  for each row execute function public.on_dm_message_deleted();
