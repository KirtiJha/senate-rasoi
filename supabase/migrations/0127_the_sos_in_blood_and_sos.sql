-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0127: the SOS in "Blood & SOS"
-- Run AFTER 0001–0126. Safe to re-run.
--
-- The tile is called Blood & SOS. It is an address book.
--
-- Residents opt in, state their blood group, tick "available to donate" — and
-- then, at two in the morning when somebody needs B− at a hospital across
-- town, the app offers a list to scroll and phone numbers to ring one at a
-- time. The one tile built for emergencies is the only tile in Aangan that
-- cannot reach a phone. Marketplace can. A borrowed ladder can.
--
-- So: a request. You say which group, where, and how soon. Every donor in the
-- society who can actually give to that patient is woken — high priority,
-- unmuteable — and anyone who can help says so in one tap, which reaches the
-- person who asked immediately.
--
-- COMPATIBILITY IS THE POINT. Notifying only the exact group would be worse
-- than useless for a patient needing AB+, who can receive from anybody, and
-- would miss every O− donor in the society — the ones who can give to all
-- eight. blood_can_donate_to() encodes the real table, so a request reaches
-- the people who can answer it and nobody else.
--
-- Nothing here replaces an ambulance, and the screen still says so.
-- ════════════════════════════════════════════════════════════════════

-- ── Who can give to whom ────────────────────────────────────────────
create or replace function public.blood_can_donate_to(p_donor text, p_patient text)
returns boolean language sql immutable set search_path = public as $fn$
  select case upper(btrim(coalesce(p_donor, '')))
    when 'O-'  then p_patient in ('O-','O+','A-','A+','B-','B+','AB-','AB+')
    when 'O+'  then p_patient in ('O+','A+','B+','AB+')
    when 'A-'  then p_patient in ('A-','A+','AB-','AB+')
    when 'A+'  then p_patient in ('A+','AB+')
    when 'B-'  then p_patient in ('B-','B+','AB-','AB+')
    when 'B+'  then p_patient in ('B+','AB+')
    when 'AB-' then p_patient in ('AB-','AB+')
    when 'AB+' then p_patient in ('AB+')
    else false
  end;
$fn$;

comment on function public.blood_can_donate_to(text, text) is
  'The real compatibility table. O- gives to everyone; AB+ receives from everyone.';

-- ── The request ─────────────────────────────────────────────────────
create table if not exists public.blood_requests (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities(id) on delete cascade,
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  blood_group   text not null check (blood_group in ('A+','A-','B+','B-','O+','O-','AB+','AB-')),
  units         int  check (units is null or units between 1 and 20),
  hospital      text,
  note          text,
  -- 'now' | 'today' | 'days' — how the ask is phrased, not a deadline to police.
  urgency       text not null default 'today' check (urgency in ('now','today','days')),
  status        text not null default 'open' check (status in ('open','fulfilled','cancelled','expired')),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);

create index if not exists blood_requests_open_idx
  on public.blood_requests (community_id, created_at desc) where status = 'open';

-- ── The answer ──────────────────────────────────────────────────────
create table if not exists public.blood_offers (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.blood_requests(id) on delete cascade,
  donor_id    uuid not null references public.profiles(id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  unique (request_id, donor_id)
);

alter table public.blood_requests enable row level security;
alter table public.blood_offers   enable row level security;

drop policy if exists br_read on public.blood_requests;
create policy br_read on public.blood_requests
  for select using (public.is_my_community(community_id) or public.is_admin(auth.uid()));

drop policy if exists br_insert on public.blood_requests;
create policy br_insert on public.blood_requests
  for insert with check (requester_id = auth.uid() and public.is_my_community(community_id));

-- Only the person who asked may close it; nobody may move it or reassign it.
drop policy if exists br_update on public.blood_requests;
create policy br_update on public.blood_requests
  for update using (requester_id = auth.uid() or public.is_admin(auth.uid()))
  with check (requester_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists br_delete on public.blood_requests;
create policy br_delete on public.blood_requests
  for delete using (requester_id = auth.uid() or public.is_admin(auth.uid()));

-- An offer is visible to the person who asked and to the donor who made it.
drop policy if exists bo_read on public.blood_offers;
create policy bo_read on public.blood_offers
  for select using (
    donor_id = auth.uid()
    or exists (select 1 from public.blood_requests r where r.id = request_id and r.requester_id = auth.uid())
    or public.is_admin(auth.uid())
  );

drop policy if exists bo_insert on public.blood_offers;
create policy bo_insert on public.blood_offers
  for insert with check (
    donor_id = auth.uid()
    and exists (
      select 1 from public.blood_requests r
       where r.id = request_id and r.status = 'open' and public.is_my_community(r.community_id)
    )
  );

-- Offering is a promise you can take back.
drop policy if exists bo_delete on public.blood_offers;
create policy bo_delete on public.blood_offers
  for delete using (donor_id = auth.uid() or public.is_admin(auth.uid()));

-- ── Waking the people who can answer ────────────────────────────────
create or replace function public.on_blood_request()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_who text; v_head text; v_body text; v_sent int := 0;
begin
  select coalesce(name, 'A neighbour') into v_who from public.profiles where id = NEW.requester_id;

  v_head := case NEW.urgency
              when 'now' then '🩸 URGENT: ' || NEW.blood_group || ' blood needed now'
              else '🩸 ' || NEW.blood_group || ' blood needed' end;
  v_body := v_who
            || coalesce(' · ' || nullif(NEW.hospital, ''), '')
            || coalesce(' · ' || NEW.units || (case when NEW.units = 1 then ' unit' else ' units' end), '')
            || ' — you can give to this group.';

  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select NEW.community_id, 'blood', NEW.id, NEW.requester_id, p.id, v_head, v_body, '/helpers'
    from public.profiles p
   where p.community_id = NEW.community_id
     and p.donor_available
     and p.blood_group is not null
     and p.id <> NEW.requester_id
     and coalesce(p.blocked, false) = false
     and public.blood_can_donate_to(p.blood_group, NEW.blood_group);
  get diagnostics v_sent = row_count;

  -- Asking into an empty room should not feel like asking into a full one.
  -- The requester is told plainly how many people this actually reached.
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (NEW.community_id, 'blood', NEW.id, NEW.requester_id, NEW.requester_id,
          case when v_sent = 0
               then 'No matching donors are listed yet'
               else 'Your request reached ' || v_sent || (case when v_sent = 1 then ' donor' else ' donors' end) end,
          case when v_sent = 0
               then 'Nobody in the society has opted in who can give ' || NEW.blood_group || '. Please also call a blood bank.'
               else 'You will be told the moment somebody offers.' end,
          '/helpers');
  return NEW;
end; $fn$;

drop trigger if exists trg_blood_request on public.blood_requests;
create trigger trg_blood_request
  after insert on public.blood_requests
  for each row execute function public.on_blood_request();

create or replace function public.on_blood_offer()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare r record; v_who text; v_flat text; v_phone text;
begin
  select * into r from public.blood_requests where id = NEW.request_id;
  select coalesce(name, 'A neighbour'), flat, coalesce(whatsapp, phone)
    into v_who, v_flat, v_phone
    from public.profiles where id = NEW.donor_id;

  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (r.community_id, 'blood', r.id, NEW.donor_id, r.requester_id,
          '🙏 ' || v_who || ' can give ' || r.blood_group,
          coalesce('Flat ' || v_flat || ' · ', '') || coalesce(v_phone, 'Open Aangan to reach them'),
          '/helpers');
  return NEW;
end; $fn$;

drop trigger if exists trg_blood_offer on public.blood_offers;
create trigger trg_blood_offer
  after insert on public.blood_offers
  for each row execute function public.on_blood_offer();

-- Closing the loop: everyone who offered hears how it ended. Somebody who
-- volunteered to give blood is owed that much.
create or replace function public.on_blood_request_closed()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if NEW.status = OLD.status or NEW.status = 'open' then return NEW; end if;

  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select NEW.community_id, 'blood', NEW.id, auth.uid(), o.donor_id,
         case NEW.status
           when 'fulfilled' then '🩸 ' || NEW.blood_group || ' request has been met'
           else 'The ' || NEW.blood_group || ' request has been closed' end,
         case NEW.status
           when 'fulfilled' then 'Thank you for offering.'
           else 'No donation is needed any more.' end,
         '/helpers'
    from public.blood_offers o
   where o.request_id = NEW.id and o.donor_id is distinct from auth.uid();
  return NEW;
end; $fn$;

drop trigger if exists trg_blood_request_closed on public.blood_requests;
create trigger trg_blood_request_closed
  after update on public.blood_requests
  for each row execute function public.on_blood_request_closed();

-- ── Nothing stays urgent for a week ─────────────────────────────────
-- An open request nobody closed keeps shouting on the screen long after the
-- need has passed, which is how people learn to ignore the shouting.
create or replace function public.expire_stale_blood_requests()
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n int;
begin
  update public.blood_requests
     set status = 'expired', closed_at = now()
   where status = 'open' and created_at < now() - interval '3 days';
  get diagnostics v_n = row_count;
  return v_n;
end; $fn$;

select cron.unschedule('aangan-expire-blood-requests')
 where exists (select 1 from cron.job where jobname = 'aangan-expire-blood-requests');
select cron.schedule('aangan-expire-blood-requests', '15 20 * * *',
                     $cron$ select public.expire_stale_blood_requests(); $cron$);

-- ── A blood request is never a quiet one ────────────────────────────
-- 'blood' joins the high-priority list and is deliberately absent from the
-- muteable categories: this is the one notification a resident cannot switch
-- off, because the cost of missing it is not an unread badge.
create or replace function public.on_notification_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_priority text;
  v_batch    jsonb;
  v_muteable_targeted boolean := NEW.type in ('court', 'recommend', 'event', 'group_chat');
begin
  if NEW.type in ('order', 'message') then return NEW; end if;
  if NEW.target_user_id is null and NEW.type = 'post' then return NEW; end if;

  if NEW.target_user_id is not null and v_muteable_targeted and exists (
    select 1 from public.notification_mutes nm
     where nm.user_id = NEW.target_user_id and nm.type = NEW.type
  ) then
    return NEW;
  end if;

  v_priority := case
    when NEW.type in ('emergency', 'announcement', 'payment', 'court', 'property', 'blood')
    then 'high' else 'default'
  end;

  for v_batch in
    select jsonb_agg(msg)
    from (
      select jsonb_build_object(
               'to',        pt.token,
               'title',     NEW.title,
               'body',      coalesce(NEW.body, ''),
               'sound',     'default',
               'priority',  v_priority,
               'channelId', 'default',
               'data',      jsonb_build_object('route', NEW.route)
             ) as msg,
             (row_number() over () - 1) / 100 as grp
      from public.push_tokens pt
      where
        (NEW.target_user_id is not null and pt.user_id = NEW.target_user_id)
        or
        (NEW.target_user_id is null
         and pt.user_id is distinct from NEW.actor_id
         and exists (
           select 1 from public.profiles p
           where p.id = pt.user_id and p.community_id = NEW.community_id
         )
         and not exists (
           select 1 from public.notification_mutes nm
           where nm.user_id = pt.user_id and nm.type = NEW.type
         )
         and not exists (
           select 1 from public.notifications n2
           where n2.entity_id = NEW.entity_id
             and n2.type = NEW.type
             and n2.target_user_id = pt.user_id
             and n2.created_at > now() - interval '5 minutes'
         ))
    ) s
    group by grp
  loop
    perform public._expo_push(v_batch);
  end loop;

  return NEW;
end;
$fn$;

-- ── When somebody last gave ─────────────────────────────────────────
-- Whole blood cannot be given again for about three months. Without a date,
-- a donor who gave last week is listed exactly like one who is ready today,
-- and gets called first because they are top of the list.
alter table public.profiles add column if not exists donor_last_donated date;

comment on column public.profiles.donor_last_donated is
  'Self-reported. Used to show a donor as resting rather than available — never to bar anyone.';
