-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0033: notifications for food/tiffin/sports/docs + Clear all
-- Run AFTER 0001–0032.
--
-- Extends the community notification fan-out (added in 0026) to the newer
-- engines: a posted dish, a new tiffin service, a new sports group, and a
-- PUBLIC document. Also adds profiles.notifications_cleared_at so a member can
-- "Clear all" — hiding everything up to that moment from their own bell.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists notifications_cleared_at timestamptz;

-- ── Home Food dish ──────────────────────────────────────────────────
create or replace function public.on_dish_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.chef_user_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'dish', NEW.id, NEW.chef_user_id,
          v_actor || ' posted a dish', NEW.dish_name, '/food');
  return NEW;
end; $$;
drop trigger if exists trg_dish_notify on public.dishes;
create trigger trg_dish_notify after insert on public.dishes
  for each row execute function public.on_dish_notify();

-- ── Tiffin service ──────────────────────────────────────────────────
create or replace function public.on_tiffin_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.chef_user_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'tiffin', NEW.id, NEW.chef_user_id,
          v_actor || ' started a tiffin service', NEW.title, '/food');
  return NEW;
end; $$;
drop trigger if exists trg_tiffin_notify on public.tiffin_plans;
create trigger trg_tiffin_notify after insert on public.tiffin_plans
  for each row execute function public.on_tiffin_notify();

-- ── Sports group ────────────────────────────────────────────────────
create or replace function public.on_sport_group_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.created_by;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'sport', NEW.id, NEW.created_by,
          v_actor || ' started a ' || NEW.sport || ' group', NEW.name, '/sports');
  return NEW;
end; $$;
drop trigger if exists trg_sport_group_notify on public.sport_groups;
create trigger trg_sport_group_notify after insert on public.sport_groups
  for each row execute function public.on_sport_group_notify();

-- ── Public document ─────────────────────────────────────────────────
create or replace function public.on_document_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select coalesce(name, 'Someone') into v_actor from public.profiles where id = NEW.owner_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, title, body, route)
  values (NEW.community_id, 'document', NEW.id, NEW.owner_id,
          v_actor || ' shared a document', NEW.name, '/documents');
  return NEW;
end; $$;
drop trigger if exists trg_document_notify on public.documents;
create trigger trg_document_notify after insert on public.documents
  for each row when (NEW.is_public) execute function public.on_document_notify();
