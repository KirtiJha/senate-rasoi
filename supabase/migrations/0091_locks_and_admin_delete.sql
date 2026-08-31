-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0091: close the books, and stop lying to admins
-- Run AFTER 0001–0090.
--
-- Two faults where the app tells somebody an action succeeded and the database
-- quietly disagreed.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. An admin's document delete actually deletes ──────────────────
--
-- The Documents screen treats owner-or-admin as equally allowed and always
-- reports "Document deleted". The policy is owner-only: admins were added to
-- `update` in 0071 and never to `delete`. So an admin removing an
-- inappropriate document saw a success message and the file was still there
-- after a reload, with nothing to suggest it was a permissions failure.
--
-- The storage object needs the same treatment or the row goes and the file
-- stays behind, which is worse than either outcome alone.
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.community_id = documents.community_id
       and 'admin' = any(p.roles)
  )
);

drop policy if exists documents_obj_delete on storage.objects;
create policy documents_obj_delete on storage.objects for delete using (
  bucket_id = 'documents'
  and exists (
    select 1 from public.documents d
     where d.storage_path = storage.objects.name
       and (
         d.owner_id = auth.uid()
         or exists (
           select 1 from public.profiles p
            where p.id = auth.uid()
              and p.community_id = d.community_id
              and 'admin' = any(p.roles)
         )
       )
  )
);

-- ─── 2. "Final accounts" that are actually final ─────────────────────
--
-- 0069 wrote the lock guard and attached it to contributions and expenses.
-- Everything added since — sponsorships, budget lines, and the carry-forward
-- and budget figures on the event row itself — was never covered. Since cash
-- sponsorship and carry-forward both feed the collected total, a completed
-- celebration's published figures could still be moved afterwards.
--
-- 0069's own comment is the standard being enforced here: "Once an event is
-- 'completed' the published report must not be quietly rewritten, or
-- transparency is meaningless."
drop trigger if exists sp_lock_guard on public.event_sponsorships;
create trigger sp_lock_guard
  before insert or update or delete on public.event_sponsorships
  for each row execute function public.guard_event_locked();

drop trigger if exists bi_lock_guard on public.event_budget_items;
create trigger bi_lock_guard
  before insert or update or delete on public.event_budget_items
  for each row execute function public.guard_event_locked();

-- The event row itself carries budget_amount and the carry-forward pair, all
-- of which the report prints. Guarding it needs its own function, because
-- guard_event_locked() reads `event_id` and here the event IS the row.
--
-- Deliberately narrow: reopening a celebration (moving it out of 'completed')
-- stays possible, and the title and cover photo stay editable. Only the
-- figures the published accounts depend on are frozen.
create or replace function public.guard_event_row_locked() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if OLD.status = 'completed'
     and NEW.status = 'completed'
     and not public.is_admin(auth.uid())
     and (NEW.budget_amount      is distinct from OLD.budget_amount
       or NEW.carry_in_available is distinct from OLD.carry_in_available
       or NEW.carry_in_used      is distinct from OLD.carry_in_used)
  then
    raise exception 'This celebration is completed — its accounts are closed.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end; $$;

drop trigger if exists ev_row_lock_guard on public.society_events;
create trigger ev_row_lock_guard
  before update on public.society_events
  for each row execute function public.guard_event_row_locked();
