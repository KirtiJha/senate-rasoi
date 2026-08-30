-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0076: the rest of the app, in the semantic index
-- Run AFTER 0001–0075.
--
-- 0040 indexed six sources and 0048 added four more, which left Ask Aangan
-- answering from about half the app while sounding equally confident about the
-- other half. Missing entirely: events, nearby places, lost & found, polls,
-- post comments, and the ANSWERS to recommendation questions (the questions
-- were indexed, the answers were not — so "what did people recommend?" could
-- only ever see the asking).
--
-- Deliberately still excluded: direct messages, orders, payments and inquiries.
-- Those are private between two residents, and an assistant that can quote them
-- back to a third is a data leak wearing a helpful face.
-- ════════════════════════════════════════════════════════════════════

-- ── Events / functions ──────────────────────────────────────────────
create or replace function public.sd_index_event() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='event' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('event', NEW.id, NEW.community_id,
    NEW.title
    || coalesce(' — ' || NEW.description, '')
    || coalesce(' · on ' || NEW.event_date::text, '')
    || coalesce(' · at ' || NEW.venue, '')
    || ' · ' || NEW.status);
  return NEW;
end; $$;
drop trigger if exists trg_sd_event on public.society_events;
create trigger trg_sd_event after insert or update or delete on public.society_events
  for each row execute function public.sd_index_event();

-- ── Nearby places ───────────────────────────────────────────────────
-- Phone deliberately omitted from the indexed text, matching how emergency
-- contacts are handled: the assistant points at the card, the card holds the
-- number. Numbers in the index become numbers in the prompt.
create or replace function public.sd_index_place() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='place' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('place', NEW.id, NEW.community_id,
    NEW.name || ' — ' || NEW.place_type
    || coalesce(' · ' || NEW.description, '')
    || coalesce(' · ' || NEW.address, '')
    || coalesce(' · open ' || NEW.hours, ''));
  return NEW;
end; $$;
drop trigger if exists trg_sd_place on public.places;
create trigger trg_sd_place after insert or update or delete on public.places
  for each row execute function public.sd_index_place();

-- ── Lost & found ────────────────────────────────────────────────────
create or replace function public.sd_index_lostfound() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='lostfound' and source_id=OLD.id; return OLD; end if;
  -- Resolved items leave the index: "has anyone found my keys" should not
  -- surface a pair returned three months ago.
  if NEW.status = 'resolved' then
    delete from public.search_documents where source='lostfound' and source_id=NEW.id;
    return NEW;
  end if;
  perform public.sd_upsert('lostfound', NEW.id, NEW.community_id,
    NEW.kind || ': ' || NEW.title
    || coalesce(' — ' || NEW.description, '')
    || coalesce(' · ' || NEW.category, ''));
  return NEW;
end; $$;
drop trigger if exists trg_sd_lostfound on public.lost_found_items;
create trigger trg_sd_lostfound after insert or update or delete on public.lost_found_items
  for each row execute function public.sd_index_lostfound();

-- ── Polls ───────────────────────────────────────────────────────────
-- The question and its options, never the vote counts. Counts change on every
-- vote, and indexing them would re-embed the row each time for information the
-- model should read live rather than remember stale.
create or replace function public.sd_index_poll(p_poll uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_community uuid;
  v_question  text;
  v_options   text;
begin
  select community_id, question into v_community, v_question from public.polls where id = p_poll;
  if v_community is null then
    delete from public.search_documents where source='poll' and source_id=p_poll;
    return;
  end if;
  -- Column is `text`, not `label`; qualified because `text` is also a type name.
  select string_agg(o.text, ', ' order by o.position) into v_options
    from public.poll_options o where o.poll_id = p_poll;
  perform public.sd_upsert('poll', p_poll, v_community,
    'Poll: ' || v_question || coalesce(' · options: ' || v_options, ''));
end; $$;

create or replace function public.sd_trg_poll() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='poll' and source_id=OLD.id; return OLD; end if;
  perform public.sd_index_poll(NEW.id);
  return NEW;
end; $$;
drop trigger if exists trg_sd_poll on public.polls;
create trigger trg_sd_poll after insert or update or delete on public.polls
  for each row execute function public.sd_trg_poll();

-- An option changing re-indexes its parent poll, so the indexed text and the
-- ballot never disagree.
create or replace function public.sd_trg_poll_option() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform public.sd_index_poll(coalesce(NEW.poll_id, OLD.poll_id));
  return coalesce(NEW, OLD);
end; $$;
drop trigger if exists trg_sd_poll_option on public.poll_options;
create trigger trg_sd_poll_option after insert or update or delete on public.poll_options
  for each row execute function public.sd_trg_poll_option();

-- ── Post comments ───────────────────────────────────────────────────
-- Comments carry no community_id of their own, so it comes from the post.
-- Without these, every discussion in the feed was invisible to the assistant —
-- the announcement was indexed, the twelve replies working out what it meant
-- were not.
create or replace function public.sd_index_comment() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_community uuid; v_title text;
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='comment' and source_id=OLD.id; return OLD; end if;
  select po.community_id, po.title into v_community, v_title
    from public.posts po where po.id = NEW.post_id;
  if v_community is null then return NEW; end if;
  perform public.sd_upsert('comment', NEW.id, v_community,
    'Comment' || coalesce(' on "' || v_title || '"', '') || ': ' || NEW.body);
  return NEW;
end; $$;
drop trigger if exists trg_sd_comment on public.post_comments;
create trigger trg_sd_comment after insert or update or delete on public.post_comments
  for each row execute function public.sd_index_comment();

-- ── Recommendation answers ──────────────────────────────────────────
-- The whole point of the feature. A question indexed without its answers means
-- "who do people recommend for AC repair" retrieves the asking and none of the
-- telling.
create or replace function public.sd_index_recoanswer() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_community uuid; v_question text;
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='recoanswer' and source_id=OLD.id; return OLD; end if;
  select q.community_id, q.title into v_community, v_question
    from public.reco_questions q where q.id = NEW.question_id;
  if v_community is null then return NEW; end if;
  perform public.sd_upsert('recoanswer', NEW.id, v_community,
    'Recommendation' || coalesce(' for "' || v_question || '"', '') || ': '
    || coalesce(NEW.provider_name || ' — ', '') || NEW.body);
  return NEW;
end; $$;
drop trigger if exists trg_sd_recoanswer on public.reco_answers;
create trigger trg_sd_recoanswer after insert or update or delete on public.reco_answers
  for each row execute function public.sd_index_recoanswer();

-- ── Backfill everything that already exists ─────────────────────────
-- embedding stays null, which is the flag the Edge Function uses to pick up
-- rows needing embedding on the next Ask.
insert into public.search_documents (source, source_id, community_id, content)
  select 'event', e.id, e.community_id,
         e.title || coalesce(' — ' || e.description, '') || coalesce(' · on ' || e.event_date::text, '')
         || coalesce(' · at ' || e.venue, '') || ' · ' || e.status
    from public.society_events e
  on conflict (source, source_id) do nothing;

insert into public.search_documents (source, source_id, community_id, content)
  select 'place', p.id, p.community_id,
         p.name || ' — ' || p.place_type || coalesce(' · ' || p.description, '')
         || coalesce(' · ' || p.address, '') || coalesce(' · open ' || p.hours, '')
    from public.places p
  on conflict (source, source_id) do nothing;

insert into public.search_documents (source, source_id, community_id, content)
  select 'lostfound', l.id, l.community_id,
         l.kind || ': ' || l.title || coalesce(' — ' || l.description, '') || coalesce(' · ' || l.category, '')
    from public.lost_found_items l where l.status <> 'resolved'
  on conflict (source, source_id) do nothing;

insert into public.search_documents (source, source_id, community_id, content)
  select 'poll', pl.id, pl.community_id,
         'Poll: ' || pl.question
         || coalesce(' · options: ' || (select string_agg(o.text, ', ' order by o.position)
                                          from public.poll_options o where o.poll_id = pl.id), '')
    from public.polls pl
  on conflict (source, source_id) do nothing;

insert into public.search_documents (source, source_id, community_id, content)
  select 'comment', pc.id, po.community_id,
         'Comment' || coalesce(' on "' || po.title || '"', '') || ': ' || pc.body
    from public.post_comments pc join public.posts po on po.id = pc.post_id
  on conflict (source, source_id) do nothing;

insert into public.search_documents (source, source_id, community_id, content)
  select 'recoanswer', ra.id, q.community_id,
         'Recommendation' || coalesce(' for "' || q.title || '"', '') || ': '
         || coalesce(ra.provider_name || ' — ', '') || ra.body
    from public.reco_answers ra join public.reco_questions q on q.id = ra.question_id
  on conflict (source, source_id) do nothing;
