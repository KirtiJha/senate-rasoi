# Aangan — Community Platform Plan
> **Living document.** Always kept in sync with the codebase. Update on every significant commit.
> **App:** Aangan (आँगन — courtyard) · **From:** Senate Rasoi (single-society food app)
> **Last updated:** 2026-06-07

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
| Service registry (10 cats) | ✅ | services.ts with attributes |
| Listings engine | ✅ | listings.ts, ListingCard, CreateListingForm, InquiryModal |
| Category feeds | ✅ | c/[category].tsx with realtime + cache |
| Listing detail + contact | ✅ | listing/[id].tsx |
| My Listings (You tab) | ✅ | MyListingsSection |
| Post screen (all categories) | ✅ | Category picker → correct form (hook bug fixed) |
| Multi-society DB schema | ✅ | community_id on profiles + listings (migrations 0008–0011) |
| Multi-society UI | ⬜ | COMMUNITY_ID still hardcoded; no society picker at sign-up |
| New categories (Day Care, Yoga, Arts) | ✅ | daycare, fitness, arts in services.ts |
| User profile page | ⬜ | No dedicated profile screen |
| Society onboarding (admin) | ⬜ | Not started |
| Request to add society | ⬜ | Not started |
| Community posts / threads | ⬜ | Not started |
| Search & filter | ⬜ | Not started |
| Issues / feedback page | ⬜ | Not started |
| Society-based access control | ⬜ | Not started |
| About page + version | ⬜ | Not started |
| Performance (FlatList, pagination) | ⬜ | Not started |
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

### 2b. New categories to add — ⬜

| # | Key | Label | Rationale |
|---|-----|-------|-----------|
| 10 | `daycare` | Day Care | Childcare services in the society; high demand |
| 11 | `fitness` | Yoga & Fitness | Yoga, gym trainers, Zumba, meditation |
| 12 | `arts` | Arts & Activities | Dance, painting, music, craft — all creative classes |

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
│         service tile grid (13 categories)            │
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

### 4b. Pending tables (new migrations needed)

**0012 — `posts` (community thread / noticeboard)**
```sql
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  author_id    uuid not null references profiles(id) on delete cascade,
  category     text not null default 'general'
                 check (category in ('general','issue','feedback','suggestion','event','lost_found')),
  title        text,
  body         text not null,
  photos       text[] not null default '{}',
  pinned       boolean not null default false,
  resolved     boolean not null default false,  -- for issues/feedback
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index posts_feed_idx on posts (community_id, category, created_at desc);
alter table posts enable row level security;
-- read: community members; write: owner or admin
alter publication supabase_realtime add table posts;
```

**0013 — `post_comments`**
```sql
create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index comments_post_idx on post_comments (post_id, created_at);
alter table post_comments enable row level security;
alter publication supabase_realtime add table post_comments;
```

**0014 — `society_join_requests`**
```sql
create table public.society_join_requests (
  id              uuid primary key default gen_random_uuid(),
  society_name    text not null,
  society_address text not null,
  requester_name  text not null,
  requester_phone text not null,
  requester_email text,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  admin_note      text,
  created_at      timestamptz not null default now()
);
-- Visible to super-admins only; writable by anyone (unauthenticated allowed for request submission)
```

**0015 — `app_versions`** (for update notifications)
```sql
create table public.app_versions (
  id           serial primary key,
  version      text not null,       -- e.g. "1.2.0"
  build_number integer not null,
  platform     text not null check (platform in ('web','ios','android','all')),
  force_update boolean not null default false,
  release_notes text,
  created_at   timestamptz not null default now()
);
-- Read-only for all authenticated users
```

**0016 — `saved_listings`** (bookmarks)
```sql
create table public.saved_listings (
  user_id    uuid references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  saved_at   timestamptz not null default now(),
  primary key (user_id, listing_id)
);
```

**0017 — `listing_reports`** (moderation)
```sql
create table public.listing_reports (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason     text not null,
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
```

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

### New routes needed ⬜
```
profile/[userId].tsx     Public profile — user's listings, contact
profile/me.tsx           My profile — edit, reset PIN, delete account, alerts
community/[id].tsx       Society detail page (for multi-society browse)
feed/index.tsx           Community posts feed (general + noticeboard)
feed/[postId].tsx        Post thread with realtime comments
feedback/index.tsx       Issues / feedback / suggestions feed
feedback/[postId].tsx    Single feedback thread
search/index.tsx         Cross-category search with filters
admin/societies.tsx      Super-admin: manage all societies
admin/requests.tsx       Society join requests
about.tsx                App info, version, update prompt
```

### Updated tab bar ⬜
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

**Still needed from Phase 2 (user action required):**
- ⏸️ Run migrations 0008–0011 in Supabase SQL editor
- ⏸️ Create `listing-photos` public storage bucket in Supabase

---

### ✅ Phase 3 — New Categories
*Complete. Deployed to main.*

- ✅ Added `daycare` (Day Care) to `services.ts` — age range, timings, capacity, meals, pickup
- ✅ Added `fitness` (Yoga & Fitness) to `services.ts` — type, level, format, timings, gender
- ✅ Added `arts` (Arts & Activities) to `services.ts` — dance/painting/music/craft combined; type, age group, format, style, timings
- ✅ `CreateListingForm` renders all 3 correctly (attribute-driven, no code changes needed)
- ✅ Home hub grid now shows 13 categories

---

### ⬜ Phase 4 — Multi-Society & User Identity
*High value. Required for growth beyond a single society.*

#### 4a. Society selection at sign-up
- ⬜ `communities` table populated with real society data (name, address, slug, city)
- ⬜ Sign-up screen: **society picker** (searchable dropdown/list of active communities)
- ⬜ `profile.community_id` set at sign-up from picker selection
- ⬜ Remove hardcoded `COMMUNITY_ID` constant; read from `auth context → profile.community_id`
- ⬜ All service layer calls (`fetchListings`, `fetchDishes`, etc.) use dynamic community_id
- ⬜ Society name/logo shown in **app header** and **profile page**

#### 4b. Society join request flow
- ⬜ "My society isn't listed" option on sign-up → `society_join_requests` record (migration 0014)
- ⬜ Request form: society name, address, city, requester contact
- ⬜ Super-admin view: pending requests → approve (creates community row) or reject

#### 4c. Admin society onboarding
- ⬜ `admin/societies.tsx` — super-admin list of all communities
- ⬜ Create new community (name, slug, address, city, timezone)
- ⬜ Assign initial admin (by phone number lookup)
- ⬜ `admin/requests.tsx` — pending join requests with approve/reject

#### 4d. Full user profile page
- ⬜ `profile/me.tsx` — my profile screen with:
  - View/edit name, flat, WhatsApp, UPI (synced from `saveProfile`)
  - Society name + badge (can't self-change; link to contact admin)
  - **Reset PIN** — re-enter old code + set new 6-digit code (Supabase password update)
  - **Alert subscriptions** — toggle push categories (new food posts, new listings in chosen categories, community announcements)
  - **My activity** — listings posted, inquiries made, orders count (summary stats)
  - **Service history** — flat list of all orders + inquiries with status
  - **Delete account** — confirmation dialog → delete profile + auth user (GDPR; hard delete)
- ⬜ `profile/[userId].tsx` — public view: listings by user, contact button
- ⬜ Society displayed in profile header (name + wing/area)

---

### ⬜ Phase 5 — Community Feed & Discussions
*The "noticeboard + Reddit-lite" for each society.*

#### 5a. Posts / threads
- ⬜ Migrations 0012 (`posts`) + 0013 (`post_comments`)
- ⬜ `lib/posts.ts` — fetch, create, subscribe (realtime)
- ⬜ `lib/comments.ts` — fetch, post, subscribe
- ⬜ `feed/index.tsx` — community posts feed; tabs: All · General · Events · Lost & Found
- ⬜ `feed/[postId].tsx` — thread view with realtime comment stream
- ⬜ Post composer: title (optional), body, photos, category tag
- ⬜ Admin: pin posts, delete any post/comment

#### 5b. Issues / feedback / suggestions
- ⬜ `feedback/index.tsx` — feed filtered to `category IN ('issue','feedback','suggestion','feature_request')`
- ⬜ Dedicated tab or section under Feed (not a separate tab — keep tab count ≤ 5)
- ⬜ Status badge: Open · In review · Resolved (admin marks resolved)
- ⬜ Anyone can comment; author and admin can close
- ⬜ Push to admin when new issue/feedback posted

---

### ⬜ Phase 6 — Search & Filter
*Discoverability across all content.*

- ⬜ `search/index.tsx` — unified search bar
  - Listings search: full-text on `title + description` (Postgres `to_tsvector`)
  - Posts search: full-text on `title + body`
  - Filter panel per category: price range, attributes (subject, condition, trade…)
  - "Near me" sort (building wing/flat proximity — simple text match for now)
- ⬜ Per-category filter bar in `c/[category].tsx` (price range, key attribute filter)
- ⬜ Food board filters: veg/non-veg toggle (already partial), slot, date — verify complete
- ⬜ Supabase full-text search indexes (add in migration 0018)
- ⬜ Recent searches stored locally (AsyncStorage)

---

### ⬜ Phase 7 — Access Control Hardening & Admin Tools
*Make RLS bulletproof and give admins proper tools.*

- ⬜ Verify all RLS policies scope to `auth.uid()`'s `community_id` (not trusting client-side filter)
- ⬜ `is_admin(uid)` DB function checks `profiles.roles @> ARRAY['admin']` AND `community_id` match
- ⬜ Super-admin role (`roles @> ARRAY['super_admin']`) bypasses community scoping in RLS
- ⬜ Admin dashboard improvements:
  - Reported listings queue (`listing_reports` — migration 0017)
  - Member management: change roles, remove member, reset their PIN
  - Category toggles per society (`community_services` table — enable/disable/reorder categories)
  - Pinned posts management
- ⬜ Rate limiting (Supabase RLS + pg function): max 10 listings/day per user, 50 posts/day

---

### ⬜ Phase 8 — About Page & App Ops
- ⬜ `about.tsx` — app info screen:
  - App name, version (from `Constants.expoConfig.version`), build number
  - Short description and tagline
  - Credits / built by
  - Links: Privacy Policy, Terms, Support email
- ⬜ **Update notification banner** — on app load, check `app_versions` table (migration 0015):
  - If `force_update = true` and current version < latest → block app with update dialog
  - If soft update → dismissible banner in Home header
- ⬜ "About" entry in You tab / profile screen

---

### ⬜ Phase 9 — Performance & Scalability
*Goal: fast cold start, smooth 60fps scroll, works for 1000+ concurrent users.*

#### 9a. Rendering performance
- ⬜ Replace `ScrollView + .map()` listing grids with `FlashList` (Shopify) — 10× faster
  than FlatList for variable-height items; keep ScrollView only for single-screen forms
- ⬜ `React.memo` on `ListingCard`, `DishCard` (prevent re-render on unrelated state changes)
- ⬜ `useCallback` on all list item `onPress` handlers
- ⬜ Skeleton loading states for all feeds (already done for category feed; extend to food, search)

#### 9b. Data & caching
- ⬜ Paginate all feeds: `limit(20)` + "Load more" / infinite scroll (listings, posts, orders)
- ⬜ Narrow Supabase `select()` columns — only fetch what's displayed (drop legacy columns)
- ⬜ Stale-while-revalidate: show AsyncStorage cache instantly, fetch in background (extend
  the pattern already in `c/[category].tsx` to all feeds)
- ⬜ Debounce realtime refetch (50ms) to batch rapid DB events into one reload
- ⬜ Consider TanStack Query for cache deduplication across screens

#### 9c. Image performance
- ⬜ `expo-image` with `cachePolicy="memory-disk"` everywhere (no raw `<Image>` from RN)
- ⬜ Upload pipeline: resize to 1000px width + JPEG 0.7 (already done for listings; apply to food)
- ⬜ Blurhash placeholders while images load
- ⬜ Supabase Storage image transforms (`?width=400&quality=75` URL param) for thumbnails vs full

#### 9d. Web / PWA
- ⬜ Service worker: offline shell + asset caching (Expo's built-in SW + `expo-router`'s static export)
- ⬜ Route code-splitting (Expo Router does this by default — verify bundles)
- ⬜ `preconnect` to Supabase URL in `+html.tsx`
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

### ⬜ Phase 10 — iOS & Android (EAS)
*After web version is stable and feature-complete.*

#### 10a. Build setup
- ⬜ `eas.json` — preview + production build profiles
- ⬜ EAS Build: iOS (requires Apple Developer account, $99/yr) + Android (Google Play, $25 one-time)
- ⬜ App icons: 1024×1024 iOS + Android adaptive icon (foreground + background layers)
- ⬜ Splash screen: branded, no white flash
- ⬜ Expo Updates (`expo-updates`) for OTA JS updates between store releases

#### 10b. Native-specific features
- ⬜ Push notifications: verify Expo Push works end-to-end on real device (pg_net → Expo → APNS/FCM)
- ⬜ Haptics: verify all haptic calls work (`expo-haptics`)
- ⬜ Share sheet: native share (photos, listing links) — `expo-sharing` + deep links
- ⬜ Deep linking: `aangan://listing/[id]` → opens correct screen (push notification tap)
- ⬜ App Badge: unread inquiry/order count on app icon (iOS + Android)

#### 10c. Store submission
- ⬜ TestFlight (iOS internal test → external beta → App Store)
- ⬜ Google Play internal track → closed beta → production
- ⬜ Store listings: screenshots (6.5" iPhone, 12.9" iPad, Pixel), description, keywords
- ⬜ Privacy policy URL (required for both stores)
- ⬜ Age rating (likely 4+, content is community-generated)

---

### ⬜ Phase 11 — Future Enhancements (prioritise later)

These are good ideas for a thriving community app. Assess after Phase 5–6 based on user demand:

| Feature | What it is |
|---------|-----------|
| **Events & Calendar** | Society can post events (Diwali puja, maintenance notice, AGM); community calendar view |
| **Lost & Found** | Separate category for lost keys, pets, items within listing engine (already `feed` category) |
| **Carpooling** | Residents going same direction offer rides; post format similar to jobs |
| **Polls & Surveys** | Society admin creates a poll; residents vote; realtime results |
| **Emergency Contacts** | Society-level pinned directory: security number, maintenance, doctor on call |
| **Saved / Bookmarks** | Save listings across categories (`saved_listings` — migration 0016 ready) |
| **Endorsements** | "12 neighbours verified this" for Service Directory (`listing_endorsements` table) |
| **Reviews & Ratings** | Star rating on completed services/orders; trust layer |
| **Appointments** | Basic scheduling for clinic/tuition (calendar slot picker → WhatsApp confirm) |
| **Verified Provider Badge** | Admin-granted badge for vetted service providers (doctor, CA, etc.) |
| **Society Newsletter** | Weekly digest of new listings + posts → email or push |

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

---

## 10. Immediate Next Steps (ordered)

1. **✅ Phase 3** — 3 new categories added to `services.ts`
2. **⏸️ Supabase** — User runs migrations 0008–0011 + creates `listing-photos` bucket
3. **⬜ Phase 4** — Multi-society UI: society picker at sign-up, remove hardcoded COMMUNITY_ID
4. **⬜ Phase 4** — User profile page (`profile/me.tsx`) + society display in header
5. **⬜ Phase 5** — Posts/threads engine (migrations 0012–0013 + feed screens)
6. **⬜ Phase 6** — Search & filter
7. **⬜ Phase 7** — Access control hardening + admin tools
8. **⬜ Phase 8** — About page + version/update notification
9. **⬜ Phase 9** — Performance (FlashList, pagination, Lighthouse)
10. **⬜ Phase 10** — iOS/Android (EAS builds, store submission)

---

## 11. Change Log

| Date | What changed |
|------|-------------|
| 2026-06-07 | Phase 3 complete: added daycare (Day Care), fitness (Yoga & Fitness), arts (Arts & Activities) to services.ts. Home hub now shows 13 categories. |
| 2026-06-07 | Plan fully rewritten. Phases 1 + 2 marked complete. Added: 3 new categories (Day Care, Yoga & Fitness, Arts & Activities), multi-society UI, full user profile, society onboarding, community posts/threads, issues/feedback page, search & filter, access control hardening, about page, version update notification, performance phase (Phase 9), iOS/Android phase (Phase 10), future enhancements (Phase 11). |
| 2026-06-07 | Phase 2 complete: listings engine, all 10 categories, inquiry flow, bug fixes (post.tsx hooks, category blank page). |
| 2026-06-07 | Phase 1 complete: Aangan rebrand, Home hub, service registry, nav restructure. |
| 2026-06-06 | Original PLATFORM_PLAN.md created (architecture decisions, data model, 3-engine approach). |
| 2026-06-06 | PLAN.md: Phases A–C complete (auth, order lifecycle, push, tiffin, future dates). |
