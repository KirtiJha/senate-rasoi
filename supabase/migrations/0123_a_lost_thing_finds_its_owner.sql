-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0123: a lost thing finds its owner
-- Run AFTER 0001–0122. Safe to re-run.
--
-- Lost & Found could describe both halves of a reunion and never join them.
--
-- Someone reports lost keys. Days later a neighbour posts found keys. Both
-- posts went out as one more item in everybody's notification tray, and
-- whether those two people ever met came down to who happened to scroll.
-- The app already knew: same society, same category, one still open.
--
-- So a found report now taps the shoulder of everyone with an open lost
-- report in that category, and a lost report taps everyone holding something
-- of that kind. Personally, by name of thing, straight to the post.
--
-- THE DOUBLE-BUZZ TRAP. Those people are also in the community broadcast, so
-- the naive version buzzes them twice for one event — the exact regression
-- 0117 undid. The push trigger now skips the community copy for anyone who
-- has just been written a personal note about the same thing, and the matches
-- are inserted BEFORE the broadcast so they exist when it checks. That rule
-- is general: any tile can now say something personal and something public
-- about one event without shouting twice.
--
-- Also here: lost_found_items had an UPDATE policy with no WITH CHECK, so a
-- poster could move their report into another society.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. One event, one buzz ──────────────────────────────────────────
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
    when NEW.type in ('emergency', 'announcement', 'payment', 'court', 'property')
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
         -- Already told personally about this very thing, moments ago. The
         -- community copy stays in their tray; it does not buzz again.
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

-- ── 2. The match ────────────────────────────────────────────────────
create or replace function public.on_lost_found_insert()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_name  text;
  v_title text;
  v_thing text;
  r       record;
  v_sent  int := 0;
begin
  select name into v_name from public.profiles where id = new.owner_user_id;

  -- Personal notes first: the broadcast below checks for them.
  --
  -- 'other' is not a match — it is the absence of one, and pairing every
  -- miscellaneous post with every other would teach people to ignore this.
  if new.status = 'open' and new.category is not null and new.category <> 'other' then
    v_thing := lower(replace(new.category, '-', ' '));
    for r in
      select o.id, o.owner_user_id
        from public.lost_found_items o
       where o.community_id = new.community_id
         and o.category = new.category
         and o.status = 'open'
         and o.kind <> new.kind
         and o.owner_user_id is distinct from new.owner_user_id
         and o.created_at > now() - interval '120 days'
       order by o.created_at desc
       limit 20
    loop
      insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (
        new.community_id, 'lost_found', new.id, new.owner_user_id, r.owner_user_id,
        case when new.kind = 'found'
             then '📦 A ' || v_thing || ' has been found'
             else '🔍 A neighbour has lost a ' || v_thing end,
        case when new.kind = 'found'
             then 'You reported one lost — could this be yours?'
             else 'You reported finding one — could this be theirs?' end,
        '/lost-found/' || new.id
      );
      v_sent := v_sent + 1;
    end loop;
  end if;

  v_title := case
    when new.kind = 'lost' then '🔍 Lost: ' || new.title
    else '📦 Found: ' || new.title
  end;

  insert into public.notifications (
    community_id, type, entity_id, actor_id, target_user_id, title, body, route
  ) values (
    new.community_id, 'lost_found', new.id, new.owner_user_id, null,
    v_title,
    coalesce(v_name, 'A neighbour') || ' posted in Lost & Found',
    '/lost-found/' || new.id
  );

  return new;
end;
$fn$;

-- ── 3. A report stays in the society it was posted to ───────────────
drop policy if exists lf_update on public.lost_found_items;
create policy lf_update on public.lost_found_items
  for update using (owner_user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (
    (owner_user_id = auth.uid() and public.is_my_community(community_id))
    or public.is_admin(auth.uid())
  );

comment on function public.on_lost_found_insert() is
  'Notifies open reports of the opposite kind in the same category personally, then the community. Personal first: the push trigger skips the community buzz for anyone already told.';
