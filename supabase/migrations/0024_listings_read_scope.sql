-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0024: scope listings reads to the user's community
-- Run AFTER 0001–0023.
--
-- Security fix: `listings_read` was `auth.role() = 'authenticated'`, letting
-- ANY signed-in user read EVERY society's listings (cross-society leak). This
-- tightens it to match the posts / listing_messages pattern — a member can
-- only read listings in their own community. Feeds/search already filter by
-- community_id at query level; this enforces it at the row level too.
-- ════════════════════════════════════════════════════════════════════

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.community_id = listings.community_id
    )
  );
