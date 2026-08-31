-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0088: let the database maintain its own rows
-- Run AFTER 0001–0087.
--
-- 0087 added a trigger so a resident may change only two columns on their own
-- flat's contribution. It has a hole: it decides who you are with auth.uid(),
-- and auth.uid() is NULL for anything that is not a signed-in app request —
-- the SQL editor, a service-role script, a migration, a cron job.
--
-- So every one of those was treated as "some resident editing their own row",
-- and had its changes silently reverted to the old values. Silently is the bad
-- part: the backfill that moved contributor names out of `note` reported
-- success, touched twenty-three rows, and changed nothing.
--
-- A trigger that guards against a resident must therefore say so explicitly
-- rather than inferring it from a failed permission check.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.contribution_self_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Not a signed-in app request at all: the SQL editor, a migration, a
  -- service-role job. These are trusted and are not what this guard is for.
  if auth.uid() is null then
    return NEW;
  end if;

  -- The treasurer and the committee may change anything, as before.
  if public.is_event_treasurer(NEW.event_id) then
    return NEW;
  end if;

  -- Everyone else is a resident editing their own flat, and may move exactly
  -- two things: whether they are taking part, and how many of them there are.
  NEW.flat            := OLD.flat;
  NEW.community_id    := OLD.community_id;
  NEW.event_id        := OLD.event_id;
  NEW.amount          := OLD.amount;
  NEW.status          := OLD.status;
  NEW.method          := OLD.method;
  NEW.note            := OLD.note;
  NEW.receipt_url     := OLD.receipt_url;
  NEW.recorded_by     := OLD.recorded_by;
  NEW.received_at     := OLD.received_at;
  NEW.contributor_name := OLD.contributor_name;
  NEW.contributor_user_id := OLD.contributor_user_id;

  return NEW;
end; $$;

-- ─── The backfill, now that it can actually run ──────────────────────
-- Names were written into `note` before contributor_name existed. Copy them
-- across for every celebration, not just one — any event seeded the same way
-- has the same problem.
--
-- Only fills a name that is still empty, and only clears a note that has
-- become an exact duplicate, so re-running it is harmless.
do $$
declare
  v_moved int;
begin
  update public.event_contributions
     set contributor_name = trim(note)
   where (contributor_name is null or trim(contributor_name) = '')
     and note is not null
     and trim(note) <> '';

  get diagnostics v_moved = row_count;

  update public.event_contributions
     set note = null
   where note is not null
     and trim(note) = trim(coalesce(contributor_name, ''));

  raise notice 'Moved % contributor names out of note', v_moved;
end $$;
