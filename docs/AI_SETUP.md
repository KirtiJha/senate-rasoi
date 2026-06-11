# Aangan AI — setup (Gemini via Edge Function)

Both AI features — **Vision autofill** (photo → form) and **Ask Aangan** (natural-
language search over your society's listings) — run **server-side** in the single
`ai-proxy` Supabase Edge Function. The Gemini key lives only there, never in the
app bundle. Until these 4 steps are done, the ✨ buttons show a friendly "AI
unavailable" toast and the rest of the app works normally.

> Both features share one function and one key. If you've already deployed for
> autofill, just **re-deploy** (`supabase functions deploy ai-proxy`) to pick up
> Ask Aangan — no new key, secret or migration needed.

## 1. Get a free Gemini API key
- Go to **https://aistudio.google.com/app/apikey** → **Create API key**.
- The free tier (model `gemini-2.5-flash`) is plenty for a pilot society.
- ⚠️ Free-tier inputs **may be used by Google to improve their models**, so the
  proxy only ever sends the **photo + an optional note** — never phone numbers,
  UPI IDs, flat numbers or blood groups.

## 2. Run the migrations
In **Supabase → SQL Editor**, run:
- `supabase/migrations/0039_ai.sql` — `ai_usage` daily-quota table + `check_and_increment_ai_quota()`.
- `supabase/migrations/0040_search_vectors.sql` — enables `pgvector` and builds the
  semantic search index for Ask Aangan (`search_documents` + triggers +
  `match_documents()`). Embeddings (`text-embedding-004`, free) are filled lazily by
  the function on the first Ask after items are posted — no extra setup, no cron.
- `supabase/migrations/0041_translations.sql` — `profiles.preferred_lang` + the
  `translations` cache for multilingual auto-translate.

## 3. Deploy the Edge Function
You need the Supabase CLI once (`npm i -g supabase`, then `supabase login` and
`supabase link --project-ref <your-ref>`).

```bash
supabase functions deploy ai-proxy
```

(Or paste `supabase/functions/ai-proxy/index.ts` into **Dashboard → Edge
Functions → Deploy a new function** and name it `ai-proxy`.)

## 4. Set the secret
```bash
supabase secrets set GEMINI_API_KEY=your_key_here
```
(`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically — don't set them.)

## Test it
- **Autofill:** Open the app → **Post a dish** (or a marketplace listing / a borrow
  item) → add a photo → tap **✨ Autofill details from photo**. Name, veg/non-veg,
  slot and description fill in for you to edit.
- **Ask Aangan:** Tap **Ask Aangan** on Home (or in the side nav) → ask something
  like *"any veg tiffin for lunch?"*. It searches your society's current dishes,
  flats, listings, borrow items and recommendations and answers with tappable
  cards. (Post a couple of items first so there's something to find.)
- **Multilingual:** Profile → **Language** → pick e.g. Bengali. Now feed posts,
  food menus and listings show in Bengali automatically, with a "Translated · see
  original" toggle. The first reader of each item in a given language triggers one
  translation; it's cached after that (free for everyone else).

## Tuning
- **Daily limit per user:** `DAILY_LIMIT` in the function (default 40). Change it
  and redeploy.
- **Model:** `MODEL` in the function (`gemini-2.5-flash`). `gemini-2.5-flash-lite`
  is faster/cheaper if you hit rate limits.
- **Watch usage:** `select * from ai_usage order by usage_date desc;`
