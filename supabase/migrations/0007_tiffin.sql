-- ════════════════════════════════════════════════════════════════════
-- Senate Rasoi — migration 0007: tiffin service + subscriptions (recurring)
-- Run AFTER 0001–0006.
--
-- A chef posts a recurring "tiffin" (e.g. daily lunch dabba) for chosen weekdays
-- with a per-day capacity. Neighbours subscribe (recurring order). We do NOT
-- generate rows nightly — the chef's "today's tiffin list" is computed on the fly
-- from active subscriptions whose weekday matches, minus any one-off skips.
-- ════════════════════════════════════════════════════════════════════

-- ── tiffin_plans ────────────────────────────────────────────────────
create table if not exists public.tiffin_plans (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  chef_user_id  uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  description   text,
  veg_type      text not null check (veg_type in ('Veg', 'Non-veg', 'Egg')),
  slot          text not null check (slot in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  price         integer not null check (price >= 0),
  days_of_week  int[] not null,                 -- 0=Sun … 6=Sat
  max_per_day   integer not null check (max_per_day > 0),
  cutoff_time   text,                            -- 'HH:MM' local; null = no cutoff
  photo_url     text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists tiffin_plans_community_idx on public.tiffin_plans (community_id, active);
create index if not exists tiffin_plans_chef_idx on public.tiffin_plans (chef_user_id);

alter table public.tiffin_plans enable row level security;

drop policy if exists tiffin_plans_read on public.tiffin_plans;
create policy tiffin_plans_read on public.tiffin_plans
  for select using (auth.role() = 'authenticated');

drop policy if exists tiffin_plans_insert on public.tiffin_plans;
create policy tiffin_plans_insert on public.tiffin_plans
  for insert with check (
    auth.uid() = chef_user_id
    and exists (select 1 from public.communities c where c.id = community_id)
  );

drop policy if exists tiffin_plans_update on public.tiffin_plans;
create policy tiffin_plans_update on public.tiffin_plans
  for update using (auth.uid() = chef_user_id or public.is_admin(auth.uid()));

drop policy if exists tiffin_plans_delete on public.tiffin_plans;
create policy tiffin_plans_delete on public.tiffin_plans
  for delete using (auth.uid() = chef_user_id or public.is_admin(auth.uid()));

-- ── subscriptions ───────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references public.tiffin_plans (id) on delete cascade,
  subscriber_user_id  uuid not null references public.profiles (id) on delete cascade,
  qty                 integer not null default 1 check (qty > 0),
  start_date          date not null default current_date,
  end_date            date,                       -- null = ongoing
  paused              boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (plan_id, subscriber_user_id)
);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
create index if not exists subscriptions_user_idx on public.subscriptions (subscriber_user_id);

alter table public.subscriptions enable row level security;

-- Readable by the subscriber, the plan's chef, or an admin.
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select using (
    subscriber_user_id = auth.uid()
    or exists (select 1 from public.tiffin_plans p where p.id = plan_id and p.chef_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );

-- The subscriber manages their own subscription.
drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert with check (subscriber_user_id = auth.uid());

drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update using (subscriber_user_id = auth.uid());

drop policy if exists subscriptions_delete on public.subscriptions;
create policy subscriptions_delete on public.subscriptions
  for delete using (subscriber_user_id = auth.uid());

-- ── one-off skips (subscriber skips a single day) ───────────────────
create table if not exists public.subscription_skips (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  skip_date       date not null,
  primary key (subscription_id, skip_date)
);
alter table public.subscription_skips enable row level security;
drop policy if exists subscription_skips_rw on public.subscription_skips;
create policy subscription_skips_rw on public.subscription_skips
  for all using (
    exists (select 1 from public.subscriptions s where s.id = subscription_id and s.subscriber_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.subscriptions s where s.id = subscription_id and s.subscriber_user_id = auth.uid())
  );

-- Realtime so chef/foodie see subscription changes live.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='subscriptions') then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;

-- ── chef: who's getting tiffin on a given date (computed, no cron) ──
-- Returns one row per active subscription whose plan serves that weekday and
-- which isn't paused/ended/skipped for that date.
create or replace function public.chef_tiffin_for_date(p_date date)
returns table (
  plan_id uuid,
  plan_title text,
  slot text,
  price integer,
  subscription_id uuid,
  subscriber_name text,
  subscriber_flat text,
  subscriber_whatsapp text,
  qty integer
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.title, p.slot, p.price,
         s.id, pr.name, pr.flat, pr.whatsapp, s.qty
    from public.tiffin_plans p
    join public.subscriptions s on s.plan_id = p.id
    join public.profiles pr on pr.id = s.subscriber_user_id
   where p.chef_user_id = auth.uid()
     and p.active
     and (extract(dow from p_date)::int = any (p.days_of_week))
     and not s.paused
     and s.start_date <= p_date
     and (s.end_date is null or s.end_date >= p_date)
     and not exists (
       select 1 from public.subscription_skips k
       where k.subscription_id = s.id and k.skip_date = p_date
     )
   order by p.slot, pr.name;
$$;

grant execute on function public.chef_tiffin_for_date(date) to authenticated;
