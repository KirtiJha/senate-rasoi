-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0040: semantic search index (pgvector) for Ask Aangan
-- Run AFTER 0001–0039.
--
-- Upgrades Ask Aangan from "send the recent catalog to Gemini" to true RAG:
--   • search_documents holds one compact text row per society listing, with a
--     pgvector embedding (filled lazily by the ai-proxy Edge Function).
--   • triggers keep that text fresh on every insert/update/delete (embedding is
--     nulled when the text changes, so the next Ask re-embeds it).
--   • match_documents() does the cosine vector search, community-scoped.
-- Display + freshness still come from the live tables (the Edge Function fetches
-- the matched ids back), so sold-out/expired items never surface.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists vector;

create table if not exists public.search_documents (
  source       text not null,                       -- dish|tiffin|listing|property|recommend|borrow
  source_id    uuid not null,
  community_id uuid not null references public.communities(id) on delete cascade,
  content      text not null,
  embedding    vector(768),                          -- null = needs (re)embedding
  updated_at   timestamptz not null default now(),
  primary key (source, source_id)
);

create index if not exists search_documents_community_idx on public.search_documents (community_id);
create index if not exists search_documents_dirty_idx on public.search_documents (community_id) where embedding is null;
create index if not exists search_documents_embedding_idx
  on public.search_documents using hnsw (embedding vector_cosine_ops);

alter table public.search_documents enable row level security;
-- No policies on purpose: only the SECURITY DEFINER triggers (writes) and the
-- service-role Edge Function (read/embed) ever touch this table.

-- ── Generic upsert helper used by every per-table trigger ──
create or replace function public.sd_upsert(
  p_source text, p_id uuid, p_community uuid, p_content text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.search_documents (source, source_id, community_id, content, embedding, updated_at)
    values (p_source, p_id, p_community, p_content, null, now())
  on conflict (source, source_id) do update set
    community_id = excluded.community_id,
    content      = excluded.content,
    -- only invalidate the embedding when the text actually changed
    embedding    = case when public.search_documents.content is distinct from excluded.content
                        then null else public.search_documents.embedding end,
    updated_at   = now();
end; $$;

-- ── Per-table trigger functions (build the searchable text) ──
create or replace function public.sd_index_dish() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='dish' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('dish', NEW.id, NEW.community_id,
    NEW.dish_name || ' — ' || NEW.veg_type || ' ' || NEW.slot || ' ₹' || NEW.price || coalesce(' ' || NEW.description, ''));
  return NEW;
end; $$;

create or replace function public.sd_index_tiffin() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='tiffin' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('tiffin', NEW.id, NEW.community_id,
    NEW.title || ' — tiffin ' || NEW.veg_type || ' ' || NEW.slot || ' ₹' || NEW.price || coalesce(' ' || NEW.description, ''));
  return NEW;
end; $$;

create or replace function public.sd_index_listing() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='listing' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('listing', NEW.id, NEW.community_id,
    NEW.title || ' — ' || NEW.category || coalesce(' ' || NEW.description, ''));
  return NEW;
end; $$;

create or replace function public.sd_index_property() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='property' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('property', NEW.id, NEW.community_id,
    NEW.title || ' — flat for ' || NEW.listing_type || ' ' || coalesce(NEW.config, '') || coalesce(' ' || NEW.description, ''));
  return NEW;
end; $$;

create or replace function public.sd_index_reco() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='recommend' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('recommend', NEW.id, NEW.community_id,
    NEW.title || ' — looking for a recommendation: ' || NEW.category || coalesce(' ' || NEW.detail, ''));
  return NEW;
end; $$;

create or replace function public.sd_index_lend() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='borrow' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('borrow', NEW.id, NEW.community_id,
    NEW.title || ' — to borrow ' || coalesce(NEW.category, '') || coalesce(' ' || NEW.description, ''));
  return NEW;
end; $$;

drop trigger if exists trg_sd_dish on public.dishes;
create trigger trg_sd_dish after insert or update or delete on public.dishes for each row execute function public.sd_index_dish();
drop trigger if exists trg_sd_tiffin on public.tiffin_plans;
create trigger trg_sd_tiffin after insert or update or delete on public.tiffin_plans for each row execute function public.sd_index_tiffin();
drop trigger if exists trg_sd_listing on public.listings;
create trigger trg_sd_listing after insert or update or delete on public.listings for each row execute function public.sd_index_listing();
drop trigger if exists trg_sd_property on public.property_listings;
create trigger trg_sd_property after insert or update or delete on public.property_listings for each row execute function public.sd_index_property();
drop trigger if exists trg_sd_reco on public.reco_questions;
create trigger trg_sd_reco after insert or update or delete on public.reco_questions for each row execute function public.sd_index_reco();
drop trigger if exists trg_sd_lend on public.lend_items;
create trigger trg_sd_lend after insert or update or delete on public.lend_items for each row execute function public.sd_index_lend();

-- ── Cosine vector search, community-scoped (service-role only) ──
create or replace function public.match_documents(
  p_community uuid, p_embedding text, p_count int default 18
) returns table (source text, source_id uuid, similarity float)
  language sql stable security definer set search_path = public as $$
  select source, source_id, 1 - (embedding <=> p_embedding::vector) as similarity
  from public.search_documents
  where community_id = p_community and embedding is not null
  order by embedding <=> p_embedding::vector
  limit p_count;
$$;
revoke all on function public.match_documents(uuid, text, int) from public, anon, authenticated;

-- ── Backfill existing rows (embedding null → filled on first Ask) ──
insert into public.search_documents (source, source_id, community_id, content)
  select 'dish', id, community_id, dish_name || ' — ' || veg_type || ' ' || slot || ' ₹' || price || coalesce(' ' || description, '') from public.dishes
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'tiffin', id, community_id, title || ' — tiffin ' || veg_type || ' ' || slot || ' ₹' || price || coalesce(' ' || description, '') from public.tiffin_plans
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'listing', id, community_id, title || ' — ' || category || coalesce(' ' || description, '') from public.listings
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'property', id, community_id, title || ' — flat for ' || listing_type || ' ' || coalesce(config, '') || coalesce(' ' || description, '') from public.property_listings
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'recommend', id, community_id, title || ' — looking for a recommendation: ' || category || coalesce(' ' || detail, '') from public.reco_questions
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'borrow', id, community_id, title || ' — to borrow ' || coalesce(category, '') || coalesce(' ' || description, '') from public.lend_items
on conflict do nothing;
