-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0036: property listings (flats for sale / rent)
-- Run AFTER 0001–0035.
--
-- Owners post their flat for sale or rent with details, photos and availability,
-- and mark it available / sold / rented. PRICE IS INTENTIONALLY NOT STORED —
-- interested neighbours use "Contact owner for price". Neighbours can ask the
-- owner for details (per-property Q&A chat) and recommend a buyer/tenant
-- (referrals). Everything is society-scoped + realtime; triggers fire targeted
-- notifications (type 'property').
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.property_listings (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references public.communities(id) on delete cascade,
  owner_user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_type     text not null check (listing_type in ('sale', 'rent')),
  title            text not null,
  description      text,
  config           text,                 -- '1 RK','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK'
  area_sqft        integer,
  floor            integer,
  total_floors     integer,
  furnishing       text check (furnishing in ('unfurnished', 'semi', 'furnished')),
  facing           text,
  bathrooms        integer,
  balconies        integer,
  parking          text check (parking in ('none', 'open', 'covered')),
  tower            text,
  flat_no          text,
  available_from   date,
  amenities        text[]  not null default '{}',
  photos           text[]  not null default '{}',
  contact_whatsapp text,
  contact_phone    text,
  status           text not null default 'available' check (status in ('available', 'sold', 'rented')),
  bump_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists property_feed_idx  on public.property_listings (community_id, status, bump_at desc);
create index if not exists property_owner_idx on public.property_listings (owner_user_id);

alter table public.property_listings enable row level security;

drop policy if exists property_read on public.property_listings;
create policy property_read on public.property_listings for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

drop policy if exists property_insert on public.property_listings;
create policy property_insert on public.property_listings for insert
  with check (owner_user_id = auth.uid() and public.is_my_community(community_id));

drop policy if exists property_update on public.property_listings;
create policy property_update on public.property_listings for update
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists property_delete on public.property_listings;
create policy property_delete on public.property_listings for delete
  using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

-- ── Per-property Q&A chat (ask the owner for details) ───────────────
create table if not exists public.property_messages (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property_listings(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists property_messages_idx on public.property_messages (property_id, created_at);

alter table public.property_messages enable row level security;

drop policy if exists property_msg_read on public.property_messages;
create policy property_msg_read on public.property_messages for select using (
  exists (select 1 from public.property_listings pl where pl.id = property_id and public.is_my_community(pl.community_id))
);
drop policy if exists property_msg_insert on public.property_messages;
create policy property_msg_insert on public.property_messages for insert with check (
  author_id = auth.uid()
  and exists (select 1 from public.property_listings pl where pl.id = property_id and public.is_my_community(pl.community_id))
);
drop policy if exists property_msg_delete on public.property_messages;
create policy property_msg_delete on public.property_messages for delete
  using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- ── Buyer / tenant referrals (recommend someone to the owner) ───────
create table if not exists public.property_referrals (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.property_listings(id) on delete cascade,
  referrer_id     uuid not null references public.profiles(id) on delete cascade,
  candidate_name  text not null,
  candidate_phone text,
  note            text,
  status          text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at      timestamptz not null default now()
);
create index if not exists property_referrals_idx on public.property_referrals (property_id, created_at desc);

alter table public.property_referrals enable row level security;

-- Read: the referrer, the property owner, or an admin.
drop policy if exists property_ref_read on public.property_referrals;
create policy property_ref_read on public.property_referrals for select using (
  referrer_id = auth.uid()
  or exists (select 1 from public.property_listings pl where pl.id = property_id and pl.owner_user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists property_ref_insert on public.property_referrals;
create policy property_ref_insert on public.property_referrals for insert with check (
  referrer_id = auth.uid()
  and exists (select 1 from public.property_listings pl where pl.id = property_id and public.is_my_community(pl.community_id))
);
-- Update (status): the property owner only.
drop policy if exists property_ref_update on public.property_referrals;
create policy property_ref_update on public.property_referrals for update using (
  exists (select 1 from public.property_listings pl where pl.id = property_id and pl.owner_user_id = auth.uid())
);
drop policy if exists property_ref_delete on public.property_referrals;
create policy property_ref_delete on public.property_referrals for delete
  using (referrer_id = auth.uid() or public.is_admin(auth.uid()));

-- ── Notifications (type 'property') ─────────────────────────────────
-- New flat → broadcast to the community.
create or replace function public.on_property_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text; v_kind text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.owner_user_id;
  v_kind := case when NEW.listing_type = 'rent' then 'for rent' else 'for sale' end;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'property', NEW.id, NEW.owner_user_id,
          'New flat ' || v_kind, left(NEW.title, 80), '/property/' || NEW.id::text);
  return NEW;
end; $$;
drop trigger if exists trg_property_notify on public.property_listings;
create trigger trg_property_notify after insert on public.property_listings
  for each row execute function public.on_property_notify();

-- New question → notify the owner; owner's reply → notify thread participants.
create or replace function public.on_property_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cid uuid; v_title text; v_author text; r record;
begin
  select pl.owner_user_id, pl.community_id, pl.title into v_owner, v_cid, v_title
    from public.property_listings pl where pl.id = NEW.property_id;
  select coalesce(p.name, 'Someone') into v_author from public.profiles p where p.id = NEW.author_id;
  if NEW.author_id is distinct from v_owner then
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_cid, 'property', NEW.property_id, NEW.author_id, v_owner,
            v_author || ' asked about your flat', left(NEW.body, 80), '/property/' || NEW.property_id::text);
  else
    for r in select distinct author_id from public.property_messages
      where property_id = NEW.property_id and author_id is distinct from v_owner
    loop
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (v_cid, 'property', NEW.property_id, NEW.author_id, r.author_id,
              v_author || ' replied', left(NEW.body, 80), '/property/' || NEW.property_id::text);
    end loop;
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_property_message on public.property_messages;
create trigger trg_property_message after insert on public.property_messages
  for each row execute function public.on_property_message();

-- New referral → notify the owner.
create or replace function public.on_property_referral()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cid uuid; v_referrer text;
begin
  select pl.owner_user_id, pl.community_id into v_owner, v_cid
    from public.property_listings pl where pl.id = NEW.property_id;
  select coalesce(p.name, 'Someone') into v_referrer from public.profiles p where p.id = NEW.referrer_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_cid, 'property', NEW.property_id, NEW.referrer_id, v_owner,
          v_referrer || ' recommended a buyer/tenant', left(NEW.candidate_name, 60), '/property/' || NEW.property_id::text);
  return NEW;
end; $$;
drop trigger if exists trg_property_referral on public.property_referrals;
create trigger trg_property_referral after insert on public.property_referrals
  for each row execute function public.on_property_referral();

-- ── Realtime (idempotent) ───────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.property_listings;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.property_messages;   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.property_referrals;  exception when duplicate_object then null; end $$;
