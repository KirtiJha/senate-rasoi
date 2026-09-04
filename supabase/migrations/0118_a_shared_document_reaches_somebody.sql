-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0118: a privately shared document reaches somebody
-- Run AFTER 0001–0117. Safe to re-run.
--
-- One document exists in this whole society. It is private, it was shared
-- with exactly one person, and that person was never told — `document_shares`
-- had no trigger on it. A filing cabinet nobody is told about is a filing
-- cabinet nobody opens.
--
-- What was ALREADY working, and I nearly broke by not checking first:
-- `trg_document_notify` fires WHEN (new.is_public), so a document uploaded
-- publicly has always announced itself to the society. My first attempt
-- announced that a second time. The only gap on the public side is a document
-- uploaded privately and made public LATER — that trigger is INSERT-only — so
-- the one added here is UPDATE-only and covers exactly the flip.
-- ════════════════════════════════════════════════════════════════════

-- Shared privately with one person: tell that person. This is the one that
-- was genuinely missing.
create or replace function public.on_document_shared()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare d record; v_who text;
begin
  select doc.name, doc.community_id, doc.owner_id
    into d from public.documents doc where doc.id = NEW.document_id;
  if not found or NEW.user_id = d.owner_id then return NEW; end if;

  select coalesce(name, 'A neighbour') into v_who from public.profiles where id = d.owner_id;

  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (d.community_id, 'document', NEW.document_id, d.owner_id, NEW.user_id,
          v_who || ' shared a document with you',
          d.name, '/documents');
  return NEW;
end; $fn$;

drop trigger if exists trg_document_shared on public.document_shares;
create trigger trg_document_shared
  after insert on public.document_shares
  for each row execute function public.on_document_shared();

-- Made public after the fact. The insert case already has a trigger; this is
-- only the flip, so nothing is announced twice.
create or replace function public.on_document_published()
returns trigger language plpgsql security definer
set search_path = public, extensions as $fn$
declare v_who text;
begin
  select coalesce(name, 'A neighbour') into v_who from public.profiles where id = NEW.owner_id;
  insert into public.notifications
    (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (NEW.community_id, 'document', NEW.id, NEW.owner_id, null,
          'New document for the society',
          NEW.name || ' · shared by ' || v_who, '/documents');
  return NEW;
end; $fn$;

drop trigger if exists trg_document_published on public.documents;
create trigger trg_document_published
  after update on public.documents
  for each row
  when (new.is_public and not coalesce(old.is_public, false))
  execute function public.on_document_published();
