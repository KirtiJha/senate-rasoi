-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0112: being given a job on a celebration says so
-- Run AFTER 0001–0111. Safe to re-run.
--
-- `event_tasks` carries an assignee_id and had no notification of any kind:
-- the committee assigns "book the dhol party" to a neighbour and nothing ever
-- reaches them. The thread of updates on a task was equally silent, and an
-- activity could be deleted out from under everyone who had signed up for it
-- — participants cascade away, so they simply found it gone.
--
-- The contribution notice had the same shape as the payments one: a bell row,
-- no push, and only on UPDATE — so a treasurer entering a payment that is
-- already received, which is how all 23 rows on Ganesh Chaturthi 2026 were
-- entered, sent nothing at all.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.on_event_task_assigned()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_event text; v_comm uuid; v_actor uuid; v_body text;
begin
  if NEW.assignee_id is null then return NEW; end if;
  if TG_OP = 'UPDATE' and NEW.assignee_id is not distinct from OLD.assignee_id then
    return NEW;
  end if;

  select title, community_id into v_event, v_comm
    from public.society_events where id = NEW.event_id;
  v_actor := coalesce(auth.uid(), NEW.created_by);
  if v_actor = NEW.assignee_id then return NEW; end if;  -- you gave it to yourself

  v_body := NEW.title || coalesce(' · due ' || to_char(NEW.due_date, 'DD Mon'), '');
  perform public.notify_user(NEW.assignee_id, 'You have a job for ' || coalesce(v_event, 'the function'),
                             v_body, '/events/' || NEW.event_id);
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_comm, 'event', NEW.event_id, v_actor, NEW.assignee_id,
          'You have a job for ' || coalesce(v_event, 'the function'), v_body,
          '/events/' || NEW.event_id);
  return NEW;
end; $fn$;

drop trigger if exists trg_event_task_assigned on public.event_tasks;
create trigger trg_event_task_assigned
  after insert or update on public.event_tasks
  for each row execute function public.on_event_task_assigned();

-- Progress is a thread; a thread nobody is told about is a diary.
create or replace function public.on_event_task_update_notify()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_task record; v_event text; v_comm uuid; v_target uuid; v_who text; v_body text;
begin
  select t.title, t.assignee_id, t.created_by, t.event_id
    into v_task from public.event_tasks t where t.id = NEW.task_id;
  if not found then return NEW; end if;

  -- The assignee hears about other people's updates; if the assignee posted,
  -- whoever set the task up hears instead.
  if NEW.author_id = v_task.assignee_id then
    v_target := v_task.created_by;
  else
    v_target := v_task.assignee_id;
  end if;
  if v_target is null or v_target = NEW.author_id then return NEW; end if;

  select title, community_id into v_event, v_comm
    from public.society_events where id = v_task.event_id;
  select coalesce(name, 'Someone') into v_who from public.profiles where id = NEW.author_id;
  v_body := v_who || ': ' || left(coalesce(NEW.note, 'posted an update'), 90);

  perform public.notify_user(v_target, v_task.title || ' — update', v_body,
                             '/events/' || v_task.event_id);
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_comm, 'event', v_task.event_id, NEW.author_id, v_target,
          v_task.title || ' — update', v_body, '/events/' || v_task.event_id);
  return NEW;
end; $fn$;

drop trigger if exists trg_event_task_update_notify on public.event_task_updates;
create trigger trg_event_task_update_notify
  after insert on public.event_task_updates
  for each row execute function public.on_event_task_update_notify();

-- Signing up for the tug of war and finding it silently gone is worse than
-- being told it was called off. Participants cascade away on delete, so this
-- has to speak before the rows go.
create or replace function public.on_activity_deleted()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_p record; v_actor uuid := auth.uid();
begin
  for v_p in
    select distinct p.added_by
      from public.event_activity_participants p
     where p.activity_id = OLD.id and p.added_by is not null
  loop
    if v_p.added_by = v_actor then continue; end if;
    perform public.notify_user(v_p.added_by, OLD.title || ' is off',
                               'The committee removed it from the programme', '/events/' || OLD.event_id);
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (OLD.community_id, 'event', OLD.event_id, v_actor, v_p.added_by,
            OLD.title || ' is off', 'The committee removed it from the programme',
            '/events/' || OLD.event_id);
  end loop;
  return OLD;
end; $fn$;

drop trigger if exists trg_activity_deleted on public.event_activities;
create trigger trg_activity_deleted
  before delete on public.event_activities
  for each row execute function public.on_activity_deleted();

-- Contributions: push, and fire when the row arrives already received.
create or replace function public.on_contribution_received()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_title text; v_body text;
begin
  if new.contributor_user_id is null or new.status <> 'received' then
    return new;
  end if;
  if TG_OP = 'UPDATE' and old.status is not distinct from 'received' then
    return new;
  end if;

  select title into v_title from public.society_events where id = new.event_id;
  v_body := 'Your ₹' || trim(to_char(new.amount, 'FM999999990')) || ' for '
            || coalesce(v_title, 'the function') || ' has been recorded.';
  perform public.notify_user(new.contributor_user_id, '✅ Contribution received', v_body,
                             '/events/' || new.event_id || '/report');
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (new.community_id, 'event', new.event_id, new.recorded_by, new.contributor_user_id,
          '✅ Contribution received', v_body, '/events/' || new.event_id || '/report');
  return new;
end; $fn$;

drop trigger if exists contribution_received_notify on public.event_contributions;
create trigger contribution_received_notify
  after insert or update on public.event_contributions
  for each row execute function public.on_contribution_received();
