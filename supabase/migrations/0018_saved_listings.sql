-- saved_listings: users can bookmark any listing
create table public.saved_listings (
  user_id    uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  saved_at   timestamptz not null default now(),
  primary key (user_id, listing_id)
);

alter table public.saved_listings enable row level security;

create policy "saved_select" on public.saved_listings
  for select using (user_id = auth.uid());

create policy "saved_insert" on public.saved_listings
  for insert with check (user_id = auth.uid());

create policy "saved_delete" on public.saved_listings
  for delete using (user_id = auth.uid());
