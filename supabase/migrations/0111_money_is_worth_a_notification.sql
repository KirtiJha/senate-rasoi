-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0111: money is worth a notification, and a court due
-- can only be settled by the person owed
-- Run AFTER 0001–0110. Safe to re-run.
--
-- Three things, all in the same tile.
--
-- 1. `payments` writes a bell row and never pushes. Every other event in this
--    app — a comment, a poll, a ride — gets `notify_user`; the one that says
--    "your neighbour just sent you ₹250" does not. And cancelling a recorded
--    payment told the payee nothing at all, so their bell still reads "X paid
--    you" for a record that no longer exists.
--
-- 2. `court_payments` has no notification of any kind, in either direction.
--    Somebody marks your ₹200 share settled and you never learn.
--
-- 3. `cp_update` allows the payer OR the payee to update the row, with no
--    WITH CHECK. `court_payment_mark_paid` carefully restricts confirmation to
--    the payee — and then the policy leaves the front door open, so a payer
--    can declare their own due paid, or edit the amount after the fact. A
--    WITH CHECK cannot see the OLD row, so this needs a trigger.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. neighbour payments ────────────────────────────────────────────
create or replace function public.on_payment_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_payer text;
  v_body  text;
begin
  select coalesce(name, 'Someone') into v_payer from public.profiles where id = NEW.payer_id;
  v_body := coalesce(NEW.note, 'Tap to confirm you received it');
  perform public.notify_user(
    NEW.payee_id,
    v_payer || ' paid you ₹' || trim(to_char(NEW.amount, 'FM999999990.00')),
    v_body, '/payments');
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (NEW.community_id, 'payment', NEW.id, NEW.payer_id, NEW.payee_id,
          v_payer || ' paid you ₹' || trim(to_char(NEW.amount, 'FM999999990.00')),
          v_body, '/payments');
  return NEW;
end; $fn$;

create or replace function public.payment_mark_received(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare v_payer uuid; v_amount numeric; v_community uuid; v_payee text; v_title text;
begin
  update public.payments set status = 'received', received_at = now()
    where id = p_id and payee_id = auth.uid() and status = 'initiated'
    returning payer_id, amount, community_id into v_payer, v_amount, v_community;
  if not found then return false; end if;
  select coalesce(name, 'Someone') into v_payee from public.profiles where id = auth.uid();
  v_title := v_payee || ' confirmed receiving ₹' || trim(to_char(v_amount, 'FM999999990.00'));
  perform public.notify_user(v_payer, v_title, 'Payment confirmed', '/payments');
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_community, 'payment', p_id, auth.uid(), v_payer, v_title, 'Payment confirmed', '/payments');
  return true;
end; $fn$;

-- Withdrawing a record is news to the person who was told they had been paid.
create or replace function public.payment_cancel(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare v_payee uuid; v_amount numeric; v_community uuid; v_payer text; v_title text;
begin
  update public.payments set status = 'cancelled'
    where id = p_id and payer_id = auth.uid() and status = 'initiated'
    returning payee_id, amount, community_id into v_payee, v_amount, v_community;
  if not found then return false; end if;
  select coalesce(name, 'Someone') into v_payer from public.profiles where id = auth.uid();
  v_title := v_payer || ' withdrew a ₹' || trim(to_char(v_amount, 'FM999999990.00')) || ' payment record';
  perform public.notify_user(v_payee, v_title, 'It is no longer on your payments list', '/payments');
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_community, 'payment', p_id, auth.uid(), v_payee, v_title,
          'It is no longer on your payments list', '/payments');
  return true;
end; $fn$;

-- ── 2. court dues get the same treatment ─────────────────────────────
create or replace function public.on_court_payment_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $fn$
declare v_payer text; v_title text;
begin
  if NEW.payee_user_id is null or NEW.payer_user_id = NEW.payee_user_id then
    return NEW;
  end if;
  select coalesce(name, 'Someone') into v_payer from public.profiles where id = NEW.payer_user_id;
  v_title := v_payer || ' paid their ₹' || trim(to_char(NEW.amount, 'FM999999990.00')) || ' court share';
  perform public.notify_user(NEW.payee_user_id, v_title, 'Tap to confirm you received it', '/payments');
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (NEW.community_id, 'payment', NEW.id, NEW.payer_user_id, NEW.payee_user_id,
          v_title, 'Tap to confirm you received it', '/payments');
  return NEW;
end; $fn$;

drop trigger if exists trg_court_payment_notify on public.court_payments;
create trigger trg_court_payment_notify
  after insert on public.court_payments
  for each row execute function public.on_court_payment_notify();

create or replace function public.court_payment_mark_paid(p_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare v_payer uuid; v_amount numeric; v_comm uuid; v_payee text; v_title text;
begin
  update public.court_payments
    set status = 'paid', paid_at = now()
    where id = p_id and payee_user_id = auth.uid() and status <> 'cancelled'
    returning payer_user_id, amount, community_id into v_payer, v_amount, v_comm;
  if not found then return false; end if;
  select coalesce(name, 'Someone') into v_payee from public.profiles where id = auth.uid();
  v_title := v_payee || ' confirmed your ₹' || trim(to_char(v_amount, 'FM999999990.00')) || ' court share';
  perform public.notify_user(v_payer, v_title, 'Settled', '/payments');
  insert into public.notifications (community_id, type, entity_id, actor_id, target_user_id, title, body, route)
  values (v_comm, 'payment', p_id, auth.uid(), v_payer, v_title, 'Settled', '/payments');
  return true;
end; $fn$;

-- ── 3. who may change a court due, and to what ───────────────────────
create or replace function public.guard_court_payment_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid := auth.uid();
begin
  -- Server-side work (cron, service role, the settle-up RPC) has no auth.uid();
  -- this guards a member's own UPDATE, not the system's.
  if v_uid is null or public.is_admin(v_uid) then
    return NEW;
  end if;

  -- Who the due is between never changes. payDues upserts on
  -- (session_id, payer_user_id), so a re-recorded payment is an UPDATE and
  -- the amount is allowed to move while nothing has been confirmed yet.
  if NEW.payer_user_id is distinct from OLD.payer_user_id
     or NEW.payee_user_id is distinct from OLD.payee_user_id
     or NEW.session_id is distinct from OLD.session_id then
    raise exception 'A court due cannot be moved to different people'
      using errcode = 'check_violation';
  end if;

  -- Once the person owed has said the money arrived, the row is history.
  if OLD.status = 'paid' then
    if NEW.amount is distinct from OLD.amount then
      raise exception 'A settled court due cannot be re-priced'
        using errcode = 'check_violation';
    end if;
    if NEW.status is distinct from OLD.status and v_uid <> OLD.payee_user_id then
      raise exception 'Only the person being paid can undo a settled court due'
        using errcode = 'check_violation';
    end if;
  end if;

  if NEW.status is distinct from OLD.status then
    -- Only the person owed can say the money arrived. The RPC has always
    -- enforced this; the table policy did not, so a payer could declare
    -- themselves settled with a plain update.
    if NEW.status = 'paid' and v_uid <> OLD.payee_user_id then
      raise exception 'Only the person being paid can mark a court due as settled'
        using errcode = 'check_violation';
    end if;
    if NEW.status = 'cancelled' and v_uid <> OLD.payer_user_id and v_uid <> OLD.payee_user_id then
      raise exception 'Only the payer or the payee can cancel a court due'
        using errcode = 'check_violation';
    end if;
  end if;

  return NEW;
end; $fn$;

drop trigger if exists trg_guard_court_payment_update on public.court_payments;
create trigger trg_guard_court_payment_update
  before update on public.court_payments
  for each row execute function public.guard_court_payment_update();

-- ── 4. repair payments recorded against the dish, not the order ──────
--
-- The dish page recorded `context_id = dish.id` while the Orders tab recorded
-- the order id, and `fetchOrderPayments` only ever looked up order ids. So a
-- payment made from the dish page never showed as paid on either side: the
-- buyer kept seeing "Pay" and the cook kept seeing an unpaid plate.
--
-- Only rows where the payer has exactly ONE order on that dish can be
-- re-pointed without guessing. The rest keep the dish id and stay visible in
-- the ledger, where they always were.
update public.payments p
   set context_id = o.id
  from public.orders o
 where p.context_type = 'dish'
   and exists (select 1 from public.dishes d where d.id = p.context_id)
   and o.dish_id = p.context_id
   and o.orderer_user_id = p.payer_id
   and (select count(*) from public.orders x
         where x.dish_id = p.context_id and x.orderer_user_id = p.payer_id) = 1;
