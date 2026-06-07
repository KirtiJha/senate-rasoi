-- app_versions: track current app releases for update notifications.
create table public.app_versions (
  id            serial primary key,
  version       text not null,
  build_number  integer not null default 0,
  platform      text not null check (platform in ('web', 'ios', 'android', 'all')),
  force_update  boolean not null default false,
  release_notes text,
  created_at    timestamptz not null default now()
);

alter table public.app_versions enable row level security;

-- Authenticated users can read version info
create policy "app_versions_select" on public.app_versions
  for select using (auth.role() = 'authenticated');

-- Seed the initial version
insert into public.app_versions (version, build_number, platform, force_update, release_notes)
values ('1.0.0', 1, 'all', false, 'Initial release of Aangan — your neighbourhood hub.');
