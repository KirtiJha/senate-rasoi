-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0060: Nearby places directory
-- Run AFTER 0001–0059.
--
-- A community-curated directory of nearby contacts (hospitals, clinics,
-- schools, supermarkets, salons, …). Anyone in the community can add; the
-- submitter or an admin can edit/delete. Optional map pin (lat/lng) + photos.
-- Photos reuse the existing public `listing-photos` bucket under a `place/`
-- prefix, so no new bucket is required.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.places (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities(id) on delete cascade,
  created_by    uuid not null references public.profiles(id)   on delete cascade,
  place_type    text not null,                      -- 'hospital' | 'clinic' | … (app-enforced)
  name          text not null,
  description   text,
  address       text,
  lat           double precision,
  lng           double precision,
  phone         text,
  whatsapp      text,
  website       text,
  hours         text,                               -- free text, e.g. "24x7", "9 AM – 9 PM"
  photos        text[] not null default '{}',
  created_at    timestamptz not null default now(),
  bump_at       timestamptz not null default now()
);
create index if not exists places_feed_idx on public.places (community_id, bump_at desc);
create index if not exists places_type_idx on public.places (community_id, place_type, bump_at desc);

alter table public.places enable row level security;

drop policy if exists places_read on public.places;
create policy places_read on public.places for select
  using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

drop policy if exists places_insert on public.places;
create policy places_insert on public.places for insert
  with check (created_by = auth.uid() and public.is_my_community(community_id));

drop policy if exists places_update on public.places;
create policy places_update on public.places for update
  using (created_by = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists places_delete on public.places;
create policy places_delete on public.places for delete
  using (created_by = auth.uid() or public.is_admin(auth.uid()));

-- New place → broadcast a community notification.
create or replace function public.on_place_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.created_by;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'place', NEW.id, NEW.created_by,
          v_actor || ' added a nearby place', left(NEW.name, 80), '/place/' || NEW.id::text);
  return NEW;
end; $$;
drop trigger if exists trg_place_notify on public.places;
create trigger trg_place_notify after insert on public.places
  for each row execute function public.on_place_notify();

-- Extend the photo-delete policy (from 0050) so a place's submitter / admin can
-- delete its photos. Photos live in `listing-photos` under `place/<id>/…`.
drop policy if exists "photos_owner_delete" on storage.objects;
create policy "photos_owner_delete" on storage.objects for delete to authenticated using (
  public.is_admin(auth.uid())
  or (bucket_id = 'listing-photos' and name like 'property/%'
      and exists (select 1 from public.property_listings p where p.id::text = split_part(name, '/', 2) and p.owner_user_id = auth.uid()))
  or (bucket_id = 'listing-photos' and name like 'borrow/%'
      and exists (select 1 from public.lend_items i where i.id::text = split_part(name, '/', 2) and i.owner_user_id = auth.uid()))
  or (bucket_id = 'listing-photos' and name like 'place/%'
      and exists (select 1 from public.places pl where pl.id::text = split_part(name, '/', 2) and pl.created_by = auth.uid()))
  or (bucket_id = 'listing-photos' and name not like 'property/%' and name not like 'borrow/%' and name not like 'place/%'
      and exists (select 1 from public.listings l where l.id::text = split_part(name, '/', 2) and l.owner_user_id = auth.uid()))
  or (bucket_id = 'dish-photos'
      and exists (select 1 from public.dishes d where d.id::text = split_part(split_part(name, '/', 2), '.', 1) and d.chef_user_id = auth.uid()))
  or (bucket_id = 'sport-logos'
      and exists (select 1 from public.sport_groups g where g.id::text = split_part(name, '.', 1) and g.created_by = auth.uid()))
);
