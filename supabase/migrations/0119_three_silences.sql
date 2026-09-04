-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0119: three things done to people without telling them
-- Run AFTER 0001–0118. Safe to re-run.
--
-- A sweep across every table in the schema for the fault that keeps coming
-- back — something happens TO a resident and nothing reaches them — left
-- three with no notification path at all. All three are live in this society
-- right now: four committee roles, twenty-one group memberships and two dish
-- reviews, none of which the person concerned was ever told about.
-- ════════════════════════════════════════════════════════════════════

-- 1. You have been put on a celebration's committee — sometimes as treasurer,
--    which is a role with other people's money attached to it.
create or replace function public.on_event_team_added()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_title text; v_comm uuid; v_actor uuid := auth.uid(); v_body text;
begin
  if v_actor is not null and v_actor = NEW.user_id then return NEW; end if;

  select e.title, e.community_id into v_title, v_comm
    from public.society_events e where e.id = NEW.event_id;

  v_body := case NEW.role
    when 'lead'      then 'You are leading it'
    when 'treasurer' then 'You are looking after the money'
    else 'You are on the committee'
  end;

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_comm, 'event', NEW.event_id, v_actor, NEW.user_id,
          'You are on the team for ' || coalesce(v_title, 'a celebration'),
          v_body, '/events/' || NEW.event_id);
  return NEW;
end; $fn$;

drop trigger if exists trg_event_team_added on public.event_team;
create trigger trg_event_team_added
  after insert on public.event_team
  for each row execute function public.on_event_team_added();

-- 2. Somebody added you to a sports group.
create or replace function public.on_group_member_added()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare g record; v_actor uuid := auth.uid();
begin
  if v_actor is not null and v_actor = NEW.user_id then return NEW; end if;

  select sg.name, sg.community_id, sg.sport into g
    from public.sport_groups sg where sg.id = NEW.group_id;
  if not found then return NEW; end if;

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (g.community_id, 'sport', NEW.group_id, v_actor, NEW.user_id,
          'You have been added to ' || coalesce(g.name, 'a sports group'),
          'Confirm the days you can play, and say hello in the group chat',
          '/sports/' || NEW.group_id::text);
  return NEW;
end; $fn$;

drop trigger if exists trg_group_member_added on public.sport_group_members;
create trigger trg_group_member_added
  after insert on public.sport_group_members
  for each row execute function public.on_group_member_added();

-- 3. A neighbour said what they thought of your cooking. The Kitchen tab grew
--    a place to read these last week; nothing told the cook one had arrived.
create or replace function public.on_dish_feedback()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare d record; v_who text; v_body text;
begin
  select di.chef_user_id, di.dish_name, di.community_id
    into d
    from public.orders o join public.dishes di on di.id = o.dish_id
   where o.id = NEW.order_id;
  if not found or d.chef_user_id is null or d.chef_user_id = NEW.rater_id then
    return NEW;
  end if;

  select coalesce(name, 'A neighbour') into v_who from public.profiles where id = NEW.rater_id;
  v_body := case when NEW.would_repeat then 'would order it again' else 'would not order it again' end;
  if coalesce(btrim(NEW.note), '') <> '' then
    v_body := v_body || ' · "' || left(NEW.note, 90) || '"';
  end if;

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (d.community_id, 'dish', NEW.order_id, NEW.rater_id, d.chef_user_id,
          v_who || ' reviewed your ' || d.dish_name,
          v_body, '/food?tab=kitchen');
  return NEW;
end; $fn$;

drop trigger if exists trg_dish_feedback_notify on public.dish_feedback;
create trigger trg_dish_feedback_notify
  after insert on public.dish_feedback
  for each row execute function public.on_dish_feedback();
