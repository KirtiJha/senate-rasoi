-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0065: Lost & Found
-- Run AFTER 0001–0064.
--
-- Residents report something they've lost, or something they've found in a
-- common area, so it finds its way back to its owner.
--
-- NOTE: `community_id` is uuid + FK, matching every other table (and the
-- `notifications` insert in the trigger below, whose column is also uuid).
-- Reads are scoped to your own society via is_my_community(), per the 0038
-- hardening — never `using (true)`.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.lost_found_items (
  id               uuid        primary key default gen_random_uuid(),
  community_id     uuid        not null references public.communities(id) on delete cascade,
  owner_user_id    uuid        not null references public.profiles(id) on delete cascade,
  kind             text        not null default 'lost' check (kind in ('lost', 'found')),
  title            text        not null,
  description      text,
  category         text,
  photo_url        text,
  contact_whatsapp text,
  status           text        not null default 'open' check (status in ('open', 'resolved')),
  created_at       timestamptz not null default now(),
  bump_at          timestamptz not null default now()
);

create index if not exists lost_found_feed_idx  on public.lost_found_items (community_id, bump_at desc);
create index if not exists lost_found_owner_idx on public.lost_found_items (owner_user_id);

alter table public.lost_found_items enable row level security;

-- Read: members of the same society (or an admin).
drop policy if exists "lost_found read" on public.lost_found_items;
create policy lf_read on public.lost_found_items for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

-- Insert: your own row, in your own society.
drop policy if exists "lost_found insert" on public.lost_found_items;
create policy lf_insert on public.lost_found_items for insert to authenticated
  with check (owner_user_id = auth.uid() and public.is_my_community(community_id));

-- Update / delete: owner or admin.
drop policy if exists "lost_found update" on public.lost_found_items;
create policy lf_update on public.lost_found_items for update to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "lost_found delete" on public.lost_found_items;
create policy lf_delete on public.lost_found_items for delete to authenticated
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

-- ─── Notification trigger (community broadcast) ───────────────────────
create or replace function public.on_lost_found_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_title text;
begin
  select name into v_name from public.profiles where id = new.owner_user_id;

  v_title := case
    when new.kind = 'lost' then '🔍 Lost: ' || new.title
    else '📦 Found: ' || new.title
  end;

  insert into public.notifications (
    community_id, type, entity_id, actor_id,
    target_user_id, title, body, route
  ) values (
    new.community_id,
    'lost_found',
    new.id,
    new.owner_user_id,
    null,   -- community broadcast
    v_title,
    coalesce(v_name, 'A neighbour') || ' posted in Lost & Found',
    '/lost-found/' || new.id
  );

  return new;
end;
$$;

drop trigger if exists lost_found_notify on public.lost_found_items;
create trigger lost_found_notify
  after insert on public.lost_found_items
  for each row execute function public.on_lost_found_insert();
