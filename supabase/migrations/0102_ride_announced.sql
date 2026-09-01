-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0102: a new lift is announced
-- Run AFTER 0001–0101.
--
-- Every other thing a resident posts tells the society it exists: a dish, a
-- listing, a poll, a flat, a lost item, a place, a celebration. A ride did not.
-- So somebody could offer three empty seats to the building and nobody would
-- ever learn, which makes the feature look dead from the driver's side too —
-- they post, nothing happens, and they go back to the group chat.
--
-- Broadcast rather than targeted, so it is muteable: this is an announcement
-- to the society, and a resident with no car and no commute should be able to
-- switch it off. The personal half — somebody wants your seat, your seat is
-- confirmed, your lift is tomorrow — is targeted and stays unmuteable, which
-- is exactly the split the mute filter already makes.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_ride_created() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_who  text;
  v_when text;
begin
  select coalesce(p.name, 'A neighbour') into v_who
    from public.profiles p where p.id = NEW.driver_user_id;

  -- "every weekday at 9:00 am" tells a reader whether it is any use to them;
  -- the date alone does not.
  v_when := case
    when NEW.one_off_date is not null
      then to_char(NEW.one_off_date, 'FMDay FMDD Mon')
    when cardinality(NEW.days_of_week) = 7 then 'every day'
    when NEW.days_of_week @> array[1,2,3,4,5] and cardinality(NEW.days_of_week) = 5
      then 'every weekday'
    else 'weekly'
  end || ' at ' || to_char(current_date + NEW.depart_time, 'FMHH12:MI am');

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (
    NEW.community_id, 'carpool', NEW.id, NEW.driver_user_id, null,
    v_who || ' is offering a lift',
    NEW.from_text || ' → ' || NEW.to_text || ' · ' || v_when
      || ' · ' || NEW.seats_total || ' seat' || case when NEW.seats_total = 1 then '' else 's' end,
    '/rides/' || NEW.id
  );

  return NEW;
end; $$;

drop trigger if exists trg_ride_created on public.rides;
create trigger trg_ride_created
  after insert on public.rides
  for each row execute function public.on_ride_created();
