-- emergency_contacts: per-society quick-dial directory (admin-managed)
create table public.emergency_contacts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name         text not null,
  phone        text not null,
  role         text not null default 'other'
               check (role in ('security','maintenance','medical','fire','electricity','water','other')),
  order_pos    smallint not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index ec_community_idx on public.emergency_contacts (community_id, order_pos);

alter table public.emergency_contacts enable row level security;

-- Community members can read
create policy "ec_select" on public.emergency_contacts
  for select using (
    community_id in (
      select community_id from public.profiles where id = auth.uid()
    )
  );

-- Only admins can write
create policy "ec_admin_all" on public.emergency_contacts
  for all using (is_admin(auth.uid()))
  with check (
    community_id in (
      select community_id from public.profiles where id = auth.uid()
    )
  );
