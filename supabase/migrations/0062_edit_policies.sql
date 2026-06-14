-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0062: editable content RLS (recommendations + documents)
-- Run AFTER 0061.
--
-- These tables had no UPDATE policy (or owner-only), so creators couldn't edit
-- their own content. Grant UPDATE to the author/owner and to admins, matching
-- how listings / posts / dishes / places already work. (Comments, dishes,
-- tiffin plans, posts, polls and sport_tournaments already permit owner-or-admin
-- updates, so they need nothing here.)
-- ════════════════════════════════════════════════════════════════════

-- Recommend questions — author or admin can edit.
drop policy if exists reco_q_update on public.reco_questions;
create policy reco_q_update on public.reco_questions for update
  using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- Recommend answers — author or admin can edit.
drop policy if exists reco_a_update on public.reco_answers;
create policy reco_a_update on public.reco_answers for update
  using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- Documents — extend the owner-only update to also allow admins (edit metadata).
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update
  using (owner_id = auth.uid() or public.is_admin(auth.uid()));
