-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0079: kitchen reputation
-- Run AFTER 0001–0078.
--
-- You will order from a stranger's kitchen twice out of curiosity. After that,
-- only on trust — and until now there was nothing to trust: a chef was chosen
-- on photo and price alone.
--
-- DESIGNED AGAINST A SOCIAL COST, not merely built.
-- A five-star review of a neighbour is not like one of a restaurant: you meet
-- them in the lift tomorrow. Score people out of five in public and they either
-- stop rating honestly or stop rating at all, and a board of dishonest ratings
-- is worse than a board with none.
--
-- So:
--   • "Would you order again?" — a yes/no. Answerable honestly by someone who
--     still has to be polite in the lift, and it still aggregates into
--     something worth reading.
--   • The note goes to the chef ONLY. Public praise, private correction.
--   • One row per order, and only after the food was delivered. It cannot be
--     brigaded, and cannot be left by somebody who never ate.
--   • Reputation attaches to the COOK, not the dish. A person makes many
--     dishes; their reliability is what carries between them.
--
-- Writes go through a SECURITY DEFINER RPC, like every other write on orders in
-- this schema. The table itself stays closed.
-- ════════════════════════════════════════════════════════════════════

create table public.dish_feedback (
  -- The order IS the key: one order, one opinion.
  order_id     uuid primary key references public.orders(id) on delete cascade,
  chef_user_id uuid not null references public.profiles(id) on delete cascade,
  rater_id     uuid not null references public.profiles(id) on delete cascade,
  would_repeat boolean not null,
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now()
);

create index dish_feedback_chef_idx on public.dish_feedback (chef_user_id);

alter table public.dish_feedback enable row level security;

-- Readable by the person who wrote it and the chef it is about. Nobody else
-- ever sees a note or who said what; the aggregate below is how the rest of
-- the society learns anything.
create policy dish_feedback_read on public.dish_feedback
  for select using (auth.uid() = rater_id or auth.uid() = chef_user_id);

-- No insert/update policy on purpose — the RPC below is the only way in.

-- ── Leaving feedback ────────────────────────────────────────────────
create or replace function public.leave_dish_feedback(
  p_order_id uuid,
  p_would_repeat boolean,
  p_note text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_chef uuid;
begin
  if v_uid is null or p_would_repeat is null then
    return false;
  end if;

  -- Must be your own order, and delivered. Rating an order you cancelled is
  -- not feedback, it is a grudge; rating one still cooking is a guess.
  select d.chef_user_id into v_chef
    from public.orders o
    join public.dishes d on d.id = o.dish_id
   where o.id = p_order_id
     and o.orderer_user_id = v_uid
     and o.status = 'delivered';

  if v_chef is null then
    return false;
  end if;

  insert into public.dish_feedback (order_id, chef_user_id, rater_id, would_repeat, note)
    values (p_order_id, v_chef, v_uid, p_would_repeat, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (order_id) do update
    set would_repeat = excluded.would_repeat,
        note         = excluded.note,
        created_at   = now();

  return true;
end; $$;

revoke all on function public.leave_dish_feedback(uuid, boolean, text) from public;
grant execute on function public.leave_dish_feedback(uuid, boolean, text) to authenticated;

-- ── The public number ───────────────────────────────────────────────
--
-- Counts only: never a note, never who said what. In a building of forty flats
-- somebody who could see individual answers could work out who left the single
-- "no".
--
-- Hidden below five. One bad night should not define a kitchen that has cooked
-- twice, and "new kitchen" is more honest than a number computed from almost
-- nothing.
create or replace function public.chef_reputations(p_chefs uuid[])
returns table (chef_user_id uuid, total int, repeat_count int, enough boolean)
language sql stable security definer set search_path = public as $$
  select f.chef_user_id,
         count(*)::int,
         count(*) filter (where f.would_repeat)::int,
         count(*) >= 5
  from public.dish_feedback f
  where f.chef_user_id = any(p_chefs)
  group by f.chef_user_id;
$$;

revoke all on function public.chef_reputations(uuid[]) from public;
grant execute on function public.chef_reputations(uuid[]) to authenticated;

-- ── What still needs asking ─────────────────────────────────────────
-- Delivered orders with no feedback yet, so the app can ask once and then stop.
create or replace function public.pending_feedback()
returns table (order_id uuid, dish_id uuid, dish_name text, chef_name text, delivered_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, d.id, d.dish_name, d.chef_name, o.status_updated_at
  from public.orders o
  join public.dishes d on d.id = o.dish_id
  left join public.dish_feedback f on f.order_id = o.id
  where o.orderer_user_id = auth.uid()
    and o.status = 'delivered'
    and f.order_id is null
    -- A fortnight later nobody remembers the meal well enough to be fair.
    and o.status_updated_at > now() - interval '14 days'
  order by o.status_updated_at desc
  limit 5;
$$;

revoke all on function public.pending_feedback() from public;
grant execute on function public.pending_feedback() to authenticated;
