# Aangan — performance review

Five parallel reviews: client fetching, database & RLS, rendering, realtime &
caching, startup & bundle. Findings deduplicated and ranked by
**impact ÷ effort**. Bundle numbers are measured, not estimated — the startup
review built alternative exports and diffed them.

Nothing here is fixed yet. Claims marked ✅ were verified directly.

---

## The short version

The codebase is well built. Animation discipline is better than average, the
RLS helpers are correctly marked `STABLE`, translations batch properly, feed
pagination is right, and no server-only code leaks into the client bundle.
Most of what follows is **deferrable work sitting on a critical path**, not bad
code.

Four things stand out, and three of them are cheap:

1. **`useThemeColors()` returns a new object on every call**, in 126 files —
   which silently defeats React Compiler app-wide. Two lines. ✅
2. **Home refetches everything on every visit and caches nothing** — ~23 round
   trips, one of which downloads the entire resident directory to print one
   number. ✅
3. **Five tables are subscribed but not in the realtime publication**, so those
   screens only *look* live. ✅
4. **The notification system amplifies itself** — no supporting index, ~900 rows
   a day, an unfiltered subscription, and a refetch per event. ✅

---

## Tier 0 — correctness bugs found on the way

These aren't performance. They're things that are quietly wrong.

### 0.1 Five tables subscribed but never published ✅
`event_contributions`, `event_expenses`, `lost_found_items`, `user_blocks`,
`places` are subscribed by the client but appear in no
`alter publication supabase_realtime add table` in 101 migrations.

Worst case is Functions: `subscribeEvent()` is the **only** live path on the
contributions and expenses screens, so a treasurer and a lead editing the same
budget each see a frozen total and can overwrite each other — while the report
screen renders *"Live accounts — updating as money moves."*

Four of the five are my own (`0065`, `0068`, `0069`): the subscriptions were
written, the publication was never updated.

> Verify against Database → Publications first — they may have been added by
> hand in the dashboard.

### 0.2 The feed subscription throws away your pagination
`src/app/(tabs)/feed.tsx:103` → `load()` calls `setPage(0)`. A reader five pages
deep is yanked to the top the moment anyone posts.

### 0.3 Nothing re-syncs on app resume
There is **no `AppState` listener anywhere in `src/`**. Phone sleeps → socket
drops → JWT expires → on resume the channel errors silently, and
`postgres_changes` has no replay. You come back after lunch to this morning's
feed, with no spinner and no error. The app looks correct and is wrong.

### 0.4 Stale prices presented as live
`food.tsx` restores `plates_left`/`price` from cache and calls
`setLoading(false)`, so the board shows "3 plates left · ₹120" for something
withdrawn yesterday, with a live Order button. The cache turned a blank second
into a false promise.

### 0.5 Cached feed stores neighbours' PII
`src/lib/listings.ts:74` writes the joined `owner:profiles(…whatsapp,phone,upi)`
into AsyncStorage — unscoped by community, no TTL, never cleared on sign-out,
including for people the user later blocks.

---

## Tier 1 — do these first (small effort, large or wide effect)

| # | Fix | Effect | Effort |
|---|---|---|---|
| 1.1 | `src/theme.ts:90` — hoist `LIGHT`/`DARK` to module constants instead of spreading per call | Restores React Compiler memoization across **126 files** ✅ | 2 lines |
| 1.2 | `src/lib/homeCounts.ts:52` — `fetchDirectory().length` → `count:'exact', head:true` | Removes ~150 KB of PII per Home visit ✅ | 1 line |
| 1.3 | Icon barrels → `@expo/vector-icons/Ionicons` in 111 files | **−427 KB JS, −133 KB gzip, −3.69 MB fonts** (measured) | mechanical `sed` |
| 1.4 | Google-font barrels → deep per-weight imports | **−1.32 MB** of unused TTF in the binary (25 weights emitted, 7 used) | small |
| 1.5 | Memoize context values — `toast.tsx:33`, `notifications.tsx:109`, `theme.tsx:81`, `auth.tsx:120` | Stops realtime channel churn in 3 screens; these wrap the whole app | 4 × 2 lines |
| 1.6 | The 8 missing indexes (below) | Feed/board queries stop sorting whole tables | 1 migration |
| 1.7 | Add the 5 tables to the realtime publication | Fixes Tier 0.1 | 1 migration |
| 1.8 | `notifications.ts:48` — scope `notification_reads` to the 50 fetched ids | Today it fetches every read-receipt the user has *ever* created | 1 line |

```sql
create index if not exists notifications_created_idx    on public.notifications      (created_at desc);
create index if not exists notification_reads_user_idx  on public.notification_reads (user_id, notification_id);
create index if not exists profiles_community_idx       on public.profiles           (community_id);
create index if not exists listings_board_idx           on public.listings           (community_id, status, bump_at desc);
create index if not exists property_bump_idx            on public.property_listings  (community_id, bump_at desc);
create index if not exists lend_bump_idx                on public.lend_items         (community_id, bump_at desc);
create index if not exists posts_pinned_feed_idx        on public.posts              (community_id, pinned desc, created_at desc);
create index if not exists profiles_admins_idx          on public.profiles           (community_id) where 'admin' = any(roles);
```

`profiles.community_id` has **never** been indexed, despite being the filter for
the directory, the DM member list, the food nudge insert, the admin loops and
the `profiles_read` RLS policy.

---

## Tier 2 — the structural ones

### 2.1 Home: ~23 round trips, on every visit, cached nothing ✅
`(tabs)/_layout.tsx` renders `<Slot/>` rather than a `<Tabs>` navigator, so tab
screens **unmount on every navigation**. Every tap on Home is a cold start.
`loadHome` fans out to ~23 requests; three more effects add an announcement
fetch, a remote version check, and `fetchSocietyDigest()` — an **LLM call with a
20 s timeout, on the first-paint path**.

`getCachedListings` already exists and `food.tsx` already uses the pattern.
Home never calls it.

**Fix:** render from AsyncStorage first, then revalidate. Move the digest and
version check off first paint. Collapse the tile counts into one RPC.

### 2.2 The notification system amplifies itself ✅
Four things compound:
- `notifications` has two indexes, **neither leading with `created_at`** — and
  the bell query constrains nothing else, so it is a full scan every time.
- The food nudge writes **one targeted row per resident**, not one broadcast:
  300 residents × 3 slots = **~900 rows/day, ~330k/year** for one society.
- The realtime subscription on `notifications` is **table-wide, unfiltered**.
- `NotificationsProvider` **refetches on every INSERT**.

So each nudge burst is 300 inserts × every connected client, each doing a
full-scan refetch. And `onMarkAll(true)` upserts N read-rows, each firing its own
event: marking 50 read = 50 events → 50 refreshes → **100 queries**.

**Fix:** patch state from `payload.new` instead of refetching; debounce
`notification_reads` events; switch the nudge to one broadcast row.

> ⚠️ The nudge fix is **two coordinated changes**, not one. `0081`'s comment is
> correct that `on_notification_push` only applies mutes to broadcasts — so the
> trigger must be made mute-aware *before* switching, or muted residents start
> getting nudges.

### 2.3 Nothing is ever deleted ✅
No retention, purge or age-based delete exists in 101 migrations.
`notifications`, `notification_reads`, `translations`, `saathi_watch_hits` and
`ai_usage` grow forever. `search_documents` indexes **every comment**, so the
vector index tracks conversation volume rather than the catalogue — and each row
costs an embedding and an HNSW insert.

A `pg_cron` job alongside the existing nudge schedule fixes this.

### 2.4 Two screens mount everything at once
**Directory** — ~12 native views per row × 300 residents ≈ 3,600 views in one
frame, and the search box lives in the same component, so **every keystroke
re-renders every row**.

**Search** — builds a client-side index of the entire society *on focus*, then
scores and sorts it per keystroke using `localeCompare` (the expensive ICU path
in Hermes) and renders every match uncapped. Proper server-side FTS with GIN
indexes already exists in `searchListings`/`searchPosts` and this screen calls
neither.

57 screens use `ScrollView` + `.map()`; 4 use `FlashList`. Most of those 57 are
genuinely small and should be left alone — these two are not.

### 2.5 Chat re-renders the whole thread per keystroke
`fetchMessages` has no `.limit()`, and `DmBubble` calls `toLocaleTimeString`
per bubble per render. The composer's state is in the same component, so a
400-message thread does **400 Intl allocations per character typed**. The
realtime handler then refetches the entire history on every incoming message.

---

## Tier 3 — worth doing, larger

- **Fonts gate the entire app.** `_layout.tsx` returns `null` until 7 TTFs
  resolve, and on web they're injected from JS — so first paint is strictly
  serialized: 1.18 MB gzip JS → parse → inject `@font-face` → 540 KB fonts →
  render. ~2 s blank on 4G, 25–35 s on 3G. And `useFonts`' error branch is
  discarded, so **one failed font fetch is a permanent white screen**.
- **`web.output: "single"`** ships all 100+ routes in one 4.6 MB file.
  Measured alternative with `asyncRoutes: { web: "production" }`:
  **1,184 KB → 937 KB gzip (−21 %)** for a one-line config change.
- **`+html.tsx` is dead code** under `output: "single"` — the Supabase
  preconnect, the anti-FOUC theme script, the manifest and the service worker
  registration never ship. Every dark-mode user gets a flash of light theme, and
  the PWA isn't installable.
- **Auth blocks on the network** with an 8 s ceiling, behind a bare spinner.
- **No pagination** on All-listings, DM threads, or the DM inbox.
- **`registerPush` runs on every launch**, including the permission dialog path.
- **No thumbnail tier** — 1000 px uploads render into 40 px avatars.

---

## Checked and found fine

Worth recording so nobody re-litigates these:

- **RLS helpers are all correctly `STABLE`.** `is_my_community` inlines;
  `is_admin_of` can't (it's `security definer`) but always sits on the right of
  an `OR` that short-circuits. **No change needed** — but don't reorder those
  clauses.
- **No server-only code in the client bundle.** `openai` isn't an app
  dependency; `src/lib/ai.ts` and `agent.ts` are thin RPC clients. No keys, no
  SDK, no prompts. Clean.
- **`head: true` counts in `homeCounts.ts` are genuinely cheap** — the expensive
  one is `fetchDirectory`, which isn't a count query at all.
- **Animation discipline is good.** Home's scroll handler, `Touchable`,
  `ParallaxHero` and `Rise` are all correctly on the UI thread, and
  `scripts/check-ui.mjs` is guarding a real class of bug with no violations.
- **Shared-subscription pattern is right.** `BlocksProvider` and
  `UnreadDmsProvider` mount once and memoize — exactly correct.
- **Translations batch and cache properly** despite `<T>` appearing in list rows.
- **Polls, inbox, borrow, lost-found, rides, payments, documents** are all
  bounded and fine as `ScrollView` lists. Don't convert them.

---

## Suggested order

**First pass — a day, mostly mechanical, no behaviour change:**
1.1 theme constants · 1.2 head count · 1.3 icon imports · 1.4 font imports ·
1.5 context memoization · 1.6 indexes · 1.7 publication · 1.8 read scoping

That alone: −560 KB gzip, −5 MB of fonts, restored memoization everywhere, the
worst query on Home gone, and the live-updates bug fixed.

**Second pass — the structural ones:** Home cache-first, the notification
storm, retention, Directory and Search.

**Third pass — when there's room:** fonts off the critical path, `asyncRoutes`,
pagination, `AppState`.
