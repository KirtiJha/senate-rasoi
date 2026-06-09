-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0031: sports group logos
-- Run AFTER 0001–0030.
--
-- Adds an uploaded logo image to sports groups. FIRST create a PUBLIC storage
-- bucket named `sport-logos` (Storage → New bucket → sport-logos → Public),
-- then run this file. The client uploads to `{group_id}.jpg`.
-- ════════════════════════════════════════════════════════════════════

alter table public.sport_groups add column if not exists logo_url text;

-- Storage access for the sport-logos bucket: public read, authenticated write.
drop policy if exists sport_logos_read on storage.objects;
create policy sport_logos_read on storage.objects
  for select using (bucket_id = 'sport-logos');

drop policy if exists sport_logos_insert on storage.objects;
create policy sport_logos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'sport-logos');

drop policy if exists sport_logos_update on storage.objects;
create policy sport_logos_update on storage.objects
  for update to authenticated using (bucket_id = 'sport-logos');

drop policy if exists sport_logos_delete on storage.objects;
create policy sport_logos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'sport-logos');
