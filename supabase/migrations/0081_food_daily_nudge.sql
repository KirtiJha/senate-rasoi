-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0081: the daily nudge
-- Run AFTER 0001–0080.
--
-- The board can be perfect and still unopened. Somebody has to be told it is
-- lunchtime.
--
-- BUILT LAST ON PURPOSE. A nudge toward a stale board teaches people the nudge
-- is worthless, and that lesson does not reverse — you get one chance at
-- "notifications from this app are worth reading". So reputation and recurring
-- dishes come first, and this only ever fires when there is genuinely
-- something to open.
--
-- Rules it obeys:
--   • Never when the count is zero. Silence is a feature.
--   • At most one per slot per society per day, even if the job re-runs.
--   • Muteable on its own, so someone can keep announcements and drop lunch.
--   • Not sent to the chef who cooked it — they know.
-- ════════════════════════════════════════════════════════════════════

-- One row per society per slot per day. The unique key IS the guarantee that a
-- retry, an overlap or a manual run cannot double-notify a whole building.
create table if not exists public.food_nudges (
  community_id uuid not null references public.communities(id) on delete cascade,
  serve_date   date not null,
  slot         text not null,
  sent_at      timestamptz not null default now(),
  dish_count   integer not null,
  primary key (community_id, serve_date, slot)
);

alter table public.food_nudges enable row level security;
-- No policies: only the SECURITY DEFINER job below ever touches this.

create or replace function public.send_food_nudge(p_slot text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r     record;
  v_sent int := 0;
begin
  for r in
    select d.community_id,
           count(*)::int                       as dishes,
           min(d.order_by)                     as first_cutoff,
           array_agg(distinct d.chef_user_id)  as chefs
      from public.dishes d
     where d.serve_date = current_date
       and d.slot = p_slot
       and d.plates_left > 0
       -- Already closed is not worth waking anyone for.
       and (d.order_by is null or d.order_by > now())
     group by d.community_id
  loop
    -- Nothing to say, so say nothing.
    if r.dishes = 0 then
      continue;
    end if;

    begin
      insert into public.food_nudges (community_id, serve_date, slot, dish_count)
        values (r.community_id, current_date, p_slot, r.dishes);
    exception when unique_violation then
      -- Already nudged this society for this slot today.
      continue;
    end;

    -- One notification per resident, skipping the cooks. A broadcast row would
    -- be cheaper, but then the chef gets told about their own dish — and the
    -- per-user mute in on_notification_push could not apply.
    insert into public.notifications
      (community_id, type, entity_id, target_user_id, title, body, route)
    select
      r.community_id,
      'food_daily',
      null,
      p.id,
      case when r.dishes = 1
        then '1 ' || lower(p_slot) || ' up today'
        else r.dishes || ' ' || lower(p_slot) || 's up today'
      end,
      case when r.first_cutoff is null
        then 'From neighbours in your society.'
        else 'Ordering closes at ' ||
             to_char(r.first_cutoff at time zone 'Asia/Kolkata', 'FMHH12:MI am') || '.'
      end,
      '/food'
    from public.profiles p
    where p.community_id = r.community_id
      and p.blocked is not true
      and not (p.id = any(r.chefs))
      -- The mute has to be applied HERE, not left to on_notification_push:
      -- that trigger only checks notification_mutes for broadcasts, and
      -- delivers every targeted row regardless. Which is right for a direct
      -- message and wrong for a daily nudge, so the filter lives at the point
      -- that decides who gets a row at all.
      and not exists (
        select 1 from public.notification_mutes nm
         where nm.user_id = p.id and nm.type = 'food_daily'
      );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end; $$;

revoke all on function public.send_food_nudge(text) from public;

-- ── Schedule ────────────────────────────────────────────────────────
-- Times are UTC; IST is +5:30. Each fires a little before the slot's cut-off,
-- while there is still time to order.
--   03:30 UTC = 09:00 IST  — breakfast is mostly a tomorrow decision
--   05:00 UTC = 10:30 IST  — lunch, at the cut-off
--   11:30 UTC = 17:00 IST  — dinner, half an hour before close
create extension if not exists pg_cron;

select cron.unschedule(j.jobname) from cron.job j
 where j.jobname in ('aangan-nudge-breakfast', 'aangan-nudge-lunch', 'aangan-nudge-dinner');

select cron.schedule('aangan-nudge-breakfast', '30 3 * * *',
  $cron$ select public.send_food_nudge('Breakfast'); $cron$);
select cron.schedule('aangan-nudge-lunch', '0 5 * * *',
  $cron$ select public.send_food_nudge('Lunch'); $cron$);
select cron.schedule('aangan-nudge-dinner', '30 11 * * *',
  $cron$ select public.send_food_nudge('Dinner'); $cron$);
