-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0032: document vault
-- Run AFTER 0001–0031.
--
-- A per-society document repository. The uploader owns each file and marks it
-- public (any society member can access) or private (only people they share it
-- with). Files live in a PRIVATE `documents` storage bucket; access is granted
-- per-file via signed URLs, gated by the RLS below.
--
-- FIRST create a PRIVATE bucket named `documents` (Storage → New bucket →
-- documents → leave "Public" OFF). Optionally set its file-size limit to 20 MB.
-- Then run this file.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.documents (
  id           uuid        primary key default gen_random_uuid(),
  community_id uuid        not null references public.communities(id) on delete cascade,
  owner_id     uuid        not null references public.profiles(id) on delete cascade,
  name         text        not null,
  description  text,
  storage_path text        not null,
  file_size    bigint,
  mime_type    text,
  is_public    boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists documents_comm_idx on public.documents (community_id);
create index if not exists documents_owner_idx on public.documents (owner_id);

create table if not exists public.document_shares (
  document_id uuid        not null references public.documents(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (document_id, user_id)
);
create index if not exists document_shares_user_idx on public.document_shares (user_id);

-- Helper: is the current user the owner of a document?
create or replace function public.is_doc_owner(p_doc uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.documents d where d.id = p_doc and d.owner_id = auth.uid());
$$;

-- ── RLS: documents ──────────────────────────────────────────────────
alter table public.documents enable row level security;

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select using (
  (is_public and public.is_my_community(community_id))
  or owner_id = auth.uid()
  or exists (select 1 from public.document_shares s where s.document_id = documents.id and s.user_id = auth.uid())
);

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert
  with check (owner_id = auth.uid() and public.is_my_community(community_id));

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update using (owner_id = auth.uid());

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete using (owner_id = auth.uid());

-- ── RLS: document_shares ────────────────────────────────────────────
alter table public.document_shares enable row level security;

drop policy if exists doc_shares_read on public.document_shares;
create policy doc_shares_read on public.document_shares for select
  using (user_id = auth.uid() or public.is_doc_owner(document_id));

drop policy if exists doc_shares_insert on public.document_shares;
create policy doc_shares_insert on public.document_shares for insert
  with check (public.is_doc_owner(document_id));

drop policy if exists doc_shares_delete on public.document_shares;
create policy doc_shares_delete on public.document_shares for delete
  using (public.is_doc_owner(document_id));

-- ── Storage policies for the 'documents' bucket ─────────────────────
-- A user can read an object only if they can read its documents row (the inner
-- SELECT respects the documents RLS above → public/owner/shared).
drop policy if exists documents_obj_read on storage.objects;
create policy documents_obj_read on storage.objects for select using (
  bucket_id = 'documents'
  and exists (select 1 from public.documents d where d.storage_path = storage.objects.name)
);

drop policy if exists documents_obj_insert on storage.objects;
create policy documents_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

drop policy if exists documents_obj_delete on storage.objects;
create policy documents_obj_delete on storage.objects for delete using (
  bucket_id = 'documents'
  and exists (select 1 from public.documents d where d.storage_path = storage.objects.name and d.owner_id = auth.uid())
);
