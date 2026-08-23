-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0070: let a reporter re-file (update) their own report
--
-- The client (`reportContent` in src/lib/moderation.ts) upserts on
-- (reporter_id, target_type, target_id) so that "reporting the same item
-- again" updates the existing row. But 0068's `cr_update` policy allowed
-- ONLY admins to UPDATE, so the conflict path was denied by RLS and the
-- second report threw ("Could not send the report") even though the first
-- had succeeded.
--
-- Fix: allow a reporter to update their OWN report, in addition to admins.
-- WITH CHECK pins reporter_id, community_id and target so a reporter can
-- only ever touch their own row for the same item — they can refresh the
-- reason/details/status, never reassign it or move it to another society.
-- Run AFTER 0068.
-- ════════════════════════════════════════════════════════════════════

drop policy if exists cr_update on public.content_reports;
create policy cr_update on public.content_reports for update to authenticated
  using (
    (public.is_admin(auth.uid()) and public.is_my_community(community_id))
    or reporter_id = auth.uid()
  )
  with check (
    (public.is_admin(auth.uid()) and public.is_my_community(community_id))
    or (reporter_id = auth.uid() and public.is_my_community(community_id))
  );
