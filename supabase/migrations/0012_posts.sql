-- Community posts & discussions (noticeboard / Reddit-lite per society)

create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  category     text not null default 'general'
                 check (category in ('general','announcement','issue','feedback','suggestion','event','lost_found')),
  title        text,
  body         text not null,
  photos       text[] not null default '{}',
  pinned       boolean not null default false,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index posts_feed_idx     on public.posts (community_id, created_at desc);
create index posts_category_idx on public.posts (community_id, category, created_at desc);
create index posts_pinned_idx   on public.posts (community_id, pinned) where pinned = true;

alter table public.posts enable row level security;

-- Members read posts scoped to their own society
create policy posts_read on public.posts
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.community_id = posts.community_id
    )
  );

-- Members post only in their own society
create policy posts_insert on public.posts
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.community_id = community_id
    )
  );

-- Author or society admin can update (pin/resolve/edit)
create policy posts_update on public.posts
  for update using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and 'admin' = any(p.roles)
        and p.community_id = posts.community_id
    )
  );

-- Author or society admin can delete
create policy posts_delete on public.posts
  for delete using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and 'admin' = any(p.roles)
        and p.community_id = posts.community_id
    )
  );

alter publication supabase_realtime add table public.posts;
