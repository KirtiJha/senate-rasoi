-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0068: content reports + peer blocking
-- Run AFTER 0001–0067.
--
-- Required by Apple App Store Guideline 1.2 (Safety — User-Generated Content):
-- an app with UGC must let members REPORT objectionable content and BLOCK
-- abusive users. Google Play's UGC policy expects the same.
--
-- NOTE: this is PEER blocking (one member hides another). It is distinct from
-- `profiles.blocked` in 0025, which is an ADMIN BAN that locks a member out of
-- the society entirely. The two are unrelated and must not be conflated.
-- ════════════════════════════════════════════════════════════════════

-- ─── Reports ─────────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id              uuid        primary key default gen_random_uuid(),
  community_id    uuid        not null references public.communities(id) on delete cascade,
  reporter_id     uuid        not null references public.profiles(id) on delete cascade,
  -- Free-form so new content types don't need a migration; the client sends a
  -- stable slug ('post' | 'comment' | 'listing' | 'dish' | 'borrow' |
  -- 'lost_found' | 'recommend' | 'property' | 'place' | 'message' | 'profile').
  target_type     text        not null,
  target_id       uuid        not null,
  target_owner_id uuid        references public.profiles(id) on delete set null,
  reason          text        not null check (reason in (
                    'spam', 'harassment', 'hate', 'scam',
                    'adult', 'violence', 'illegal', 'other')),
  details         text,
  status          text        not null default 'open'
                    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by     uuid        references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  -- One report per person per item; re-reporting updates the existing row.
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_queue_idx  on public.content_reports (community_id, status, created_at desc);
create index if not exists reports_target_idx on public.content_reports (target_type, target_id);

alter table public.content_reports enable row level security;

-- You can see your own reports; admins see every report in their society.
drop policy if exists cr_read on public.content_reports;
create policy cr_read on public.content_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (public.is_admin(auth.uid()) and public.is_my_community(community_id))
  );

drop policy if exists cr_insert on public.content_reports;
create policy cr_insert on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_my_community(community_id));

-- Only admins triage. (Reporters intentionally cannot edit a filed report.)
drop policy if exists cr_update on public.content_reports;
create policy cr_update on public.content_reports for update to authenticated
  using (public.is_admin(auth.uid()) and public.is_my_community(community_id));

-- ─── Peer blocks ─────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid        not null references public.profiles(id) on delete cascade,
  blocked_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- A user manages their own block list. They may also read rows where they are
-- the BLOCKED party — the client needs that to enforce blocking mutually
-- (a blocked user must not be able to DM the person who blocked them).
drop policy if exists ub_read on public.user_blocks;
create policy ub_read on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists ub_insert on public.user_blocks;
create policy ub_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists ub_delete on public.user_blocks;
create policy ub_delete on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- True when either party has blocked the other. STABLE + SECURITY DEFINER so
-- it can be used inside other policies without tripping over ub_read.
create or replace function public.is_peer_blocked(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = auth.uid() and blocked_id = p_other)
        or (blocker_id = p_other    and blocked_id = auth.uid())
  );
$$;

grant execute on function public.is_peer_blocked(uuid) to authenticated;

-- ─── Enforce blocking on direct messages ─────────────────────────────
-- Hiding content client-side is enough for feeds, but a block must actually
-- STOP contact — so refuse the insert at the database.
create or replace function public.on_dm_check_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
begin
  select case when t.user_a = new.sender_id then t.user_b else t.user_a end
    into v_other
    from public.dm_threads t
   where t.id = new.thread_id;

  if v_other is not null and exists (
    select 1 from public.user_blocks
     where (blocker_id = new.sender_id and blocked_id = v_other)
        or (blocker_id = v_other       and blocked_id = new.sender_id)
  ) then
    raise exception 'This conversation is unavailable.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists dm_block_check on public.dm_messages;
create trigger dm_block_check
  before insert on public.dm_messages
  for each row execute function public.on_dm_check_block();

-- ─── Notify admins when something is reported ────────────────────────
create or replace function public.on_content_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  for v_admin in
    select id from public.profiles
     where community_id = new.community_id
       and 'admin' = any(coalesce(roles, '{}'))
  loop
    insert into public.notifications (
      community_id, type, entity_id, actor_id,
      target_user_id, title, body, route
    ) values (
      new.community_id,
      'report',
      new.id,
      new.reporter_id,
      v_admin.id,
      '🚩 Content reported',
      'A ' || new.target_type || ' was reported for ' || new.reason || '.',
      '/admin?tab=reports'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists content_report_notify on public.content_reports;
create trigger content_report_notify
  after insert on public.content_reports
  for each row execute function public.on_content_report_insert();
