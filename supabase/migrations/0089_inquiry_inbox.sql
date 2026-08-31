-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0089: an inquiry that actually arrives
-- Run AFTER 0001–0088.
--
-- Asking to join a carpool did almost nothing visible. Three separate faults,
-- each of which alone would have been enough to make it look broken.
--
-- 1. NO INBOX ROW. on_inquiry_create called notify_user and stopped there,
--    which sends an Expo push and writes nothing to `notifications`. So the
--    owner got a banner if push happened to be working on their device, and
--    the moment it was dismissed there was no trace of it anywhere in the app.
--    This is the same fault 0057 fixed for orders; inquiries were missed.
--
-- 2. ONLY ON INSERT. sendInquiry upserts on (listing_id, from_user_id), so the
--    second time somebody asked about the same listing — a follow-up, a
--    corrected message — the row was UPDATEd and the AFTER INSERT trigger
--    never ran. The most motivated enquirer was the one most reliably ignored.
--
-- 3. THE MESSAGE WAS UNREADABLE. Nothing in the app ever selected it. The
--    owner saw a count on their own listing card and no way to open it; that
--    part is fixed in the app, not here.
--
-- The push now comes from the notification row via 0066's trigger rather than
-- a direct notify_user call, so there is exactly one push and one inbox entry.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_inquiry_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_title    text;
  v_comm     uuid;
  v_inquirer text;
begin
  select l.owner_user_id, l.title, l.community_id
    into v_owner_id, v_title, v_comm
    from public.listings l
   where l.id = NEW.listing_id;

  if v_owner_id is null or v_owner_id = NEW.from_user_id then
    return NEW;
  end if;

  -- On an update, only say something if the message actually changed.
  -- Re-tapping the button with the same words is not news.
  if TG_OP = 'UPDATE'
     and NEW.message is not distinct from OLD.message then
    return NEW;
  end if;

  select coalesce(p.name, 'Someone') into v_inquirer
    from public.profiles p where p.id = NEW.from_user_id;

  -- The inbox row. 0066's trigger turns this into a push, so notify_user is
  -- deliberately not called here — two calls meant two notifications.
  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (
    v_comm,
    'listing',
    NEW.listing_id,
    NEW.from_user_id,
    v_owner_id,
    v_inquirer || ' is interested',
    coalesce(
      nullif(trim(NEW.message), ''),
      'Asked about ' || left(coalesce(v_title, 'your listing'), 60)
    ),
    '/listing/' || NEW.listing_id
  );

  return NEW;
end;
$$;

drop trigger if exists trg_inquiry_notify on public.inquiries;
create trigger trg_inquiry_notify
  after insert or update on public.inquiries
  for each row execute function public.on_inquiry_create();

-- ─── Let the enquirer see their own request ──────────────────────────
-- 0011's read policy covers the listing owner and, depending on how it was
-- written, may not cover the person who sent it. Somebody who asks to join a
-- ride must be able to see that they asked.
drop policy if exists inquiries_read_own on public.inquiries;
create policy inquiries_read_own on public.inquiries
  for select using (auth.uid() = from_user_id);
