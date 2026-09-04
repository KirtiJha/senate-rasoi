-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0122: lending ends as cleanly as it starts
-- Run AFTER 0001–0121. Safe to re-run.
--
-- Borrow & Lend could open a conversation and never close one.
--
--   • A neighbour asks for the ladder, then borrows one elsewhere. There was
--     no way to say so: RLS let only the ITEM OWNER touch a request row.
--   • The owner says yes to one of three askers. The other two are left
--     'pending' forever, still being told "the owner will respond soon".
--   • The owner instead flips the item to "Lent out" by hand — same silence.
--   • The owner deletes the listing. Every request cascades away without a
--     word, including an accepted one where the item is in someone's flat.
--
-- After this, every request reaches a settled state and the person on the
-- other side is told, once, in a sentence a neighbour would actually say.
--
-- Also closed here: lend_items/borrow_requests UPDATE policies had no
-- WITH CHECK, so an owner could move an item into another society or point a
-- request at a different requester. And nothing stopped a double tap from
-- filing the same request twice.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. A request can now be withdrawn ───────────────────────────────
alter table public.borrow_requests drop constraint if exists borrow_requests_status_check;
alter table public.borrow_requests add constraint borrow_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'returned', 'cancelled'));

-- Set when the app closed a request on the owner's behalf (the item went to
-- someone else, or was withdrawn) rather than the owner declining this person.
-- The difference is the whole message: "lent to another neighbour" is news,
-- "Ravi said no" is a snub.
alter table public.borrow_requests add column if not exists auto_closed boolean not null default false;

-- One open request per person per item. A second tap is now a no-op, not a
-- second row in the owner's list.
create unique index if not exists borrow_requests_one_open
  on public.borrow_requests (item_id, requester_id)
  where status in ('pending', 'accepted');

-- ── 2. Who may change what ──────────────────────────────────────────
drop policy if exists borrow_update on public.borrow_requests;
create policy borrow_update on public.borrow_requests
  for update using (
    exists (select 1 from public.lend_items i where i.id = item_id and i.owner_user_id = auth.uid())
    or requester_id = auth.uid()
    or public.is_admin(auth.uid())
  );

-- WITH CHECK cannot see the OLD row, so the column-level rules live here.
create or replace function public.guard_borrow_request()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_owner uuid;
begin
  select owner_user_id into v_owner from public.lend_items where id = OLD.item_id;

  -- The request is a fact about two people and one item; none of those move.
  if NEW.item_id is distinct from OLD.item_id
     or NEW.requester_id is distinct from OLD.requester_id then
    raise exception 'A borrow request cannot be reassigned.';
  end if;

  -- The requester may withdraw, and nothing else. Admins and the owner are
  -- unrestricted (an admin cleaning up, an owner accepting or declining).
  if auth.uid() = OLD.requester_id
     and auth.uid() is distinct from v_owner
     and not public.is_admin(auth.uid()) then
    if NEW.status is distinct from OLD.status and NEW.status <> 'cancelled' then
      raise exception 'You can withdraw your request, but not answer it.';
    end if;
    if OLD.status not in ('pending', 'accepted') and NEW.status = 'cancelled' then
      raise exception 'This request is already closed.';
    end if;
  end if;
  return NEW;
end; $fn$;

drop trigger if exists trg_guard_borrow_request on public.borrow_requests;
create trigger trg_guard_borrow_request
  before update on public.borrow_requests
  for each row execute function public.guard_borrow_request();

-- An item stays in the society it was posted to, owned by whoever posted it.
drop policy if exists lend_update on public.lend_items;
create policy lend_update on public.lend_items
  for update using (owner_user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (
    (owner_user_id = auth.uid() and public.is_my_community(community_id))
    or public.is_admin(auth.uid())
  );

-- ── 3. Answering one request answers the others ─────────────────────
-- Saying yes to a neighbour is also saying "it's gone" to everyone else
-- waiting. That used to be left unsaid.
create or replace function public.settle_borrow_siblings()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if NEW.status = 'accepted' and OLD.status is distinct from 'accepted' then
    update public.borrow_requests
       set status = 'declined', auto_closed = true
     where item_id = NEW.item_id and id <> NEW.id and status = 'pending';
    update public.lend_items set status = 'lent'
     where id = NEW.item_id and status = 'available';

  -- The item is free again: returned, or the borrower changed their mind.
  elsif NEW.status in ('returned', 'cancelled') and OLD.status = 'accepted' then
    update public.lend_items set status = 'available'
     where id = NEW.item_id and status = 'lent';
  end if;
  return NEW;
end; $fn$;

drop trigger if exists trg_settle_borrow_siblings on public.borrow_requests;
create trigger trg_settle_borrow_siblings
  after update on public.borrow_requests
  for each row execute function public.settle_borrow_siblings();

-- ── 4. Sentences, not status codes ──────────────────────────────────
create or replace function public.on_borrow_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_cid uuid; v_title text; v_owner uuid; v_owner_name text; v_who text;
  v_target uuid; v_head text; v_body text;
begin
  if NEW.status is not distinct from OLD.status then return NEW; end if;

  select i.community_id, i.title, i.owner_user_id into v_cid, v_title, v_owner
    from public.lend_items i where i.id = NEW.item_id;
  v_title := left(coalesce(v_title, 'item'), 40);
  select coalesce(name, 'A neighbour') into v_owner_name from public.profiles where id = v_owner;
  select coalesce(name, 'A neighbour') into v_who from public.profiles where id = NEW.requester_id;

  if NEW.status = 'cancelled' then
    -- The asker walked away; the owner is the one who needs to know.
    v_target := v_owner;
    v_head := v_who || ' no longer needs your ' || v_title;
    v_body := 'They have withdrawn their request.';
  else
    v_target := NEW.requester_id;
    if NEW.status = 'accepted' then
      v_head := '🤝 ' || v_owner_name || ' said yes — ' || v_title;
      v_body := 'Message them to arrange when to pick it up.';
    elsif NEW.status = 'declined' and NEW.auto_closed then
      v_head := v_title || ' has gone to another neighbour';
      v_body := 'Your request has been closed. Do ask again another time.';
    elsif NEW.status = 'declined' then
      v_head := v_owner_name || ' can''t lend the ' || v_title || ' right now';
      v_body := 'Nothing personal — try again another time.';
    else -- returned
      v_head := 'Returned: ' || v_title;
      v_body := v_owner_name || ' has marked it back with them. Thank you!';
    end if;
  end if;

  -- Never notify somebody about their own tap.
  if v_target is distinct from auth.uid() and v_target is not null then
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_cid, 'borrow', NEW.item_id, auth.uid(), v_target, v_head, v_body, '/borrow/' || NEW.item_id::text);
  end if;
  return NEW;
end; $fn$;

-- ── 5. The item itself going quiet ──────────────────────────────────
-- An owner who flips straight to "Lent out" or "Hide" has answered everyone
-- waiting, whether or not they meant to. Close those requests and say so.
create or replace function public.on_lend_item_unavailable()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if NEW.status <> 'available' and OLD.status = 'available' then
    update public.borrow_requests
       set status = 'declined', auto_closed = true
     where item_id = NEW.id and status = 'pending';
  end if;
  return NEW;
end; $fn$;

drop trigger if exists trg_lend_item_unavailable on public.lend_items;
create trigger trg_lend_item_unavailable
  after update of status on public.lend_items
  for each row execute function public.on_lend_item_unavailable();

-- ── 6. A withdrawn listing says goodbye ─────────────────────────────
-- Runs BEFORE the cascade, while the requests still exist to be read.
create or replace function public.on_lend_item_delete()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare r record; v_title text;
begin
  v_title := left(coalesce(OLD.title, 'item'), 40);
  for r in
    select requester_id, status from public.borrow_requests
     where item_id = OLD.id and status in ('pending', 'accepted')
  loop
    if r.requester_id is distinct from auth.uid() then
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (OLD.community_id, 'borrow', OLD.id, auth.uid(), r.requester_id,
              'The ' || v_title || ' is no longer listed',
              case when r.status = 'accepted'
                   then 'The listing was removed. Do return it to them as agreed.'
                   else 'Your request has been closed.' end,
              '/borrow');
    end if;
  end loop;
  return OLD;
end; $fn$;

drop trigger if exists trg_lend_item_delete on public.lend_items;
create trigger trg_lend_item_delete
  before delete on public.lend_items
  for each row execute function public.on_lend_item_delete();

comment on column public.borrow_requests.auto_closed is
  'True when the app closed this request because the item went elsewhere or was withdrawn — not because the owner declined this person.';
