-- polls: community surveys with multiple-choice options
create table public.polls (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  question     text not null,
  expires_at   timestamptz,
  is_closed    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls(id) on delete cascade,
  text     text not null,
  position smallint not null default 0
);

create table public.poll_votes (
  poll_id   uuid not null references public.polls(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voted_at  timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index polls_community_idx on public.polls (community_id, created_at desc);
create index votes_option_idx on public.poll_votes (option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- polls: community members can read
create policy "polls_select" on public.polls
  for select using (
    community_id in (select community_id from public.profiles where id = auth.uid())
  );
create policy "polls_insert" on public.polls
  for insert with check (
    author_id = auth.uid() and
    community_id in (select community_id from public.profiles where id = auth.uid())
  );
create policy "polls_manage" on public.polls
  for update using (author_id = auth.uid() or is_admin(auth.uid()));
create policy "polls_delete" on public.polls
  for delete using (author_id = auth.uid() or is_admin(auth.uid()));

-- options: readable by community members, writable by poll author
create policy "options_select" on public.poll_options
  for select using (
    poll_id in (select id from public.polls where community_id in (
      select community_id from public.profiles where id = auth.uid()
    ))
  );
create policy "options_insert" on public.poll_options
  for insert with check (
    poll_id in (select id from public.polls where author_id = auth.uid())
  );

-- votes: readable by community, writable by auth user
create policy "votes_select" on public.poll_votes
  for select using (
    poll_id in (select id from public.polls where community_id in (
      select community_id from public.profiles where id = auth.uid()
    ))
  );
create policy "votes_upsert" on public.poll_votes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.poll_votes;
