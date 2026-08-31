-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0080: recurring dishes
-- Run AFTER 0001–0079.
--
-- THE BOTTLENECK IS SUPPLY.
-- A neighbourhood food board does not die because nobody is hungry. It dies
-- when the chefs stop posting, the board looks stale, and people stop
-- checking. Everything about daily use follows from whether a kitchen shows
-- up — so the highest-leverage change is not aimed at eaters at all.
--
-- Today a chef must recreate the same dish from scratch every morning:
-- name, slot, veg type, price, plate count, photo. "I make idli every Tuesday"
-- said once does more for a live board than any feature aimed at buyers.
--
-- The pattern already exists and is proven: `tiffin_plans` has days_of_week
-- and cutoff_time. Daily dishes — the item that most needs it — never got it.
-- This copies that shape deliberately, down to the column names, so the two
-- halves of the food engine stay legible together.
--
-- MATERIALISED, NOT VIRTUAL.
-- A template creates a real `dishes` row each morning rather than the board
-- rendering templates directly. Plate counts, orders, cut-offs, search
-- indexing and the whole chef order flow already work on dishes; a parallel
-- "virtual dish" concept would need every one of them taught about it twice.
-- ════════════════════════════════════════════════════════════════════

create table public.dish_templates (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities(id) on delete cascade,
  chef_user_id  uuid not null references public.profiles(id) on delete cascade,

  -- The dish, minus anything that belongs to one particular day.
  dish_name     text not null,
  slot          text not null check (slot in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  veg_type      text not null check (veg_type in ('Veg', 'Non-veg', 'Egg')),
  price         integer not null check (price >= 0),
  max_plates    integer not null check (max_plates > 0),
  description   text,
  photo_url     text,

  -- Contact details are copied onto each dish, matching how dishes already
  -- store them, so changing your number later does not rewrite history.
  chef_name     text not null,
  flat          text not null,
  whatsapp      text not null,
  upi           text,

  days_of_week  int[] not null check (cardinality(days_of_week) between 1 and 7),
  active        boolean not null default true,

  created_at    timestamptz not null default now(),
  last_run_on   date
);

create index dish_templates_chef_idx on public.dish_templates (chef_user_id);
create index dish_templates_live_idx on public.dish_templates (community_id) where active;

alter table public.dish_templates enable row level security;

-- A template is the chef's own. Everyone else meets it as tomorrow's dish.
create policy dish_templates_own on public.dish_templates
  for all using (auth.uid() = chef_user_id) with check (auth.uid() = chef_user_id);

-- Which dish came from which template. Also the idempotency key: run the job
-- twice and the second run does nothing, because this pair is unique.
alter table public.dishes add column if not exists template_id uuid
  references public.dish_templates(id) on delete set null;

create unique index if not exists dishes_template_day_idx
  on public.dishes (template_id, serve_date) where template_id is not null;

-- The deadline a slot implies on a given day. Kept in SQL so the nightly job
-- and the app agree without the job importing the app's logic.
create or replace function public.slot_cutoff_at(p_slot text, p_date date)
returns timestamptz
language sql immutable set search_path = public as $$
  select (p_date + case p_slot
    when 'Breakfast' then time '07:00'
    when 'Lunch'     then time '10:30'
    when 'Dinner'    then time '17:30'
    else                  time '10:30'   -- Snack: same as lunch
  end) at time zone 'Asia/Kolkata';
$$;

-- ── Materialising a day ─────────────────────────────────────────────
--
-- Runs for a given date, defaulting to tomorrow. Safe to run repeatedly: the
-- unique index above means a second run is a no-op rather than a duplicate
-- board.
create or replace function public.materialise_dishes(p_date date default (current_date + 1))
returns integer
language plpgsql security definer set search_path = public as $$
declare
  t     record;
  v_dow int := extract(dow from p_date);   -- 0 = Sunday, matching tiffin_plans
  n     int := 0;
begin
  for t in
    select * from public.dish_templates
     where active and v_dow = any(days_of_week)
  loop
    begin
      insert into public.dishes (
        community_id, chef_user_id, chef_name, flat, whatsapp, upi,
        dish_name, slot, veg_type, price, max_plates, plates_left,
        description, photo_url, serve_date, order_by, template_id,
        owner_token_hash
      ) values (
        t.community_id, t.chef_user_id, t.chef_name, t.flat, t.whatsapp, t.upi,
        t.dish_name, t.slot, t.veg_type, t.price, t.max_plates, t.max_plates,
        t.description, t.photo_url, p_date,
        -- Same deadline the post form computes for a future day: the slot's
        -- own cut-off on the serve date.
        public.slot_cutoff_at(t.slot, p_date), t.id,
        -- Templated dishes are owned by an account, never a device token.
        ''
      );
      n := n + 1;
    exception when unique_violation then
      -- Already made today. Nothing to do.
      null;
    end;

    update public.dish_templates set last_run_on = p_date where id = t.id;
  end loop;

  return n;
end; $$;

revoke all on function public.materialise_dishes(date) from public;

-- ── Nightly ─────────────────────────────────────────────────────────
-- 18:30 UTC = midnight IST. Tomorrow's board is up before anyone wakes.
create extension if not exists pg_cron;

select cron.unschedule('aangan-materialise-dishes')
  where exists (select 1 from cron.job where jobname = 'aangan-materialise-dishes');

select cron.schedule(
  'aangan-materialise-dishes',
  '30 18 * * *',
  $cron$ select public.materialise_dishes(); $cron$
);
