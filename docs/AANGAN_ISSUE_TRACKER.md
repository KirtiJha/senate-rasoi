# 🏡 Aangan — Pilot Issue Tracker

> Living log of bugs, enhancements, and ideas surfaced during end-to-end pilot testing.
> Status legend: 🔴 Open · 🟡 In Progress · 🟢 Implemented · ⚪️ Won't Do / Deferred
> Type legend: 🐞 Bug · ✨ Enhancement · 💡 Idea/Feature

_Last updated: 12 Jun 2026, 1:00 AM IST_

---

## Summary

| Open | In Progress | Implemented | Deferred | Total |
|---|---|---|---|---|
| 1 | 0 | 7 | 0 | 8 |

---

## Issues

### #1 — Photo upload fails when posting home food 🐞
- **Status:** 🟢 Implemented
- **Area:** Food / Post a dish · Storage
- **Reported:** 11 Jun 2026
- **Root cause (confirmed):** The Storage buckets (`dish-photos`, `listing-photos`, `sport-logos`) had **no RLS policies** on `storage.objects`. Since that table has RLS **on by default**, every upload was rejected with **`403 / new row violates row-level security policy`**. The bucket's "public" flag only allows *reads* — *writes* need explicit policies. (The upload code itself is correct — identical to the working listing/property uploads.)
- **Fix:** **Migration `0050_storage_photo_policies.sql`** adds the policies — public read, broad `authenticated` insert/update (the write must be broad because dish/listing photos are uploaded *before* the owning row exists), and owner-or-admin delete via a path→table join. It also flips the buckets to public. _Code hardening from the earlier pass stays:_ a photo failure no longer blocks posting, and real errors now surface.
- **▶️ Action:** Run **`0050`** (the three buckets must already exist), then re-test a dish photo — it should attach.

---

### #2 — Badminton sports: no realtime sync + missing feedback on RSVP actions 🐞✨
- **Status:** 🟢 Implemented
- **Area:** Sports / Badminton group
- **Reported:** 11 Jun 2026
- **Root cause:** The DB was fine (realtime is published for all four court tables; RLS lets a member read their own RSVP back). The bugs were entirely **client-side in `CourtBookings`**: it **never subscribed** to realtime (so counts/statuses only refreshed on a manual reload), had **no success toast**, and relied on a re-fetch with **no optimistic update** (so the buttons felt unchanged until the round-trip finished).
- **Fix:**
  1. **Realtime** — new `subscribeGroupSessions(groupId)` subscribes to `court_session_players` / `court_sessions` / `court_bookings`; the group view now updates live as anyone responds.
  2. **Success toast** — "You're in ✓" / "Marked as can't come" on each RSVP (plus a tap haptic).
  3. **Optimistic update** — tapping flips your choice **and** the live "X in" count instantly, then reconciles with the server.
  4. **Clearer control** — the RSVP now shows a prompt ("Coming along?" / "You're in — tap to change"), a filled selected state with a circle-check/■ icon, and a busy/disabled state.

---

### #3 — Order status push notification still says "Senate Rasoi" 🐞
- **Status:** 🟢 Implemented
- **Area:** Food / Notifications · _found during end-to-end review_
- **Root cause:** `on_order_change()` (migration 0005) used the old brand name **"Senate Rasoi"** as the push title for order status updates to the buyer.
- **Fix:** Migration **`0049_order_notify_rebrand.sql`** re-creates the function with title **"Order update"** (logic unchanged). ⏳ Run 0049 in the SQL editor to apply.

---

### #4 — Dues / payment-tracking screen didn't update live 🐞
- **Status:** 🟢 Implemented
- **Area:** Sports / Dues · _found during end-to-end review_
- **Root cause:** `/sports/dues` only loaded on screen focus, so when a booker tapped **"Received"** the payer's "I owe" view (and vice-versa) wouldn't reflect it until a manual refresh.
- **Fix:** New `subscribeCourtPayments()` realtime subscription wired into the dues screen — "I owe" and "Owed to me" now refresh live as payments are initiated/confirmed.

---

### #5 — Order events don't appear in the in-app notification centre 🐞
- **Status:** 🔴 Open (low priority for pilot)
- **Area:** Food / Notifications · _found during end-to-end review_
- **Description:** New orders and order status changes fire an **Expo push** (`notify_user`, migration 0005) but **don't insert an in-app `notifications` row** (unlike posts/listings/polls/dishes). On web (where push isn't wired) a chef/buyer only sees order changes via **realtime on the Orders/Kitchen screen** — if they're elsewhere, nothing surfaces in the bell.
- **Proposed fix:** Add an in-app `notifications` insert in the order trigger (new migration) so the bell shows "New order" / "Order confirmed", consistent with other events. Deferring until the broader notifications pass.

---

### #6 — Back button stops working after a page refresh 🐞
- **Status:** 🟢 Implemented
- **Area:** Navigation (web) · e.g. Sports → Booking dues
- **Reported:** 12 Jun 2026
- **Root cause:** On web, a hard refresh of a deep route starts a fresh history stack, so `router.back()` (used by every `ScreenHeader` back chevron) had nowhere to go and silently did nothing. Navigating *within* the app built history, so back worked then.
- **Fix:** `ScreenHeader` back now does `router.canGoBack() ? back() : router.replace(backHref ?? '/')`. Added an optional `backHref` (Booking dues → `/sports`, sports group → `/sports`); everything else falls back to Home. So back always goes somewhere sensible, even after a refresh.

---

### #7 — "I owe" / "Owed to me" always blank 🐞
- **Status:** 🟢 Implemented
- **Area:** Sports / Booking dues
- **Reported:** 12 Jun 2026
- **Root cause:** `fetchMyDues` and `fetchBookerCollections` only returned sessions where **`sessionEnded`** was true — i.e. dues stayed empty until the session's *end* time (start + duration) had passed. While testing before that, both tabs were blank.
- **Fix:** Dues now go live once the **game has started** (`sessionStarted` — start time reached), not only after it ends, and only for **paid** sessions (charge > 0). The amount is `charge ÷ confirmed players`, charged to each confirmed non-booker and owed to the booker, and it updates live as people confirm/decline (per #4's realtime). So booking an 8:00 game shows the split from 8:00, finalising at the end.

---

### #8 — Court booking form requires typing date / time / duration ✨
- **Status:** 🟢 Implemented
- **Area:** Sports / Book a session
- **Reported:** 12 Jun 2026
- **Root cause:** Time (`18:00`), duration (`60`) and one-off date (`2026-06-20`) were free-text inputs — error-prone and unfriendly on mobile.
- **Fix:** Replaced with tap selectors: a **TimePicker** (hour 1–12 + minute 00/15/30/45 + AM/PM), **duration pills** (30m/45m/1h/1h 30m/2h), a **date picker** (next 14 days as Today/Tomorrow/weekday pills), and **week-count pills** (1/2/4/8/12). Sensible defaults pre-filled (6:00 PM, 1h, today) so a booking is valid in a couple of taps. Charge, venue, title and UPI stay as text.

---

## End-to-end review notes (Home Food + Badminton)

**Verified working in code:** dish posting (now resilient to photo failures); order placement → **chef push on new order** + **buyer push on status change** (0005, title fixed in #3); Kitchen & Orders screens have **realtime**; badminton group create / booking → **member push** (0043) → RSVP (fixed in #2) → session-end **client-side cost split** → **UPI dues** (pay → initiated → booker confirms → paid) with the dues screen now **live** (#4).

**Minor / deferred (logged, fine for pilot):** `subscribeToOrders` is a whole-table subscription (re-fetch is RLS-scoped, so safe; a perf nicety only). Sports booking notification excludes the booker (by design — they auto-confirm).

---

## Changelog
- **12 Jun 2026 (later)** — #1 root cause confirmed (no Storage RLS policies → 403); fixed via migration 0050 (photo bucket policies + public). Now 🟢.
- **12 Jun 2026** — Logged + fixed #6 (back-on-refresh fallback), #7 (dues blank — now live at game start, not only after end), #8 (booking form tap selectors for time/duration/date/weeks).
- **11 Jun 2026 (later)** — Reviewed Home Food + Badminton end-to-end. #2 fixed (realtime + toast + optimistic RSVP + clearer control); #1 hardened (photo non-fatal + real errors, needs bucket verified). Logged + fixed #3 (order-notify rebrand, migration 0049) and #4 (dues screen realtime). Logged #5 (in-app order notifications, deferred).
- **11 Jun 2026** — Tracker created. Logged issues #1 and #2.
