# 🍽️ Senate Chef

A community food board for a residential society. Neighbours post dishes they're
cooking; others order via WhatsApp before cooking starts — so chefs make exactly
the right amount, with no waste.

Built **PWA-first** with Expo (one codebase → web today, iOS/Android later) on a
free stack. See [`PLAN.md`](./PLAN.md) for the full product plan and roadmap.

- **No login.** Identity is a name/flat/WhatsApp profile saved on the device.
- **Zero-friction ordering.** Tap *Order* → WhatsApp opens with the message pre-filled.
- **Safe without accounts.** Posts are owned by a device token; only its hash is
  stored. Plate counts decrement atomically (no overselling). See [`PLAN.md` §4](./PLAN.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Expo (React Native) + Expo Router |
| Web / PWA | React Native Web, static export, installable manifest |
| Styling | NativeWind (Tailwind for RN) |
| Backend / DB | Supabase (Postgres + Realtime + Storage) |
| Web hosting | Vercel (or any static host) |

---

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in your Supabase values (see below)
npx expo start            # press "w" for web, or scan the QR with Expo Go
```

The app runs without Supabase configured — you'll just see a setup banner on the
board instead of live dishes.

### Build the web/PWA bundle

```bash
npx expo export --platform web   # outputs static site to ./dist
npx serve dist                   # preview locally
```

---

## One-time backend setup (free, ~5 minutes)

1. **Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Run the schema.** Open the project's **SQL Editor**, paste the contents of
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql), and run it.
   This creates the `communities` + `dishes` tables, Row-Level Security policies,
   the atomic `order_plates` / token-checked `delete_dish` RPCs, enables Realtime,
   and seeds the single society.
3. **Create the photo bucket.** Storage → **New bucket** → name it `dish-photos` →
   make it **Public**. (Public read is fine; uploads use the anon key.)
4. **Copy your keys.** Project Settings → **API**. Put the **Project URL** and the
   **anon public** key into `.env`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
5. Restart `expo start`. The board is now live.

> The anon key is meant to be public — all security is enforced server-side by RLS
> and the SECURITY DEFINER functions, not by hiding the key.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel. The included [`vercel.json`](./vercel.json) already sets the
   build command (`expo export --platform web`) and output dir (`dist`).
3. Add the two `EXPO_PUBLIC_*` environment variables in the Vercel project settings.
4. Deploy → you get an HTTPS URL that installs as a PWA on phones.

---

## Project structure

```
src/
  app/                 # Expo Router routes (file-based)
    _layout.tsx        # fonts, providers, splash
    +html.tsx          # web/PWA document (meta, manifest link)
    (tabs)/
      _layout.tsx      # bottom tabs + hero header
      index.tsx        # Today's Menu — live board, filters, order, remove
      post.tsx         # Post a Dish — form, photo upload
      orders.tsx       # My Orders — device-local
  components/          # Hero, DishCard, OrderModal, forms, ...
  context/             # profile + toast providers
  lib/                 # supabase client, dishes service, device token, profile, orders
supabase/migrations/   # SQL schema + RLS + RPCs
public/                # PWA manifest + icons
docs/                  # the original Firebase prototype (reference)
```

---

## Native apps (later)

The same codebase ships to iOS/Android via [EAS Build](https://docs.expo.dev/build/introduction/).
See Phase 3 in [`PLAN.md`](./PLAN.md). No code changes needed for the core flow.
