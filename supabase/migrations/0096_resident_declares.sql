-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0096: a resident can say "not this time" first
-- Run AFTER 0001–0095.
--
-- 0087/0088/0095 let a resident set opted_out and head_count on their own
-- flat's contribution row. That only helps if a row exists — and since the
-- collection is now driven by hand, entered as each neighbour pays, most flats
-- have no row at all until they have already paid. The people most worth
-- hearing from early are exactly the ones who are not going to.
--
-- So a resident may create their own row, for their own flat, in one shape
-- only: opted out, owing nothing. Everything else about a contribution — the
-- amount, whether money arrived, how it was paid — stays the treasurer's.
-- ════════════════════════════════════════════════════════════════════

drop policy if exists ec_insert_own on public.event_contributions;
create policy ec_insert_own on public.event_contributions for insert to authenticated
  with check (
    public.is_my_community(community_id)
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and public.flat_key(p.flat) is not null
         and public.flat_key(p.flat) = public.flat_key(event_contributions.flat)
    )
  );

-- The policy decides whose flat; this decides what the row may say. A resident
-- declaring themselves out must not be able to invent a paid contribution.
create or replace function public.guard_resident_declared_row() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return NEW;
  end if;
  if public.is_event_treasurer(NEW.event_id) then
    return NEW;
  end if;

  -- Anyone else is a resident speaking for their own flat, and the only thing
  -- they may assert is that they are not taking part.
  NEW.opted_out   := true;
  NEW.amount      := 0;
  NEW.status      := 'pending';
  NEW.method      := null;
  NEW.received_at := null;
  NEW.receipt_url := null;
  NEW.contributor_user_id := auth.uid();
  NEW.recorded_by := auth.uid();

  return NEW;
end; $$;

drop trigger if exists trg_resident_declared_row on public.event_contributions;
create trigger trg_resident_declared_row
  before insert on public.event_contributions
  for each row execute function public.guard_resident_declared_row();
