-- A PIN reset somebody has to agree to.
--
-- `self_reset_pin(phone, new_pin)` set a resident's password from their
-- phone number and nothing else. It was SECURITY DEFINER and callable by
-- anyone, and every phone number in the society is printed in the resident
-- directory — so any member could take any neighbour's account, and so
-- could anyone who had ever seen the directory.
--
-- There is no SMS or OTP in this app to lean on. What there is: admins who
-- already have a "Reset PIN" control, and a notification pipeline. So the
-- reset becomes a request a human approves. The resident asks; every admin
-- of their society is told; an admin sets a temporary PIN from Admin →
-- Members and passes it on however they normally reach that neighbour.

create table if not exists public.pin_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  created_at   timestamptz not null default now(),
  handled_at   timestamptz,
  handled_by   uuid references auth.users(id) on delete set null
);
create index if not exists pin_reset_open on public.pin_reset_requests (community_id, created_at desc) where handled_at is null;

alter table public.pin_reset_requests enable row level security;

-- Admins of the society see and close them. Nobody else reads them at all:
-- an open request names a resident who cannot get in, which is not public.
drop policy if exists pin_reset_admin_read on public.pin_reset_requests;
create policy pin_reset_admin_read on public.pin_reset_requests
  for select to authenticated using (public.is_admin_of(community_id));

drop policy if exists pin_reset_admin_update on public.pin_reset_requests;
create policy pin_reset_admin_update on public.pin_reset_requests
  for update to authenticated using (public.is_admin_of(community_id));

/**
 * Ask for a reset. Anon-callable, because somebody locked out is by
 * definition not signed in.
 *
 * Always returns true. A function that says "no such number" is a way to
 * find out who is on Aangan, one guess at a time.
 */
create or replace function public.request_pin_reset(p_phone text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_comm uuid;
  v_name text;
  v_flat text;
  a record;
begin
  select id, community_id, name, flat into v_user, v_comm, v_name, v_flat
    from public.profiles
   where phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
   limit 1;
  if v_user is null or v_comm is null then return true; end if;

  -- One open request per person per hour: a request is a notification to
  -- every admin, and a button somebody can hold down is a way to spam them.
  if exists (
    select 1 from public.pin_reset_requests
     where user_id = v_user and handled_at is null and created_at > now() - interval '1 hour'
  ) then
    return true;
  end if;

  insert into public.pin_reset_requests (user_id, community_id) values (v_user, v_comm);

  for a in
    select id from public.profiles
     where community_id = v_comm and 'admin' = any(roles) and coalesce(blocked, false) = false
  loop
    insert into public.notifications (community_id, type, entity_id, target_user_id, title, body, route)
    values (
      v_comm, 'pin_reset', v_user, a.id,
      'PIN reset requested',
      coalesce(v_name, 'A resident') || coalesce(' · Flat ' || v_flat, '') || ' cannot sign in. Set them a temporary PIN.',
      '/admin'
    );
  end loop;

  return true;
end; $$;

grant execute on function public.request_pin_reset(text) to anon, authenticated;

-- And the old door is closed.
revoke execute on function public.self_reset_pin(text, text) from anon, authenticated, public;
