-- Society join requests — submitted by prospective members whose society isn't listed

create table public.society_join_requests (
  id              uuid primary key default gen_random_uuid(),
  society_name    text not null,
  society_address text not null,
  requester_name  text not null,
  requester_phone text not null,
  requester_email text,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  admin_note      text,
  created_at      timestamptz not null default now()
);

alter table public.society_join_requests enable row level security;

-- Anyone (authenticated) can submit a request
create policy sjr_insert on public.society_join_requests
  for insert with check (auth.role() = 'authenticated');

-- Admins can view all requests
create policy sjr_read_admin on public.society_join_requests
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and 'admin' = any(p.roles)
    )
  );

-- Admins can update status / admin_note
create policy sjr_update_admin on public.society_join_requests
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and 'admin' = any(p.roles)
    )
  );
