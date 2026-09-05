-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0135: the two policies that spelled "admin" out longhand
-- Run AFTER 0001–0134. Safe to re-run.
--
-- 0129 rewrote seventy-two policies so that being an admin means being an
-- admin OF a society. It found them by looking for `is_admin(auth.uid())`.
-- Eight policies never call it — they inline the same test:
--
--   EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
--                                      AND 'admin' = ANY (p.roles))
--
-- so the sweep walked straight past them. Six of the eight also compare
-- community_id and were fine by accident of being written carefully. Two were
-- not, and both are real:
--
-- 1. society_join_requests — sjr_read_admin and sjr_update_admin have no
--    community test at all. Any admin of any society could read every request
--    ever submitted: the requester's name, phone and email, from every other
--    society. That table is a pile of contact details for strangers.
--
-- 2. post_comments.comments_delete — joins posts and profiles and never
--    relates them, so it asks "is this person an admin somewhere?" and lets
--    them delete the comment. A newer policy, comments_delete_own_or_admin,
--    does the same job correctly with `me.community_id = p.community_id`.
--    Permissive policies are OR-ed, so the loose one decided every case and
--    the careful one never mattered.
--
-- The lesson worth keeping: a security sweep that matches on the name of a
-- helper only finds the code that was polite enough to call it.
-- ════════════════════════════════════════════════════════════════════

-- The unscoped duplicate. comments_delete_own_or_admin already covers the
-- author and the admin of that post's own society.
drop policy if exists comments_delete on public.post_comments;

-- ── Retiring the join-request queue ─────────────────────────────────
-- It existed so somebody whose society was missing could ask us to add it.
-- They can now add it themselves during onboarding, in the same minute,
-- without waiting for anyone — so the queue is a path with a worse outcome at
-- the end of it, and one that leaked contact details sideways while it waited.
--
-- The table stays (rows are history); nothing in the app can reach it. RLS is
-- enabled with no policies, which denies by default.
drop policy if exists sjr_insert on public.society_join_requests;
drop policy if exists sjr_read_admin on public.society_join_requests;
drop policy if exists sjr_update_admin on public.society_join_requests;

comment on table public.society_join_requests is
  'Retired in 0135. Residents add a missing society themselves during onboarding. No client access: RLS is on with no policies.';
