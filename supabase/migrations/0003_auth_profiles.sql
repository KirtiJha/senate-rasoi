-- ════════════════════════════════════════════════════════════════════
-- Senate Rasoi — migration 0003: accounts, profiles & roles
-- Run AFTER 0001 and 0002, in the Supabase SQL editor.
--
-- We use Supabase Auth with a "phone-as-email" alias: each user signs up with
-- email = <digits>@senate.app and password = their 6-digit code. Supabase
-- bcrypt-hashes the code and issues real sessions, so RLS can key off auth.uid()
-- — all without SMS/OTP.
--
-- ⚠️ DASHBOARD STEP (required): Authentication → Sign In / Providers → Email →
--    turn OFF "Confirm email" (the alias addresses can't receive mail), and keep
--    the Email provider enabled. Otherwise new sign-ups can't log in.
-- ════════════════════════════════════════════════════════════════════

-- ── profiles ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  phone       text unique not null,
  name        text not null,
  flat        text,
  whatsapp    text,
  upi         text,
  roles       text[] not null default '{foodie}',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any signed-in user can read profiles (to show chef name/flat/contact).
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (auth.role() = 'authenticated');

-- You may create and edit only your own profile row.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id);

-- ── role helpers ────────────────────────────────────────────────────
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = uid and 'admin' = any (roles));
$$;

-- Block users from granting THEMSELVES the admin role via a normal update.
-- (chef / foodie can be self-added; admin requires an existing admin.)
create or replace function public.guard_profile_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.roles is distinct from OLD.roles
     and ('admin' = any (NEW.roles)) and not ('admin' = any (OLD.roles))
     and not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can grant the admin role';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_profile_roles on public.profiles;
create trigger trg_guard_profile_roles
  before update on public.profiles
  for each row execute function public.guard_profile_roles();

-- Admin edits another user's roles.
create or replace function public.set_user_roles(p_target uuid, p_roles text[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    return false;
  end if;
  update public.profiles set roles = p_roles where id = p_target;
  return found;
end;
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.set_user_roles(uuid, text[]) to authenticated;

-- ── dishes: ownership by user (replaces device-token model) ─────────
alter table public.dishes add column if not exists chef_user_id uuid references public.profiles (id) on delete cascade;
-- owner_token_hash is now optional (legacy device-token rows only).
alter table public.dishes alter column owner_token_hash drop not null;

-- Replace the old anon-insert policy with authenticated owner policies.
drop policy if exists dishes_insert on public.dishes;
create policy dishes_insert on public.dishes
  for insert with check (
    auth.uid() = chef_user_id
    and plates_left = max_plates
    and exists (select 1 from public.communities c where c.id = community_id)
  );

drop policy if exists dishes_update on public.dishes;
create policy dishes_update on public.dishes
  for update using (auth.uid() = chef_user_id or public.is_admin(auth.uid()));

drop policy if exists dishes_delete on public.dishes;
create policy dishes_delete on public.dishes
  for delete using (auth.uid() = chef_user_id or public.is_admin(auth.uid()));

create index if not exists dishes_chef_idx on public.dishes (chef_user_id);

-- To bootstrap the first admin, run once (replace the phone):
--   update public.profiles set roles = array_append(roles, 'admin')
--   where phone = '<your-digits>' and not ('admin' = any(roles));
