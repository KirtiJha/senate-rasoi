-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0058: borrow/lend improvements
-- Run AFTER 0001–0057.
--
--   1. Add `kind` column to lend_items: 'offer' (I'm lending this) vs
--      'request' (I need to borrow something). Defaults to 'offer' so
--      existing rows are unaffected.
--   2. Add in-app notification triggers:
--      a. New lend_item → community broadcast (type = 'borrow')
--      b. New borrow_request → targeted at item owner (type = 'borrow')
-- ════════════════════════════════════════════════════════════════════

-- ── 1. kind column ──────────────────────────────────────────────────
alter table public.lend_items
  add column if not exists kind text not null default 'offer'
  check (kind in ('offer', 'request'));

-- ── 2a. Notification when a new lend_item is posted ────────────────
create or replace function public.on_lend_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
begin
  select coalesce(name, 'A neighbour') into v_actor_name
    from public.profiles where id = NEW.owner_user_id;

  insert into public.notifications (
    community_id, type, entity_id, actor_id, target_user_id, title, body, route
  ) values (
    NEW.community_id,
    'borrow',
    NEW.id,
    NEW.owner_user_id,
    null, -- broadcast to community
    case NEW.kind
      when 'request' then '🙏 ' || v_actor_name || ' needs to borrow something'
      else '🤝 ' || v_actor_name || ' is lending something'
    end,
    NEW.title,
    '/borrow/' || NEW.id
  );
  return NEW;
end;
$$;

drop trigger if exists lend_item_notify on public.lend_items;
create trigger lend_item_notify
  after insert on public.lend_items
  for each row execute function public.on_lend_item_insert();

-- ── 2b. Notification when a borrow request is made ─────────────────
create or replace function public.on_borrow_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_title    text;
  v_item_owner    uuid;
  v_community_id  uuid;
  v_requester_name text;
begin
  select title, owner_user_id, community_id into v_item_title, v_item_owner, v_community_id
    from public.lend_items where id = NEW.item_id;

  select coalesce(name, 'A neighbour') into v_requester_name
    from public.profiles where id = NEW.requester_id;

  insert into public.notifications (
    community_id, type, entity_id, actor_id, target_user_id, title, body, route
  ) values (
    v_community_id,
    'borrow',
    NEW.item_id,
    NEW.requester_id,
    v_item_owner, -- targeted at owner only
    'New borrow request 🤝',
    v_requester_name || ' wants to borrow your ' || coalesce(v_item_title, 'item'),
    '/borrow/' || NEW.item_id
  );
  return NEW;
end;
$$;

drop trigger if exists borrow_request_notify on public.borrow_requests;
create trigger borrow_request_notify
  after insert on public.borrow_requests
  for each row execute function public.on_borrow_request_insert();
