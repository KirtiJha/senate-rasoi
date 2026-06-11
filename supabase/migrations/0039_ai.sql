-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0039: AI usage quota
-- Run AFTER 0001–0038.
--
-- Backs the `ai-proxy` Edge Function. Every Gemini call is metered per user
-- per day so the free-tier limits can't be blown (and one user can't burn the
-- whole society's quota). The Edge Function calls check_and_increment_ai_quota()
-- with the service-role key BEFORE hitting Gemini; a false return = over budget.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.ai_usage (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  count      int  not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

-- A user may see their own usage (for an "X AI actions left today" hint).
drop policy if exists ai_usage_read on public.ai_usage;
create policy ai_usage_read on public.ai_usage for select
  using (user_id = auth.uid());
-- No insert/update/delete policies: only the SECURITY DEFINER function (and the
-- service role inside the Edge Function) ever writes here.

-- Atomically claim one unit of today's quota. Returns true if the call is
-- allowed (and records it), false if the user is already at the daily limit.
create or replace function public.check_and_increment_ai_quota(
  p_user_id uuid,
  p_limit   int default 40
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_count int;
begin
  insert into public.ai_usage (user_id, usage_date, count)
    values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into v_count;

  -- v_count is null when the ON CONFLICT update was skipped (limit reached).
  return v_count is not null;
end;
$$;

revoke all on function public.check_and_increment_ai_quota(uuid, int) from public, anon, authenticated;
