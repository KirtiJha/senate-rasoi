-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0038: pre-launch security hardening
-- Run AFTER 0001–0037.
--
--   1. Scope profile reads to YOUR OWN society. Previously any authenticated
--      user could read every profile in every society (name, flat, phone,
--      WhatsApp, UPI, blood group) — a cross-society PII leak.
--   2. Freeze community_id (+ keep the admin-role guard): a user can no longer
--      change their own society to read another society's data.
--   3. Scope dish reads to society members — chef WhatsApp/UPI were world-
--      readable (even logged-out).
-- ════════════════════════════════════════════════════════════════════

-- Caller's own community, read without recursing through profiles RLS.
create or replace function public.current_community_id()
returns uuid language sql stable security definer set search_path = public as $$
  select community_id from public.profiles where id = auth.uid();
$$;

-- ── 1. Profiles: read only yourself, your own society, or (admin) anyone ──
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid()
  or public.is_admin(auth.uid())
  or (community_id is not null and community_id = public.current_community_id())
);

-- ── 2. Profile guard: block self-promotion to admin AND society changes ──
create or replace function public.guard_profile_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- only an admin can grant the admin role
  if NEW.roles is distinct from OLD.roles
     and ('admin' = any (NEW.roles)) and not ('admin' = any (OLD.roles))
     and not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can grant the admin role';
  end if;
  -- you cannot move yourself between societies (only an admin can)
  if NEW.community_id is distinct from OLD.community_id
     and OLD.community_id is not null
     and not public.is_admin(auth.uid()) then
    raise exception 'You cannot change your society';
  end if;
  return NEW;
end; $$;
-- (the BEFORE UPDATE trigger trg_guard_profile_roles from 0003 stays attached)

-- ── 3. Dishes: society members only (was: public) ──
drop policy if exists dishes_read on public.dishes;
create policy dishes_read on public.dishes for select using (
  public.is_my_community(community_id) or public.is_admin(auth.uid())
);
