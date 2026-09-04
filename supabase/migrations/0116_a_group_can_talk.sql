-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0116: a sports group can talk to itself
-- Run AFTER 0001–0115. Safe to re-run.
--
-- Twenty-one memberships across three groups and no way for any of them to
-- say "anyone for a game at seven?". Every arrangement in this tile is a form
-- — book a court, confirm a day, settle a due — and the conversation that
-- surrounds all of it happens on WhatsApp, which is why WhatsApp is still
-- where this society actually lives.
--
-- Deliberately not a second DM system: the messages table has the same shape
-- as dm_messages and the screen reuses the same bubbles and composer. Two
-- things differ. Only the group's own members can read it, and unread is a
-- read cursor per member rather than a flag per message — because a message
-- here has nine readers rather than one.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.group_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.sport_groups(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  body         text,
  photo_url    text,
  created_at   timestamptz not null default now(),
  constraint group_message_not_empty
    check (coalesce(nullif(btrim(body), ''), photo_url) is not null)
);

create index if not exists group_messages_group_idx
  on public.group_messages (group_id, created_at desc);

-- Where each member has read up to. One row per member per group; absent
-- means they have never opened it, which counts as everything unread.
create table if not exists public.group_reads (
  group_id     uuid not null references public.sport_groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_messages enable row level security;
alter table public.group_reads    enable row level security;

create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.sport_group_members m
     where m.group_id = p_group and m.user_id = p_user
  );
$fn$;

-- Only the group can read the group. A conversation among nine people is not
-- society-wide content, and the members list is the only membership test that
-- means anything here.
drop policy if exists gm_read on public.group_messages;
create policy gm_read on public.group_messages for select
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists gm_insert on public.group_messages;
create policy gm_insert on public.group_messages for insert
  with check (author_id = auth.uid() and public.is_group_member(group_id, auth.uid()));

-- Your own message, or anyone's if you run the group.
drop policy if exists gm_delete on public.group_messages;
create policy gm_delete on public.group_messages for delete
  using (
    author_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (select 1 from public.sport_group_members m
                where m.group_id = group_id and m.user_id = auth.uid() and m.is_captain)
  );

drop policy if exists gr_all on public.group_reads;
create policy gr_all on public.group_reads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Everyone in the group except the person typing. The bell row is the push:
-- 0073's trigger on `notifications` delivers it and honours mutes (see 0117).
create or replace function public.on_group_message()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare
  v_who   text;
  v_group text;
  v_body  text;
  v_m     record;
begin
  select coalesce(name, 'Someone') into v_who from public.profiles where id = NEW.author_id;
  select name into v_group from public.sport_groups where id = NEW.group_id;
  v_body := coalesce(nullif(btrim(NEW.body), ''), '📷 Photo');

  for v_m in
    select m.user_id from public.sport_group_members m
     where m.group_id = NEW.group_id and m.user_id <> NEW.author_id
  loop
    insert into public.notifications
      (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (NEW.community_id, 'group_chat', NEW.group_id, NEW.author_id, v_m.user_id,
            coalesce(v_group, 'Your group') || ' · ' || v_who,
            left(v_body, 140),
            '/sports/' || NEW.group_id::text || '/chat');
  end loop;
  return NEW;
end; $fn$;

drop trigger if exists trg_group_message on public.group_messages;
create trigger trg_group_message
  after insert on public.group_messages
  for each row execute function public.on_group_message();

-- How many unread messages this member has, per group they belong to.
create or replace function public.my_group_unread()
returns table(group_id uuid, unread bigint)
language sql stable security definer set search_path = public as $fn$
  select m.group_id,
         (select count(*) from public.group_messages g
           where g.group_id = m.group_id
             and g.author_id <> auth.uid()
             and g.created_at > coalesce(
                   (select r.last_read_at from public.group_reads r
                     where r.group_id = m.group_id and r.user_id = auth.uid()),
                   'epoch'::timestamptz))
    from public.sport_group_members m
   where m.user_id = auth.uid();
$fn$;
