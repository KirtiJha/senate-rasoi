# Aangan — Community Platform Plan
> **Living document.** Always kept in sync with the codebase. Update on every significant commit.
> **App:** Aangan (आँगन — courtyard) · **From:** Senate Rasoi (single-society food app)
> **Last updated:** 2026-06-08 (migrations 0022–0024 all run; polish: unread-DM badge + recent searches. All web work to date is live)

---

## Status legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Complete & deployed to main |
| 🔄 | In progress |
| ⬜ | Not started — planned |
| ⏸️ | Blocked on user action / external dependency |
| ❌ | Dropped |

---

## Quick Status Dashboard

| Area | Status | Notes |
|------|--------|-------|
| Rebrand to Aangan | ✅ | app.json, manifest, Brand, NavRail, HTML meta |
| Home hub | ✅ | Service tile grid at index.tsx |
| Food engine | ✅ | Unchanged: dishes, orders, tiffin, subscriptions |
| Service registry (15 cats) | ✅ | services.ts — 14 listing cats + food; incl. carpooling |
| Listings engine | ✅ | listings.ts, ListingCard, CreateListingForm, InquiryModal |
| Category feeds | ✅ | c/[category].tsx with realtime + cache + pagination |
| Listing detail + contact | ✅ | listing/[id].tsx + bookmark button |
| My Listings (You tab) | ✅ | MyListingsSection |
| Saved / Bookmarks | ✅ | saved_listings (migration 0018), bookmark on detail, Saved tab in You |
| Post screen (all categories) | ✅ | Category picker → correct form (hook bug fixed) |
| Multi-society DB schema | ✅ | community_id on profiles + listings (migrations 0008–0011) |
| Multi-society UI | ✅ | Society picker at sign-up; dynamic communityId in all feeds |
| New categories (Day Care, Yoga, Arts, Astrology, Carpooling) | ✅ | 5 new cats in services.ts |
| User profile page (own) | ✅ | profile/me.tsx — edit, PIN change, delete account |
| Public profile page | ✅ | profile/[userId].tsx — name, flat, roles, active listings |
| Community display | ✅ | Society badge on Home, You, Profile, NavRail |
| Society join request | ✅ | Form in sign-in; migration 0014; Admin Requests tab |
| Admin: join requests view | ✅ | Requests tab in admin.tsx |
| Society onboarding (admin) | ⏸️ | Approve button in admin→Requests; creating community row needs manual DB step (first society seeded manually ✅) |
| Community posts / threads | ✅ | posts.ts, feed.tsx, feed/[postId].tsx, migrations 0012–0013 |
| Feed compose UX | ✅ | Post button moved to sticky footer above keyboard |
| Search & filter | ✅ | search.tsx, searchListings(), category filter chips |
| Issues / feedback page | ✅ | Feed tab with category filter (issue/feedback/suggestion) |
| Polls & Surveys | ✅ | polls.tsx, realtime voting, create/close/delete (migration 0020) |
| Emergency Contacts | ✅ | emergency.tsx, 7 role types, admin add/delete, direct dial (migration 0019) |
| Society-based access control | ✅ | RLS on all tables; is_admin fn (migration 0017); communityId in all queries |
| About page + version | ✅ | about.tsx with version, features, technical info |
| Pagination (category feeds) | ✅ | limit/offset + Load more in c/[category].tsx |
| React.memo (ListingCard) | ✅ | ListingCard wrapped in memo |
| Mobile nav to Polls/Emergency | ✅ | Community section on Home hub with Polls + Emergency tiles |
| Posts feed pagination | ✅ | PAGE=20, Load more button, "You're all caught up" footer |
| Announce-only for admins | ✅ | Announcement filtered from ComposeModal for non-admins |
| PostCard memo + FlashList | ✅ | PostCard wrapped in memo; posts feed uses FlashList |
| Skeleton loaders (posts feed) | ✅ | Animated pulsing PostCardSkeleton |
| Update notification banner | ✅ | Checks app_versions on Home load; dismissable / force-update modes |
| Feed blank screen fix | ✅ | ScrollView missing from react-native import after FlashList migration |
| NavRail — persistent (all screens) | ✅ | Moved to root _layout.tsx; admin/polls/emergency/about no longer hide it |
| NavRail — collapsible | ✅ | 220px ↔ 64px icon-only; spring animation; chevron rotates 180° |
| NavRail — restructured sections | ✅ | Primary → Community → Admin → spacer → New Post CTA → About/Theme |
| NavRail — active left-bar indicator | ✅ | 3px accent bar on active item (VS Code / Linear style) |
| Push token capture | ✅ | `registerPush()` in lib/push.ts, called from auth.tsx on login; upserts to push_tokens (native-only, web no-op) |
| Supabase backend live | ✅ | All migrations 0001–0020 run; `listing-photos` bucket created; first community seeded; admin granted |
| Web deploy (GitHub + Vercel) | ✅ | Deployed to main / Vercel |
| Per-listing chat threads | ✅ | Phase 12a — `listing_messages` (migration 0021, run) + realtime + push; collapsible ListingChat — LIVE & verified |
| Listing-grid FlashList | ✅ | Category feed + search results now FlashList (numColumns, centered maxWidth) |
| Search-result skeletons | ✅ | ListingCardSkeleton grid while searching |
| Image caching + blurhash | ✅ | IMAGE_CACHE_PROPS (memory-disk + neutral blurhash + fade) on ListingCard, listing hero, DishCard |
| Inquiry-count badge (My Listings) | ✅ | "N interested" badge per card via fetchInquiryCountsForOwner |
| Direct messages (DMs) | ✅ | Phase 12b — `dm_threads`/`dm_messages` (0023, run) + RLS + realtime + push; inbox + thread screens, Message btn, NavRail + Home tile — LIVE & verified (dedupe, realtime, participant-only RLS) |
| Full-text search | ✅ | `search_tsv` GIN indexes (0022, run); FTS-first searchListings + searchPosts; Search Listings/Posts toggle — LIVE & verified (stem match) |
| Listings cross-society RLS fix | ✅ | `listings_read` tightened to community scope (migration 0024, run) |
| Unread-DM badge | ✅ | Shared `UnreadDmsProvider` (one realtime sub); badge on NavRail Messages + Home tile |
| Recent searches | ✅ | `lib/recentSearches.ts` (AsyncStorage); chips in Search empty state |
| Food photo resize | ✅ | Already done — uploadDishPhoto resizes 1000px/JPEG-0.7 |
| PWA preconnect + shell precache | ✅ | Supabase preconnect/dns-prefetch in +html; sw.js precaches shell on install (cache → aangan-v2) |
| Sentry / PostHog monitoring | ⬜ | Requires external accounts |
| iOS / Android (EAS) | ⬜ | After web version is stable |
| App store submissions | ⬜ | After iOS/Android phase |

---

## 1. Vision

Aangan is a residential society's shared courtyard — one app for everything neighbours need
from each other: home food, services, buy & sell, community posts, and a trusted directory.

**Design tenets:**
- Every new service is **config, not code** (registry-driven).
- No in-app payments — WhatsApp + UPI, as trusted neighbours do.
- **Multi-society from the start** — each society is isolated; shared infrastructure.
- **Fast and responsive** at any scale: offline-first, paginated, realtime where it matters.
- Works great as a **web PWA today**; ships to iOS + Android when web is stable.

---

## 2. Service Categories

### 2a. Current categories (10) — ✅ All in services.ts

| # | Key | Label | Type | Status |
|---|-----|-------|------|--------|
| 0 | `food` | Home Food | Food engine | ✅ |
| 1 | `tuition` | Tuitions | Service | ✅ |
| 2 | `tailoring` | Tailoring | Service | ✅ |
| 3 | `tax` | Income Tax | Service | ✅ |
| 4 | `clinic` | Clinic | Service | ✅ |
| 5 | `catering` | Catering | Service | ✅ |
| 6 | `decoration` | Decoration | Service | ✅ |
| 7 | `jobs` | Job Referral | Post | ✅ |
| 8 | `market` | Buy & Sell | Product | ✅ |
| 9 | `directory` | Service Directory | Recommendation | ✅ |

### 2b. Added categories — ✅ All in services.ts

| # | Key | Label | Status |
|---|-----|-------|--------|
| 10 | `daycare` | Day Care | ✅ Phase 3 |
| 11 | `fitness` | Yoga & Fitness | ✅ Phase 3 |
| 12 | `arts` | Arts & Activities | ✅ Phase 3 |
| 13 | `astrology` | Astrology | ✅ Phase 3 |
| 14 | `carpooling` | Carpooling | ✅ Phase 11 |

**On dance & painting:** Recommend **one combined "Arts & Activities" category** rather than
two separate categories or folding into Tuitions. Reasons:

1. **Tuitions** = academic subjects (Math, Science, Languages, competitive exams). Parents
   search with board/grade context. Attributes: subject, grade, mode.
2. **Dance & Painting** = creative/extracurricular. Different search intent, different
   attributes (style, age group, batch size, schedule). Mixing them with academic tuitions
   creates noise in both directions.
3. **Two separate** categories (dance / painting) would be too thin for most societies —
   you'd never have enough listings to justify dedicated feeds. One "Arts & Activities"
   category with a `type` attribute (Dance, Painting, Music, Craft, Drama, Other) is richer
   and more useful.
4. Yoga similarly sits better in a **Yoga & Fitness** category (wellness/exercise context)
   than alongside academic tuitions.

**Attributes for new categories:**

```
daycare:
  age_range     select  [Infant (0–1), Toddler (1–3), Preschool (3–6), After school (6–12)]
  timings       text    "Mon–Sat, 7 AM – 7 PM"
  capacity      number  (max children)
  meals_included toggle
  pickup_drop    toggle

fitness:
  type          select  [Yoga, Zumba, Gym training, Meditation, Pilates, Other]
  level         select  [Beginner, All levels, Intermediate, Advanced]
  format        select  [Group class, 1-on-1, Online, Hybrid]
  timings       text    "6–7 AM, 6–7 PM"
  gender        select  [All genders, Women only, Men only]

arts:
  type          multiselect [Dance, Painting, Music, Craft, Drama, Drawing, Other]
  age_group     multiselect [Kids (5–12), Teens (13–18), Adults, All ages]
  format        select  [Group class, 1-on-1, Online, At my place]
  timings       text
  style         text    "Bharatnatyam, Watercolour, Hindustani…"
```

---

## 3. Architecture

### 3a. Three engines (unchanged)

```
┌─────────────────────────────────────────────────────┐
│                    HOME HUB                          │
│         service tile grid (15 categories)            │
└──────────────────┬──────────────────────────────────┘
         ┌─────────┴──────────┐
         ▼                    ▼
 ┌──────────────┐   ┌──────────────────┐
 │ FOOD ENGINE  │   │ LISTINGS ENGINE  │
 │ dishes/orders│   │ 12 categories    │
 │ tiffin/subs  │   │ listings+inquiry │
 └──────────────┘   └──────────────────┘
         │                    │
         └────── Supabase ────┘
   auth.uid() · RLS · RPCs · realtime · push
```

### 3b. Multi-society architecture

```
communities (one row per society)
    │
    ├── profiles.community_id  (which society each user belongs to)
    ├── listings.community_id  (which society each listing belongs to)
    ├── dishes.community_id    (which society each dish belongs to — existing via chef)
    └── posts.community_id     (community threads — new)

RLS ensures every query is implicitly scoped to auth user's community_id.
```

**Key principle:** A user belongs to exactly one society. All feeds, posts, and listings are
scoped to that society. Admins of a society can manage that society only. Platform admins
(super-admins) can see all.

---

## 4. Data Model

### 4a. What exists (migrations 0001–0011) ✅

| Migration | Contents |
|-----------|---------|
| 0001 | communities, profiles, dishes, orders |
| 0002 | order RPCs (place, accept, cancel) |
| 0003 | auth via Supabase + roles (chef/foodie/admin) |
| 0004 | full order lifecycle, Kitchen dashboard RPCs |
| 0005 | push_tokens, pg_net → Expo Push pipeline |
| 0006 | serve_date on dishes (future-date posts) |
| 0007 | tiffin_plans, subscriptions, subscription_skips |
| 0008 | communities.slug + address columns |
| 0009 | profiles.community_id FK |
| 0010 | listings table + RLS + realtime |
| 0011 | inquiries table + RLS + push trigger |

### 4b. All migrations — ✅ Complete (0001–0020)

| Migration | Contents | Status |
|-----------|----------|--------|
| 0001 | communities, profiles, dishes, orders | ✅ |
| 0002 | order RPCs (place, accept, cancel) | ✅ |
| 0003 | auth via Supabase + roles | ✅ |
| 0004 | full order lifecycle, Kitchen RPCs | ✅ |
| 0005 | push_tokens, pg_net → Expo Push | ✅ |
| 0006 | serve_date on dishes | ✅ |
| 0007 | tiffin_plans, subscriptions, subscription_skips | ✅ |
| 0008 | communities.slug + address | ✅ |
| 0009 | profiles.community_id FK | ✅ |
| 0010 | listings table + RLS + realtime | ✅ |
| 0011 | inquiries table + RLS + push trigger | ✅ |
| 0012 | posts table + RLS + realtime | ✅ |
| 0013 | post_comments table + RLS + realtime | ✅ |
| 0014 | society_join_requests table | ✅ |
| 0015 | delete_own_account SECURITY DEFINER RPC | ✅ |
| 0016 | app_versions table (for update notifications) | ✅ |
| 0017 | is_admin(uid) DB function + updated RLS policies | ✅ |
| 0018 | saved_listings table + RLS | ✅ |
| 0019 | emergency_contacts table + RLS | ✅ |
| 0020 | polls + poll_options + poll_votes tables + RLS + realtime | ✅ |
| 0021 | listing_messages (per-listing chat) + RLS + realtime + push trigger | ✅ |
| 0022 | full-text search: search_tsv generated cols + GIN indexes (listings, posts) | ✅ run + verified |
| 0023 | direct messages: dm_threads + dm_messages + RLS + realtime + push + dm_get_or_create_thread RPC | ✅ run + verified |
| 0024 | tighten listings_read RLS to community scope (security fix) | ✅ run |
| 0025 | member moderation: profiles.blocked + admin_set_blocked / admin_delete_member RPCs | ⏸️ written — run in Supabase |
| 0026 | notifications + notification_reads + triggers (post/listing/poll/DM) + realtime | ⏸️ written — run in Supabase |

**Pending (future):**
- `listing_reports` — moderation queue (schema designed; UI not yet built)
- Full-text search indexes on listings + posts (Phase 9)

---

## 5. Navigation & Information Architecture

### Current routes ✅
```
(tabs)/index.tsx         Home hub — service grid
(tabs)/food.tsx          Food board (dishes + tiffins)
(tabs)/post.tsx          Category picker → create form
(tabs)/you.tsx           My orders, tiffins, listings, kitchen
(tabs)/_layout.tsx       Tab bar
c/[category].tsx         Category feed (listings engine)
listing/[id].tsx         Listing detail
admin.tsx                Admin panel (basic)
(auth)/sign-in.tsx       Sign-in / sign-up
```

### New routes — completed ✅
```
profile/me.tsx           ✅ My profile — edit, reset PIN, society badge, delete account
feed/(tabs).tsx          ✅ Community posts feed (all categories + filter chips)
feed/[postId].tsx        ✅ Post thread with realtime comments, PostMenu
(tabs)/search.tsx        ✅ Cross-category search with debounce + category filter
about.tsx                ✅ App info, version, features, technical info
```

### New routes — added ✅
```
profile/[userId].tsx     Public profile — name, flat, roles, active listings
emergency.tsx            Emergency Contacts screen (admin add/delete, direct call)
polls.tsx                Polls & Surveys screen (create, vote, realtime)
```

### New routes — still pending ⬜
```
community/[id].tsx       Society detail page (future)
admin/societies.tsx      Super-admin society management (future)
```

### Updated tab bar ✅
| Tab | Icon | Route |
|-----|------|-------|
| Home | home | /  |
| Feed | chatbubbles | /feed |
| Post (+) | add-circle | /post |
| Search | search | /search |
| You | person | /you |

---

## 6. Roles & Permissions

### Current roles ✅
- **foodie** — default; can browse, order, post any listing
- **chef** — food provider; Kitchen dashboard; post dishes/tiffin
- **admin** — society admin; moderate listings, manage members

### Extended model ⬜
- **super_admin** — platform-level; can see all societies, approve join requests, manage communities. Set directly in DB — not self-service.
- Society-scoped admin is enforced via `profile.community_id` matching `listing.community_id`. An admin can only moderate their own society's content.
- All RLS policies scope to `auth.uid()`'s `community_id` — users are **hard-isolated** by society. No cross-society data leakage possible.

### Access control matrix ⬜

| Action | Foodie | Chef | Admin | Super-admin |
|--------|--------|------|-------|-------------|
| View own society feed | ✅ | ✅ | ✅ | ✅ |
| View other society | ❌ | ❌ | ❌ | ✅ |
| Post listing | ✅ | ✅ | ✅ | ✅ |
| Post dish/tiffin | ❌ | ✅ | ✅ | ✅ |
| Delete own listing | ✅ | ✅ | ✅ | ✅ |
| Delete any listing | ❌ | ❌ | ✅ | ✅ |
| Pin a post | ❌ | ❌ | ✅ | ✅ |
| Mark feedback resolved | ❌ | ❌ | ✅ | ✅ |
| Approve society | ❌ | ❌ | ❌ | ✅ |
| Manage members | ❌ | ❌ | ✅ | ✅ |

---

## 7. Phased Roadmap

---

### ✅ Phase 1 — Foundation & Rebrand
*Complete. Deployed to main.*

- ✅ Renamed app to **Aangan** (app.json, manifest, Brand, NavRail, HTML meta)
- ✅ **Home hub** tab (service tile grid at `index.tsx`)
- ✅ **Service registry** (`services.ts`) — 10 categories with icons, colors, attributes
- ✅ Food moved to `/food`; nav restructured (tabs + NavRail)
- ✅ Post tab open to all users (not chef-only)

---

### ✅ Phase 2 — Listings Engine (all categories)
*Complete. Deployed to main.*

- ✅ `listings` table (migration 0010) + RLS + realtime
- ✅ `inquiries` table (migration 0011) + push trigger
- ✅ `listing-photos` storage bucket constant added
- ✅ `listings.ts` — fetch, post, cache, realtime subscribe, photo upload
- ✅ `inquiries.ts` — send inquiry, WhatsApp link builder
- ✅ `ListingCard` component
- ✅ `InquiryModal` component (WhatsApp CTA + optional message)
- ✅ `CreateListingForm` — attribute-driven, works for all 13 categories
- ✅ `c/[category].tsx` — category feed (grid, loading skeleton, FAB)
- ✅ `listing/[id].tsx` — detail screen (photos, owner, attributes, contact CTA)
- ✅ `MyListingsSection` in You tab (manage own listings)
- ✅ Post screen: category picker → correct form (Rules of Hooks + stale state bugs fixed)
- ✅ All 10 categories registered and functional end-to-end

**Phase 2 backend setup — ✅ Done:**
- ✅ Migrations 0008–0011 run in Supabase
- ✅ `listing-photos` public storage bucket created

---

### ✅ Phase 3 — New Categories
*Complete. Deployed to main.*

- ✅ Added `daycare` (Day Care) to `services.ts` — age range, timings, capacity, meals, pickup
- ✅ Added `fitness` (Yoga & Fitness) to `services.ts` — type, level, format, timings, gender
- ✅ Added `arts` (Arts & Activities) to `services.ts` — dance/painting/music/craft combined; type, age group, format, style, timings
- ✅ Added `astrology` (Astrology) to `services.ts` — horoscope, kundali, vastu, numerology, tarot; mode, experience, languages
- ✅ `CreateListingForm` renders all 4 correctly (attribute-driven, no code changes needed)
- ✅ Home hub grid now shows 14 categories

---

### ✅ Phase 4 — Multi-Society & User Identity
*Complete.*

#### 4a. Society selection at sign-up ✅
- ✅ `lib/communities.ts` — fetchCommunities, fetchCommunityById, submitJoinRequest
- ✅ Sign-up screen: society picker modal (searchable) + join request form
- ✅ `profile.community_id` set at sign-up from picker selection
- ✅ All service layer calls use dynamic `communityId` (from auth context, fallback to COMMUNITY_ID)
- ✅ Society name badge shown in Home, You tab, Profile

#### 4b. Society join request flow ✅
- ✅ "My society isn't listed" → inline join request form in sign-in picker
- ✅ `society_join_requests` table (migration 0014)
- ✅ Admin Requests tab in admin.tsx — view/approve/reject requests

#### 4c. Admin society onboarding ⏸️
- ✅ Requests tab with approve/reject UI
- ✅ First community seeded manually in DB (test society live)
- ⏸️ Approving a join request still needs a manual DB step to create the community row (approve button updates status only)
- ⬜ `admin/societies.tsx` — full society management (future)

#### 4d. Full user profile page ✅
- ✅ `profile/me.tsx` — edit name/flat/WhatsApp/UPI, change PIN, society badge, delete account
- ✅ `delete_own_account` RPC (migration 0015)
- ✅ Tab bar updated: Feed + Search tabs added between Post and You
- ✅ NavRail updated: Feed, Search, About items + Post CTA for all users
- ✅ Root Stack: all new routes registered

---

### ✅ Phase 5 — Community Feed & Discussions
*Complete.*

#### 5a. Posts / threads ✅
- ✅ Migrations 0012 (`posts`) + 0013 (`post_comments`)
- ✅ `lib/posts.ts` — fetchPosts, fetchPostById, createPost, deletePost, setPinned, setResolved, fetchComments, createComment, deleteComment, subscribeToFeed, subscribeToComments
- ✅ `(tabs)/feed.tsx` — community posts feed; filter chips: All/General/Announcements/Issues/Events/Lost&Found/Feedback/Suggestions
- ✅ `feed/[postId].tsx` — thread view with realtime comments, reply bar, PostMenu (pin/resolve/delete)
- ✅ Post composer (ComposeModal): category picker, title, body
- ✅ Admin: pin/unpin posts (PostMenu), mark resolved/reopen (issues), delete post/comment

#### 5b. Issues / feedback / suggestions ✅
- ✅ Covered by Feed tab with `issue/feedback/suggestion` category filters
- ✅ Resolved status badge in feed + thread view
- ✅ Admin can mark issues as resolved from PostMenu

---

### ✅ Phase 6 — Search & Filter
*Complete (core).*

- ✅ `(tabs)/search.tsx` — unified search bar with debounce (350ms)
  - Listings search: `ilike` on `title + description` via `searchListings()`
  - Category filter chips (horizontal scroll, all 14 service categories)
  - Empty states: initial, searching, no results
  - Results in 2/3-col responsive grid using ListingCard
- ✅ `searchListings()` in `listings.ts` — communityId-scoped, category-filterable
- ✅ Posts search — `searchPosts()` (FTS-first + ilike fallback); Search screen now has a **Listings / Posts** toggle
- ✅ Supabase full-text indexes — `search_tsv` GIN on listings + posts (migration `0022`); `searchListings` upgraded to FTS-first
- ✅ Recent searches in AsyncStorage (`lib/recentSearches.ts`) — chips in the Search empty state

---

### ✅ Phase 7 — Access Control Hardening & Admin Tools
*Core complete. Some items remain for future.*

- ✅ All tables have RLS with `community_id` scoping (posts, post_comments, listings, inquiries)
- ✅ `is_admin(uid)` DB function (migration 0017) — checks `roles @> array['admin']`
- ✅ Updated `posts` and `post_comments` RLS to use `is_admin()` for delete policies
- ✅ Admin dashboard — Members tab: role management with toggle chips
- ✅ Admin dashboard — Requests tab: view/approve/reject society join requests
- ⬜ Super-admin role (future — set directly in DB for now)
- ⬜ Reported listings queue (migration 0017 schema designed; UI pending)
- ⬜ Category toggles per society (future)
- ⬜ Rate limiting (future)

---

### ✅ Phase 8 — About Page & App Ops
*Complete (core).*

- ✅ `about.tsx` — app info screen with version, features, technical info, legal links
- ✅ NavRail: About link (desktop)
- ✅ `app_versions` table (migration 0016) for update notifications
- ✅ `delete_own_account` RPC (migration 0015)
- ⬜ Update notification banner on Home load (reads `app_versions` table — planned)

---

### 🔄 Phase 9 — Performance & Scalability
*In progress. Core wins done.*

#### 9a. Rendering performance
- ✅ `React.memo` on `ListingCard` and `DishCard`
- ✅ `PostCard` extracted to a memoized component (feed.tsx:224)
- ✅ Posts feed uses `FlashList` (`@shopify/flash-list` installed; feed.tsx)
- ✅ Skeleton loaders for posts feed (`PostCardSkeleton`)
- ✅ Category feed + search results now use `FlashList` (numColumns, centered maxWidth; `estimatedItemSize` removed for FlashList v2)
- ✅ Skeleton loading states for **search** results (`ListingCardSkeleton` grid)

#### 9b. Data & caching
- ✅ Paginate category feeds: `limit(20)` + "Load more" in `c/[category].tsx`
- ✅ Stale-while-revalidate (AsyncStorage cache already in category feed)
- ✅ Search debounce (350ms) in search.tsx
- ✅ Paginate posts feed (PAGE=20 + "Load more"; feed.tsx)
- ⬜ Supabase full-text search indexes (future migration — note: 0018 is already `saved_listings`)
- ⬜ Debounce realtime refetch (50ms)

#### 9c. Image performance
- ✅ `expo-image` with `cachePolicy="memory-disk"` on ListingCard, listing hero, DishCard (shared `IMAGE_CACHE_PROPS` in `lib/image.ts`)
- ✅ Blurhash placeholders + 200ms fade while images load (one neutral hash; no per-image hashing)
- ✅ Upload pipeline: resize to 1000px width + JPEG 0.7 — done for **both** listings (`uploadListingPhoto`) and food (`uploadDishPhoto`)
- ⬜ Supabase Storage image transforms (`?width=400&quality=75` URL param) for thumbnails vs full

#### 9d. Web / PWA
- ✅ Service worker: offline shell + asset caching (`public/sw.js` — network-first nav, SWR assets, shell precached on install; cache `aangan-v2`)
- ⬜ Route code-splitting (Expo Router does this by default — verify bundles)
- ✅ `preconnect` + `dns-prefetch` to Supabase URL in `+html.tsx`
- ⬜ Lighthouse audit: target ≥ 90 performance, ≥ 90 PWA, ≥ 90 accessibility

#### 9e. Native performance (post-EAS)
- ⬜ Hermes engine (default in Expo SDK 56) — verify enabled in EAS builds
- ⬜ New Architecture (Fabric + JSI) — verify with SDK 56 defaults
- ⬜ Startup time budget: < 2s cold start on mid-range Android
- ⬜ Bundle size budget: track and gate on CI

#### 9f. Monitoring
- ⬜ Sentry: error tracking (crashes, unhandled rejections)
- ⬜ PostHog: analytics (screen views, key actions, retention)
- ⬜ Supabase dashboard: query performance, slow queries, connection pool
- ⬜ Vercel Analytics: Web Vitals (LCP, CLS, FID)

---

### ✅ Phase 10 — iOS & Android (EAS)
*Configuration complete. Awaiting Apple/Google developer accounts.*

#### 10a. Build setup ✅
- ✅ `eas.json` — development/preview/production build profiles with channels
- ✅ `app.json` — iOS bundleIdentifier, Android package, adaptive icons, splash, scheme
- ✅ `app.json` — OTA updates config (`expo-updates`), runtimeVersion policy
- ✅ `app.json` — iOS infoPlist privacy descriptions (camera, photos, contacts)
- ✅ `app.json` — Android permissions list

#### 10b. User actions needed ⏸️
- ⏸️ Apple Developer account ($99/yr) for App Store + TestFlight
- ⏸️ Google Play developer account ($25 one-time) for Play Store
- ⏸️ App icons: provide 1024×1024 iOS icon + Android adaptive icon (foreground layer)
- ⏸️ Run `eas build --platform all --profile production` when accounts ready

#### 10c. Store submission ⬜
- ⬜ TestFlight internal test → external beta → App Store (after build)
- ⬜ Google Play internal track → closed beta → production (after build)
- ⬜ Store listing screenshots and descriptions

---

### ✅ Phase 11 — Community Features (COMPLETE)

| Feature | Status | Notes |
|---------|--------|-------|
| **Events & Calendar** | ✅ Covered | Feed's `event` post category handles event posts |
| **Lost & Found** | ✅ Covered | Feed's `lost_found` post category handles lost/found posts |
| **Carpooling** | ✅ Done | Added as service category 14 in `services.ts` (color #0EA5E9, icon `car-outline`) |
| **Polls & Surveys** | ✅ Done | `polls`, `poll_options`, `poll_votes` tables (migration 0020); full UI in `src/app/polls.tsx`; realtime subscription; admin can close/delete; any member can create |
| **Emergency Contacts** | ✅ Done | `emergency_contacts` table (migration 0019); full UI in `src/app/emergency.tsx`; 7 role types with color/icon; admin add/delete; direct tel: call |
| **Saved / Bookmarks** | ✅ Done | `saved_listings` table (migration 0018); save/unsave button on listing detail; `SavedSection` in You tab |
| **Endorsements** | ⬜ Deferred | Post-launch — requires `listing_endorsements` table |
| **Reviews & Ratings** | ⬜ Deferred | Post-launch — trust layer after critical mass |
| **Appointments** | ⬜ Deferred | Post-launch — calendar slot picker complexity |
| **Verified Provider Badge** | ⬜ Deferred | Post-launch — admin workflow required |
| **Society Newsletter** | ⬜ Deferred | Post-launch — Supabase Edge Function + email infra |

**New files (Phase 11):**
- `supabase/migrations/0018_saved_listings.sql` — saved_listings table with RLS
- `supabase/migrations/0019_emergency_contacts.sql` — emergency_contacts table with RLS
- `supabase/migrations/0020_polls.sql` — polls + poll_options + poll_votes tables with RLS + realtime
- `src/lib/saved.ts` — save/unsave/isSaved/fetchSaved helpers
- `src/lib/emergency.ts` — fetchEmergencyContacts/addEmergencyContact/deleteEmergencyContact
- `src/lib/polls.ts` — fetchPolls/createPoll/votePoll/closePoll/deletePoll/subscribeToPolls
- `src/app/emergency.tsx` — Emergency Contacts screen with admin add/delete UI
- `src/app/polls.tsx` — Polls screen with voting, create poll modal, realtime
- `src/app/profile/[userId].tsx` — Public profile showing name, flat, roles, active listings
- `src/components/SavedSection.tsx` — Saved listings list for You tab

**Modified files (Phase 11):**
- `src/lib/services.ts` — Added carpooling (category 14)
- `src/app/listing/[id].tsx` — Added bookmark toggle button (save/unsave)
- `src/app/(tabs)/you.tsx` — Added Saved tab (SavedSection)
- `src/components/NavRail.tsx` — Added Polls + Emergency links in sidebar
- `src/app/_layout.tsx` — Registered emergency, polls, profile/[userId] routes

---

## 8. Performance Targets

| Metric | Target |
|--------|--------|
| Web cold start (first paint) | < 1.5s on 4G |
| Feed scroll | 60fps, no jank |
| Listing detail open | < 300ms |
| Realtime update visible | < 1s after DB write |
| iOS app cold start | < 2s on iPhone 11 class |
| Android cold start | < 3s on mid-range (2022) |
| Lighthouse Performance | ≥ 90 |
| Lighthouse PWA | ≥ 90 |
| Lighthouse Accessibility | ≥ 90 |
| Supabase query p95 | < 100ms |
| Concurrent users (Supabase free tier) | ~50 realtime; upgrade plan for 500+ |

---

## 9. Decisions Log

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | App name | ✅ **Aangan** |
| 2 | Auth | ✅ Supabase Auth, phone-as-email alias, 6-digit code as password |
| 3 | Email alias domain | ✅ Keep `@senate.app` forever — invisible to users, breaking change to migrate |
| 4 | Payments | ✅ No in-app payments; WhatsApp + UPI only |
| 5 | Posting model | ✅ Open posting (any member) + admin moderation; verified badge in Phase 11 |
| 6 | Inquiry model | ✅ In-app inquiry record + WhatsApp deep-link |
| 7 | Phase 2 rollout | ✅ All listing categories launched together |
| 8 | Multi-society | ✅ Architect for multi-society from start; dynamic community_id |
| 9 | Dance/Painting vs Tuitions | ✅ Separate "Arts & Activities" category — different search intent and attributes |
| 10 | Yoga category | ✅ "Yoga & Fitness" — wellness context, not academic |
| 11 | iOS/Android timing | ✅ After web version is feature-complete and stable |
| 12 | Community posts engine | ✅ Separate `posts` + `post_comments` tables; not shoehorned into listings |
| 13 | Feedback/issues | ✅ Posts table with `category` column (issue/feedback/suggestion) — not a separate table |
| 14 | Feedback tab vs separate page | ✅ Merge into Feed tab with category filter chips — keeps tab count at 5 |
| 15 | Approve join request | ✅ Admin sets `status=approved`; creating the society row is a manual admin step for now |
| 16 | `delete_own_account` | ✅ Supabase SECURITY DEFINER RPC — cleanest approach for deleting auth.users |
| 17 | Polls voting model | ✅ Upsert with `onConflict: poll_id,user_id` — users can change their vote; one vote per poll |
| 18 | Carpooling | ✅ Added as listing service category (not a separate posts engine) — same CRUD pattern |
| 19 | Saved listings | ✅ Composite PK `(user_id, listing_id)`; 23505 conflict silently swallowed on duplicate save |
| 20 | In-app chat model | ✅ Phase 12a per-listing threads built (society-readable, like post_comments); full 1:1 DMs deferred to 12b |
| 21 | Push notifications | ✅ DB architecture (pg_net triggers) + client token capture both complete; end-to-end delivery verifiable only on a native build (Phase 10) |
| 22 | SMS / OTP | ✅ Auth uses PIN (not SMS OTP); no SMS gateway needed — intentional, keeps infra simple |

---

## 10. Notifications — Current State

### WhatsApp (deep-link, NOT API)
WhatsApp is used as a **deep-link redirect** (opens `https://wa.me/<number>?text=...`), NOT an API integration.

| Trigger | Status | How it works |
|---------|--------|-------------|
| Buyer orders food | ✅ | `buildWhatsAppOrderLink()` — opens WhatsApp with pre-filled order message to chef's number |
| Buyer enquires about listing | ✅ | `buildInquiryWhatsAppLink()` — opens WhatsApp to listing owner's number |
| Any other action | ❌ | No WhatsApp API integration exists |

**Intentional design:** No paid WhatsApp Business API needed. Works via `wa.me` URL which every Indian smartphone user understands.

**Gap:** Users must have WhatsApp installed, and must have shared their WhatsApp number on their profile. If a number is missing, the button silently does nothing useful.

### SMS / OTP
Auth uses phone number as a **fake email alias** (`phone@senate.app`) with a **6-digit PIN as password**. There is **no real SMS OTP** — the user sets a PIN at signup and uses it to sign in. No SMS gateway (Twilio, MSG91, etc.) is integrated.

### Expo Push Notifications (native iOS/Android only)
The architecture exists but registration is **incomplete**:

| Component | Status |
|-----------|--------|
| `push_tokens` table (migration 0005) | ✅ Exists |
| `notify_user()` Postgres function via `pg_net` | ✅ Exists |
| Order status change → buyer notified | ✅ DB trigger fires |
| New inquiry → listing owner notified | ✅ DB trigger fires |
| **Token capture code in app** | ✅ **Done** — `registerPush()` (lib/push.ts) calls `getExpoPushTokenAsync()` and upserts to `push_tokens`; invoked from auth.tsx on login |
| New post/comment notification | ❌ Not implemented |
| New poll notification | ❌ Not implemented |
| Web push | ❌ Not supported (Expo tokens are native-only) |

**Status:** Token capture is wired (`lib/push.ts` → `getExpoPushTokenAsync()` with EAS project ID → upsert into `push_tokens`, called from `auth.tsx` on login). It is a **native-only no-op on web** (`Platform.OS === 'web' || !Device.isDevice` early-return), so end-to-end delivery can only be verified once a native build exists (Phase 10). The DB triggers (order status, new inquiry) will then have a token to deliver to. On web, push simply doesn't apply.

---

## 11. In-App Chat — Analysis & Plan

### What exists today
| Feature | Chat capability |
|---------|----------------|
| Feed posts | ✅ Realtime comment threads (post_comments) |
| Listing contact | ⚡ WhatsApp deep-link only — no in-app history |
| Food orders | ⚡ WhatsApp deep-link only |
| Direct messages | ❌ None |
| Carpool coordination | ⚡ WhatsApp only |

### Where in-app chat adds real value

**1. Per-listing inquiry threads (high value, low complexity)**
Right now, when a user enquires about a tutor or service, it opens WhatsApp. This loses the conversation from the app and requires the person to share their personal phone. A **per-listing thread** (same pattern as post_comments but scoped to a listing) lets:
- Buyer ask: "Are you available on Saturdays?"
- Owner reply in-app
- Both sides see the history in the app
- Admin can moderate if needed

**2. Carpool coordination threads (high value)**
Carpool listings inherently need multi-turn conversation (pickup point changes, last-minute cancellations). A thread per carpool listing is the right model.

**3. Direct messages / neighbour DMs (medium value, high complexity)**
Useful for private conversation that isn't tied to a listing (e.g., "Hey, can I borrow your parking slot this weekend?"). Full N-to-N DM system requires a `conversations` + `messages` schema, read receipts, notification infrastructure. Defer until after per-listing threads are stable.

### Recommendation — Phase 12: In-App Chat

**Phase 12a (per-listing threads — ✅ BUILT):**
- ✅ New table: `listing_messages (id, listing_id, author_id, body, created_at)` — migration `0021_listing_messages.sql`
- ✅ RLS: society members can read; members post as themselves (author_id = auth.uid()); author or admin deletes
- ✅ Realtime subscription on `listing_id` (`subscribeToListingMessages`)
- ✅ Push on new message: neighbour→owner, and owner-reply→all other thread participants (reuses `notify_user` + pg_net)
- ✅ UI: collapsible "Chat with owner" section (`components/listings/ListingChat.tsx`) on listing detail, lazy-loads + subscribes on first open
- ✅ Service layer: `src/lib/listingMessages.ts` (fetch/send/delete/subscribe)
- ✅ Migration `0021_listing_messages.sql` run in Supabase — **feature is LIVE**

**Phase 12b (direct messages — ✅ BUILT):**
- ✅ Tables (migration `0023_direct_messages.sql`): `dm_threads (id, community_id, user_a, user_b, last_message, last_message_at)` with canonical `user_a < user_b` + unique pair; `dm_messages (id, thread_id, sender_id, body, read_at, created_at)`
- ✅ RLS: only the two participants read/write; `dm_messages.update` lets a participant set `read_at`
- ✅ `dm_get_or_create_thread(p_other)` SECURITY DEFINER RPC — atomic, same-community enforced
- ✅ Trigger on new message: bumps thread `last_message`/`last_message_at` + push-notifies the recipient (reuses `notify_user`)
- ✅ Realtime on `dm_messages` + `dm_threads`
- ✅ Service layer: `src/lib/dm.ts` (getOrCreateThread, fetchInbox, fetchThread, fetchMessages, sendMessage, markThreadRead, fetchUnreadThreadCount, subscribe)
- ✅ UI: inbox `src/app/messages/index.tsx`, thread `src/app/messages/[threadId].tsx` (realtime, read receipts, profile link in header)
- ✅ Entry points: "Message" button on `profile/[userId]`, "Messages" in NavRail (desktop) + Home Community tile (mobile); routes registered in `_layout`
- ⏸️ **User action:** run `0023_direct_messages.sql` in Supabase to activate

---

## 12. End-to-End Testing Guide

### Step 1 — Run all Supabase migrations

Open **Supabase Dashboard → SQL Editor** and run these in order. Each file is in `/supabase/migrations/`:

```
0001_init.sql                ← communities, profiles, dishes, orders
0002_orders.sql              ← order RPCs
0003_auth_profiles.sql       ← auth + roles
0004_order_lifecycle.sql     ← full order lifecycle
0005_push.sql                ← push_tokens, notify_user() trigger
0006_serve_date.sql          ← serve_date on dishes
0007_tiffin.sql              ← tiffin_plans, subscriptions
0008_communities_meta.sql    ← communities.slug + address
0009_profile_community.sql   ← profiles.community_id FK
0010_listings.sql            ← listings table + RLS + realtime
0011_inquiries.sql           ← inquiries table + push trigger
0012_posts.sql               ← posts table + RLS + realtime
0013_post_comments.sql       ← post_comments + realtime
0014_society_requests.sql    ← society_join_requests
0015_delete_account_rpc.sql  ← delete_own_account() RPC
0016_app_versions.sql        ← app_versions table + seed row
0017_is_admin_fn.sql         ← is_admin() function + RLS updates
0018_saved_listings.sql      ← saved_listings table
0019_emergency_contacts.sql  ← emergency_contacts table
0020_polls.sql               ← polls + poll_options + poll_votes
0021_listing_messages.sql    ← per-listing chat threads + push  ✅ run
0022_fulltext_search.sql     ← search_tsv + GIN indexes         ✅ run
0023_direct_messages.sql     ← DMs: threads, messages, RPC      ✅ run
0024_listings_read_scope.sql ← community-scope listings_read    ✅ run
0025_member_moderation.sql   ← profiles.blocked + admin RPCs    (NEW — run this)
0026_notifications.sql       ← notifications + reads + triggers (NEW — run this)
```

### Step 2 — Create Supabase Storage bucket

In **Supabase Dashboard → Storage → New bucket**:
- Name: `listing-photos`
- Public: **Yes** (check the toggle)
- Click Create

### Step 3 — Create a test society (community)

In **Supabase → SQL Editor**:
```sql
insert into public.communities (name, slug, address)
values ('Green Valley Apartments', 'green-valley', 'Sector 12, Noida, UP')
returning id;
```
Copy the returned UUID — you'll use it in Step 5.

### Step 4 — Sign up your first user (yourself)

1. Open the web app (`npx expo start --web` or deployed URL)
2. Enter your phone number and create a 6-digit PIN
3. Fill in name, flat number, WhatsApp
4. In the society picker, select the society you just created
5. Complete sign-up

### Step 5 — Grant admin role to your account

In **Supabase → SQL Editor** (replace `<phone>` with your number):
```sql
update public.profiles
set roles = array['foodie', 'chef', 'admin']
where phone = '<your-phone-number>';
```

Or by user ID (find it in the auth.users table or profiles table):
```sql
update public.profiles
set roles = array['foodie', 'chef', 'admin']
where id = '<your-uuid>';
```

### Step 6 — Verify admin access in the app

Reload the app. You should now see:
- ✅ "Admin · manage members & roles" row in the You tab
- ✅ "Admin" link in the desktop NavRail
- ✅ Admin shield icon in the You tab header area
- ✅ "+" button on Emergency Contacts screen
- ✅ "Announcement" category available in Feed compose
- ✅ Can close/delete polls

### Step 7 — Feature test checklist

**Home Hub:**
- [ ] 15 service tiles visible (food + 14 categories)
- [ ] "Community" section shows Polls + Emergency tiles
- [ ] Tapping tiles navigates to correct screen
- [ ] Society badge shows your society name
- [ ] Greeting changes based on time of day

**Food engine:**
- [ ] Post a dish (as chef): name, slot, veg type, price, photo (optional)
- [ ] Order a dish (as another account or same in food tab): qty, confirm
- [ ] Order lifecycle: accept → cooking → delivered (Kitchen section)
- [ ] Tiffin: create a recurring tiffin service

**Listings:**
- [ ] Post a listing in any of the 14 categories
- [ ] Photo upload (tap camera area in CreateListingForm)
- [ ] View listing detail — bookmark button (top-right of hero)
- [ ] Tap "Contact on WhatsApp" — should open WhatsApp with pre-filled message
- [ ] Saved listings appear in You → Saved tab
- [ ] Search: type keywords in Search tab, filter by category chip

**Community Feed:**
- [ ] Post a General/Issue/Feedback/Event/Lost & Found message
- [ ] Admin: post an Announcement (non-admin shouldn't see this option)
- [ ] Comment on a post (from the post thread screen)
- [ ] Admin: pin a post, mark issue as resolved
- [ ] Realtime: open Feed in two tabs/devices, post from one → appears in the other

**Polls:**
- [ ] Home → Polls tile → polls screen
- [ ] Create a poll (any member) with 2+ options
- [ ] Vote on a poll — results bar appears
- [ ] Admin: close a poll, delete a poll

**Emergency Contacts:**
- [ ] Home → Emergency tile → emergency screen
- [ ] Admin: tap "+" → add a contact with name, phone, role type
- [ ] Tap dial button → should trigger a phone call (`tel:` link)
- [ ] Admin: delete a contact

**Profile:**
- [ ] You tab → tap avatar → profile/me.tsx
- [ ] Edit name, flat, WhatsApp, UPI → Save Changes
- [ ] Tap any listing owner's name → public profile page (profile/[userId])

**Admin panel (admin only):**
- [ ] You tab → Admin row → admin.tsx
- [ ] Members tab: see all members, toggle chef/admin roles
- [ ] Requests tab: see join requests (submit one from a second account to test)

---

## 13. Immediate Next Steps (updated)

**Backend setup — ✅ Done (2026-06-08):**
1. ✅ All migrations 0001–0020 run in Supabase
2. ✅ `listing-photos` public storage bucket created
3. ✅ Test community seeded + admin granted
4. ✅ Web deployed to GitHub + Vercel (main)

**Code — recently shipped (2026-06-08):**
5. ✅ **Phase 12a: Per-listing chat threads** — migration `0021_listing_messages.sql` (run), `lib/listingMessages.ts`, collapsible `ListingChat` on listing detail (realtime + push). **LIVE.**
6. ✅ Push token capture — `getExpoPushTokenAsync()` wired in lib/push.ts; end-to-end delivery to verify on native build (Phase 10)
7. ✅ Skeleton loaders for search results (`ListingCardSkeleton` grid)
8. ✅ Inquiry-count badge — "N interested" on MyListingsSection cards
9. ✅ Perf: category + search grids → FlashList; expo-image memory-disk cache + blurhash placeholders
10. ✅ **Phase 12b: Direct messages** — migration `0023`, `lib/dm.ts`, inbox + thread screens, Message button + NavRail/Home entry points.
11. ✅ **Full-text search** — migration `0022`, FTS `searchListings`/`searchPosts`, Search Listings/Posts toggle.
12. ✅ **PWA** — Supabase preconnect + service-worker shell precache. (Service worker already existed; food resize already shipped.)

**✅ Migrations 0022 + 0023 run and runtime-verified** (2026-06-08) against prod Supabase:
DM thread dedupe, realtime delivery, participant-only RLS (non-participant blocked), inbox
last-message bump, mark-read; FTS stem-matching on listings ("dancing"→"dance") and posts.

**⏸️ User action — run `0024_listings_read_scope.sql`** to apply the listings cross-society RLS fix.

**Code — polish shipped (2026-06-08):**
- ✅ **Unread-DM badge** — shared `UnreadDmsProvider` (one realtime sub) → badge on NavRail "Messages" + Home Messages tile (`9+` cap)
- ✅ **Recent searches** — `lib/recentSearches.ts` (AsyncStorage, deduped, max 8); tappable chips in the Search empty state with Clear; saved on submit + result tap
- ✅ **Security:** `listings_read` cross-society leak fixed — community-scoped in migration `0024` (run)
- ⏭️ **Skipped — Supabase Storage image transforms:** the render/transform endpoint is a paid (Pro) feature; on the free tier it 400s and would break thumbnails. 1000px upload + memory-disk cache already cover the win.

**Code — remaining candidates:**
- ⬜ Lighthouse ≥90 audit pass (PWA/perf/a11y) — needs a deployed build + the Lighthouse tool to measure
- ⬜ Per-thread unread indicators inside the DM inbox (nav badge done)
- ⬜ Tighten other `auth.role()='authenticated'`-only reads if any remain (audit dishes/tiffin)

**When ready for native (Phase 10):**
8. **⏸️ Apple Developer account** ($99/yr) → TestFlight → App Store
9. **⏸️ Google Play account** ($25) → internal track → Play Store
10. **⏸️ Verify push delivery end-to-end** — token registration is already wired (lib/push.ts); confirm tokens upsert + triggers deliver on a real native build
11. **⏸️ App icons** — 1024×1024 iOS icon + Android adaptive icon foreground layer

---

## 11. Change Log

| Date | What changed |
|------|-------------|
| 2026-06-09 | **NavRail collapse alignment fix + society badge restyle.** Collapsed-rail icons (bell / New Post / avatar / nav) were pushed right because the centering offset ignored the section's `paddingHorizontal:10` — set `iconMarginL` collapsed shift `9 → 0` so they center properly. Society-name badge restyled to a prominent **violet** pill (filled icon + semibold colored text) on Home, You, and Profile. |
| 2026-06-09 | **All Listings → bottom tab (mobile).** Moved `listings.tsx` into the `(tabs)` group and added it as a persistent footer tab (Home · Feed · **Listings** · Post · Search · You), dropping the back button (it's top-level now). Removed the Home "All Listings" Community tile (replaced by the tab); NavRail "Listings" item unchanged for desktop. Block/delete (0025) + notifications (0026) **runtime-verified** against prod. |
| 2026-06-09 | **Notifications + listings polish.** Notifications now include the user's **own** actions (dropped the `actor_id != me` filter — verified own announcement appears). Modal gained per-row **read/unread toggle** + **Mark all read/unread** (added `markUnread`, verified read-row delete under RLS). **Bell** placed in persistent chrome: mobile → TopBar, right of the theme switcher; desktop → a "Notifications" row in the NavRail just above the New Post CTA (collapses to icon-only). (Earlier Home-greeting-row placement reverted.) **All Listings** redesigned from a card grid into a responsive **table** — desktop columns (Listing · Category · Price · View/Contact actions), compact rows + WhatsApp quick-contact on mobile. tsc clean. |
| 2026-06-09 | **Community-app rework: roles, admin moderation, all-listings, notifications, announcement banner.** (1) **Roles simplified** to member + admin — removed the chef/foodie picker at signup; every member can cook/post (ungated post.tsx/you.tsx); profile/admin show Member/Admin only. (2) **Admin member management** (migration `0025`): `profiles.blocked` + `admin_set_blocked`/`admin_delete_member` RPCs (own-community, self-protected). Admin page lists community members with Message (DM) / Make-admin / Block / Delete; sign-in refuses blocked members with a message (defensive if 0025 unrun), deleted → normal no-account path; auth context force-signs-out a member blocked mid-session. (3) **All Listings** screen (`/listings`) — cross-category FlashList feed + filter; NavRail item + Home tile. (4) **Notifications** (migration `0026`): `notifications` + `notification_reads` + triggers (post/announcement/listing/poll/DM) + realtime; `NotificationsProvider` + bell (NavRail + TopBar) with unread badge + modal (tap→read+route, mark-all-read). (5) **Announcement banner** on Home (latest announcement, dismissable, persisted). tsc clean. ⏸️ run migrations 0025 + 0026. |
| 2026-06-09 | **Nav chrome cleanup.** Desktop NavRail: replaced the loose bottom items (About row + theme toggle + tagline — cramped when collapsed) with a single **account row** (avatar + name) that opens a popover menu: Profile · About · Light/Dark · Sign out. New Post stays as the coral CTA. Mobile: removed the duplicate profile icon from the Home header (the "You" tab already covers it; `/profile/me` still reachable from You). |
| 2026-06-09 | **UX fixes + Messages directory.** (1) Replaced the bottom "Post"/"New Post" FABs with a compact round `+`: on category screens it sits in the header (right, category-coloured); on the feed it sits inline at the right of the filter-tabs row — cleaner alongside the desktop NavRail. (2) **Bug fix — Messages had no way to start a chat:** added a member-directory `messages/new.tsx` (searchable list of community neighbours → `getOrCreateThread` → thread), a `+` compose button in the inbox header, a "New message" button in the empty state, and `fetchCommunityMembers()` in `lib/dm.ts`; verified it returns real neighbours. (3) Brand logo/title in NavRail (desktop) + TopBar (mobile) now route to Home. tsc clean. |
| 2026-06-09 | **README rewritten** to match the current Aangan platform (was stale "Senate Chef" food-only/no-login docs). **Bug report investigated — NOT a bug:** "every feed post lands in General". Write path is correct (`createPost` inserts the selected `category`; single call site at feed.tsx) and a live DB read confirmed posts persist their real category (e.g. a `feedback` post stored as `feedback`, not `general`). The earlier test posts were simply created as General. No code change. |
| 2026-06-08 | **Polish: unread-DM badge + recent searches.** Migration 0024 run (listings RLS scoped). `UnreadDmsProvider` (one shared realtime sub) drives an unread-count badge on the NavRail "Messages" item + Home Messages tile. `lib/recentSearches.ts` (AsyncStorage, deduped, max 8) → tappable Recent chips in the Search empty state, saved on submit + result tap. Skipped Supabase Storage image transforms (paid Pro feature — would 400/break thumbnails on free tier). tsc clean. |
| 2026-06-08 | **DMs + FTS verified; listings RLS security fix.** Migrations 0022 (FTS) + 0023 (DMs) run and **runtime-verified against prod** (DM thread dedupe, realtime, participant-only RLS with non-participant blocked, inbox bump, mark-read; FTS stem-match on listings + posts). Added migration `0024_listings_read_scope.sql` tightening `listings_read` from `auth.role()='authenticated'` to community-scoped (matches posts/listing_messages) — closes a cross-society listings read leak. ⏸️ run 0024. |
| 2026-06-08 | **Phase 12b DMs + full-text search + PWA polish.** (1) Verified Phase 12a chat end-to-end against prod Supabase (insert/select RLS, persistence, realtime publication — PASS). (2) **DMs (12b):** migration `0023` (dm_threads/dm_messages + RLS + realtime + push + `dm_get_or_create_thread` RPC), `lib/dm.ts`, inbox + thread screens, Message button on profile, NavRail "Messages" + Home tile. (3) **Full-text search:** migration `0022` (search_tsv GIN on listings+posts), FTS-first `searchListings` + new `searchPosts`, Search screen Listings/Posts toggle. (4) **PWA:** Supabase preconnect/dns-prefetch in +html, sw.js precaches shell on install (cache→aangan-v2). Confirmed food photo resize already shipped. `tsc --noEmit` clean. ⏸️ run migrations 0022 + 0023. |
| 2026-06-08 | **NavRail collapse fix + tsc clean.** Collapsed left rail: "New Post" CTA and theme-toggle labels were missing `numberOfLines={1}`, so at `maxWidth:0` the hidden text wrapped vertically and ballooned the coral button height — added `numberOfLines={1}` to both (matches NavItemRow). Fixed the 2 remaining `tsc` errors: `router.push('/food' as any)` in index.tsx (Expo typed-routes) and `resolved` in theme.tsx now collapses `ColorSchemeName` (incl. `unspecified`/null) to `'light'\|'dark'`. `npx tsc --noEmit` now fully clean. |
| 2026-06-08 | **Phase 12a + polish shipped.** Per-listing chat: migration `0021_listing_messages.sql` (RLS, realtime, push trigger), `lib/listingMessages.ts`, collapsible `ListingChat` on listing detail. Polish: category + search grids → `FlashList` (numColumns, centered maxWidth; dropped `estimatedItemSize` for FlashList v2, incl. feed.tsx); `ListingCardSkeleton` for search; `IMAGE_CACHE_PROPS` (memory-disk + neutral blurhash + fade) on ListingCard/listing hero/DishCard; "N interested" inquiry-count badge on My Listings. Installed missing local dep `@shopify/flash-list`. ⏸️ user must run migration 0021. |
| 2026-06-08 | **Plan sync to reality:** backend live (all migrations 0001–0020 run, `listing-photos` bucket, community seeded, admin granted); web deployed to GitHub + Vercel. Corrected push token capture from "MISSING" to ✅ (wired in lib/push.ts, called from auth.tsx). Reconciled Phase 9 prose with dashboard (PostCard memo / posts FlashList / posts skeletons / posts pagination all ✅; listing-grid FlashList + search skeletons remain ⬜). Next code feature: Phase 12a per-listing chat. |
| 2026-06-08 | Plan major update: added E2E testing guide (Section 12), notifications analysis (Section 10), in-app chat analysis + Phase 12 plan (Section 11). Phase 9 items all complete: mobile nav to community features, posts pagination, announcement admin-only, PostCard memo, FlashList, skeletons, update banner. |
| 2026-06-08 | Phase 11 complete: Polls, Emergency Contacts, Saved Listings, Carpooling, Public Profile, NavRail updates, bookmark button on listing detail. Migrations 0018–0020 added. |
| 2026-06-07 | Added astrology (Astrology) to services.ts. Home hub now shows 14 categories. |
| 2026-06-07 | Phase 3 complete: added daycare (Day Care), fitness (Yoga & Fitness), arts (Arts & Activities) to services.ts. Home hub now shows 13 categories. |
| 2026-06-07 | Plan fully rewritten. Phases 1 + 2 marked complete. Added: 3 new categories (Day Care, Yoga & Fitness, Arts & Activities), multi-society UI, full user profile, society onboarding, community posts/threads, issues/feedback page, search & filter, access control hardening, about page, version update notification, performance phase (Phase 9), iOS/Android phase (Phase 10), future enhancements (Phase 11). |
| 2026-06-07 | Phase 2 complete: listings engine, all 10 categories, inquiry flow, bug fixes (post.tsx hooks, category blank page). |
| 2026-06-07 | Phase 1 complete: Aangan rebrand, Home hub, service registry, nav restructure. |
| 2026-06-06 | Original PLATFORM_PLAN.md created (architecture decisions, data model, 3-engine approach). |
| 2026-06-06 | PLAN.md: Phases A–C complete (auth, order lifecycle, push, tiffin, future dates). |
