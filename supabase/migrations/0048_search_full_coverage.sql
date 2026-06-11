-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0048: full-coverage semantic index for Ask Aangan
-- Run AFTER 0001–0047.
--
-- Adds four more sources to search_documents so Ask Aangan covers (nearly) the
-- whole app: feed posts, PUBLIC documents, sports groups, and emergency/service
-- contacts. Also nulls existing embeddings so everything is re-embedded with the
-- new embedding model (gemini-embedding-001) the function now uses.
-- ════════════════════════════════════════════════════════════════════

-- ── Feed posts ──────────────────────────────────────────────────────
create or replace function public.sd_index_post() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='post' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('post', NEW.id, NEW.community_id,
    trim(coalesce(NEW.title || ' — ', '') || coalesce(NEW.body, '')));
  return NEW;
end; $$;
drop trigger if exists trg_sd_post on public.posts;
create trigger trg_sd_post after insert or update or delete on public.posts for each row execute function public.sd_index_post();

-- ── Documents (public only — never index private files) ─────────────
create or replace function public.sd_index_document() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='document' and source_id=OLD.id; return OLD; end if;
  if NEW.is_public then
    perform public.sd_upsert('document', NEW.id, NEW.community_id, NEW.name || coalesce(' — ' || NEW.description, ''));
  else
    delete from public.search_documents where source='document' and source_id=NEW.id;
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_sd_document on public.documents;
create trigger trg_sd_document after insert or update or delete on public.documents for each row execute function public.sd_index_document();

-- ── Sports groups ───────────────────────────────────────────────────
create or replace function public.sd_index_sport() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='sport' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('sport', NEW.id, NEW.community_id,
    NEW.name || ' — ' || NEW.sport || ' group' || coalesce(' · ' || NEW.description, '') || coalesce(' · ' || NEW.practice_location, ''));
  return NEW;
end; $$;
drop trigger if exists trg_sd_sport on public.sport_groups;
create trigger trg_sd_sport after insert or update or delete on public.sport_groups for each row execute function public.sd_index_sport();

-- ── Emergency / service contacts ────────────────────────────────────
create or replace function public.sd_index_emergency() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then delete from public.search_documents where source='emergency' and source_id=OLD.id; return OLD; end if;
  perform public.sd_upsert('emergency', NEW.id, NEW.community_id,
    NEW.name || ' — ' || coalesce(NEW.category, NEW.role) || ' contact');
  return NEW;
end; $$;
drop trigger if exists trg_sd_emergency on public.emergency_contacts;
create trigger trg_sd_emergency after insert or update or delete on public.emergency_contacts for each row execute function public.sd_index_emergency();

-- ── Backfill existing rows ──────────────────────────────────────────
insert into public.search_documents (source, source_id, community_id, content)
  select 'post', id, community_id, trim(coalesce(title || ' — ', '') || coalesce(body, '')) from public.posts
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'document', id, community_id, name || coalesce(' — ' || description, '') from public.documents where is_public
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'sport', id, community_id, name || ' — ' || sport || ' group' || coalesce(' · ' || description, '') || coalesce(' · ' || practice_location, '') from public.sport_groups
on conflict do nothing;
insert into public.search_documents (source, source_id, community_id, content)
  select 'emergency', id, community_id, name || ' — ' || coalesce(category, role) || ' contact' from public.emergency_contacts
on conflict do nothing;

-- Re-embed everything with the new embedding model.
update public.search_documents set embedding = null;
