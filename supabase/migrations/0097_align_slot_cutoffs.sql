-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0097: one cut-off rule, not two
-- Run AFTER 0001–0096.
--
-- The same rule is written twice and the two disagree.
--
--   src/lib/time.ts  (a dish posted by hand)   Breakfast 9:30, Lunch 12:30,
--                                              Dinner 19:30, Snack: anytime
--   0080 slot_cutoff_at (a recurring dish)     Breakfast 7:00, Lunch 10:30,
--                                              Dinner 17:30, Snack: 10:30
--
-- Up to two and a half hours apart, and Snack goes from "order anytime" to a
-- hard 10:30 deadline purely because the dish came from a template. A chef's
-- recurring idli closes for orders hours earlier than the identical dish typed
-- out that morning, with nothing on screen saying so.
--
-- The client's times win. They are the ones residents have actually been
-- ordering against, and they are the more generous of the two — moving the
-- nightly job to match cannot close an order window somebody was relying on,
-- whereas moving the app to match the job would.
--
-- Fixing the disagreement also fixes a second bug for free: 0081 schedules the
-- lunch nudge at 10:30 IST, exactly when the old templated lunch cut-off
-- passed, so a recurring lunch could be filtered out of the very notification
-- meant to surface it. At 12:30 the nudge lands two hours clear.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.slot_cutoff_at(p_slot text, p_date date)
returns timestamptz
language sql immutable set search_path = public as $$
  select case p_slot
    -- Snack has no deadline in the app, and null here means the same thing:
    -- `order_by is null` is treated everywhere as "order any time".
    when 'Snack' then null
    else (p_date + case p_slot
      when 'Breakfast' then time '09:30'
      when 'Lunch'     then time '12:30'
      when 'Dinner'    then time '19:30'
      else                  time '12:30'
    end) at time zone 'Asia/Kolkata'
  end;
$$;
