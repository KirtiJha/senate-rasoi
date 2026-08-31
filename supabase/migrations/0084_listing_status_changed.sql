-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0084: when a listing changed status
-- Run AFTER 0001–0083.
--
-- Marking something sold made it vanish from Buy & Sell entirely: every browse
-- query filtered `status = 'active'`. That is wrong twice over. The buyer who
-- was mid-conversation loses the thing they were discussing, and the board
-- loses the only evidence it works — a marketplace where nothing is ever seen
-- to sell looks like a marketplace where nothing sells.
--
-- So sold items stay on the board, marked sold, ranked below what is still
-- available. But not forever: a year of sold sofas is a graveyard, not a
-- marketplace.
--
-- Aging them out needs to know WHEN something sold, and nothing recorded that.
-- `bump_at` is when the listing was last bumped, which for a flat listed in
-- June and sold in August is June — so aging on bump_at would hide the sale
-- the moment it happened. Hence a column of its own.
-- ════════════════════════════════════════════════════════════════════

alter table public.listings
  add column if not exists status_changed_at timestamptz;

-- Existing rows get their best available approximation. Sold items already on
-- the board will age out from this migration's date rather than their real
-- sale date, which is the most honest guess available and self-corrects as
-- soon as anything changes status again.
update public.listings
   set status_changed_at = coalesce(status_changed_at, greatest(bump_at, created_at))
 where status_changed_at is null;

alter table public.listings
  alter column status_changed_at set default now();

create index if not exists listings_status_changed_idx
  on public.listings (community_id, status, status_changed_at desc);

-- Maintained by the database rather than the client: the status can change
-- from an RPC, an admin action or an expiry sweep, and a timestamp only some
-- of those remember to set is worse than none.
create or replace function public.listing_status_touch() returns trigger
  language plpgsql set search_path = public as $$
begin
  if NEW.status is distinct from OLD.status then
    NEW.status_changed_at := now();
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_listing_status_touch on public.listings;
create trigger trg_listing_status_touch before update on public.listings
  for each row execute function public.listing_status_touch();
