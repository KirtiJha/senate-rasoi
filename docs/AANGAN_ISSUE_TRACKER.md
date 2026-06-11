# 🏡 Aangan — Pilot Issue Tracker

> Living log of bugs, enhancements, and ideas surfaced during end-to-end pilot testing.
> Status legend: 🔴 Open · 🟡 In Progress · 🟢 Implemented · ⚪️ Won't Do / Deferred
> Type legend: 🐞 Bug · ✨ Enhancement · 💡 Idea/Feature

_Last updated: 11 Jun 2026, 11:30 PM IST_

---

## Summary

| Open | In Progress | Implemented | Deferred | Total |
|---|---|---|---|---|
| 1 | 1 | 3 | 0 | 5 |

---

## Issues

### #1 — Photo upload fails when posting home food 🐞
- **Status:** 🟡 In Progress (code hardened — needs Storage bucket verified)
- **Area:** Food / Post a dish
- **Reported:** 11 Jun 2026
- **Description:** Adding a photo while posting home food shows a "connection problem" error.
- **Root cause:** `uploadDishPhoto` is byte-for-byte identical to the working `uploadListingPhoto` / `uploadPropertyPhoto`, so this is **not a code bug** — it's almost certainly the **`dish-photos` Storage bucket** not being set up the way `listing-photos` is (missing bucket, or no `INSERT` policy for `authenticated`). Two code problems made it worse: (a) a photo failure **blocked the whole dish post**, and (b) the catch showed a generic "check your connection" that **hid the real error**.
- **Fix (code, done):** Photo upload is now **best-effort** — `postDish` posts the dish even if the image fails (logs the real error), and `post.tsx` warns *"Dish posted ✅ — but the photo could not upload"* instead of blocking. Other (non-photo) failures now surface the **actual error message** so the cause is visible.
- **⚠️ ACTION REQUIRED (dashboard):** In Supabase → Storage, confirm a **public** bucket named **`dish-photos`** exists with an `INSERT` policy `to authenticated` (mirror `listing-photos`). See `docs/LAUNCH_CHECKLIST.md`. After that, re-test — the photo should attach; if not, the post now shows the precise error.

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

## End-to-end review notes (Home Food + Badminton)

**Verified working in code:** dish posting (now resilient to photo failures); order placement → **chef push on new order** + **buyer push on status change** (0005, title fixed in #3); Kitchen & Orders screens have **realtime**; badminton group create / booking → **member push** (0043) → RSVP (fixed in #2) → session-end **client-side cost split** → **UPI dues** (pay → initiated → booker confirms → paid) with the dues screen now **live** (#4).

**Minor / deferred (logged, fine for pilot):** `subscribeToOrders` is a whole-table subscription (re-fetch is RLS-scoped, so safe; a perf nicety only). Sports booking notification excludes the booker (by design — they auto-confirm).

---

## Changelog
- **11 Jun 2026 (later)** — Reviewed Home Food + Badminton end-to-end. #2 fixed (realtime + toast + optimistic RSVP + clearer control); #1 hardened (photo non-fatal + real errors, needs bucket verified). Logged + fixed #3 (order-notify rebrand, migration 0049) and #4 (dues screen realtime). Logged #5 (in-app order notifications, deferred).
- **11 Jun 2026** — Tracker created. Logged issues #1 and #2.
