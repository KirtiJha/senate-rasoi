-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0087: a resident speaks for their own flat
-- Run AFTER 0001–0086.
--
-- 244 flats, most of them not yet occupied. Nobody is going to sit with a list
-- and record, for every one of them, whether they are taking part and how many
-- people live there — and a committee that guesses gets it wrong in both
-- directions: a shortfall invented for an empty flat, a family of six counted
-- as two.
--
-- The two facts the resident is the authority on are exactly these: am I in,
-- and how many of us. So they may set those two columns on their own flat's
-- row, and nothing else. The amount, the status, whether the money arrived —
-- those stay with the treasurer, because a ledger anybody can edit is not a
-- ledger.
--
-- MATCHED ON DIGITS, NOT STRING EQUALITY. A profile may hold '149', 'A-149' or
-- '149 ' for what the collection calls '149'. Comparing the digits is the only
-- comparison that works across a directory nobody has ever normalised.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.flat_key(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '');
$$;

grant execute on function public.flat_key(text) to authenticated;

-- Is this row the caller's own flat, in the caller's own society?
create or replace function public.is_my_flat_contribution(p_row uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.event_contributions ec
      join public.profiles p on p.id = auth.uid()
     where ec.id = p_row
       and p.community_id = ec.community_id
       and public.flat_key(p.flat) is not null
       and public.flat_key(p.flat) = public.flat_key(ec.flat)
  );
$$;

revoke all on function public.is_my_flat_contribution(uuid) from public;
grant execute on function public.is_my_flat_contribution(uuid) to authenticated;

drop policy if exists ec_update_own on public.event_contributions;
create policy ec_update_own on public.event_contributions for update to authenticated
  using (public.is_my_flat_contribution(id))
  with check (public.is_my_flat_contribution(id));

-- The policy opens the row; this decides what may actually change in it.
-- WITH CHECK cannot see the old values, so the restriction has to live here.
create or replace function public.contribution_self_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- The treasurer and the committee may change anything, as before.
  if public.is_event_treasurer(NEW.event_id) then
    return NEW;
  end if;

  -- Everyone else is editing their own flat, and may move two things.
  NEW.flat            := OLD.flat;
  NEW.community_id    := OLD.community_id;
  NEW.event_id        := OLD.event_id;
  NEW.amount          := OLD.amount;
  NEW.status          := OLD.status;
  NEW.method          := OLD.method;
  NEW.note            := OLD.note;
  NEW.receipt_url     := OLD.receipt_url;
  NEW.recorded_by     := OLD.recorded_by;
  NEW.received_at     := OLD.received_at;
  NEW.contributor_name := OLD.contributor_name;
  NEW.contributor_user_id := OLD.contributor_user_id;

  return NEW;
end; $$;

drop trigger if exists trg_contribution_self_guard on public.event_contributions;
create trigger trg_contribution_self_guard before update on public.event_contributions
  for each row execute function public.contribution_self_guard();
