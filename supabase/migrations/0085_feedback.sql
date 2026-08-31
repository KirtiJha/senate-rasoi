-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0085: bugs, requests and feedback
-- Run AFTER 0001–0084.
--
-- Every bug in this app so far reached the developer because one resident
-- happened to mention it in a WhatsApp group. That is not a channel: the
-- reporter never learns whether it was heard, nobody else can see it is
-- already known, and the person who could fix it finds out last.
--
-- WHO CAN SEE A REPORT.
-- Author and admins, and nobody else. The tempting alternative is a public
-- board where neighbours upvote requests and duplicates collapse — genuinely
-- useful for feature requests, and wrong for the other two kinds. A bug report
-- often carries a screenshot of whatever the reporter had on screen, and
-- "feedback" is where somebody says the app is confusing, sometimes about a
-- feature their neighbour asked for. A resident who must weigh who will read it
-- writes less, or writes nothing. Private by default costs some duplicate
-- requests; public by default costs the honest reports, which are the ones
-- worth having.
--
-- WHY A THREAD RATHER THAN A STATUS FIELD.
-- "Status: done" answers nothing — done how, and is it the thing I meant? Each
-- update is a comment, optionally carrying the status it moved to, so the
-- reporter reads a reply rather than watching a label change silently.
-- ════════════════════════════════════════════════════════════════════

create table public.feedback_items (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id)    on delete cascade,

  kind         text not null check (kind in ('bug', 'feature', 'feedback')),
  title        text not null check (char_length(trim(title)) > 0),
  body         text,
  photo_urls   text[] not null default '{}',

  -- open → planned → in_progress → done, or declined at any point. Five states
  -- because a tracker with twelve is a tracker nobody updates.
  status       text not null default 'open'
                 check (status in ('open', 'planned', 'in_progress', 'done', 'declined')),

  -- Captured automatically at submit, never typed. "Which version?" is the
  -- first question every bug report needs and the last one a resident can
  -- answer, and a screen size explains a surprising share of layout bugs.
  app_version  text,
  platform     text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index feedback_items_mine_idx on public.feedback_items (author_id, created_at desc);
create index feedback_items_queue_idx on public.feedback_items (community_id, status, created_at desc);

-- ─── The thread ──────────────────────────────────────────────────────
create table public.feedback_comments (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.feedback_items(id) on delete cascade,
  author_id    uuid not null references public.profiles(id)       on delete cascade,
  body         text not null check (char_length(trim(body)) > 0),
  -- The status this comment moved the report to, when it moved it at all.
  status_after text check (status_after in ('open', 'planned', 'in_progress', 'done', 'declined')),
  created_at   timestamptz not null default now()
);

create index feedback_comments_idx on public.feedback_comments (item_id, created_at);

-- ─── Access ──────────────────────────────────────────────────────────
alter table public.feedback_items    enable row level security;
alter table public.feedback_comments enable row level security;

-- An admin of the community the report belongs to. Community-scoped, so an
-- admin of one society cannot read another's reports.
create or replace function public.is_feedback_admin(p_item uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.feedback_items f
      join public.profiles p on p.id = auth.uid()
     where f.id = p_item
       and p.community_id = f.community_id
       and 'admin' = any(p.roles)
  );
$$;

revoke all on function public.is_feedback_admin(uuid) from public;
grant execute on function public.is_feedback_admin(uuid) to authenticated;

create policy feedback_read on public.feedback_items
  for select using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.community_id = feedback_items.community_id
         and 'admin' = any(p.roles)
    )
  );

-- Anyone signed in may report; only into their own name and their own society.
create policy feedback_insert on public.feedback_items
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.community_id = feedback_items.community_id
    )
  );

-- The author may correct what they wrote. Only an admin may move the status —
-- enforced by the trigger below, because a WITH CHECK cannot see the old row.
create policy feedback_update on public.feedback_items
  for update using (auth.uid() = author_id or public.is_feedback_admin(id))
        with check (auth.uid() = author_id or public.is_feedback_admin(id));

create policy feedback_delete on public.feedback_items
  for delete using (auth.uid() = author_id or public.is_feedback_admin(id));

create or replace function public.feedback_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  NEW.updated_at := now();

  -- An author editing their own report cannot promote it to 'done'.
  if NEW.status is distinct from OLD.status and not public.is_feedback_admin(NEW.id) then
    raise exception 'Only an admin can change the status of a report';
  end if;

  -- Nor can the report be moved to another society, or handed to someone else.
  NEW.community_id := OLD.community_id;
  NEW.author_id    := OLD.author_id;
  return NEW;
end; $$;

drop trigger if exists trg_feedback_guard on public.feedback_items;
create trigger trg_feedback_guard before update on public.feedback_items
  for each row execute function public.feedback_guard();

-- Comments follow the item: if you can read the report you can read its
-- thread, and both sides can write in it. That is the whole point — a reporter
-- who cannot answer "which screen were you on?" is back to WhatsApp.
create policy feedback_comment_read on public.feedback_comments
  for select using (
    exists (
      select 1 from public.feedback_items f
       where f.id = item_id
         and (f.author_id = auth.uid() or public.is_feedback_admin(f.id))
    )
  );

create policy feedback_comment_insert on public.feedback_comments
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.feedback_items f
       where f.id = item_id
         and (f.author_id = auth.uid() or public.is_feedback_admin(f.id))
    )
    -- Only an admin's comment may carry a status change.
    and (status_after is null or public.is_feedback_admin(item_id))
  );

-- ─── Telling the reporter ────────────────────────────────────────────
-- The half that makes this a channel rather than a suggestion box. A report
-- that is answered in silence is a report nobody files twice.
create or replace function public.on_feedback_comment() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  f record;
  v_who text;
begin
  select * into f from public.feedback_items where id = NEW.item_id;

  -- Apply the status the comment carries, so the label and the thread can
  -- never disagree.
  if NEW.status_after is not null and NEW.status_after is distinct from f.status then
    update public.feedback_items
       set status = NEW.status_after, updated_at = now()
     where id = NEW.item_id;
  end if;

  -- Nobody needs telling about their own comment.
  if NEW.author_id = f.author_id then
    return NEW;
  end if;

  select name into v_who from public.profiles where id = NEW.author_id;

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (
    f.community_id, 'feedback', NEW.item_id, NEW.author_id, f.author_id,
    case NEW.status_after
      when 'done'        then 'Fixed: ' || f.title
      when 'declined'    then 'Closed: ' || f.title
      when 'planned'     then 'Planned: ' || f.title
      when 'in_progress' then 'Being worked on: ' || f.title
      else coalesce(v_who, 'The team') || ' replied'
    end,
    left(NEW.body, 140),
    '/feedback/' || NEW.item_id
  );

  return NEW;
end; $$;

drop trigger if exists trg_feedback_comment on public.feedback_comments;
create trigger trg_feedback_comment after insert on public.feedback_comments
  for each row execute function public.on_feedback_comment();
