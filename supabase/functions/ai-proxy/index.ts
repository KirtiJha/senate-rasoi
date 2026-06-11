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
const EMBED_MODEL = 'text-embedding-004'; // 768-dim, free tier
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
      'A resident is posting a homemade dish to sell to neighbours, and added this photo. ' +
      'FIRST decide if the photo actually shows food or a cooked/prepared dish. If it does NOT (a person, pet, object, ' +
      'screenshot, document, random scene, etc.), set is_relevant=false and leave the other fields empty — do NOT invent a dish. ' +
      'If it IS food, set is_relevant=true and give a short appetising dish name (Indian naming where it fits), classify ' +
      'Veg / Non-veg / Egg from what you see, suggest the most likely meal slot, and write a warm one-line description. Never invent a price.',
    schema: {
      type: 'object',
      properties: {
        is_relevant: { type: 'boolean', description: 'true ONLY if the photo actually shows food / a cooked dish' },
        dish_name: { type: 'string', description: 'Short dish name, e.g. "Masala Dosa with Sambar" (empty if not food)' },
        veg_type: { type: 'string', enum: ['Veg', 'Non-veg', 'Egg'] },
        suggested_slot: { type: 'string', enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
        description: { type: 'string', description: 'One warm sentence, max ~120 chars (empty if not food)' },
      },
      required: ['is_relevant'],
    },
  },
  listing: {
    instruction:
      'A resident is posting a second-hand item to sell/give away in their society marketplace, and added this photo. ' +
      'FIRST decide if the photo actually shows a real, physical item that could be sold or given away. If it does NOT ' +
      '(a person, pet, screenshot, random scene, etc.), set is_relevant=false and leave the other fields empty — do NOT invent a listing. ' +
      'If it IS a sellable item, set is_relevant=true and write a clear honest title and a short factual description ' +
      '(what it is, visible condition). Never invent a brand, specs or price you cannot see.',
    schema: {
      type: 'object',
      properties: {
        is_relevant: { type: 'boolean', description: 'true ONLY if the photo shows a real physical item that could be sold' },
        title: { type: 'string', description: 'Concise item title, e.g. "Dell 24-inch monitor, like new" (empty if not an item)' },
        description: { type: 'string', description: '1–2 honest sentences (empty if not an item)' },
      },
      required: ['is_relevant'],
    },
  },
  borrow: {
    instruction:
      'A resident is offering a household item to lend to neighbours, and added this photo. ' +
      'FIRST decide if the photo actually shows a real, physical item that could be lent. If it does NOT (a person, pet, ' +
      'screenshot, random scene, etc.), set is_relevant=false and leave the other fields empty — do NOT invent an item. ' +
      'If it IS a lendable item, set is_relevant=true, name the item plainly and write a one-line description of what it is good for.',
    schema: {
      type: 'object',
      properties: {
        is_relevant: { type: 'boolean', description: 'true ONLY if the photo shows a real physical item that could be lent' },
        item_name: { type: 'string', description: 'Plain item name, e.g. "Cordless drill" (empty if not an item)' },
        description: { type: 'string', description: 'One short sentence (empty if not an item)' },
      },
      required: ['is_relevant'],
    },
  },
};

// Low-level Gemini call → parsed structured JSON. `parts` may mix text + image.
async function geminiJSON(
  parts: unknown[],
  schema: Record<string, unknown>,
  temperature: number,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature,
          thinkingConfig: { thinkingBudget: 0 }, // fast + cheap
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

// Embed texts → 768-dim vectors. taskType tunes for documents vs the query.
async function embedTexts(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: t.slice(0, 2000) }] },
          taskType,
        })),
      }),
    },
  );
  if (!res.ok) throw new Error(`Embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  return (data.embeddings ?? []).map((e: any) => e.values as number[]);
}

const toVec = (v: number[]) => `[${v.join(',')}]`;

// ── Photo → form fields (Phase 1) ──
function callAutofill(
  instruction: string,
  schema: Record<string, unknown>,
  note: string,
  imageBase64: string,
): Promise<Record<string, unknown>> {
  const prompt =
    `${instruction}\n\n` +
    (note ? `The resident added this hint: "${note}".\n\n` : '') +
    'Respond ONLY with the JSON described by the schema. Keep it truthful to the photo — never guess prices or personal details.';
  return geminiJSON(
    [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }],
    schema,
    0.4,
  );
}

// ════════════════════════════════════════════════════════════════════
// "Ask Aangan" (Phase 2) — answer a natural-language question over the
// society's own catalog. We fetch a small, community-scoped, PII-free
// catalog and let Gemini pick the items that answer the question. No
// embeddings/pgvector: at pilot scale the whole catalog fits in context.
// ════════════════════════════════════════════════════════════════════

const ASK_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'A short, friendly answer (1–3 sentences). Empty if nothing matches.' },
    results: {
      type: 'array',
      description: 'The catalog items that genuinely answer the question, best first. Empty if none.',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['dish', 'tiffin', 'listing', 'property', 'recommend', 'borrow'] },
          id: { type: 'string' },
          title: { type: 'string' },
          reason: { type: 'string', description: 'One short phrase on why it fits' },
        },
        required: ['source', 'id', 'title'],
      },
    },
  },
  required: ['answer', 'results'],
};

type CatalogItem = { source: string; id: string; title: string; info: string };

type SourceDef = {
  table: string;
  cols: string;
  // deno-lint-ignore no-explicit-any
  map: (r: any) => { title: string; info: string };
  // deno-lint-ignore no-explicit-any
  fresh?: (q: any, today: string) => any; // status/date filter so stale rows never surface
};

// One definition per Ask Aangan source — used both for the recent-catalog
// fallback and for re-hydrating vector-match ids from the live tables.
const SOURCES: Record<string, SourceDef> = {
  dish: {
    table: 'dishes',
    cols: 'id,dish_name,description,veg_type,slot,price,plates_left,serve_date,created_at',
    map: (r) => ({ title: String(r.dish_name), info: `${r.veg_type} · ${r.slot} · ₹${r.price} · ${r.plates_left} left${r.description ? ` · ${r.description}` : ''}` }),
    fresh: (q, today) => q.gte('serve_date', today).gt('plates_left', 0),
  },
  tiffin: {
    table: 'tiffin_plans',
    cols: 'id,title,description,veg_type,slot,price,created_at',
    map: (r) => ({ title: String(r.title), info: `Tiffin · ${r.veg_type} · ${r.slot} · ₹${r.price}/day${r.description ? ` · ${r.description}` : ''}` }),
    fresh: (q) => q.eq('active', true),
  },
  listing: {
    table: 'listings',
    cols: 'id,title,description,category,price,price_unit,created_at',
    map: (r) => ({ title: String(r.title), info: `${r.category}${r.price ? ` · ₹${r.price}${r.price_unit && r.price_unit !== 'fixed' ? '/' + r.price_unit : ''}` : ''}${r.description ? ` · ${r.description}` : ''}` }),
    fresh: (q) => q.eq('status', 'active'),
  },
  property: {
    table: 'property_listings',
    cols: 'id,title,description,listing_type,config,area_sqft,furnishing,created_at',
    map: (r) => ({ title: String(r.title), info: `Flat for ${r.listing_type} · ${r.config ?? ''} ${r.area_sqft ? `· ${r.area_sqft} sqft` : ''} ${r.furnishing ?? ''}${r.description ? ` · ${r.description}` : ''}` }),
    fresh: (q) => q.eq('status', 'available'),
  },
  recommend: {
    table: 'reco_questions',
    cols: 'id,title,detail,category,created_at',
    map: (r) => ({ title: String(r.title), info: `Recommendation Q · ${r.category}${r.detail ? ` · ${r.detail}` : ''}` }),
  },
  borrow: {
    table: 'lend_items',
    cols: 'id,title,description,category,status,created_at',
    map: (r) => ({ title: String(r.title), info: `To borrow · ${r.category ?? ''}${r.description ? ` · ${r.description}` : ''}` }),
    fresh: (q) => q.eq('status', 'available'),
  },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// Recent, fresh items per source (fallback when vectors aren't ready yet).
// deno-lint-ignore no-explicit-any
async function buildCatalog(admin: any, communityId: string): Promise<CatalogItem[]> {
  const out: CatalogItem[] = [];
  await Promise.all(Object.entries(SOURCES).map(async ([source, def]) => {
    let q = admin.from(def.table).select(def.cols).eq('community_id', communityId)
      .order('created_at', { ascending: false }).limit(40);
    if (def.fresh) q = def.fresh(q, todayStr());
    const { data } = await q;
    for (const r of (data ?? [])) { const m = def.map(r); out.push({ source, id: String(r.id), title: m.title, info: m.info }); }
  }));
  return out;
}

// Re-hydrate vector-matched ids from the live tables (applies freshness filters,
// so a sold/expired match is silently dropped).
// deno-lint-ignore no-explicit-any
async function fetchByIds(admin: any, idsBySource: Record<string, string[]>): Promise<CatalogItem[]> {
  const out: CatalogItem[] = [];
  await Promise.all(Object.entries(idsBySource).map(async ([source, ids]) => {
    const def = SOURCES[source];
    if (!def || !ids.length) return;
    let q = admin.from(def.table).select(def.cols).in('id', ids);
    if (def.fresh) q = def.fresh(q, todayStr());
    const { data } = await q;
    for (const r of (data ?? [])) { const m = def.map(r); out.push({ source, id: String(r.id), title: m.title, info: m.info }); }
  }));
  return out;
}

// Society facts (member count, residents, announcements, polls) — always-on
// context so Ask can answer questions that aren't about a specific listing.
// deno-lint-ignore no-explicit-any
async function buildFacts(admin: any, communityId: string): Promise<string> {
  const lines: string[] = [];

  try {
    const { count } = await admin.from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', communityId).neq('blocked', true);
    if (typeof count === 'number') lines.push(`The society has ${count} member${count === 1 ? '' : 's'} on Aangan.`);
  } catch { /* skip */ }

  try {
    const { data } = await admin.from('profiles')
      .select('name,flat,profession').eq('community_id', communityId).neq('blocked', true).limit(200);
    const r = (data ?? []).filter((x: { name?: string }) => x.name);
    if (r.length) {
      lines.push('Residents (name · flat · profession): ' +
        r.map((x: { name: string; flat?: string; profession?: string }) =>
          `${x.name}${x.flat ? ` · ${x.flat}` : ''}${x.profession ? ` · ${x.profession}` : ''}`).join('; '));
    }
  } catch { /* skip */ }

  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await admin.from('posts')
      .select('title,body,category,created_at').eq('community_id', communityId)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(8);
    const anns = (data ?? []).filter((p: { category?: string }) => p.category === 'announcement');
    if (anns.length) {
      lines.push('Recent announcements: ' +
        anns.map((a: { title?: string; body?: string }) => `${a.title ? a.title + ': ' : ''}${(a.body || '').slice(0, 160)}`).join(' | '));
    }
  } catch { /* skip */ }

  try {
    const { data } = await admin.from('polls')
      .select('question').eq('community_id', communityId).order('created_at', { ascending: false }).limit(5);
    const p = (data ?? []).filter((x: { question?: string }) => x.question);
    if (p.length) lines.push('Current polls: ' + p.map((x: { question: string }) => x.question).join('; '));
  } catch { /* skip */ }

  return lines.join('\n');
}

type ChatTurn = { role: 'user' | 'assistant'; text: string };

async function callAsk(question: string, catalog: CatalogItem[], facts: string, history: ChatTurn[]): Promise<Record<string, unknown>> {
  const lines = catalog.map((c) => `- [${c.source}:${c.id}] ${c.title} — ${c.info}`).join('\n');
  const convo = history.map((h) => `${h.role === 'user' ? 'Resident' : 'Aangan'}: ${h.text}`).join('\n');
  const prompt =
    "You are Aangan, a friendly assistant for an Indian residential society, having an ongoing chat with a resident. " +
    'Answer using ONLY the society info and catalog below. Use the conversation so far to resolve follow-ups ' +
    '(e.g. "any cheaper?", "what about veg ones?", "in tower B?"). For questions about members, residents, who lives ' +
    'where, professions, announcements or polls, use the "Society info" section. For things to buy/borrow/eat/rent, use ' +
    'the catalog and list the matching items (best first) in results. Write a short, warm, conversational answer. Never ' +
    'invent people, items, prices or contacts. If you genuinely have nothing relevant, say so politely.\n\n' +
    (convo ? `Conversation so far:\n${convo}\n\n` : '') +
    `Resident's new message: "${question}"\n\n` +
    (facts ? `Society info:\n${facts}\n\n` : '') +
    `Catalog (source:id — title — details):\n${lines || '(no listings right now)'}\n\n` +
    'In results, copy the source and id exactly from the matching catalog lines. Society-info or follow-up answers often have no new result cards.';
  return geminiJSON([{ text: prompt }], ASK_SCHEMA, 0.3);
}

// ════════════════════════════════════════════════════════════════════
// Multilingual — translate content into the reader's language, cached.
// ════════════════════════════════════════════════════════════════════

type TranslateItem = { source: string; id: string; field: string; text: string };
const itemKey = (i: { source: string; id: string; field: string }) => `${i.source}:${i.id}:${i.field}`;

// Tiny non-crypto hash (FNV-1a) for cache invalidation when the original changes.
function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: { translations: { type: 'array', items: { type: 'string' } } },
  required: ['translations'],
};

async function handleTranslate(
  // deno-lint-ignore no-explicit-any
  admin: any,
  targetLang: string,
  rawItems: TranslateItem[],
): Promise<Record<string, string>> {
  const target = targetLang.trim().slice(0, 40);
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .filter((i) => i && i.source && i.id && i.field && typeof i.text === 'string' && i.text.trim())
    .slice(0, 50);
  if (!target || !items.length) return {};

  const result: Record<string, string> = {};

  // 1. Look up the cache for these ids in this language.
  const ids = [...new Set(items.map((i) => i.id))];
  const { data: cached } = await admin.from('translations')
    .select('source,source_id,field,content,source_hash')
    .eq('target_lang', target).in('source_id', ids);
  const cacheMap = new Map<string, { content: string; source_hash: string }>();
  for (const r of (cached ?? []) as { source: string; source_id: string; field: string; content: string; source_hash: string }[]) {
    cacheMap.set(`${r.source}:${r.source_id}:${r.field}`, { content: r.content, source_hash: r.source_hash });
  }

  // 2. Split into hits (fresh cache) and misses.
  const misses: TranslateItem[] = [];
  for (const it of items) {
    const hit = cacheMap.get(itemKey(it));
    if (hit && hit.source_hash === hashText(it.text)) result[itemKey(it)] = hit.content;
    else misses.push(it);
  }
  if (!misses.length) return result;

  // 3. Translate the misses in one batched call.
  const numbered = misses.map((m, i) => `${i + 1}. ${m.text.replace(/\s+/g, ' ').trim().slice(0, 1200)}`).join('\n');
  const prompt =
    `Translate each numbered text into ${target}, for residents of an Indian apartment community. ` +
    'Keep proper nouns, people\'s names, brand names, prices, ₹ amounts, numbers, phone numbers, @handles and URLs EXACTLY as-is. ' +
    'Keep it natural and concise. If a text is already in ' + target + ', return it unchanged. ' +
    'Return a JSON object {"translations": [...]} with one translated string per input, in the same order.\n\n' +
    numbered;

  const out = await geminiJSON([{ text: prompt }], TRANSLATE_SCHEMA, 0.2);
  const arr = (out.translations as string[]) ?? [];

  // 4. Store + return.
  const rows: Record<string, unknown>[] = [];
  misses.forEach((m, i) => {
    const t = arr[i];
    if (typeof t === 'string' && t.trim()) {
      result[itemKey(m)] = t;
      rows.push({ source: m.source, source_id: m.id, field: m.field, target_lang: target, content: t, source_hash: hashText(m.text) });
    }
  });
  if (rows.length) await admin.from('translations').upsert(rows, { onConflict: 'source,source_id,field,target_lang' });

  return result;
}

// ════════════════════════════════════════════════════════════════════
// Weekly society digest — "This week in your society", cached per week.
// ════════════════════════════════════════════════════════════════════

type Digest = { summary: string; highlights: string[] };

const DIGEST_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One warm, welcoming sentence about the week in the society.' },
    highlights: { type: 'array', items: { type: 'string' }, description: 'Up to 4 short bullet highlights.' },
  },
  required: ['summary', 'highlights'],
};

// Monday (UTC) of the current week, as YYYY-MM-DD.
function weekStartUTC(): string {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

async function handleDigest(
  // deno-lint-ignore no-explicit-any
  admin: any,
  communityId: string,
): Promise<Digest> {
  const weekStart = weekStartUTC();

  // 1. Cache hit?
  const { data: cached } = await admin.from('society_digests')
    .select('content').eq('community_id', communityId).eq('week_start', weekStart).maybeSingle();
  if (cached?.content) {
    try { return JSON.parse(cached.content) as Digest; } catch { /* regenerate */ }
  }

  // 2. Gather the last 7 days of activity (community-scoped, best-effort).
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  // deno-lint-ignore no-explicit-any
  const grab = async (table: string, cols: string, label: string): Promise<{ label: string; count: number; titles: string[] }> => {
    try {
      const { data } = await admin.from(table).select(cols).eq('community_id', communityId).gte('created_at', since).limit(20);
      const rows = (data ?? []) as Record<string, unknown>[];
      const titles = rows.map((r) => String(r[cols.split(',')[0]] ?? '').trim()).filter(Boolean).slice(0, 6);
      return { label, count: rows.length, titles };
    } catch {
      return { label, count: 0, titles: [] };
    }
  };

  const groups = await Promise.all([
    grab('posts', 'title,body', 'community posts'),
    grab('dishes', 'dish_name', 'home-cooked dishes'),
    grab('tiffin_plans', 'title', 'tiffin services'),
    grab('listings', 'title', 'marketplace listings'),
    grab('property_listings', 'title', 'flats for sale/rent'),
    grab('reco_questions', 'title', 'recommendation requests'),
    grab('lend_items', 'title', 'items to borrow'),
    grab('polls', 'question', 'polls'),
  ]);

  const total = groups.reduce((n, g) => n + g.count, 0);
  if (total < 3) {
    const quiet: Digest = { summary: '', highlights: [] };
    await admin.from('society_digests').upsert({ community_id: communityId, week_start: weekStart, content: JSON.stringify(quiet) });
    return quiet;
  }

  // 3. Summarise with Gemini.
  const activity = groups.filter((g) => g.count > 0)
    .map((g) => `- ${g.count} ${g.label}${g.titles.length ? `: ${g.titles.join('; ')}` : ''}`).join('\n');
  const prompt =
    "Write a short, warm 'This week in your society' digest for residents of an Indian apartment community, " +
    'based only on this week\'s activity below. One friendly summary sentence, then up to 4 concrete highlight bullets ' +
    '(mention real items by name where useful). Encouraging and neighbourly; never invent anything not listed.\n\n' +
    `This week's activity:\n${activity}`;

  const out = await geminiJSON([{ text: prompt }], DIGEST_SCHEMA, 0.5);
  const digest: Digest = {
    summary: String(out.summary ?? ''),
    highlights: Array.isArray(out.highlights) ? (out.highlights as string[]).slice(0, 4) : [],
  };
  await admin.from('society_digests').upsert({ community_id: communityId, week_start: weekStart, content: JSON.stringify(digest) });
  return digest;
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

  // ── 2. Parse the request ──
  let body: {
    action?: string; kind?: Kind; note?: string; image?: string; question?: string;
    target_lang?: string; items?: TranslateItem[]; history?: { role?: string; text?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (body.action !== 'autofill' && body.action !== 'ask' && body.action !== 'translate' && body.action !== 'digest') {
    return json({ error: 'Unknown action' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Translate: NOT metered against the AI-helper quota (cached + batched,
  //    and it must work freely while browsing). ──
  if (body.action === 'translate') {
    try {
      const translations = await handleTranslate(admin, body.target_lang ?? '', body.items ?? []);
      return json({ translations });
    } catch (e) {
      console.error('ai-proxy translate error:', e);
      return json({ translations: {} }); // fail soft → reader just sees the original
    }
  }

  // ── Digest: cached once per society per week, so it isn't metered per user. ──
  if (body.action === 'digest') {
    try {
      const { data: prof } = await admin.from('profiles').select('community_id').eq('id', userId).single();
      const communityId = prof?.community_id as string | undefined;
      if (!communityId) return json({ digest: { summary: '', highlights: [] } });
      return json({ digest: await handleDigest(admin, communityId) });
    } catch (e) {
      console.error('ai-proxy digest error:', e);
      return json({ digest: { summary: '', highlights: [] } });
    }
  }

  // ── 3. Meter usage (service role; the RPC is locked to definer-only) ──
  const { data: allowed, error: quotaErr } = await admin.rpc('check_and_increment_ai_quota', {
    p_user_id: userId,
    p_limit: DAILY_LIMIT,
  });
  if (quotaErr) return json({ error: 'Quota check failed' }, 500);
  if (!allowed) return json({ error: 'over_quota', message: "You've used today's AI helper limit. Try again tomorrow." }, 429);

  // ── 4a. Autofill: photo → form fields ──
  if (body.action === 'autofill') {
    const kind = body.kind as Kind;
    const spec = kind && SCHEMAS[kind];
    if (!spec) return json({ error: 'Unknown kind' }, 400);

    const image = (body.image ?? '').trim();
    if (!image) return json({ error: 'A photo is required for autofill' }, 400);
    if (image.length > MAX_IMAGE_CHARS) return json({ error: 'Photo is too large' }, 413);
    const note = (body.note ?? '').toString().slice(0, 200);

    const NOUN: Record<Kind, string> = { dish: 'dish or food', listing: 'item to sell', borrow: 'item to lend' };
    try {
      const result = await callAutofill(spec.instruction, spec.schema, note, image);
      if (result.is_relevant === false) {
        return json({ error: 'not_relevant', message: `That photo doesn't look like a ${NOUN[kind]} — pick another, or fill the form in.` });
      }
      delete result.is_relevant; // internal flag, not a form field
      return json({ result });
    } catch (e) {
      console.error('ai-proxy autofill error:', e);
      return json({ error: 'AI could not read this photo — fill the form manually.' }, 502);
    }
  }

  // ── 4b. Ask Aangan: conversational answer over the society's catalog ──
  const question = (body.question ?? '').toString().trim().slice(0, 300);
  if (!question) return json({ error: 'Ask a question first' }, 400);

  // Prior turns (for follow-up resolution); cap to the last few.
  const history: ChatTurn[] = (Array.isArray(body.history) ? body.history : [])
    .slice(-8)
    .map((h: { role?: string; text?: string }) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', text: String(h.text ?? '').slice(0, 1000) }))
    .filter((h: ChatTurn) => h.text);

  // Scope strictly to the caller's own society (service role bypasses RLS).
  const { data: prof } = await admin.from('profiles').select('community_id').eq('id', userId).single();
  const communityId = prof?.community_id as string | undefined;
  if (!communityId) return json({ result: { answer: 'Join a society to use Ask Aangan.', results: [] } });

  // For retrieval, blend the previous user turn so short follow-ups still match.
  const prevUser = [...history].reverse().find((h) => h.role === 'user')?.text;
  const retrievalText = prevUser ? `${prevUser}\n${question}` : question;

  try {
    let catalog: CatalogItem[] = [];

    // Semantic (pgvector) path — best-effort; falls back to the recent catalog.
    try {
      // 1. Lazily embed any rows the triggers marked dirty (usually a handful).
      const { data: dirty } = await admin.from('search_documents')
        .select('source,source_id,content').eq('community_id', communityId).is('embedding', null).limit(60);
      if (dirty?.length) {
        const vecs = await embedTexts(dirty.map((d: { content: string }) => d.content), 'RETRIEVAL_DOCUMENT');
        await Promise.all(dirty.map((d: { source: string; source_id: string }, i: number) =>
          vecs[i]
            ? admin.from('search_documents').update({ embedding: toVec(vecs[i]) }).eq('source', d.source).eq('source_id', d.source_id)
            : Promise.resolve()));
      }

      // 2. Embed the question (blended with the prior turn) and cosine-search.
      const [qVec] = await embedTexts([retrievalText], 'RETRIEVAL_QUERY');
      if (qVec) {
        const { data: matches } = await admin.rpc('match_documents', { p_community: communityId, p_embedding: toVec(qVec), p_count: 18 });
        if (matches?.length) {
          const idsBySource: Record<string, string[]> = {};
          for (const m of matches as { source: string; source_id: string }[]) (idsBySource[m.source] ??= []).push(m.source_id);
          catalog = await fetchByIds(admin, idsBySource);
        }
      }
    } catch (e) {
      console.error('ai-proxy vector path failed, falling back:', e);
    }

    // Fallback (vectors not ready / no matches): recent fresh catalog.
    if (!catalog.length) catalog = await buildCatalog(admin, communityId);

    // Always-on society facts (members, residents, announcements, polls).
    const facts = await buildFacts(admin, communityId);

    const result = await callAsk(question, catalog, facts, history);
    return json({ result });
  } catch (e) {
    console.error('ai-proxy ask error:', e);
    return json({ error: 'Ask Aangan is unavailable right now — try the Search tab.' }, 502);
  }
});
