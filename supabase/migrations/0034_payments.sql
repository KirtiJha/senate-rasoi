-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0034: UPI payment ledger
-- Run AFTER 0001–0033.
--
-- A lightweight payment record on top of UPI deep links. The app never touches
-- money — neighbours pay neighbour-to-neighbour via their UPI app. We only
-- RECORD that a payment was initiated, and let the receiver confirm it:
--   payer taps "Pay" → opens UPI app → "I've paid" creates a row (initiated)
--   payee taps "Mark received" → status 'received'  (both sides see it)
-- Each step fires a targeted notification to the other party.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.payments (
  id            uuid          primary key default gen_random_uuid(),
  community_id  uuid          not null references public.communities(id) on delete cascade,
  payer_id      uuid          not null references public.profiles(id) on delete cascade,
  payee_id      uuid          not null references public.profiles(id) on delete cascade,
  amount        numeric(10,2) not null check (amount > 0),
  note          text,
  context_type  text,         -- 'dish' | 'tiffin' | 'listing' | 'other'
  context_id    uuid,
  upi_id        text,
  status        text          not null default 'initiated' check (status in ('initiated','received','cancelled')),
  created_at    timestamptz   not null default now(),
  received_at   timestamptz
);
create index if not exists payments_payer_idx on public.payments (payer_id, created_at desc);
create index if not exists payments_payee_idx on public.payments (payee_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.payments enable row level security;

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (payer_id = auth.uid() or payee_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert
  with check (payer_id = auth.uid() and public.is_my_community(community_id));
-- No update/delete policy: status transitions go through the RPCs below.

-- ── Status transitions (SECURITY DEFINER) ───────────────────────────
create or replace function public.payment_mark_received(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_payer uuid; v_amount numeric; v_community uuid; v_payee text;
begin
  update public.payments set status = 'received', received_at = now()
    where id = p_id and payee_id = auth.uid() and status = 'initiated'
    returning payer_id, amount, community_id into v_payer, v_amount, v_community;
  if not found then return false; end if;
  select coalesce(name, 'Someone') into v_payee from public.profiles where id = auth.uid();
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_community, 'payment', p_id, auth.uid(), v_payer,
          v_payee || ' confirmed receiving ₹' || trim(to_char(v_amount, 'FM999999990.00')),
          'Payment confirmed', '/payments');
  return true;
end; $$;
grant execute on function public.payment_mark_received(uuid) to authenticated;

create or replace function public.payment_cancel(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.payments set status = 'cancelled'
    where id = p_id and payer_id = auth.uid() and status = 'initiated';
  return found;
end; $$;
grant execute on function public.payment_cancel(uuid) to authenticated;

-- ── Notify the payee when a payment is initiated ────────────────────
create or replace function public.on_payment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_payer text;
begin
  select coalesce(name, 'Someone') into v_payer from public.profiles where id = NEW.payer_id;
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (NEW.community_id, 'payment', NEW.id, NEW.payer_id, NEW.payee_id,
          v_payer || ' paid you ₹' || trim(to_char(NEW.amount, 'FM999999990.00')),
          coalesce(NEW.note, 'Tap to confirm you received it'), '/payments');
  return NEW;
end; $$;
drop trigger if exists trg_payment_notify on public.payments;
create trigger trg_payment_notify after insert on public.payments
  for each row execute function public.on_payment_notify();

-- payments → realtime so both sides see status changes live
alter publication supabase_realtime add table public.payments;
