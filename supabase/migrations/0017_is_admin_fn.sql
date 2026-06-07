-- Helper: is_admin(uid)
-- Returns true if the given user has the 'admin' role in their profile.
-- Used in RLS policies to avoid repeating the join.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and roles @> array['admin']::text[]
  );
$$;

-- Tighten posts RLS: admins can update (pin/resolve) and delete any post
-- in their own community.
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;

create policy "posts_update_own_or_admin" on public.posts
  for update using (
    author_id = auth.uid()
    or is_admin(auth.uid())
  );

create policy "posts_delete_own_or_admin" on public.posts
  for delete using (
    author_id = auth.uid()
    or is_admin(auth.uid())
  );

-- Tighten post_comments RLS: admins can delete any comment
drop policy if exists "comments_delete_own" on public.post_comments;

create policy "comments_delete_own_or_admin" on public.post_comments
  for delete using (
    author_id = auth.uid()
    or is_admin(auth.uid())
  );
