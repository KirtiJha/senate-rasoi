# 🏡 Aangan — Pilot Issue Tracker

> Living log of bugs, enhancements, and ideas surfaced during end-to-end pilot testing.
> Status legend: 🔴 Open · 🟡 In Progress · 🟢 Implemented · ⚪️ Won't Do / Deferred
> Type legend: 🐞 Bug · ✨ Enhancement · 💡 Idea/Feature

_Last updated: 16 Aug 2026 — app-store readiness audit (Android + iOS)_

---

## Summary

| Open | In Progress | Implemented | Deferred | Total |
|---|---|---|---|---|
| 3 | 0 | 24 | 0 | 27 |

> Open: **#18** (PIN-reset-by-phone — product/security decision), **#26** (UGC report/block — **blocks iOS submission**), **#27** (developer support contact — **blocks iOS submission**).
> Pending migrations: run through **0066**.

### 🚦 App Store / Play readiness at a glance

| Area | Android | iOS |
|---|---|---|
| Build config (`app.json`, `eas.json`) | ✅ | ✅ (#24) |
| Push notifications end-to-end | ✅ | ✅ (#24 — `aps-environment` now set) |
| Account deletion (Apple 5.1.1(v)) | ✅ | ✅ — Profile → Delete account (RPC in `0015`) |
| Privacy policy + Terms | ✅ | ✅ — `/legal` |
| UGC report & block (Apple 1.2) | ⚠️ policy risk | ❌ **#26 — hard blocker** |
| Published developer contact (Apple 1.2) | ⚠️ | ❌ **#27 — hard blocker** |
| Store listing assets (screenshots, copy) | ⬜ not started | ⬜ not started |

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
- **Status:** 🟢 Implemented (in #17 / migration 0057)
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

### #9 — No back option on desktop for pushed pages ✨
- **Status:** 🟢 Implemented
- **Area:** Navigation (desktop)
- **Fix:** The `ScreenHeader` back chevron was mobile-only (desktop relied on the NavRail), leaving pushed pages like Booking dues with no way back on computer. It now shows on desktop too, with the same `canGoBack()` → `backHref` fallback.

---

### #10 — Court bookings: attendance-driven dues, booker controls, manual settlement, edit booking ✨
- **Status:** 🟢 Implemented · **▶️ run migration `0051`**
- **Area:** Sports / Court bookings & dues
- **Ask:** dues by who's actually in (not by time); booker can edit a booking (re-notify + re-confirm); booker can mark anyone in/out so they never lose their share; RSVP locks shortly after start; manual "paid / received" when UPI isn't used; notifications + status stay in sync.
- **Implemented:**
  1. **Attendance-driven dues** — the split is now `charge ÷ confirmed players`, shown the moment someone confirms (no time gate) and recalculated live as people change. _(migration in `0051`; client gate removed.)_
  2. **RSVP lock** — members can't change their own in/out **15 min after start** (`rsvpLocked`); the card shows their locked status and points them to the booker.
  3. **Booker "Manage players"** — `court_set_attendance()` RPC lets the booker (or admin) mark **any** member in/out **anytime** (even after the game), so attendance — and the split — reflect who really played.
  4. **Edit booking** — `court_update_booking()` RPC: the booker edits title/time/duration/charge; changes flow to **upcoming sessions**, and an "Ask everyone to re-confirm" toggle resets RSVPs + **notifies the group**.
  5. **Manual settlement** — payer can "mark paid" without UPI; booker can **"Mark paid"** a due directly (`court_booker_settle()`, e.g. cash) or **undo** a settlement (reverts to owed). Two-step (payer→initiated, booker→received) still works.
  6. **Sync** — booking-update notifications via the RPC; dues + group views already refresh in realtime (#2/#4).

---

### #11 — Payments screen missed whole categories (e.g. sports dues) 🐞
- **Status:** 🟢 Implemented
- **Area:** Payments
- **Root cause:** `/payments` read only the neighbour-ledger `payments` table (dish/tiffin/listing). **Badminton/court dues live in a separate `court_payments` table** (migration 0043), so they never appeared — making it look like it only showed "cooking" payments.
- **Fix:** `fetchMyPayments` now also reads `court_payments` (RLS-scoped to payer/payee), maps them into the common row shape (court `paid` → `received`, labelled "🏸 … (Sports dues)") and merges + sorts everything by date. Realtime watches both tables. Court rows can now also be **acted on here** (payee "Received" → court RPC; payer can undo) as well as in Booking dues; no duplicate/incorrect action path. There's no duplicate/incorrect action path. Client-only — no migration.

---

### #12 — Opening a DM (Message from a resident) throws a realtime error 🐞
- **Status:** 🟢 Implemented
- **Area:** Messaging / Directory
- **Symptom:** `Uncaught Error: cannot add 'postgres_changes' callbacks for realtime:dm-… after subscribe()` when opening a chat.
- **Root cause:** The thread screen's subscribe effect depends on `[threadId, userId]`; `userId` flips from `undefined` → set as auth loads, so `subscribeToThread` runs twice in quick succession with the **same channel topic** (`dm-{threadId}`). The first channel's async removal hasn't finished, so supabase-js hands back the existing, already-subscribed channel and `.on()` throws.
- **Fix:** Each subscription now uses a **unique channel topic** (`dm-{threadId}-{seq}`), so a fresh, unsubscribed channel is always created (thread + inbox).

---

### #13 — Add a Message icon to directory rows ✨
- **Status:** 🟢 Implemented
- **Area:** Directory
- **Fix:** Onboarded residents now show a **chat icon** in the row actions, between Call and WhatsApp, to DM without opening the detail sheet first.

---

### #14 — Sign-up: if the number already has an account, prompt Sign in ✨
- **Status:** 🟢 Implemented · **▶️ run migration `0056`**
- **Area:** Auth / Sign-up
- **Ask:** already-onboarded → ask them to sign in; in roster but not onboarded → autofill + continue.
- **Fix:** `find_resident_by_phone` (migration 0056) now also checks `profiles` and returns `already_onboarded`. Sign-up shows an amber **"… already has an account → Sign in instead"** banner (switches to sign-in, keeps the phone) for onboarded numbers, and the green autofill banner only for roster-but-not-onboarded numbers.

---

### #15 — Some delete/remove actions skipped the confirmation modal 🐞
- **Status:** 🟢 Implemented
- **Area:** App-wide
- **Found:** Auditing all delete/remove paths (incl. mobile-added code), these deleted **without** a confirm modal: sport **tournament**, recommendation **answer**, **poll**, **feed post** + **comment**, **listing-chat** + **property-chat** messages, **tiffin** plan, and document **share-revoke**.
- **Fix:** All now go through the themed `useConfirm()` dialog before deleting (added the hook to polls/feed/ListingChat/PropertyChat). The mobile-built captain-management (remove member, transfer captaincy, delete group/tournament) and dish-detail delete already confirmed.

---

### #16 — Realtime "after subscribe()" crash on navigating to Sports (and class-wide) 🐞
- **Status:** 🟢 Implemented
- **Area:** Realtime (app-wide)
- **Symptom:** `Uncaught Error: cannot add postgres_changes callbacks for realtime:court-… after subscribe()` when opening Sports; a refresh "fixes" it.
- **Root cause:** supabase-js returns an **existing** channel when one with the same topic already exists. When a subscribe effect re-runs (its deps change as auth/data settle) before the prior channel's async removal finishes, the second `supabase.channel('same-topic')` hands back an already-subscribed channel and `.on()` throws. Same root cause as #12 (DM) — but **every** fixed-topic channel was vulnerable (court, posts, polls, properties, listings, orders, payments, notifications…).
- **Fix:** Patched it at the source in `lib/supabase.ts` — `supabase.channel()` now appends a process-unique suffix to every topic, so a fresh, unsubscribed channel is always created. Topic names are cosmetic for `postgres_changes` (the filter is in the `.on()` config), so it's safe and fixes the whole class in one place (supersedes the per-file DM fix).

---

### #17 — Final end-to-end audit (Auth + Home Food + Badminton): fixes 🐞✨
- **Status:** 🟢 Implemented · **▶️ run migration `0057`**
- A 3-way parallel code review of the Auth, Home Food and Sports flows. Fixed:
  - **PIN reset was completely broken** (Critical): `self_reset_pin` / `admin_reset_user_pin` set `search_path = public`, but `crypt`/`gen_salt` live in the `extensions` schema → "function gen_salt does not exist". `0057` adds `extensions` to both. (Closes the 0053/0054 feature.)
  - **Captain controls silently failed** (Moderate): the UI shows Edit/Delete-group + tournament controls to captains, but `sport_groups` / `sport_tournaments` RLS only allowed owner/admin. `0057` extends `sg_update`/`sg_delete`/`st_write` to `is_group_captain`.
  - **Orders had no in-app notification** (was #5): `on_order_change` only sent an Expo push (dead on web). `0057` also inserts a `notifications` row (new `order` type + bell icon) for the chef on a new order and the buyer on each status change.
  - **Sports split could short the booker** (Critical): per-head used `round2` (₹400/3 → 3×₹133.33 = ₹399.99). Now `Math.ceil` everywhere (booker absorbs the rounding remainder) — consistent across optimistic UI, session card, and dues.
  - **Sign-up didn't block a known account**: `submit()` now stops + switches to sign-in when `alreadyOnboarded` (the banner is no longer only advisory).
  - **Manage-players** now lists group members **plus** anyone who already responded (so a confirmed player who left the group can still be marked out and not skew the split).
  - Booking-sheet copy updated to match the attendance-driven (live) split.

---

### #18 — Security: PIN can be reset by phone number alone (account takeover) 🐞
- **Status:** 🔴 Open (needs a product decision)
- **Area:** Auth / Forgot-PIN
- **Risk:** `self_reset_pin` is `anon`-callable and verifies identity **only by phone number** (no OTP/SMS) — and phone numbers are openly shared within a society. Anyone who knows a resident's number can set their PIN and sign in as them. The 0054 migration header explicitly accepts this trade-off; flagging it as a real (not theoretical) takeover vector.
- **Options:** (a) gate behind an SMS/email OTP (needs a provider), (b) require the current PIN to change it and make "forgot PIN" an **admin-only** temp-PIN reset (already built via `admin_reset_user_pin`), (c) accept for the trusted-society pilot and document it. Recommend (b) for launch.

---

### #19 — Lost & Found 💡
- **Status:** 🟢 Implemented · **▶️ run migration `0065`**
- **Area:** Lost & Found (new feature)
- **Ask:** a way for residents to report something they've lost, or something they've found in a common area, so it gets back to its owner.
- **Implemented:** new `lost_found_items` table (kind `lost`/`found`, status `open`/`resolved`, photo, category, WhatsApp) with owner-or-admin RLS. Three screens — list `/lost-found` (Lost/Found tabs, "My posts" filter, realtime), form `/lost-found/new?kind=…`, detail `/lost-found/[id]` (owner edit sheet, status toggle, "I think I saw it!" / "Is this mine?" WhatsApp CTA, graceful removed-screen). Surfaced on the Home tile grid with an open-item count badge, in the **Just listed** strip, in **All listings** behind 🔍 Lost / 📦 Found chips, and in the notification bell via a community-broadcast trigger.

---

### #20 — Most notifications never reached a closed app ✨
- **Status:** 🟢 Implemented · **▶️ run migration `0066`**
- **Area:** Notifications (app-wide)
- **Root cause:** only orders (0057), DMs (0023) and listing inquiries (0011/0021) fired a real Expo push. Every other event type wrote an in-app `notifications` row for the bell but sent **no push**, so with the app closed the user learned nothing.
- **Fix:** one trigger on `notifications` fans a push for **every** row — targeted rows (`target_user_id` set) push that user; broadcast rows push all community members except the actor. Batched ≤100/request per Expo's limit via the `pg_net` pipeline from 0005. Skips `order`/`message` (already pushed by their own triggers) and broadcast `post` (routine feed chatter) to avoid double-push. Because it keys off the table and not the type, **all future event types are covered automatically** — Lost & Found included.

---

### #21 — Android build & release path ✨
- **Status:** 🟢 Implemented
- **Area:** Release engineering
- **Implemented:** EAS project linked (`extra.eas.projectId`), Firebase `google-services.json` for FCM, `apk` profile for free link/QR distribution plus a `production` AAB profile for Play, `expo-updates` + EAS Update URL for OTA JS updates, and a full runbook at `docs/ANDROID_RELEASE.md`.

---

### #22 — Home Food liability disclaimers ✨
- **Status:** 🟢 Implemented
- **Area:** Food
- **Implemented:** a `FoodDisclaimer` component on the Home Food board, plus a liability note at order and subscribe confirmation — home kitchens aren't licensed food businesses and buyers should know that.

---

### #23 — Dead `lost_found` branch broke the typecheck 🐞
- **Status:** 🟢 Implemented
- **Area:** All listings
- **Root cause:** `contactItem` already handled `lost_found` with an early return, so a later `else if (i.kind === 'lost_found')` was unreachable and narrowed `i.raw` to `never` — 2 `tsc` errors. Introduced when the guard and the branch were added in separate edits without re-reading the whole function.
- **Fix:** removed the dead branch. `tsc --noEmit` is clean.

---

### #24 — Store readiness: native config gaps 🐞✨
- **Status:** 🟢 Implemented
- **Area:** `app.json` / `eas.json` · _found during the app-store readiness audit_
- **Findings & fixes** (each verified against the installed package source for the pinned SDK 56 versions, not from memory):
  1. **`expo-notifications` was missing from `plugins`** — the package was installed and used, but its config plugin never ran. On iOS that plugin is what writes the **`aps-environment` entitlement**; without it a store build has no push entitlement. Added with `mode: "production"` (the plugin defaults to `development`, which would break push on TestFlight/App Store builds), plus brand `color` and `defaultChannel`. _Android `POST_NOTIFICATIONS` was already fine — expo-notifications autolinks it in its own manifest._
  2. **Play-hostile storage permissions** — `app.json` redeclared `READ_/WRITE_EXTERNAL_STORAGE` **unscoped**, broadening the properly-scoped `maxSdkVersion="32"` versions that `expo-image-picker` already ships. Unscoped `WRITE_EXTERNAL_STORAGE` triggers Play Console's sensitive-permission review. Removed ours; the library's correctly-scoped ones survive the manifest merge.
  3. **Phantom microphone permission** — `expo-image-picker` injects `RECORD_AUDIO` (and `NSMicrophoneUsageDescription`) for video capture, but every `launchImageLibraryAsync` call in the app passes `mediaTypes: ['images']`; we never record. Set `microphonePermission: false`, which strips both. Verified gone from the resolved config.
  4. **Unused contacts permission** — `NSContactsUsageDescription` was declared but `expo-contacts` isn't a dependency and nothing reads device contacts (the "contacts" in the app are DB rows: emergency contacts, service directory). Removed, so App Review has one less thing to query.
  5. **Export-compliance prompt** — added `ITSAppUsesNonExemptEncryption: false`, which otherwise has to be answered by hand on **every** TestFlight/App Store upload.
  6. **No iOS submit config** — `eas.json` had `submit.production.android` only. Added an `ios` block (`appleId` / `ascAppId` / `appleTeamId` placeholders to fill once the App Store Connect record exists).

---

### #25 — Force-update banner was a dead end on mobile 🐞
- **Status:** 🟢 Implemented
- **Area:** Home / update banner
- **Root cause:** the banner's only action, "Refresh now", was wrapped in `Platform.OS === 'web'`, and the "Dismiss" button is deliberately hidden when `force_update` is set. On a native build a forced update therefore rendered a red **"Update required"** card with **no button at all** — an unresolvable dead end.
- **Fix:** native now shows **"Update now"**, which calls `Updates.fetchUpdateAsync()` and reloads into the new bundle. A version that also changed native code can't ship over the air, so `isNew === false` (and `Updates.isEnabled === false` in dev) falls back to "Please update Aangan from the app store".

---

### #26 — No way for a member to report or block another member 🐞
- **Status:** 🔴 Open · **blocks iOS submission**
- **Area:** Safety / moderation (app-wide)
- **Risk:** **Apple App Store Guideline 1.2 (Safety — User-Generated Content)** requires apps with UGC to ship *all four* of: a content filter, a mechanism to **report** offensive content, the ability to **block abusive users**, and published developer contact info (see #27). Aangan is full of UGC — feed posts and comments, listings, dishes, recommendations, borrow, Lost & Found, and 1:1 DMs — but there is **no report and no block affordance anywhere**. The Terms already forbid abusive content and say admins may moderate, but a policy sentence is not a mechanism; App Review tests for the buttons. Google Play's UGC policy expects the same, though it's enforced less strictly at review time.
- **Scope (proposed):** a `content_reports` table (reporter, target type + id, reason, status) and a `user_blocks` table; a "Report" and "Block" action on posts/comments/listings/DMs/profiles; filtering blocked users' content out of the feeds; and an admin review queue on `/admin`.
- **⚠️ Needs a product decision first:** how far a block reaches — hide their feed posts and comments only, or also their listings, dishes and directory row? Mutual (neither sees the other) or one-way? That choice changes the query shape in most list screens, so it should be settled before implementation.

---

### #27 — No published developer contact 🐞
- **Status:** 🔴 Open · **blocks iOS submission**
- **Area:** Legal / support
- **Risk:** the same Guideline 1.2 requires **published developer contact info** so users can reach a human about abuse, and App Store Connect separately requires a **Support URL** on the listing. Right now there is no support email anywhere in `src/` — the Privacy Policy's only escalation path is "contact your society admin through the app", which is not a route to the developer.
- **Fix (small):** add a support email to the Terms/Privacy "Changes & contact" sections and surface it on `/about`, then use the same address as the App Store Connect Support URL / contact.

---

## End-to-end review notes (Home Food + Badminton)

**Verified working in code:** dish posting (now resilient to photo failures); order placement → **chef push on new order** + **buyer push on status change** (0005, title fixed in #3); Kitchen & Orders screens have **realtime**; badminton group create / booking → **member push** (0043) → RSVP (fixed in #2) → session-end **client-side cost split** → **UPI dues** (pay → initiated → booker confirms → paid) with the dues screen now **live** (#4).

**Minor / deferred (logged, fine for pilot):** `subscribeToOrders` is a whole-table subscription (re-fetch is RLS-scoped, so safe; a perf nicety only). Sports booking notification excludes the booker (by design — they auto-confirm).

---

## Changelog
- **16 Aug 2026** — App-store readiness audit for Android + iOS. Logged #19–#23 (the Jun 17–22 work: Lost & Found, push-for-everything, Android release path, food disclaimers, tsc fix). Fixed #24 (native config: notifications plugin + `aps-environment`, Play-hostile storage perms, phantom `RECORD_AUDIO`, unused contacts perm, export-compliance flag, iOS submit block) and #25 (force-update dead end on native). Logged **#26** (UGC report/block) and **#27** (developer contact) as **hard iOS submission blockers**.
- **12 Jun 2026 (late)** — #12 DM realtime crash fixed (unique channel topic); #13 message icon on directory rows; #11 court payments now actionable on the Payments screen too.
- **12 Jun 2026 (night)** — #9 desktop back control; #10 court overhaul — attendance-driven dues, RSVP lock, booker manage-players + edit-booking, manual settlement (migration 0051).
- **12 Jun 2026 (later)** — #1 root cause confirmed (no Storage RLS policies → 403); fixed via migration 0050 (photo bucket policies + public). Now 🟢.
- **12 Jun 2026** — Logged + fixed #6 (back-on-refresh fallback), #7 (dues blank — now live at game start, not only after end), #8 (booking form tap selectors for time/duration/date/weeks).
- **11 Jun 2026 (later)** — Reviewed Home Food + Badminton end-to-end. #2 fixed (realtime + toast + optimistic RSVP + clearer control); #1 hardened (photo non-fatal + real errors, needs bucket verified). Logged + fixed #3 (order-notify rebrand, migration 0049) and #4 (dues screen realtime). Logged #5 (in-app order notifications, deferred).
- **11 Jun 2026** — Tracker created. Logged issues #1 and #2.
