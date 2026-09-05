-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0132: a society anywhere in India
-- Run AFTER 0001–0131. Safe to re-run.
--
-- Onboarding searched OpenStreetMap with a Bengaluru bounding box and
-- `bounded=1`, which tells Nominatim to return nothing outside that rectangle.
-- A resident in Pune, Kochi or Guwahati typed their society's name, got "No
-- matches", and had no way to know the search had never looked outside one
-- city. That is fixed in the app; this is the schema half.
--
-- Once the app is national a name stops being an identity — "Green Park"
-- exists in a dozen cities. State and pincode are what a neighbour uses to
-- pick theirs out of a list, and what a second founder needs to see before
-- creating a duplicate of a society that is already here.
-- ════════════════════════════════════════════════════════════════════

alter table public.communities add column if not exists state text;
alter table public.communities add column if not exists pincode text;

comment on column public.communities.pincode is
  'Six digits, self-reported or from the map. Used to disambiguate societies of the same name.';

create index if not exists communities_city_idx on public.communities (lower(city));
create index if not exists communities_geo_idx on public.communities (lat, lon)
  where lat is not null and lon is not null;
