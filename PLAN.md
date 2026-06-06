# Senate Rasoi — End-to-End Plan

> A home-food network for one residential society. Neighbours who cook ("chefs")
> post dishes — one-off or a daily tiffin service; neighbours who eat reserve
> plates ahead of time. Chefs cook the right amount, run their little kitchen
> with real order tracking, and the community eats home food. Coordination over
> WhatsApp + UPI; no commercial-scale machinery — designed for a trusted building.
>
> **Living document.** Status is tracked inline. Update as decisions/tasks change.

---

## Status legend
- ⬜ Not started · 🔄 In progress · ✅ Done · ⏸️ Blocked/waiting on user · ❌ Dropped
- 🟡 **Proposed — needs user confirmation** (see §11)

**Last updated:** 2026-06-06 — **Phases A, B, C all built** (migrations 0001–0007).
Accounts (phone + 6-digit code) + roles (chef/foodie/admin); full order lifecycle
(accept→cooking→delivered, 5-min cancel window, capacity + cutoff); free push
(native) + tap-to-WhatsApp; future-date posts + Today/Upcoming; **tiffin service +
recurring subscriptions** (no-cron). Remaining: **Phase D** (deploy, native EAS,
offline PWA) + admin role-editor UI. App = **Senate Rasoi**, design v3 (bright +
dark, coral accent, Bricolage/Hanken, adaptive nav + *You* hub).

---

## 1. Product decisions

| Decision | Choice | Status |
|---|---|---|
| Platforms | Web + installable **PWA first**; native iOS/Android via EAS later | ✅ |
| Design | **Bright & minimal + system dark mode**, one coral accent, grotesk type | ✅ shipped |
| Ordering & payment | **WhatsApp + UPI** coordination; no in-app payments | ✅ |
| **Login** | **Phone number + a self-set 6-digit code** (no OTP, no SMS cost). Code is **hashed** (Supabase Auth email-alias). | ✅ |
| Roles | **Chef**, **Foodie** (orderer), **Admin**. Multi-role; chosen at sign-up; self-add chef/foodie; admin grants admin. | ✅ |
| Order tracking | placed → accepted/rejected → cooking → delivered, + cancellations. Chef drives status; foodie sees live updates + push. | ✅ |
| Tiffin / recurring | Chef **tiffin services**; foodies **subscribe** (= recurring). No-cron, computed per weekday. | ✅ |
| Future orders | Chefs post for **future dates**; foodies **reserve** ahead (Today/Upcoming). | ✅ |
| Capacity & window | Per-dish **max quantity** + chef-set **order cutoff**; no orders after cutoff. | ✅ |
| Cancellation | Foodie cancels **within 5 min**; after that only the **chef** (foodie taps to call/WhatsApp). Chef cancels anytime. | ✅ |
| Scope | **Single society**; `communities` table exists so multi-society is config later | ✅ |

### Superseded
- ❌ "No login for v1" / device-token ownership — replaced by real accounts (above).
  The device-token code (`owner_token_hash`, `lib/device.ts`) is legacy and will be
  reworked to `chef_user_id = auth.uid()` ownership.

---

## 2. Roles model
- **Chef** — posts dishes / tiffin plans, manages incoming orders (accept, cook, deliver), sets capacity & cutoffs.
- **Orderer** *(name TBD — e.g. Neighbour / Foodie / Diner)* — browses, reserves plates, tracks orders, subscribes to tiffins.
- **Admin** — elevated: edit any user's roles, remove any post/order, moderate. The building's organiser(s).
- Stored as a `roles text[]` (or `user_roles` table). The app shows/hides features per role; **You → My Kitchen** appears only for chefs, an **Admin** area only for admins.

---

## 3. Order lifecycle (state machine)
```
placed ──accept──▶ accepted ──start──▶ cooking ──deliver──▶ delivered   (happy path)
  │                                                          
  └──reject──▶ rejected
cancellation:
  • orderer: allowed while status=placed/accepted AND within CANCEL_WINDOW (5 min)
  • chef:    allowed anytime up to delivered
  • after the window, orderer's "Cancel" becomes "Call chef" (tap-to-call / WhatsApp)
```
- Every transition → in-app status update for the orderer **and** a notification (see §5 notifications), plus a one-tap WhatsApp link for actual chat.
- Stock is reserved at `placed`; restored on `rejected`/`cancelled`.

---

## 4. Tech stack
| Layer | Choice | Notes |
|---|---|---|
| App | **Expo + Expo Router** (SDK 56, TS) | one codebase, web/PWA now |
| UI | **NativeWind v4** + light/dark CSS-var theme | `tailwind.config.js`, `src/theme.ts` |
| Fonts | Bricolage Grotesque (display) + Hanken Grotesk (UI) | |
| Backend/DB | **Supabase** (Postgres + Realtime + Storage) | live, project `ydpqdvglkizrfwmqqysq` |
| **Auth** | 🟡 **Supabase Auth** with phone-as-email alias + 6-digit code as password (gives real sessions + RLS, no SMS). Alt: custom `users` table + hashed code + session tokens. | §11 Q |
| Notifications | 🟡 **Expo push** (free) + in-app; **auto-WhatsApp needs a paid API** (Meta/Twilio) — otherwise tap-to-WhatsApp links | §11 Q |
| Hosting | **Vercel** (web) · **EAS** (native later) | `vercel.json` ready |
| Source | **GitHub** | pending account |
| Errors/analytics | Sentry + PostHog (later) | |

---

## 5. Data model (live — migrations 0001–0007)
- **communities** — `id`, `name` *(1 row)* ✅
- **profiles** — `id`(=auth uid), `phone`, `name`, `flat`, `whatsapp`, `upi`, `roles text[]` ✅
- **dishes** — + `chef_user_id`, `serve_date`, `order_by`, `max_plates`, `plates_left` ✅ (`owner_token_hash` now legacy/nullable)
- **orders** — `dish_id`, `orderer_user_id`, `buyer_name/flat`, `qty`, `status`, `cancelled_by`, `status_updated_at` ✅
- **tiffin_plans** — `chef_user_id`, `title`, `veg_type`, `slot`, `price`, `days_of_week`, `max_per_day`, `cutoff_time`, `active` ✅
- **subscriptions** — `plan_id`, `subscriber_user_id`, `qty`, `start_date`, `end_date`, `paused` ✅ + **subscription_skips** ✅
- **push_tokens** — Expo token per user/device ✅

---

## 6. Security model
1. **Auth:** 6-digit code is a weak secret (1M combos) → must be **hashed** (bcrypt/argon2, handled by Supabase Auth if we use it) and **rate-limited / lockout** on failed sign-ins. Acceptable for a small trusted building; revisit if abused. No SMS/OTP cost.
2. **RLS keyed on `auth.uid()`** once real auth lands: chefs mutate only their dishes/orders; orderers mutate only their orders; admins via role check; everyone reads the community feed.
3. Sensitive mutations via `SECURITY DEFINER` RPCs where helpful (atomic reserve, status transitions, role edits).
4. Contact privacy: chef name/flat/whatsapp shown within the society (accepted); revisit if scope grows.
5. HTTPS; secrets in env; React escapes text (XSS-safe).

---

## 7. Roadmap & progress

### ✅ Done
- **Phase 0 — Scaffold:** Expo+Router+TS, NativeWind, PWA shell, `0001_init.sql`. Supabase project live, `.env` wired, `0001` run + verified.
- **Phase 1 — Core loop:** post → live board → order → remove; device profile; photo upload; atomic stock.
- **Design v2 → v3:** custom system; final = bright/minimal + dark, coral accent, grotesk fonts, adaptive nav (bottom tabs / desktop rail), **You** hub (orders + kitchen, chef tools appear after first post), single Post entry, haptics, share, skeletons, countdowns, veg filter.
- **Order lifecycle v1 (code):** `0002_orders.sql` (place/accept-ish/cancel RPCs), Kitchen dashboard, live status, buyer cancel.

### 🔄 / ⏸️ In flight
- ⏸️ Run **`0002_orders.sql`** in Supabase (not yet run — ordering + Kitchen need it).
- ⏸️ GitHub + Vercel deploy (needs accounts).

### Phase A — **Accounts & roles** (next, foundational) 🟡
- ⬜ Decide auth approach (§11). Migration `0003`: `profiles` + `roles`, RLS on `auth.uid()`.
- ⬜ Sign-up/sign-in screens (phone + 6-digit code), role pick at sign-up, session persistence.
- ⬜ Rework dish/order ownership from device-token → `auth.uid()`.
- ⬜ Admin: role management screen; moderate any post/order.

### Phase B — **Full order lifecycle + notifications** 🔄
- ✅ **B1** (`0004_order_lifecycle.sql`): states placed→accepted/rejected→cooking→delivered;
  auth-based RPCs (place_order/set_order_status/cancel_order) + RLS reads + realtime;
  Kitchen chef controls; My Orders live status; **5-min cancel window** then call-chef;
  chef-set **order cutoff**; **tap-to-WhatsApp** at each step (free); order history both sides.
- ✅ **B2** (`0005_push.sql`): `push_tokens` + RLS; Postgres trigger → Expo Push API via
  pg_net (new order → chef; status change → orderer). Client `lib/push.ts` registers on
  login (native only; web no-op). *Push delivers only on native builds — verify in Phase D.*

### Phase C — **Future dates · tiffin · recurring** 🔄
- ✅ **C1** (`0006_serve_date.sql`): `dishes.serve_date`; Post "Cooking on" (Today/Tomorrow/+2/+3)
  with cutoff computed on the serve date; Discover **Today / Upcoming** toggle; past dishes hidden;
  serve-date pill on cards; future reservations work (atomic reserve unchanged).
- ✅ **C2** (`0007_tiffin.sql`): **Tiffin service** — `tiffin_plans` + `subscriptions` + `subscription_skips`,
  RLS, `chef_tiffin_for_date()` (subscribers computed per weekday, **no cron**). Post has a
  **One-off dish / Tiffin** toggle (days-of-week, price/day, max/day, cutoff); Discover shows a
  **Daily tiffins** strip + Subscribe sheet; **You → Tiffins** (pause/resume/cancel/message chef);
  **Kitchen** lists plans + **today's subscribers**. **Recurring = subscriptions.**

### Phase D — Polish, deploy, native ⬜ *(deployments on hold per user)*
- ⬜ Offline/PWA install, a11y, Sentry/PostHog; Vercel deploy; EAS native builds + stores.
- ⬜ Admin role-editor screen (RPC `set_user_roles` exists).

### Phase E — Performance · caching · responsiveness ⬜ (planned)
Goal: fast, smooth, awesome on browser + iOS + Android.
- **Rendering:** swap long `.map` lists → `FlatList`/`FlashList` (Discover grid, orders, subscribers) with `keyExtractor` + `getItemLayout`; `React.memo` cards (✅ DishCard); memoize handlers (`useCallback`).
- **Data/caching:** narrow Supabase `select(...)` columns (drop `owner_token_hash` etc.); paginate/limit feeds; cache last feed in AsyncStorage for instant cold-start; debounce realtime refetches; consider TanStack Query for cache+dedupe.
- **Images:** `expo-image` disk+memory cache (default), set `cachePolicy`, request resized/transformed URLs from Supabase, lazy offscreen, blurhash placeholders.
- **Web/PWA:** service worker for offline shell + asset caching; code-split routes; preconnect to Supabase; compress; Lighthouse pass (perf/PWA/a11y ≥ 90).
- **Responsiveness:** audit breakpoints (phone/tablet/desktop) for hero, grid (1/2/3 col), sheets, rail; safe-area on notch/home-indicator; large-text / Dynamic Type; landscape.
- **Native:** EAS production build, Hermes, startup-time + bundle-size budget; verify haptics/push/sheets on device.
- **Monitoring:** Sentry (errors) + a basic perf dashboard (PostHog) to watch real-device metrics.

---

## 8. Costs
- **Free:** Expo, Supabase, Vercel, GitHub, NativeWind, **Expo push notifications**.
- **Paid only if chosen:** automated WhatsApp messages (Meta/Twilio); Apple $99/yr + Google $25 (stores, Phase D).
- No SMS/OTP cost (code-based auth); no payment fees (UPI direct).

---

## 9. Open items / needs from user
- ⏸️ Run `0002_orders.sql` (and upcoming `0003+`) in Supabase SQL editor.
- ⏸️ GitHub + Vercel accounts for deploy.
- 🟡 Decisions in §11 below.

---

## 10. (reserved)

## 11. Decisions (resolved)
1. ✅ **Orderer role name** → **Foodie**.
2. ✅ **Auth** → Supabase-Auth email-alias (phone + 6-digit code).
3. ✅ **Notifications** → FREE (Expo push + in-app + tap-to-WhatsApp); paid auto-WhatsApp deferred.
4. ✅ **Sequence** → A (accounts) → B (lifecycle+push) → C (future/tiffin/recurring) → D.

### Open / next
- Phase **D**: deploy (GitHub + Vercel), native EAS build (verifies push), offline PWA, Sentry/PostHog.
- **Admin management UI** (role editing screen) still TODO — RPC `set_user_roles` exists.

---

## 12. Change log
- **2026-06-06** — **Phase B + C shipped.** B1 lifecycle (`0004`), B2 free push via pg_net
  trigger (`0005`), C1 future dates (`0006`), C2 tiffin + recurring subscriptions (`0007`).
  Migrations 0001–0007 all run. PLAN kept in sync.
- **2026-06-06** — **Phase A shipped** (`0003`): phone + 6-digit code auth (Supabase email-alias),
  profiles + roles (chef/foodie/admin), adaptive role-gated nav, ownership via auth.uid().
- **2026-06-06** — Captured major new direction: **accounts (phone + 6-digit code), roles
  (chef/orderer/admin, multi-role), full order lifecycle (accept/reject/cooking/delivered),
  cancellation windows, tiffin & recurring orders, future-date reservations, capacity &
  order cutoffs, notifications.** Renamed **Senate Chef → Senate Rasoi**. Supersedes the
  no-login model. Re-scoped roadmap into Phases A–D.
- **2026-06-06** — **Design v3** "Bright & minimal + dark mode": coral accent, Bricolage +
  Hanken fonts, adaptive nav (bottom tabs / desktop rail), *You* hub (orders + kitchen,
  progressive chef disclosure), single Post entry, light/dark via CSS vars. (Earlier v2
  "Warm Home Kitchen" cream/green/serif was replaced.)
- **2026-06-06** — Order lifecycle v1 (`0002_orders.sql`): orders table + reserve/confirm/
  cancel RPCs, Kitchen dashboard, live status.
- **2026-06-06** — Phase 0/1 built; Supabase live; `0001` run. PWA + WhatsApp/UPI ordering.
- **2026-06-06** — Initial plan (no-login, device-token, PWA-first, single society).
