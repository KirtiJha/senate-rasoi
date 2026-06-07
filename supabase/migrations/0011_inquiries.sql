-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0011: inquiries table + push trigger
-- Records "I'm interested" actions against any listing. Used to:
--   • show "N neighbours interested" counts (Phase 4)
--   • push-notify the listing owner
-- v1 ships this table + trigger; the feed count badge is Phase 4.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.inquiries (
  id            uuid        primary key default gen_random_uuid(),
  listing_id    uuid        not null references public.listings(id) on delete cascade,
  from_user_id  uuid        not null references public.profiles(id) on delete cascade,
  message       text,
  status        text        not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  unique (listing_id, from_user_id)
);

create index if not exists inquiries_listing_idx on public.inquiries (listing_id);
create index if not exists inquiries_from_idx    on public.inquiries (from_user_id);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.inquiries enable row level security;

-- Inquirer can see their own; listing owner can see all inquiries on their listing.
drop policy if exists inquiries_read on public.inquiries;
create policy inquiries_read on public.inquiries
  for select using (
    from_user_id = auth.uid()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_user_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

drop policy if exists inquiries_insert on public.inquiries;
create policy inquiries_insert on public.inquiries
  for insert with check (from_user_id = auth.uid());

drop policy if exists inquiries_update on public.inquiries;
create policy inquiries_update on public.inquiries
  for update using (
    from_user_id = auth.uid()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_user_id = auth.uid()
    )
  );

-- ── Push notification on new inquiry ────────────────────────────────
-- Reuses the existing notify_user() RPC + pg_net pipeline from migration 0005.
create or replace function public.on_inquiry_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id   uuid;
  v_inquirer   text;
  v_title      text;
begin
  -- Look up the listing owner and title.
  select l.owner_user_id, l.title
    into v_owner_id, v_title
    from public.listings l
   where l.id = NEW.listing_id;

  -- Don't notify if the owner is the one inquiring (edge case).
  if v_owner_id = NEW.from_user_id then
    return NEW;
  end if;

  -- Look up inquirer's display name.
  select coalesce(p.name, 'Someone')
    into v_inquirer
    from public.profiles p
   where p.id = NEW.from_user_id;

  -- Fire push (best-effort; notify_user is SECURITY DEFINER and uses pg_net).
  perform public.notify_user(
    v_owner_id,
    v_inquirer || ' is interested',
    v_inquirer || ' enquired about your listing: ' || left(v_title, 60)
  );

  return NEW;
end;
$$;

drop trigger if exists trg_inquiry_notify on public.inquiries;
create trigger trg_inquiry_notify
  after insert on public.inquiries
  for each row execute function public.on_inquiry_create();
