# Community Platform — Architecture & Expansion Plan

> **Status:** Draft for review · **Date:** 2026-06-07
> **From:** A single-purpose home-food app (current "Senate Rasoi")
> **To:** A multi-service community platform for a residential society
>
> This document proposes how to evolve the existing app into a general
> community services platform without throwing away the working food vertical.
> Nothing here is built yet — review, adjust, confirm, then we implement.

---

## 1. Vision

One app for everything a residential society needs from its own people:
home food, tuitions, tailoring, income-tax help, a clinic, catering,
decoration, job referrals, buy & sell, and a trusted directory of service
people (plumber, electrician, maid, driver…).

Today's food service becomes **one tile among many**. The app becomes the
society's shared "courtyard" — discover a service, see who in the building
offers it, and reach out (WhatsApp + UPI, as today). No in-app payments.

**Design tenet:** reuse the patterns that already work (auth, roles, RLS,
SECURITY DEFINER RPCs, realtime, push, WhatsApp deep-links, NativeWind
design system) and add the *minimum* new machinery to support many services.

---

## 2. The core insight — services collapse into 3 engines

The 10 services map onto a small number of **interaction archetypes**. This
is the single most important decision in the plan: we do **not** build 10
verticals. We build 3 engines and configure the rest.

| # | Service | Archetype | Engine |
|---|---------|-----------|--------|
| 1 | **Food** (dishes, tiffin) | Listings + inventory + order lifecycle + recurring | **Food engine** (exists today) |
| 2 | Tuitions for kids | Provider offering → inquiry / enrol | Listings engine |
| 3 | Tailoring | Provider offering → inquiry | Listings engine |
| 4 | Income tax | Professional service → inquiry / appointment | Listings engine |
| 5 | Clinic | Provider → inquiry / appointment | Listings engine |
| 6 | Catering | Event service → quote / inquiry | Listings engine |
| 7 | Decoration | Event service → quote / inquiry | Listings engine |
| 8 | Job referral | Community post (offer / seek) | Listings engine |
| 9 | Buy & sell products | Classified listing (has "sold" state) | Listings engine |
| 10 | Service-person contacts | Trusted directory / recommendation | Listings engine (referral mode) |

**Three engines:**

1. **Food engine** — the existing, rich vertical (`dishes`, `orders`,
   `tiffin_plans`, `subscriptions`). Genuinely different mechanics (atomic
   stock reserve, multi-state order lifecycle, no-cron recurring). **Kept
   as-is**, just *registered* into the new home so it feels like one service.

2. **Listings engine** — a single shared model + UI that powers services
   2–10. A listing has a category, a title/description/photos/price, an owner,
   a status, and a small bag of **category-specific attributes** (JSONB). One
   feed, one card, one detail screen, one create form — differentiated by
   category config.

3. **Inquiry engine** — the lightweight "I'm interested" action shared across
   listings (mirrors how ordering food opens WhatsApp today). Optionally
   records an in-app lead so owners get a notification and a count.

Everything is unified by a **service registry** (a config catalog) and a new
**Home hub** (grid of service tiles).

---

## 3. Architecture overview

```
                          ┌─────────────────────────┐
                          │      HOME HUB (new)      │
                          │  grid of service tiles   │
                          └────────────┬─────────────┘
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
          ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
          │  FOOD ENGINE │   │ LISTINGS ENGINE  │   │  DIRECTORY   │
          │ (unchanged)  │   │ (services 2–9)   │   │ (referral    │
          │ dishes/orders│   │ listings+inquiry │   │  mode of     │
          │ tiffin/subs  │   │ +attributes      │   │  listings)   │
          └──────────────┘   └──────────────────┘   └──────────────┘
                  │                    │                    │
                  └──────────── Supabase (Postgres) ────────┘
            auth.uid() · RLS · SECURITY DEFINER RPCs · realtime · push
```

- **Service registry** (`src/lib/services.ts`) is the source of truth for what
  categories exist, their icon/color/blurb, which engine renders them, their
  attribute schema, and their call-to-action verb. Adding a new "light"
  service later = add one entry + (maybe) an attribute schema. No migration.
- The **food engine** is registered as the `food` category but routes to its
  existing screens/components.
- The **listings engine** is one table + one service layer + a handful of
  generic components, driven by the registry.

---

## 4. Data model

### 4.1 Service registry (config first, DB toggle later)

The catalog lives in TypeScript (rarely changes, drives lots of UI):

```ts
// src/lib/services.ts
export type ServiceKind = 'food' | 'listing';
export type ListingType = 'service' | 'product' | 'post' | 'recommendation';
export type CTA = 'order' | 'inquire' | 'buy' | 'contact' | 'book';

export interface AttrField {
  key: string;            // stored in listings.attributes JSONB
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'toggle';
  options?: string[];     // for select/multiselect
  required?: boolean;
}

export interface ServiceCategory {
  key: string;            // 'food' | 'tuition' | 'market' | ...
  label: string;          // "Home Food", "Tuitions", "Buy & Sell"
  blurb: string;          // one-liner for the tile
  icon: string;           // Ionicon name or emoji
  color: string;          // accent for the tile
  kind: ServiceKind;      // 'food' routes to food engine; 'listing' to listings engine
  listingType?: ListingType;
  cta: CTA;
  attributes: AttrField[];// category-specific form fields
  enabled: boolean;
  order: number;
}
```

**Phase-2 nicety:** a tiny `community_services` table (`community_id`,
`category_key`, `enabled`, `sort`) lets a society admin turn categories
on/off and reorder them at runtime. The TS catalog stays the schema; the DB
row is just per-community on/off. Not needed for v1.

### 4.2 `listings` — the shared table (services 2–10)

```sql
create table public.listings (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities(id) on delete cascade,
  category        text not null,            -- 'tuition' | 'market' | 'directory' | ...
  owner_user_id   uuid not null references public.profiles(id) on delete cascade,

  title           text not null,
  description     text,
  photos          text[] not null default '{}',

  price           integer,                  -- nullable; meaning per category
  price_unit      text,                     -- 'fixed'|'per_hour'|'per_month'|'per_session'|'negotiable'|null

  -- contact (denormalized for convenience; falls back to owner profile)
  contact_whatsapp text,
  contact_phone    text,
  location         text,                    -- flat / wing / area

  status          text not null default 'active'
                    check (status in ('active','closed','sold','expired')),

  -- archetype E: recommending a third-party service person (not a member)
  is_referral     boolean not null default false,
  referral_name   text,                     -- "Ramesh – Electrician"
  referral_phone  text,

  attributes      jsonb not null default '{}',  -- category-specific fields
  expires_at      timestamptz,              -- auto-expire classifieds/posts
  bump_at         timestamptz not null default now(),  -- freshness sort
  created_at      timestamptz not null default now()
);

create index listings_feed_idx   on public.listings (community_id, category, status, bump_at desc);
create index listings_owner_idx  on public.listings (owner_user_id);
create index listings_attrs_idx  on public.listings using gin (attributes);
```

This single table covers:
- **Service offerings** (tuition/tailoring/tax/clinic/catering/decor): `price` +
  `price_unit`, `attributes` like `{subject, grade, mode}` or `{speciality, timings}`.
- **Buy & sell**: `price` (asking), `status` flips to `'sold'`, `attributes`
  like `{condition, brand}`.
- **Job referral**: `listingType: 'post'`, `attributes` like `{kind: 'offer'|'seek', role}`.
- **Service-person directory**: `is_referral = true`, `referral_name/phone`,
  `attributes` like `{trade}`.

**RLS — mirrors the existing `dishes` conventions exactly:**

```sql
alter table public.listings enable row level security;

create policy listings_read   on public.listings
  for select using (auth.role() = 'authenticated');

create policy listings_insert on public.listings
  for insert with check (
    auth.uid() = owner_user_id
    and exists (select 1 from public.communities c where c.id = community_id)
  );

create policy listings_update on public.listings
  for update using (auth.uid() = owner_user_id or public.is_admin(auth.uid()));

create policy listings_delete on public.listings
  for delete using (auth.uid() = owner_user_id or public.is_admin(auth.uid()));
```

Realtime: `alter publication supabase_realtime add table public.listings;`

### 4.3 `inquiries` — the shared lead/interest table

```sql
create table public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  from_user_id  uuid not null references public.profiles(id) on delete cascade,
  message       text,
  status        text not null default 'open' check (status in ('open','closed')),
  created_at    timestamptz not null default now(),
  unique (listing_id, from_user_id)
);

alter table public.inquiries enable row level security;

create policy inquiries_read on public.inquiries
  for select using (
    from_user_id = auth.uid()
    or exists (select 1 from public.listings l
               where l.id = listing_id and l.owner_user_id = auth.uid())
    or public.is_admin(auth.uid())
  );

create policy inquiries_insert on public.inquiries
  for insert with check (from_user_id = auth.uid());

create policy inquiries_update on public.inquiries
  for update using (from_user_id = auth.uid()
                    or exists (select 1 from public.listings l
                               where l.id = listing_id and l.owner_user_id = auth.uid()));
```

> **v1 can ship without `inquiries`** — every CTA can simply deep-link to
> WhatsApp, exactly like food ordering does today. The table is what unlocks
> "3 neighbours interested" counts and owner push notifications. Recommended,
> but droppable to ship faster.

### 4.4 Notifications — reuse what exists

The food app already has `push_tokens` + `notify_user(uid, title, body)` +
the `pg_net` → Expo Push pipeline. We **reuse it directly**:

```sql
create trigger trg_inquiry_notify
  after insert on public.inquiries
  for each row execute function public.on_inquiry_create();
-- on_inquiry_create() looks up listing.owner_user_id and calls notify_user().
```

No new push infrastructure needed.

### 4.5 Food vertical — unchanged, just registered

`dishes`, `orders`, `tiffin_plans`, `subscriptions`, their RPCs, RLS,
triggers, and realtime all stay exactly as they are. The food category in the
registry has `kind: 'food'` and routes to the existing Discover/Kitchen
screens. Zero risk to the working product.

### 4.6 Storage

Generalize the `dish-photos` bucket to a shared `listing-photos` bucket
(food keeps its own bucket; new listings use the new one), pathed as
`listing-photos/{community_id}/{listing_id}/{n}.jpg`. Same client-side
compression pipeline already in `post.tsx` (`expo-image-manipulator`,
1000px, 0.7 JPEG). Add Storage RLS policies (currently photos work but the
bucket policies live outside migrations — we'll add them properly this time).

### 4.7 Later additions (Phase 4, noted not designed)

- `listing_endorsements (listing_id, user_id)` → "12 neighbours recommend"
  for the trusted directory (social proof).
- `saved_listings (user_id, listing_id)` → cross-service bookmarks.
- `appointments` → real scheduling for clinic/tuition (until then: inquiry +
  WhatsApp).
- `reviews` / ratings on providers.
- `reports` → flag a listing for admin moderation.

---

## 5. Information architecture (navigation redesign)

**Today:** `Discover · Post · You` (food-centric).

**Proposed:**

| Tab | Phone | Desktop rail | Purpose |
|-----|-------|--------------|---------|
| **Home** | ✓ | ✓ | Service tile grid — the new landing |
| **Search** | optional | ✓ | Cross-service search (Phase 4; can start as icon in Home) |
| **Post (+)** | ✓ centre | ✓ button | Category-aware create: pick category → right form |
| **You** | ✓ | ✓ | Profile, my listings, my inquiries, my orders/kitchen/tiffins, admin |

**Routes (Expo Router):**

```
src/app/(tabs)/
  index.tsx              # NEW Home hub (service grid)
  post.tsx               # generalized create (category picker → form)
  you.tsx                # generalized "my stuff"
src/app/
  c/[category].tsx       # generic category feed (listings engine)
  food/index.tsx         # food board (existing Discover logic, moved)
  listing/[id].tsx       # generic listing detail + inquire/contact CTA
  admin.tsx              # extended: members + categories + moderation
```

- Home tile for **food** → `/food` (existing board, untouched).
- Home tile for any **listing** category → `/c/tuition`, `/c/market`, etc.
- Tapping a listing → `/listing/[id]` with the category's CTA.
- Desktop rail shows Home + a short list of top categories + Post + You +
  Admin + theme toggle (extends the current `NavRail`).

---

## 6. Roles & permissions evolution

Today: `foodie` (default), `chef` (food provider), `admin`.

**Proposed — keep it simple, avoid per-category role explosion:**

- **Every member can post any listing** (classifieds-style). Being a
  "provider" is *implicit* in owning a listing — no gate needed to offer
  tuition, sell a sofa, or recommend an electrician. This matches how
  buy/sell and recommendations naturally work and lowers friction.
- **`chef`** stays as the food-provider role (gates the Post-food flow and
  the Kitchen dashboard, which have real inventory mechanics). Think of it
  as the one category that needs a "provider mode."
- **`admin`** unchanged — can moderate/remove any listing (RLS already
  supports `is_admin`), manage members/roles, toggle categories.
- Default role stays `foodie` (rename cosmetic later → "member").

> **Open question (see §11):** do you want *any* other category to be
> "provider-gated" like food (e.g., a vetted clinic/tax provider badge), or
> is open-posting + admin moderation enough? Recommendation: open-posting for
> v1, add a verified-provider **badge** (not a gate) in Phase 4.

---

## 7. Frontend structure & reuse

```
src/lib/
  services.ts          # registry: catalog + attribute schemas (NEW)
  listings.ts          # generic CRUD/feed/realtime/photos (NEW, mirrors dishes.ts)
  inquiries.ts         # generic inquiry service (NEW)
  food/                # (optional refactor) dishes.ts, orders.ts, tiffin.ts move here
  types/listing.ts     # Listing, Inquiry, per-category attribute types (NEW)

src/components/
  home/ServiceGrid.tsx     ServiceTile.tsx        # NEW home hub
  listings/ListingCard.tsx ListingDetail.tsx      # NEW generic listing UI
  listings/CategoryForm.tsx                        # attribute-driven create form
  listings/InquiryModal.tsx                        # mirrors OrderModal
  (existing food components unchanged: DishCard, OrderModal, KitchenSection, …)
```

**Patterns we copy verbatim from the food vertical:**
- Service layer: `.select('*, owner:profiles!...(name,flat,whatsapp)')` joins,
  `.rpc(...)` for any atomic op, AsyncStorage cache-then-refetch, realtime
  channel subscribe/cleanup.
- WhatsApp deep-link helpers (`waLink`, per-category message builders).
- Bottom-sheet modal structure (`OrderModal` → `InquiryModal`).
- `ChoiceTiles` / `Field` / `Stepper` / `Button` / `Container` design-system
  components — the generic `CategoryForm` is built from these.

The `CategoryForm` renders the category's `attributes` schema dynamically, so
adding a service's fields is data, not new screens.

---

## 8. Per-category specification (attributes + CTA)

| Category | `listingType` | CTA | Key attributes (JSONB) | Price meaning |
|----------|---------------|-----|------------------------|---------------|
| **Home Food** | (food engine) | order | — (own tables) | per plate |
| **Tuitions** | service | inquire/book | subject, grade/board, mode (home/online), batch timing | per month/session |
| **Tailoring** | service | inquire | specialities (blouse, alteration…), turnaround | fixed/negotiable |
| **Income Tax** | service | book | services (ITR, GST…), credentials | per filing/hour |
| **Clinic** | service | book | speciality, clinic timings, address | per visit |
| **Catering** | service | inquire | cuisines, min order, event types | per plate/quote |
| **Decoration** | service | inquire | event types, portfolio photos | per event/quote |
| **Job Referral** | post | contact | kind (offer/seek), role, company, location | — |
| **Buy & Sell** | product | buy | condition, brand, category | asking price |
| **Service Directory** | recommendation | contact | trade (plumber, electrician, maid…), endorsements | — |

All CTAs resolve to **WhatsApp + (optional) in-app inquiry record**, never
in-app payment — consistent with the current product.

---

## 9. Rebranding (name + logo)

The app is no longer "Rasoi" (kitchen). We need a name that says *community*,
*neighbourhood*, and *helpfulness* — works across food, services, and
classifieds.

**Name shortlist (recommendation: _Aangan_):**

| Name | Meaning | Why it fits |
|------|---------|-------------|
| **Aangan** (आँगन) ⭐ | Courtyard — the shared heart of a home | Warm, Indian, service-neutral, evokes a shared community space |
| **Mohalla** (मोहल्ला) | Neighbourhood | Literally the unit we serve; friendly, memorable |
| **Chaupal** (चौपाल) | Village commons where people gather | Strong "community hub" metaphor |
| **Padosi** (पड़ोसी) | Neighbour | Direct, relatable |
| **Apna** (अपना) | "Ours / one's own" | "Apna Society" — ownership & belonging |

**Recommendation:** **Aangan** (tagline e.g. *"your society, together"*).
Service-agnostic, warm, and the "courtyard" metaphor maps perfectly to a
shared hub of neighbours' offerings.

**Logo direction:** a simple, friendly mark — e.g. an abstract courtyard /
cluster of homes around a shared centre, or a rounded "aangan" doorway motif.
Keep the existing warm **coral accent** (`#FF5A3C`) — it's already wired
through the design system and dark mode — optionally pair with a secondary
warm tone. Bricolage/Hanken type stack stays.

**Rename touch-points (mechanical, low-risk if done carefully):**
- `app.json` (name, slug, scheme, bundle ids, splash, icons), `public/manifest.json`,
  `+html.tsx` meta, `Brand`/`Wordmark` component, README, footer copy.
- ⚠️ **Auth email-alias domain** `@senate.app` (in `supabase.ts:phoneToEmail`)
  is baked into every existing login. **Do not change it** even on rename, or
  existing users can't sign in. It's invisible to users — keep as-is, or plan
  a careful migration. (Flagged as a decision in §11.)
- `COMMUNITY_ID` constant and the seeded community row name ("Senate Society")
  → cosmetic, safe to update display name.
- Storage bucket `dish-photos` stays for food; new `listing-photos` bucket.

---

## 10. Phased roadmap

Each phase is independently shippable and leaves the app working.

### Phase 1 — Foundation & rebrand *(shell becomes multi-service)*
- New name + logo + manifest/app.json.
- **Service registry** (`services.ts`) with food + placeholder categories.
- **Home hub** tab (service grid); food tile routes to existing board.
- Move food Discover to `/food`; generalize nav (tabs + NavRail).
- No new services yet — food still fully works. *De-risks the IA change.*

### Phase 2 — Listings engine + first light services
- `listings` + `inquiries` tables, RLS, realtime, `listing-photos` bucket.
- Generic `listings.ts` / `inquiries.ts`, `ListingCard`, `ListingDetail`,
  `CategoryForm`, `InquiryModal`.
- Launch the **two simplest, highest-value** categories first:
  **Service Directory** (recommend a plumber/electrician/maid) and
  **Buy & Sell**. These prove the engine end-to-end.
- Inquiry → WhatsApp + push to owner.

### Phase 3 — Service-provider categories
- Turn on **Tuitions, Tailoring, Income Tax, Clinic, Catering, Decoration**
  via registry entries + attribute schemas. Mostly config, little new code.
- Provider profile page (all of a member's listings in one place).

### Phase 4 — Enhancements
- Cross-service **search**, **saved** listings, **endorsements** (directory
  social proof), **verified-provider badge**, **reports/moderation** UI,
  optional **appointments/scheduling** for clinic/tuition, ratings/reviews,
  admin **category toggles** (`community_services` table).

---

## 11. Open decisions (need your input before we build)

1. **Name & logo** — go with **Aangan**, or pick from the shortlist / propose
   your own? (Blocks Phase 1 rebrand.)
2. **Posting model** — open posting for all non-food categories with admin
   moderation (recommended), or should some categories (clinic/tax) be
   provider-gated/vetted?
3. **In-app inquiries** — build the `inquiries` table for "interested" counts +
   owner notifications (recommended), or v1 = pure WhatsApp deep-link to ship
   faster?
4. **First services to launch in Phase 2** — I propose **Directory** + **Buy &
   Sell**. Agree, or lead with something else (e.g. Tuitions)?
5. **Email-alias domain** — keep `@senate.app` for auth forever (invisible,
   zero-risk) — confirm you're fine with that despite the rename.
6. **Single society vs multi-society** — stay single-community for now
   (current assumption), or is multi-society on the near horizon (affects how
   hard we lean on `community_id` everywhere)?

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| IA change breaks the working food flow | Phase 1 only *adds* a Home hub and *moves* the board; food tables/logic untouched. |
| JSONB attributes become a typing mess | Per-category TS interfaces + a schema array; `gin` index for queryable fields. |
| Generic form can't express a category well | Any category can "graduate" to a bespoke vertical later (like food) if it outgrows the engine. |
| Rename breaks existing logins | Keep the `@senate.app` auth alias; rename is display-only. |
| Scope creep across 10 services | Engines + registry mean most services are *config*; phases gate the work. |
| Spam / bad listings | `expires_at` auto-expiry + admin delete (RLS ready) + Phase-4 reports. |

---

## 13. Out of scope (for now)

- In-app payments / escrow (stays WhatsApp + UPI).
- Real-time chat (WhatsApp remains the comms channel).
- Multi-society tenancy switching UI (single society assumed).
- Native store submissions (separate deploy track).

---

## 14. What "done" looks like for v1 of the platform

- A resident opens the app to a **Home hub** of services.
- They can **post** in any category and **discover/contact** in any category.
- **Food works exactly as before**, now as one tile.
- **Directory + Buy & Sell** are live (Phase 2); provider categories follow.
- The app is **rebranded** end-to-end.
- Adding the *next* light service is a **config change**, not a project.

---

*Implementation note: all code must follow the pinned Expo v56 docs
(`https://docs.expo.dev/versions/v56.0.0/`) per AGENTS.md, and reuse the
existing auth/RLS/RPC/realtime/design-system conventions documented above.*
