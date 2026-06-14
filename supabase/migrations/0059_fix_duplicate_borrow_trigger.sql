-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0059: remove duplicate borrow-request trigger
-- Run AFTER 0058.
--
-- Migration 0037 already had on_borrow_request() / trg_borrow_request
-- that notifies the item owner when someone requests to borrow.
-- Migration 0058 accidentally added a second trigger (borrow_request_notify
-- → on_borrow_request_insert) that fires on the same event, causing
-- duplicate notifications. Drop the 0058 one; keep the 0037 original.
-- ════════════════════════════════════════════════════════════════════

drop trigger if exists borrow_request_notify on public.borrow_requests;
drop function if exists public.on_borrow_request_insert();
