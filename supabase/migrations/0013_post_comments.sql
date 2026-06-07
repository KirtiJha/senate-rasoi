-- Realtime comments on community posts

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

-- Society members can read comments on posts in their community
create policy comments_read on public.post_comments
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.posts po
      join public.profiles p on p.id = auth.uid()
      where po.id = post_id and po.community_id = p.community_id
    )
  );

-- Authenticated members can comment
create policy comments_insert on public.post_comments
  for insert with check (auth.uid() = author_id);

-- Author can edit their own comment
create policy comments_update on public.post_comments
  for update using (auth.uid() = author_id);

-- Author or society admin can delete
create policy comments_delete on public.post_comments
  for delete using (
    auth.uid() = author_id
    or exists (
      select 1 from public.posts po
      join public.profiles p on p.id = auth.uid()
      where po.id = post_id and 'admin' = any(p.roles)
    )
  );

alter publication supabase_realtime add table public.post_comments;
