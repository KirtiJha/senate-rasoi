-- Saathi learns the rest of the society.
--
-- Three gaps the chat history showed. "Set up a reminder for the 6am tanker"
-- had nowhere to go. Carpool was never in the search index, so "any ride to
-- Whitefield?" could only be answered "none". And a sports group's practice
-- days and time were not in its index text, so "when is badminton?" found
-- the group and could not say.

-- ── 1. Reminders ─────────────────────────────────────────────────────
-- Saathi proposes one; the resident confirms; the app inserts it as
-- themselves under RLS. A minute-cron turns due rows into notifications,
-- which push through the existing pipeline on the 'mine' channel.
create table if not exists public.saathi_reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  text         text not null check (length(btrim(text)) between 1 and 200),
  remind_at    timestamptz not null,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists saathi_reminders_due on public.saathi_reminders (remind_at) where sent_at is null;

alter table public.saathi_reminders enable row level security;
drop policy if exists saathi_reminders_own on public.saathi_reminders;
create policy saathi_reminders_own on public.saathi_reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and remind_at > now() - interval '1 minute');

create or replace function public.fire_saathi_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in
    select id, user_id, community_id, text
      from public.saathi_reminders
     where sent_at is null and remind_at <= now()
     order by remind_at
     limit 200
  loop
    insert into public.notifications (community_id, type, entity_id, target_user_id, title, body, route)
    values (r.community_id, 'reminder', r.id, r.user_id, 'Reminder', r.text, '/ask');
    update public.saathi_reminders set sent_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end; $$;

select cron.unschedule('aangan-saathi-reminders') where exists (select 1 from cron.job where jobname = 'aangan-saathi-reminders');
select cron.schedule('aangan-saathi-reminders', '* * * * *', $$select public.fire_saathi_reminders();$$);

-- ── 2. Carpool in the index ──────────────────────────────────────────
create or replace function public.sd_index_ride()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_days text;
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='ride' and source_id=OLD.id; return OLD; end if;
  if not NEW.active then
    delete from public.search_documents where source='ride' and source_id=NEW.id;
    return NEW;
  end if;
  select string_agg((array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[d + 1], ', ' order by d)
    into v_days from unnest(NEW.days_of_week) d;
  perform public.sd_upsert('ride', NEW.id, NEW.community_id,
    'Carpool: ' || NEW.from_text || ' to ' || NEW.to_text
    || ' — leaves ' || left(NEW.depart_time::text, 5)
    || coalesce(' on ' || v_days, '')
    || coalesce(' on ' || NEW.one_off_date::text, '')
    || ' · ' || NEW.seats_total || ' seats'
    || coalesce(' · ₹' || NEW.price_per_seat || ' per seat', '')
    || coalesce(' · ' || NEW.vehicle, '')
    || coalesce(' · ' || NEW.note, ''));
  return NEW;
end; $$;

drop trigger if exists trg_sd_index_ride on public.rides;
create trigger trg_sd_index_ride
  after insert or update or delete on public.rides
  for each row execute function public.sd_index_ride();

-- Existing rides join the index.
update public.rides set active = active where active;

create or replace function public.saathi_watch_route(p_source text, p_id uuid)
returns text language sql immutable as $$
  select case p_source
    when 'listing'    then '/listing/'    || p_id
    when 'property'   then '/property/'   || p_id
    when 'borrow'     then '/borrow/'     || p_id
    when 'post'       then '/feed/'       || p_id
    when 'event'      then '/events/'     || p_id
    when 'place'      then '/place/'      || p_id
    when 'lostfound'  then '/lost-found/' || p_id
    when 'recommend'  then '/recommend/'  || p_id
    when 'ride'       then '/rides/'      || p_id
    when 'dish'       then '/food'
    when 'tiffin'     then '/food'
    when 'sport'      then '/sports/'     || p_id
    when 'document'   then '/documents'
    when 'emergency'  then '/emergency'
    else '/'
  end;
$$;

-- ── 3. Practice days and time in a sports group's index text ─────────
create or replace function public.sd_index_sport()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='sport' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('sport', NEW.id, NEW.community_id,
    NEW.name || ' — ' || NEW.sport || ' group'
    || coalesce(' · practice ' || NEW.practice_days, '')
    || coalesce(' at ' || NEW.practice_time, '')
    || coalesce(' for ' || NEW.practice_duration, '')
    || coalesce(' · ' || NEW.practice_location, '')
    || coalesce(' · ' || NEW.description, ''));
  return NEW;
end; $$;

update public.sport_groups set name = name;
