-- A message can carry a photo.
--
-- Direct messages were words only. A neighbour asking "is this your
-- parcel?" or "which switch?" had to describe it, or leave for WhatsApp.
--
-- Photos live in a private bucket, one folder per thread, readable by the
-- two people in it and nobody else; the client asks for a short-lived
-- signed URL when it draws one. The thread preview, the bell entry and the
-- push all learn to say "Photo" when there are no words.

alter table public.dm_messages add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('dm-photos', 'dm-photos', false)
on conflict (id) do nothing;

-- Is the caller one of the two people in the thread this object belongs to?
-- Object names are '<thread id>/<file>'.
create or replace function public.dm_photo_allowed(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dm_threads t
     where t.id::text = split_part(p_name, '/', 1)
       and auth.uid() in (t.user_a, t.user_b)
  );
$$;
grant execute on function public.dm_photo_allowed(text) to authenticated;

drop policy if exists dm_photos_participant_read on storage.objects;
create policy dm_photos_participant_read on storage.objects
  for select to authenticated
  using (bucket_id = 'dm-photos' and public.dm_photo_allowed(name));

drop policy if exists dm_photos_participant_write on storage.objects;
create policy dm_photos_participant_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dm-photos' and public.dm_photo_allowed(name));

drop policy if exists dm_photos_owner_delete on storage.objects;
create policy dm_photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'dm-photos' and owner = auth.uid());

-- The thread preview and the push: "Photo" when there are no words.
create or replace function public.on_dm_message()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_other  uuid;
  v_sender text;
  v_line   text := coalesce(nullif(left(NEW.body, 120), ''), '📷 Photo');
begin
  update public.dm_threads
     set last_message = v_line, last_message_at = now()
   where id = NEW.thread_id;

  select case when t.user_a = NEW.sender_id then t.user_b else t.user_a end
    into v_other
    from public.dm_threads t
   where t.id = NEW.thread_id;

  select coalesce(p.name, 'Someone') into v_sender
    from public.profiles p where p.id = NEW.sender_id;

  perform public.notify_user(
    v_other,
    v_sender || ' sent you a message',
    coalesce(nullif(left(NEW.body, 100), ''), 'Sent you a photo'),
    '/messages/' || NEW.thread_id
  );
  return NEW;
end;
$$;

create or replace function public.on_dm_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid; v_comm uuid; v_sender text;
begin
  select case when t.user_a = NEW.sender_id then t.user_b else t.user_a end, t.community_id
    into v_other, v_comm
    from public.dm_threads t where t.id = NEW.thread_id;
  select coalesce(name, 'Someone') into v_sender from public.profiles where id = NEW.sender_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_comm, 'message', NEW.thread_id, NEW.sender_id, v_other,
          v_sender || ' sent you a message',
          coalesce(nullif(left(NEW.body, 80), ''), 'Sent you a photo'),
          '/messages/' || NEW.thread_id::text);
  return NEW;
end; $$;

-- Withdrawing a photo message takes the photo with it.
create or replace function public.guard_dm_message_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = OLD.sender_id
     and NEW.deleted_at is not null and OLD.deleted_at is null then
    NEW.body := '';
    NEW.photo_path := null;
    NEW.sender_id := OLD.sender_id;
    NEW.thread_id := OLD.thread_id;
    NEW.created_at := OLD.created_at;
    NEW.read_at := OLD.read_at;
    return NEW;
  end if;

  if NEW.body is distinct from OLD.body
     or NEW.photo_path is distinct from OLD.photo_path
     or NEW.sender_id is distinct from OLD.sender_id
     or NEW.thread_id is distinct from OLD.thread_id
     or NEW.created_at is distinct from OLD.created_at
     or NEW.deleted_at is distinct from OLD.deleted_at then
    raise exception 'A message cannot be changed after it is sent.';
  end if;

  if NEW.read_at is distinct from OLD.read_at and auth.uid() = OLD.sender_id then
    raise exception 'Only the person a message was sent to can mark it read.';
  end if;

  return NEW;
end; $$;

create or replace function public.on_dm_message_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_last record;
begin
  if NEW.deleted_at is null or OLD.deleted_at is not null then return NEW; end if;

  select body, photo_path, created_at into v_last
    from public.dm_messages
   where thread_id = NEW.thread_id and deleted_at is null
   order by created_at desc limit 1;

  update public.dm_threads
     set last_message = coalesce(
           nullif(left(v_last.body, 120), ''),
           case when v_last.photo_path is not null then '📷 Photo' end,
           'Message withdrawn')
   where id = NEW.thread_id;
  return NEW;
exception when others then
  return NEW;
end; $$;
