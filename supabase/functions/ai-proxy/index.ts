// ════════════════════════════════════════════════════════════════════
// Aangan — ai-proxy Edge Function
//
// The ONLY place the Gemini API key lives. A PWA ships its JS to the browser,
// so the key can never be in the app bundle — every AI call is routed through
// here. This function:
//   1. verifies the caller's Supabase JWT (must be a signed-in resident),
//   2. meters usage per user per day (free-tier guard) via an RPC,
//   3. strips/avoids PII before calling Gemini (free tier may train on input),
//   4. calls Gemini with a structured-output JSON schema and returns the result.
//
// Deploy:   supabase functions deploy ai-proxy
// Secret:   supabase secrets set GEMINI_API_KEY=...   (from aistudio.google.com)
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MODEL = 'gemini-2.5-flash';
const DAILY_LIMIT = 40; // AI actions per user per day
const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB of base64 — a comfortably large photo

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── Per-kind output contracts (the only fields we ever ask Gemini for) ──
type Kind = 'dish' | 'listing' | 'borrow';

const SCHEMAS: Record<Kind, { instruction: string; schema: Record<string, unknown> }> = {
  dish: {
    instruction:
      'This is a homemade dish a resident wants to sell to neighbours in an Indian apartment society. ' +
      'Give a short appetising dish name (Indian naming where it fits), classify Veg / Non-veg / Egg from what you see, ' +
      'suggest the most likely meal slot, and write a warm one-line description (spice/ingredients). Do NOT invent a price.',
    schema: {
      type: 'object',
      properties: {
        dish_name: { type: 'string', description: 'Short dish name, e.g. "Masala Dosa with Sambar"' },
        veg_type: { type: 'string', enum: ['Veg', 'Non-veg', 'Egg'] },
        suggested_slot: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
        description: { type: 'string', description: 'One warm sentence, max ~120 chars' },
      },
      required: ['dish_name', 'veg_type', 'description'],
    },
  },
  listing: {
    instruction:
      'This is a second-hand item a resident wants to sell or give away in their apartment society marketplace. ' +
      'Write a clear, honest listing title and a short factual description (what it is, visible condition, notable details). ' +
      'Do NOT invent a brand, specs or price you cannot see.',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Concise item title, e.g. "Dell 24-inch monitor, like new"' },
        description: { type: 'string', description: '1–2 honest sentences about the item and its condition' },
      },
      required: ['title', 'description'],
    },
  },
  borrow: {
    instruction:
      'This is a household item a resident is offering to lend to neighbours. ' +
      'Name the item plainly and write a one-line description of what it is and what it is good for.',
    schema: {
      type: 'object',
      properties: {
        item_name: { type: 'string', description: 'Plain item name, e.g. "Cordless drill"' },
        description: { type: 'string', description: 'One short sentence' },
      },
      required: ['item_name', 'description'],
    },
  },
};

async function callGemini(
  instruction: string,
  schema: Record<string, unknown>,
  note: string,
  imageBase64: string,
): Promise<Record<string, unknown>> {
  const prompt =
    `${instruction}\n\n` +
    (note ? `The resident added this hint: "${note}".\n\n` : '') +
    'Respond ONLY with the JSON described by the schema. Keep it truthful to the photo — never guess prices or personal details.';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 }, // fast + cheap; autofill needs no reasoning budget
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GEMINI_KEY) return json({ error: 'AI is not configured' }, 503);

  // ── 1. Authenticate the caller ──
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Not signed in' }, 401);
  const userId = userData.user.id;

  // ── 2. Parse + validate the request ──
  let body: { action?: string; kind?: Kind; note?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (body.action !== 'autofill') return json({ error: 'Unknown action' }, 400);

  const kind = body.kind as Kind;
  const spec = kind && SCHEMAS[kind];
  if (!spec) return json({ error: 'Unknown kind' }, 400);

  const image = (body.image ?? '').trim();
  if (!image) return json({ error: 'A photo is required for autofill' }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ error: 'Photo is too large' }, 413);
  const note = (body.note ?? '').toString().slice(0, 200);

  // ── 3. Meter usage (service role; the RPC is locked to definer-only) ──
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: allowed, error: quotaErr } = await admin.rpc('check_and_increment_ai_quota', {
    p_user_id: userId,
    p_limit: DAILY_LIMIT,
  });
  if (quotaErr) return json({ error: 'Quota check failed' }, 500);
  if (!allowed) return json({ error: 'over_quota', message: "You've used today's AI helper limit. Try again tomorrow." }, 429);

  // ── 4. Call Gemini ──
  try {
    const result = await callGemini(spec.instruction, spec.schema, note, image);
    return json({ result });
  } catch (e) {
    console.error('ai-proxy gemini error:', e);
    return json({ error: 'AI could not read this photo — fill the form manually.' }, 502);
  }
});
