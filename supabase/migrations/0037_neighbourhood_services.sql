-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0037: three resident-driven services
-- Run AFTER 0001–0036.
--
--   1. Ask & Recommend — local recommendations Q&A (questions + answers + upvotes)
--   2. Borrow & Lend    — a community share board (lend items + borrow requests)
--   3. Blood & SOS      — opt-in blood-donor / emergency-helper registry (profile cols)
--
-- All society-scoped + realtime; triggers fire targeted notifications
-- (types 'recommend' and 'borrow').
-- ════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1. ASK & RECOMMEND                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝
create table if not exists public.reco_questions (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  category     text not null,
  title        text not null,
  detail       text,
  answer_count integer not null default 0,
  created_at   timestamptz not null default now(),
  bump_at      timestamptz not null default now()
);
create index if not exists reco_q_feed_idx on public.reco_questions (community_id, bump_at desc);

create table if not exists public.reco_answers (
  id             uuid primary key default gen_random_uuid(),
  question_id    uuid not null references public.reco_questions(id) on delete cascade,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null,
  provider_name  text,
  provider_phone text,
  vote_count     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists reco_a_idx on public.reco_answers (question_id, vote_count desc);

create table if not exists public.reco_votes (
  answer_id uuid not null references public.reco_answers(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  primary key (answer_id, user_id)
);

alter table public.reco_questions enable row level security;
alter table public.reco_answers   enable row level security;
alter table public.reco_votes     enable row level security;

drop policy if exists reco_q_read on public.reco_questions;
create policy reco_q_read on public.reco_questions for select using (public.is_my_community(community_id) or public.is_admin(auth.uid()));
drop policy if exists reco_q_insert on public.reco_questions;
create policy reco_q_insert on public.reco_questions for insert with check (author_id = auth.uid() and public.is_my_community(community_id));
drop policy if exists reco_q_delete on public.reco_questions;
create policy reco_q_delete on public.reco_questions for delete using (author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists reco_a_read on public.reco_answers;
create policy reco_a_read on public.reco_answers for select using (
  exists (select 1 from public.reco_questions q where q.id = question_id and public.is_my_community(q.community_id))
);
drop policy if exists reco_a_insert on public.reco_answers;
create policy reco_a_insert on public.reco_answers for insert with check (
  author_id = auth.uid()
  and exists (select 1 from public.reco_questions q where q.id = question_id and public.is_my_community(q.community_id))
);
drop policy if exists reco_a_delete on public.reco_answers;
create policy reco_a_delete on public.reco_answers for delete using (author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists reco_v_read on public.reco_votes;
create policy reco_v_read on public.reco_votes for select using (
  exists (select 1 from public.reco_answers a join public.reco_questions q on q.id = a.question_id
          where a.id = answer_id and public.is_my_community(q.community_id))
);
drop policy if exists reco_v_insert on public.reco_votes;
create policy reco_v_insert on public.reco_votes for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.reco_answers a join public.reco_questions q on q.id = a.question_id
              where a.id = answer_id and public.is_my_community(q.community_id))
);
drop policy if exists reco_v_delete on public.reco_votes;
create policy reco_v_delete on public.reco_votes for delete using (user_id = auth.uid());

-- answer count + notify the asker
create or replace function public.on_reco_answer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cid uuid; v_title text; v_author text;
begin
  update public.reco_questions set answer_count = answer_count + 1, bump_at = now()
    where id = NEW.question_id
    returning author_id, community_id, title into v_owner, v_cid, v_title;
  select coalesce(name, 'Someone') into v_author from public.profiles where id = NEW.author_id;
  if NEW.author_id is distinct from v_owner then
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_cid, 'recommend', NEW.question_id, NEW.author_id, v_owner,
            v_author || ' answered your question', left(coalesce(v_title, ''), 70), '/recommend/' || NEW.question_id::text);
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_reco_answer on public.reco_answers;
create trigger trg_reco_answer after insert on public.reco_answers for each row execute function public.on_reco_answer();

create or replace function public.on_reco_answer_del()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reco_questions set answer_count = greatest(answer_count - 1, 0) where id = OLD.question_id;
  return OLD;
end; $$;
drop trigger if exists trg_reco_answer_del on public.reco_answers;
create trigger trg_reco_answer_del after delete on public.reco_answers for each row execute function public.on_reco_answer_del();

-- vote count
create or replace function public.on_reco_vote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then update public.reco_answers set vote_count = vote_count + 1 where id = NEW.answer_id; return NEW;
  else update public.reco_answers set vote_count = greatest(vote_count - 1, 0) where id = OLD.answer_id; return OLD; end if;
end; $$;
drop trigger if exists trg_reco_vote_ins on public.reco_votes;
create trigger trg_reco_vote_ins after insert on public.reco_votes for each row execute function public.on_reco_vote();
drop trigger if exists trg_reco_vote_del on public.reco_votes;
create trigger trg_reco_vote_del after delete on public.reco_votes for each row execute function public.on_reco_vote();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 2. BORROW & LEND                                                  ║
-- ╚══════════════════════════════════════════════════════════════════╝
create table if not exists public.lend_items (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references public.communities(id) on delete cascade,
  owner_user_id    uuid not null references public.profiles(id) on delete cascade,
  title            text not null,
  description      text,
  category         text,
  photo_url        text,
  status           text not null default 'available' check (status in ('available', 'lent', 'unavailable')),
  contact_whatsapp text,
  contact_phone    text,
  created_at       timestamptz not null default now(),
  bump_at          timestamptz not null default now()
);
create index if not exists lend_feed_idx on public.lend_items (community_id, status, bump_at desc);

create table if not exists public.borrow_requests (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.lend_items(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  note         text,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'returned')),
  created_at   timestamptz not null default now()
);
create index if not exists borrow_req_idx on public.borrow_requests (item_id, created_at desc);

alter table public.lend_items      enable row level security;
alter table public.borrow_requests enable row level security;

drop policy if exists lend_read on public.lend_items;
create policy lend_read on public.lend_items for select using (public.is_my_community(community_id) or public.is_admin(auth.uid()));
drop policy if exists lend_insert on public.lend_items;
create policy lend_insert on public.lend_items for insert with check (owner_user_id = auth.uid() and public.is_my_community(community_id));
drop policy if exists lend_update on public.lend_items;
create policy lend_update on public.lend_items for update using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists lend_delete on public.lend_items;
create policy lend_delete on public.lend_items for delete using (owner_user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists borrow_read on public.borrow_requests;
create policy borrow_read on public.borrow_requests for select using (
  requester_id = auth.uid()
  or exists (select 1 from public.lend_items i where i.id = item_id and i.owner_user_id = auth.uid())
  or public.is_admin(auth.uid())
);
drop policy if exists borrow_insert on public.borrow_requests;
create policy borrow_insert on public.borrow_requests for insert with check (
  requester_id = auth.uid()
  and exists (select 1 from public.lend_items i where i.id = item_id and public.is_my_community(i.community_id))
);
drop policy if exists borrow_update on public.borrow_requests;
create policy borrow_update on public.borrow_requests for update using (
  exists (select 1 from public.lend_items i where i.id = item_id and i.owner_user_id = auth.uid())
);
drop policy if exists borrow_delete on public.borrow_requests;
create policy borrow_delete on public.borrow_requests for delete using (requester_id = auth.uid() or public.is_admin(auth.uid()));

-- new request → notify the lender
create or replace function public.on_borrow_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cid uuid; v_title text; v_who text;
begin
  select owner_user_id, community_id, title into v_owner, v_cid, v_title from public.lend_items where id = NEW.item_id;
  select coalesce(name, 'Someone') into v_who from public.profiles where id = NEW.requester_id;
  if NEW.requester_id is distinct from v_owner then
    insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
    values (v_cid, 'borrow', NEW.item_id, NEW.requester_id, v_owner,
            v_who || ' wants to borrow your ' || left(coalesce(v_title, 'item'), 40), left(coalesce(NEW.note, ''), 70), '/borrow/' || NEW.item_id::text);
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_borrow_request on public.borrow_requests;
create trigger trg_borrow_request after insert on public.borrow_requests for each row execute function public.on_borrow_request();

-- status change → notify the requester
create or replace function public.on_borrow_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_title text;
begin
  if NEW.status is distinct from OLD.status then
    select community_id, title into v_cid, v_title from public.lend_items where id = NEW.item_id;
    insert into public.notifications (community_id, type, entity_id, target_user_id, title, body, route)
    values (v_cid, 'borrow', NEW.item_id, NEW.requester_id,
            'Borrow request ' || NEW.status, left(coalesce(v_title, 'item'), 60), '/borrow/' || NEW.item_id::text);
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_borrow_update on public.borrow_requests;
create trigger trg_borrow_update after update on public.borrow_requests for each row execute function public.on_borrow_update();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 3. BLOOD & SOS — opt-in donor / emergency-helper registry         ║
-- ╚══════════════════════════════════════════════════════════════════╝
alter table public.profiles
  add column if not exists blood_group     text,
  add column if not exists donor_available boolean not null default false,
  add column if not exists helper_skills   text[]  not null default '{}';
-- (profiles are already readable by community members via the existing policy,
--  and self-update is already allowed — no new RLS needed.)

-- ── Realtime (idempotent) ───────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.reco_questions;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reco_answers;     exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reco_votes;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.lend_items;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.borrow_requests;  exception when duplicate_object then null; end $$;
