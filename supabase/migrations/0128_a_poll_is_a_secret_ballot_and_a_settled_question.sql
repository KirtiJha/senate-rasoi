-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0128: a poll is a secret ballot and a settled question
-- Run AFTER 0001–0127. Safe to re-run.
--
-- Polls is the one tile where a fault changes an outcome rather than causing
-- an inconvenience. Five things were wrong with it.
--
-- 1. THERE WAS NO SECRET BALLOT. poll_votes could be read row by row — user_id
--    included — by every resident of the society. The app never showed it, but
--    the app is not the only way in: the anon key ships inside it, and the
--    table was one query away. "Should the committee be replaced?" is not a
--    question people answer honestly when their neighbours can read the
--    answer. Votes are now readable only by the person who cast them, and
--    counts come from an aggregate that returns no identities at all.
--
-- 2. A CLOSED POLL STILL ACCEPTED VOTES. Neither is_closed nor expires_at was
--    checked anywhere — not in the policy, not in a trigger. Closing a poll
--    hid the buttons and nothing more.
--
-- 3. A VOTE DID NOT HAVE TO BELONG TO ITS POLL. option_id and poll_id had a
--    foreign key each and no relationship to one another, so a vote could name
--    one poll and an option from a different one. The tally is counted by
--    option, the turnout by poll: one crafted row moved both.
--
-- 4. THE QUESTION COULD BE REWRITTEN AFTER THE VOTING. polls had an UPDATE
--    policy with no WITH CHECK and nothing froze the text. Forty people answer
--    one question; the author edits it into another and keeps their answers.
--    The question is now fixed the moment the first vote lands.
--
-- 5. NOBODY WAS EVER TOLD THE RESULT. The only trigger on polls announced new
--    ones. People voted and heard nothing again — the tile asked for opinions
--    and never reported back. Closing a poll now tells everyone who voted what
--    won, and polls that reach their own deadline close themselves.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. The ballot is secret ─────────────────────────────────────────
drop policy if exists votes_select on public.poll_votes;
create policy votes_select on public.poll_votes
  for select using (user_id = auth.uid());

comment on policy votes_select on public.poll_votes is
  'A ballot belongs to the person who cast it. Nobody else reads it — not neighbours, not admins. Counts come from poll_tallies().';

-- Counts without identities. SECURITY DEFINER so it can see across the ballot
-- box, community-scoped so it can only ever count your own society's polls.
create or replace function public.poll_tallies(p_polls uuid[])
returns table (poll_id uuid, option_id uuid, votes bigint)
language sql stable security definer set search_path = public as $fn$
  select v.poll_id, v.option_id, count(*)::bigint
    from public.poll_votes v
    join public.polls p on p.id = v.poll_id
   where v.poll_id = any(p_polls)
     and (public.is_my_community(p.community_id) or public.is_admin(auth.uid()))
   group by v.poll_id, v.option_id;
$fn$;

comment on function public.poll_tallies(uuid[]) is
  'Vote counts per option, with no voter identities. The only way the app learns results.';

-- ── 2 & 3. A vote must be live, and must belong to its poll ─────────
create or replace function public.guard_poll_vote()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare p record;
begin
  select id, is_closed, expires_at, community_id into p
    from public.polls where id = NEW.poll_id;
  if p.id is null then
    raise exception 'That poll no longer exists.';
  end if;

  if not exists (
    select 1 from public.poll_options o where o.id = NEW.option_id and o.poll_id = NEW.poll_id
  ) then
    raise exception 'That choice does not belong to this poll.';
  end if;

  if p.is_closed then
    raise exception 'This poll is closed.';
  end if;
  if p.expires_at is not null and p.expires_at <= now() then
    raise exception 'Voting on this poll has ended.';
  end if;
  return NEW;
end; $fn$;

drop trigger if exists trg_guard_poll_vote on public.poll_votes;
create trigger trg_guard_poll_vote
  before insert or update on public.poll_votes
  for each row execute function public.guard_poll_vote();

-- ── 4. The question is settled once people start answering it ───────
create or replace function public.guard_poll_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if NEW.community_id is distinct from OLD.community_id
     or NEW.author_id is distinct from OLD.author_id then
    raise exception 'A poll cannot be moved or reassigned.';
  end if;

  if NEW.question is distinct from OLD.question
     and exists (select 1 from public.poll_votes v where v.poll_id = OLD.id) then
    raise exception 'People have already voted — the question can no longer be changed.';
  end if;

  -- Reopening a closed poll would let the result change after it was
  -- announced. Closing is final; a new question deserves a new poll.
  if OLD.is_closed and not NEW.is_closed then
    raise exception 'A closed poll cannot be reopened.';
  end if;
  return NEW;
end; $fn$;

drop trigger if exists trg_guard_poll_update on public.polls;
create trigger trg_guard_poll_update
  before update on public.polls
  for each row execute function public.guard_poll_update();

drop policy if exists polls_manage on public.polls;
create policy polls_manage on public.polls
  for update using (author_id = auth.uid() or public.is_admin(auth.uid()))
  with check (
    (author_id = auth.uid() or public.is_admin(auth.uid()))
    and public.is_my_community(community_id)
  );

-- ── 5. The result comes back ────────────────────────────────────────
create or replace function public.on_poll_closed()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_win record; v_total int; v_tie boolean; v_body text;
begin
  if OLD.is_closed or not NEW.is_closed then return NEW; end if;

  select count(*) into v_total from public.poll_votes where poll_id = NEW.id;

  select o.text, c.n into v_win
    from (select option_id, count(*) n from public.poll_votes
           where poll_id = NEW.id group by option_id) c
    join public.poll_options o on o.id = c.option_id
   order by c.n desc, o.position asc limit 1;

  select count(*) > 1 into v_tie
    from (select count(*) n from public.poll_votes where poll_id = NEW.id group by option_id) x
   where x.n = coalesce(v_win.n, 0);

  v_body := case
    when v_total = 0 then 'It closed without a single vote.'
    when v_tie then 'It ended in a tie on ' || v_win.n || (case when v_win.n = 1 then ' vote' else ' votes' end) || '.'
    else '“' || left(v_win.text, 40) || '” won with ' || v_win.n || ' of ' || v_total
         || (case when v_total = 1 then ' vote' else ' votes' end) || '.'
  end;

  -- Everyone who voted, plus the person who asked. Not the whole society: a
  -- result is owed to the people who took part, not broadcast at the rest.
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  select NEW.community_id, 'poll', NEW.id, auth.uid(), u.user_id,
         '📊 Result: ' || left(NEW.question, 60), v_body, '/polls'
    from (
      select v.user_id from public.poll_votes v where v.poll_id = NEW.id
      union
      select NEW.author_id
    ) u
   where u.user_id is not null and u.user_id is distinct from auth.uid();
  return NEW;
exception when others then
  -- The poll is closed either way (0124's rule).
  return NEW;
end; $fn$;

drop trigger if exists trg_poll_closed on public.polls;
create trigger trg_poll_closed
  after update on public.polls
  for each row execute function public.on_poll_closed();

-- A poll with a deadline should honour it without anyone remembering to.
create or replace function public.close_expired_polls()
returns integer language plpgsql security definer set search_path = public as $fn$
declare v_n int;
begin
  update public.polls
     set is_closed = true
   where not is_closed and expires_at is not null and expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end; $fn$;
