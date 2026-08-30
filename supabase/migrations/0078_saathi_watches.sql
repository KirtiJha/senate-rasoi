-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0078: standing watches for Saathi
-- Run AFTER 0001–0077.
--
-- Until now Saathi only existed while you were looking at it. A watch is the
-- one thing it can do while you are asleep: "tell me when a 2BHK is listed",
-- "let me know if anyone lists a drill".
--
-- KEYWORDS, NOT EMBEDDINGS — deliberately.
-- A watch has to fire the moment the listing appears. Embeddings are filled
-- lazily, so a semantic watch would silently miss anything posted before the
-- backfill caught up, and "silently missed it" is the one failure a watch
-- cannot have. Keywords fire on insert, are predictable, and can be shown back
-- to the resident as the literal thing being watched for. Less clever;
-- considerably more trustworthy for something that runs unattended.
-- ════════════════════════════════════════════════════════════════════

create table public.saathi_watches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,

  -- What the resident sees: "2 BHK flats for rent".
  label        text not null,
  -- What actually matches: every one must appear in the indexed text, so
  -- {'2 bhk','rent'} is narrower than {'2 bhk'} rather than broader.
  keywords     text[] not null check (cardinality(keywords) between 1 and 6),
  -- Optional narrowing to particular kinds of thing, e.g. {'property'}.
  sources      text[],

  -- Individually switchable, because a resident who stops caring about flats
  -- should not have to delete the watch to stop hearing about them.
  active       boolean not null default true,

  created_at    timestamptz not null default now(),
  last_fired_at timestamptz
);

create index saathi_watches_user_idx on public.saathi_watches (user_id, created_at desc);
-- The trigger's lookup: active watches in one community.
create index saathi_watches_live_idx on public.saathi_watches (community_id) where active;

-- One notification per watch per item, ever.
--
-- Without this, editing a listing re-fires every watch that matched it — and
-- the resident who asked to hear about 2BHKs once hears about the same flat
-- every time its owner fixes a typo. The unique key IS the dedupe.
create table public.saathi_watch_hits (
  watch_id  uuid not null references public.saathi_watches(id) on delete cascade,
  source    text not null,
  source_id uuid not null,
  fired_at  timestamptz not null default now(),
  primary key (watch_id, source, source_id)
);

alter table public.saathi_watches enable row level security;
alter table public.saathi_watch_hits enable row level security;

-- A watch is private to whoever set it. No admin visibility: what a resident
-- asked to be told about is their business.
create policy saathi_watches_own on public.saathi_watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy saathi_watch_hits_own on public.saathi_watch_hits
  for select using (
    exists (select 1 from public.saathi_watches w where w.id = watch_id and w.user_id = auth.uid())
  );

-- ── Where a match sends you ─────────────────────────────────────────
create or replace function public.saathi_watch_route(p_source text, p_id uuid)
  returns text language sql immutable as $$
  select case p_source
    when 'listing'    then '/listing/'    || p_id
    when 'property'   then '/property/'   || p_id
    when 'borrow'     then '/borrow/'     || p_id
    when 'post'       then '/feed/'       || p_id
    when 'event'      then '/events/'     || p_id
    when 'place'      then '/place/'      || p_id
    when 'lostfound'  then '/lost-found/' || p_id
    when 'recommend'  then '/recommend/'  || p_id
    when 'dish'       then '/food'
    when 'tiffin'     then '/food'
    when 'sport'      then '/sports/'     || p_id
    when 'document'   then '/documents'
    when 'emergency'  then '/emergency'
    else '/'
  end;
$$;

-- ── The trigger ─────────────────────────────────────────────────────
--
-- Fires on search_documents rather than on each source table: that one table
-- already receives everything indexed, in a normalised `content` column, so a
-- watch covers every kind of thing without thirteen more triggers to maintain.
create or replace function public.saathi_check_watches() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  w        record;
  v_text   text := lower(coalesce(NEW.content, ''));
begin
  if v_text = '' then return NEW; end if;

  for w in
    select * from public.saathi_watches
     where community_id = NEW.community_id
       and active
       and (sources is null or NEW.source = any(sources))
  loop
    -- Every keyword must be present. Narrowing a watch should narrow it.
    if exists (select 1 from unnest(w.keywords) k where position(lower(k) in v_text) = 0) then
      continue;
    end if;

    -- Already told them about this exact item.
    if exists (
      select 1 from public.saathi_watch_hits h
       where h.watch_id = w.id and h.source = NEW.source and h.source_id = NEW.source_id
    ) then
      continue;
    end if;

    insert into public.saathi_watch_hits (watch_id, source, source_id)
      values (w.id, NEW.source, NEW.source_id);

    insert into public.notifications (community_id, type, entity_id, target_user_id, title, body, route)
      values (
        NEW.community_id,
        'saathi_watch',
        NEW.source_id,
        w.user_id,
        'Saathi: ' || w.label,
        left(NEW.content, 140),
        public.saathi_watch_route(NEW.source, NEW.source_id)
      );

    update public.saathi_watches set last_fired_at = now() where id = w.id;
  end loop;

  return NEW;
end; $$;

drop trigger if exists trg_saathi_watches on public.search_documents;
create trigger trg_saathi_watches after insert or update of content on public.search_documents
  for each row execute function public.saathi_check_watches();
