-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0064: admins can edit any comment
-- Run AFTER 0063.
--
-- post_comments update was author-only; extend it to admins so the admin role
-- can edit every comment (it already could delete them). Every other editable
-- table already permits owner-or-admin updates.
-- ════════════════════════════════════════════════════════════════════

drop policy if exists comments_update on public.post_comments;
create policy comments_update on public.post_comments for update
  using (auth.uid() = author_id or public.is_admin(auth.uid()));
