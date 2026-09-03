-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0105: quieter threads, and two authorisation holes
-- Run AFTER 0001–0104. Safe to re-run.
--
-- Three faults in the feed, found by auditing it end to end. The first is mine
-- from 0090, one day old.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. A thread you can leave ───────────────────────────────────────
--
-- 0090 notifies the post's author and everyone who has ever commented, on
-- every new comment, forever. On a fifteen-reply lost-and-found thread that is
-- fifteen notifications per reply, and because the rows are targeted rather
-- than broadcast the mute filter never applies to them — by design, since a
-- targeted row is normally somebody talking to you.
--
-- The design was right for "somebody replied to your post" and wrong for
-- "somebody else also commented on a thread you once touched". So: the author
-- is always told, other participants are told unless they have muted this
-- thread, and anybody can mute any thread they are in.
create table if not exists public.post_mutes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_mutes enable row level security;

drop policy if exists post_mutes_own on public.post_mutes;
create policy post_mutes_own on public.post_mutes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.on_post_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_author uuid;
  v_comm   uuid;
  v_who    text;
  r        record;
begin
  select p.author_id, p.community_id into v_author, v_comm
    from public.posts p where p.id = NEW.post_id;

  if v_comm is null then
    return NEW;
  end if;

  select coalesce(pr.name, 'Someone') into v_who
    from public.profiles pr where pr.id = NEW.author_id;

  for r in
    select distinct uid from (
      select v_author as uid
      union
      select c.author_id from public.post_comments c where c.post_id = NEW.post_id
    ) s
    where uid is not null
      and uid is distinct from NEW.author_id
      -- Muted this thread.
      and not exists (
        select 1 from public.post_mutes m
         where m.post_id = NEW.post_id and m.user_id = uid
      )
      -- Blocked, either direction. Blocking was enforced only in the client,
      -- so a blocked neighbour's words still arrived as a push — 140
      -- characters of them — for a comment the app then hid on arrival.
      and not exists (
        select 1 from public.user_blocks b
         where (b.blocker_id = uid and b.blocked_id = NEW.author_id)
            or (b.blocker_id = NEW.author_id and b.blocked_id = uid)
      )
  loop
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      v_comm, 'post', NEW.post_id, NEW.author_id, r.uid,
      case when r.uid = v_author
        then v_who || ' commented on your post'
        else v_who || ' also commented'
      end,
      left(NEW.body, 140),
      '/feed/' || NEW.post_id
    );
  end loop;

  return NEW;
end;
$$;

-- ─── 2. Deleting a comment stays inside your own society ─────────────
--
-- comments_delete_own_or_admin (0017) uses is_admin(uid), which only asks
-- whether the roles array contains 'admin' — with no community at all. 0071
-- scoped every other table and listed post_comments among those "deferred to
-- a later migration"; nothing since has closed it.
--
-- Inert while one society exists. The moment there are two, an admin of one
-- can delete any comment in the other.
drop policy if exists "comments_delete_own_or_admin" on public.post_comments;
create policy "comments_delete_own_or_admin" on public.post_comments
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1
        from public.posts p
        join public.profiles me on me.id = auth.uid()
       where p.id = post_comments.post_id
         and me.community_id = p.community_id
         and 'admin' = any(me.roles)
    )
  );

-- ─── 3. Pinning is an admin's job, not the author's ──────────────────
--
-- posts_update_own_or_admin is row-level with no column restriction, so an
-- author may set any column on their own post — including `pinned`, which the
-- UI offers to admins only. Any resident calling the same update the app
-- already makes could pin themselves to the top of the society's feed.
--
-- Enforced in a trigger because a policy's WITH CHECK cannot see the old row,
-- so it cannot tell "pinned was already true" from "this update set it".
create or replace function public.guard_post_pin() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return NEW;
  end if;

  if NEW.pinned is distinct from OLD.pinned
     and not exists (
       select 1 from public.profiles me
        where me.id = auth.uid()
          and me.community_id = NEW.community_id
          and 'admin' = any(me.roles)
     )
  then
    raise exception 'Only a society admin can pin a post.'
      using errcode = 'check_violation';
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_guard_post_pin on public.posts;
create trigger trg_guard_post_pin
  before update on public.posts
  for each row execute function public.guard_post_pin();
