-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0130: a society knows where it is
-- Run AFTER 0001–0129. Safe to re-run.
--
-- Nearby sorts and labels by distance. The point it measures from lived in
-- the app as a constant:
--
--   // Society centre fallback (DS-MAX Senate) so "Nearest" works even if the
--   // community row has no coordinates yet.
--   const FALLBACK_CENTER = { lat: 12.8687464, lon: 77.6345485 };
--
-- Every community row has lat/lon columns and this one's were never filled
-- in, so today every distance in the tile is measured from that constant. For
-- DS Max Senate the numbers come out right, by coincidence: it is their own
-- location. For a society in Delhi it would have said "2.3 km" about a
-- hospital eighteen hundred kilometres away, with nothing to suggest a guess.
--
-- The constant is one society's data, so it goes on that society's row and
-- out of the app. Where a society's location is unknown the tile now says so
-- rather than inventing a centre.
--
-- Also: places had an UPDATE policy with no WITH CHECK, so whoever added a
-- place could move it into another society.
-- ════════════════════════════════════════════════════════════════════

update public.communities
   set lat = 12.8687464, lon = 77.6345485
 where lat is null and lon is null
   and id = 'd836e935-4622-4289-8136-11ca73b54a39';

drop policy if exists places_update on public.places;
create policy places_update on public.places
  for update using (created_by = auth.uid() or public.is_admin_of(community_id))
  with check (
    public.is_my_community(community_id)
    and (created_by = auth.uid() or public.is_admin_of(community_id))
  );
