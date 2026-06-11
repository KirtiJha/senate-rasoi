# Aangan AI — setup (Gemini via Edge Function)

AI features (Vision autofill now; "Ask Aangan" search next) run **server-side** in
the `ai-proxy` Supabase Edge Function. The Gemini key lives only there — never in
the app bundle. Until these 4 steps are done, the ✨ Autofill button shows a
friendly "AI unavailable" toast and the rest of the app works normally.

## 1. Get a free Gemini API key
- Go to **https://aistudio.google.com/app/apikey** → **Create API key**.
- The free tier (model `gemini-2.5-flash`) is plenty for a pilot society.
- ⚠️ Free-tier inputs **may be used by Google to improve their models**, so the
  proxy only ever sends the **photo + an optional note** — never phone numbers,
  UPI IDs, flat numbers or blood groups.

## 2. Run the migration
In **Supabase → SQL Editor**, run `supabase/migrations/0039_ai.sql`
(adds the `ai_usage` daily-quota table + `check_and_increment_ai_quota()`).

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
Open the app → **Post a dish** (or a marketplace listing / a borrow item) → add a
photo → tap **✨ Autofill details from photo**. The name, veg/non-veg, slot and
description should fill in for you to edit.

## Tuning
- **Daily limit per user:** `DAILY_LIMIT` in the function (default 40). Change it
  and redeploy.
- **Model:** `MODEL` in the function (`gemini-2.5-flash`). `gemini-2.5-flash-lite`
  is faster/cheaper if you hit rate limits.
- **Watch usage:** `select * from ai_usage order by usage_date desc;`
