-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0120: a flat can say what it costs
-- Run AFTER 0001–0119. Safe to re-run.
--
-- `property_listings` carries columns for facing, balconies, parking, total
-- floors and area — and nothing at all for money. Every listing rendered the
-- same hardcoded line, "Price on request — contact the owner", and the app's
-- own contact message opened with "could you share the price and details?".
--
-- For a society board that is the wrong way round. A neighbour scrolling
-- flats wants to know whether it is eighteen thousand or thirty-five before
-- messaging anybody, and an owner should not answer the same question ten
-- times. Both columns stay optional — "on request" is a legitimate choice,
-- it just should not be the only one the app allows.
-- ════════════════════════════════════════════════════════════════════

alter table public.property_listings
  add column if not exists price   bigint,
  add column if not exists deposit bigint;

comment on column public.property_listings.price is
  'Monthly rent for a rent listing, asking price for a sale. Null means the owner chose not to say. See 0120.';
comment on column public.property_listings.deposit is
  'Security deposit, rent listings only. Null means unstated.';

alter table public.property_listings
  drop constraint if exists property_price_sane;
alter table public.property_listings
  add constraint property_price_sane
  check (
    (price is null or (price > 0 and price < 100000000000))
    and (deposit is null or (deposit >= 0 and deposit < 100000000000))
  );
