-- ══════════════════════════════════════════════════════════
-- 0065 – Lost & Found
-- ══════════════════════════════════════════════════════════

-- ─── Table ────────────────────────────────────────────────
create table if not exists public.lost_found_items (
  id               uuid        primary key default gen_random_uuid(),
  community_id     text        not null,
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

alter table public.lost_found_items enable row level security;

-- Everyone may read (open read policy)
create policy "lost_found read"
  on public.lost_found_items for select using (true);

-- Authenticated users insert their own rows
create policy "lost_found insert"
  on public.lost_found_items for insert to authenticated
  with check (owner_user_id = auth.uid());

-- Owner or admin may update
create policy "lost_found update"
  on public.lost_found_items for update to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- Owner or admin may delete
create policy "lost_found delete"
  on public.lost_found_items for delete to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- ─── Notification trigger ─────────────────────────────────
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

create trigger lost_found_notify
  after insert on public.lost_found_items
  for each row execute function public.on_lost_found_insert();
