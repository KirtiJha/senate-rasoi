-- A face to the name.
--
-- Everyone in Aangan was two initials on a coloured circle. A society is
-- people who pass each other at the gate; a photo is how "Flat 204" becomes
-- "oh, her". The photo is optional and the initials stay as the fallback.
--
-- Public bucket, one folder per person, and only that person may put
-- anything in it. The profile row keeps the URL so every list that already
-- joins profiles can draw the face without another request.

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- A neighbour changing their photo should reach every open screen; the
-- avatar map listens for profile updates, so profiles joins the stream.
alter publication supabase_realtime add table public.profiles;
