-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0050: Storage RLS policies for the photo buckets
-- Run AFTER 0001–0049.
--
-- storage.objects has RLS enabled by default, so with NO policies every upload
-- is denied ("new row violates row-level security policy" / 403). The bucket's
-- "public" flag only governs READS — writes still need explicit policies.
--
-- This adds the (previously dashboard-only) policies from docs/LAUNCH_CHECKLIST.md
-- for the three public photo buckets: listing-photos, dish-photos, sport-logos.
-- (The private `documents` bucket already has its own policies in 0032.)
--
-- Prereq: the three buckets must already exist (created in the dashboard).
-- ════════════════════════════════════════════════════════════════════

-- Make sure the photo buckets are public so getPublicUrl() images load.
update storage.buckets set public = true where id in ('listing-photos', 'dish-photos', 'sport-logos');

-- Public READ — needed for the public image URLs to load.
drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects for select
  using (bucket_id in ('listing-photos', 'dish-photos', 'sport-logos'));

-- WRITE — any signed-in member. Must stay broad: dish/listing photos are uploaded
-- BEFORE the owning row exists (the id is pre-generated for the path), so an
-- owner-scoped insert check would break posting.
drop policy if exists "photos_auth_write" on storage.objects;
create policy "photos_auth_write" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-photos', 'dish-photos', 'sport-logos'));

drop policy if exists "photos_auth_update" on storage.objects;
create policy "photos_auth_update" on storage.objects for update to authenticated
  using (bucket_id in ('listing-photos', 'dish-photos', 'sport-logos'));

-- DELETE — only the owner of the underlying row, or an admin (path → table join).
drop policy if exists "photos_owner_delete" on storage.objects;
create policy "photos_owner_delete" on storage.objects for delete to authenticated using (
  public.is_admin(auth.uid())
  or (bucket_id = 'listing-photos' and name like 'property/%'
      and exists (select 1 from public.property_listings p where p.id::text = split_part(name, '/', 2) and p.owner_user_id = auth.uid()))
  or (bucket_id = 'listing-photos' and name like 'borrow/%'
      and exists (select 1 from public.lend_items i where i.id::text = split_part(name, '/', 2) and i.owner_user_id = auth.uid()))
  or (bucket_id = 'listing-photos' and name not like 'property/%' and name not like 'borrow/%'
      and exists (select 1 from public.listings l where l.id::text = split_part(name, '/', 2) and l.owner_user_id = auth.uid()))
  or (bucket_id = 'dish-photos'
      and exists (select 1 from public.dishes d where d.id::text = split_part(split_part(name, '/', 2), '.', 1) and d.chef_user_id = auth.uid()))
  or (bucket_id = 'sport-logos'
      and exists (select 1 from public.sport_groups g where g.id::text = split_part(name, '.', 1) and g.created_by = auth.uid()))
);
