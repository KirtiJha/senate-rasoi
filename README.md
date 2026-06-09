# 🏡 Aangan

**Aangan** (आँगन — "courtyard") is a single app for everything neighbours in a
residential society need from each other: home food, local services, buy & sell,
community discussions, polls, emergency contacts, and private messaging. One
shared courtyard, scoped to your society.

Built **PWA-first** with Expo (one codebase → web today, iOS/Android via EAS
later) on an all-free stack. No in-app payments — coordination happens over
**WhatsApp + UPI**, the way trusted neighbours already work.

> **Canonical plan & status:** [`PLATFORM_PLAN.md`](./PLATFORM_PLAN.md).
> ([`PLAN.md`](./PLAN.md) is the original food-only plan, superseded.)
> Repo folder is still `senate-chef`; the app is **Aangan**.

---

## What's inside

Two engines under one Home hub, plus community tools — all multi-society and
realtime:

- **Food engine** — chefs post dishes (one-off or future-dated) and **tiffin
  services**; neighbours reserve plates or **subscribe**; full order lifecycle
  (placed → accepted → cooking → delivered, with cancellation windows) and a
  chef Kitchen dashboard.
- **Listings engine** — one registry-driven flow covering **15 categories**
  (tuitions, tailoring, tax, clinic, catering, decoration, jobs, buy & sell,
  service directory, day care, yoga & fitness, arts, astrology, carpooling),
  with photos, attributes, inquiries, bookmarks, and per-listing chat.
- **Community** — a posts feed with comment threads (general / announcements /
  issues / events / lost & found / feedback / suggestions), **polls**,
  **emergency contacts**, a **resident directory** (members + manually-added
  neighbours, grouped by flat, with invites), **sports groups** (teams per
  sport with members, practice schedules and tournaments), a **document vault**
  (upload society files, keep public or share privately with revoke, preview +
  download), **direct messages** between neighbours, and **universal fuzzy
  search** across everything.
- **Identity & roles** — phone + 6-digit PIN accounts (no SMS/OTP), roles
  **chef / member / admin**, public profiles, and a society admin panel.

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | **Expo SDK 56** (React Native) + **Expo Router** (typed routes) |
| Web / PWA | React Native Web, static export, installable manifest + service worker |
| Styling | **NativeWind v4** (Tailwind for RN) + light/dark CSS-var theme |
| Fonts | Bricolage Grotesque (display) + Hanken Grotesk (UI) |
| Lists / images | `@shopify/flash-list`, `expo-image` (memory-disk cache + blurhash) |
| Backend / DB | **Supabase** — Postgres + Row-Level Security + Realtime + Storage |
| Auth | Supabase Auth via a phone→email alias (`<digits>@senate.app`) + PIN-as-password |
| Notifications | Expo push (native) via a `pg_net` Postgres trigger; WhatsApp deep-links everywhere |
| Web hosting | **Vercel** · Native builds | **EAS** (bundle id `com.aangan.app`) |

**Security model:** everything is scoped to the signed-in user's `community_id`
and enforced by RLS, with `SECURITY DEFINER` RPCs for atomic/privileged actions
(order placement, role edits, account deletion, DM thread creation). The anon key
is meant to be public — security lives server-side, not in hiding the key.

---

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in your Supabase values (see below)
npx expo start            # press "w" for web, or scan the QR with Expo Go / a dev build
```

The app boots without Supabase configured — you'll see a setup banner instead of
live data.

### Useful scripts

```bash
npm run web                       # expo start --web
npx expo export --platform web    # static PWA bundle → ./dist
npx serve dist                    # preview the export
npx tsc --noEmit                  # type-check
```

---

## One-time backend setup

1. **Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Run the migrations in order.** Open **SQL Editor** and run every file in
   [`supabase/migrations/`](./supabase/migrations) from `0001_init.sql` through
   the latest (`0032_documents.sql`). They create all tables (communities,
   profiles, dishes, orders, tiffin, listings, inquiries, posts, comments, polls,
   emergency contacts, saved listings, per-listing chat, direct messages,
   notifications, resident directory, sports groups, document vault), RLS
   policies, RPCs, full-text indexes, realtime publications, and the push
   pipeline.
3. **Disable email confirmation.** Auth → Providers → Email → turn **off**
   "Confirm email" (the phone-as-email aliases can't receive confirmation mail).
4. **Create the Storage buckets:** `listing-photos`, `dish-photos` and
   `sport-logos` as **public** buckets, plus `documents` as a **private** bucket
   (leave "Public" off — the vault grants access per-file via signed URLs).
5. **Seed a society and grant yourself admin:**
   ```sql
   insert into public.communities (name, slug, address)
   values ('Green Valley Apartments', 'green-valley', 'Sector 12, Noida') returning id;

   -- after you sign up in the app, grant admin to your account:
   -- (the member role is stored as 'foodie'; the UI just labels it "Member")
   update public.profiles set roles = array['foodie','chef','admin']
   where phone = '<your-phone-digits>';
   ```
6. **Copy your keys** into `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

See [`PLATFORM_PLAN.md` §12](./PLATFORM_PLAN.md) for a full end-to-end testing guide.

---

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo in Vercel — [`vercel.json`](./vercel.json) sets the build
   command (`expo export --platform web`) and output dir (`dist`).
3. Add the two `EXPO_PUBLIC_*` env vars in the Vercel project settings.
4. Deploy → an HTTPS URL that installs as a PWA (offline shell via `public/sw.js`).

> Note: the free **Hobby** plan runs **one** build at a time — a stuck build will
> queue the next one until cancelled.

---

## Project structure

```
src/
  app/                       # Expo Router routes (file-based)
    _layout.tsx              # fonts, providers (auth, theme, toast, unread DMs), splash
    +html.tsx                # web/PWA document (meta, manifest, SW registration, preconnect)
    (auth)/sign-in.tsx       # phone + PIN sign-in / sign-up + society picker
    (tabs)/
      index.tsx              # Home hub — service grid + community tiles
      food.tsx               # Food board (dishes + tiffins)
      feed.tsx               # Community posts feed + composer
      search.tsx             # Universal fuzzy search across everything
      post.tsx               # Category picker → create listing/dish
      you.tsx                # My orders, tiffins, listings, saved, kitchen
      c/[category].tsx       # Category listing feed (FlashList)
    listing/[id].tsx         # Listing detail + inquiry + per-listing chat
    directory.tsx            # Resident directory (members + manual entries)
    sports.tsx · sports/[id].tsx   # Sports groups list + group detail
    documents.tsx            # Document vault (upload, public/private, share)
    messages/                # DM inbox + thread
    profile/me.tsx · [userId].tsx
    feed/[postId].tsx        # Post thread + comments
    admin.tsx · about.tsx · polls.tsx · emergency.tsx
  components/                # DishCard, ListingCard, NavRail, ScreenHeader, ui/ kit, ...
  context/                   # auth, theme, toast, unread (shared providers)
  lib/                       # supabase client + service layer (one module per domain)
supabase/migrations/         # 0001–0030: schema, RLS, RPCs, FTS, realtime, push, directory, sports
public/                      # PWA manifest, icons, service worker
assets/images/               # app icon, adaptive icon layers, splash
docs/                        # the original Firebase prototype (reference)
```

---

## Native apps (later)

The same codebase ships to iOS/Android via [EAS Build](https://docs.expo.dev/build/introduction/).
Config is in place — [`eas.json`](./eas.json) build profiles and
[`app.json`](./app.json) bundle ids (`com.aangan.app`), adaptive icons, splash,
privacy strings, and OTA-update settings. Run `eas login` → `eas init` (writes the
project id push needs) → `eas build`. Apple ($99/yr) and Google ($25) developer
accounts gate store distribution. See Phase 10 in [`PLATFORM_PLAN.md`](./PLATFORM_PLAN.md).

---

> ⚠️ **Read before writing code:** Expo SDK 56 changed a lot — check the versioned
> docs at <https://docs.expo.dev/versions/v56.0.0/>. (See [`AGENTS.md`](./AGENTS.md).)
