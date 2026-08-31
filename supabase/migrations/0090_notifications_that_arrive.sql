-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0090: the notifications that were never sent
-- Run AFTER 0001–0089.
--
-- A parallel audit of every notify path in the schema turned up four surfaces
-- where a message is stored and rendered correctly and nobody is ever told it
-- arrived. This is the same fault 0057 fixed for orders and 0089 fixed for
-- inquiries; these are the ones that were missed.
--
-- One rule, applied everywhere here: write the row into `notifications` and let
-- 0066's fan-out turn it into a push. Calling notify_user() directly sends a
-- push with no route (so tapping it goes nowhere) and leaves no trace in the
-- bell once the banner is dismissed.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Comments on a feed post ──────────────────────────────────────
--
-- The busiest screen in the app, and the most complete silence: post_comments
-- has never had a notify trigger. A resident asks the society for help, five
-- neighbours answer over two days, and the person who asked is told nothing.
-- They find out only by reopening that exact post.
--
-- Notifies the post's author, and everyone else who has already commented —
-- a reply belongs to the conversation, not just to the original poster.
create or replace function public.on_post_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_author uuid;
  v_comm   uuid;
  v_title  text;
  v_who    text;
  r        record;
begin
  select p.author_id, p.community_id, coalesce(nullif(p.title, ''), left(p.body, 60))
    into v_author, v_comm, v_title
    from public.posts p
   where p.id = NEW.post_id;

  if v_comm is null then
    return NEW;
  end if;

  select coalesce(pr.name, 'Someone') into v_who
    from public.profiles pr where pr.id = NEW.author_id;

  for r in
    -- The author, plus anyone already in the thread. Never the commenter.
    select distinct uid from (
      select v_author as uid
      union
      select c.author_id from public.post_comments c where c.post_id = NEW.post_id
    ) s
    where uid is not null and uid is distinct from NEW.author_id
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

drop trigger if exists trg_post_comment_notify on public.post_comments;
create trigger trg_post_comment_notify
  after insert on public.post_comments
  for each row execute function public.on_post_comment_notify();

-- ─── 2. Questions on a listing ───────────────────────────────────────
--
-- Pushed but never written to the bell — so with push off, or the banner
-- dismissed, the question simply does not exist anywhere in the app. The push
-- also carried no route, so tapping it went nowhere.
--
-- notify_user is deliberately dropped here: the inserted row makes 0066 push
-- it, and two calls meant two notifications.
create or replace function public.on_listing_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner  uuid;
  v_title  text;
  v_comm   uuid;
  v_author text;
  r        record;
begin
  select l.owner_user_id, l.title, l.community_id
    into v_owner, v_title, v_comm
    from public.listings l
   where l.id = NEW.listing_id;

  if v_comm is null then
    return NEW;
  end if;

  select coalesce(p.name, 'Someone') into v_author
    from public.profiles p where p.id = NEW.author_id;

  if NEW.author_id is distinct from v_owner then
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      v_comm, 'listing', NEW.listing_id, NEW.author_id, v_owner,
      v_author || ' asked about your listing',
      'Re "' || left(coalesce(v_title, 'your listing'), 50) || '": ' || left(NEW.body, 90),
      '/listing/' || NEW.listing_id
    );
  else
    -- The owner replying reaches everyone else in the thread.
    for r in
      select distinct author_id
        from public.listing_messages
       where listing_id = NEW.listing_id
         and author_id is distinct from v_owner
    loop
      insert into public.notifications
        (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (
        v_comm, 'listing', NEW.listing_id, NEW.author_id, r.author_id,
        v_author || ' replied',
        'Re "' || left(coalesce(v_title, 'a listing'), 50) || '": ' || left(NEW.body, 90),
        '/listing/' || NEW.listing_id
      );
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_listing_message_notify on public.listing_messages;
create trigger trg_listing_message_notify
  after insert on public.listing_messages
  for each row execute function public.on_listing_message();

-- ─── 3. A bug report reaching the people who can fix it ──────────────
--
-- 0085 notified the reporter when an admin replied, and nobody at all when a
-- report was filed. So the queue only worked if an admin remembered to go and
-- look at it, which is the habit a suggestion box dies of.
create or replace function public.on_feedback_filed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_who text;
  r     record;
begin
  select coalesce(p.name, 'A resident') into v_who
    from public.profiles p where p.id = NEW.author_id;

  for r in
    select p.id from public.profiles p
     where p.community_id = NEW.community_id
       and 'admin' = any(p.roles)
       and p.id is distinct from NEW.author_id
  loop
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (
      NEW.community_id, 'feedback', NEW.id, NEW.author_id, r.id,
      case NEW.kind
        when 'bug'     then v_who || ' reported a problem'
        when 'feature' then v_who || ' asked for something'
        else                v_who || ' sent feedback'
      end,
      left(NEW.title, 140),
      '/feedback/' || NEW.id
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_feedback_filed on public.feedback_items;
create trigger trg_feedback_filed
  after insert on public.feedback_items
  for each row execute function public.on_feedback_filed();

-- ─── 4. The reporter's own replies ───────────────────────────────────
--
-- 0085 only ever notified the report's author, so the conversation ran one
-- way: an admin's question reached the reporter, and the reporter's answer
-- reached nobody. Replaces that function; the status-sync half is unchanged.
create or replace function public.on_feedback_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f     record;
  v_who text;
  r     record;
begin
  select * into f from public.feedback_items where id = NEW.item_id;

  if NEW.status_after is not null and NEW.status_after is distinct from f.status then
    update public.feedback_items
       set status = NEW.status_after, updated_at = now()
     where id = NEW.item_id;
  end if;

  select coalesce(p.name, 'Someone') into v_who
    from public.profiles p where p.id = NEW.author_id;

  if NEW.author_id = f.author_id then
    -- The reporter answered. Tell the admins, or the thread stalls here.
    for r in
      select p.id from public.profiles p
       where p.community_id = f.community_id
         and 'admin' = any(p.roles)
         and p.id is distinct from NEW.author_id
    loop
      insert into public.notifications
        (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
      values (
        f.community_id, 'feedback', NEW.item_id, NEW.author_id, r.id,
        v_who || ' replied on "' || left(f.title, 50) || '"',
        left(NEW.body, 140),
        '/feedback/' || NEW.item_id
      );
    end loop;
  else
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
  end if;

  return NEW;
end;
$$;

-- ─── 5. Re-reporting abusive content ─────────────────────────────────
--
-- reportContent upserts, and 0070 exists specifically so that update succeeds.
-- The notify trigger was never widened to match, so a reporter escalating from
-- "spam" to the child-safety reason updated the row in silence. Given what
-- 0072 was written for, this is the worst place in the schema for that gap.
drop trigger if exists content_report_notify on public.content_reports;
create trigger content_report_notify
  after insert or update on public.content_reports
  for each row execute function public.on_content_report_insert();
