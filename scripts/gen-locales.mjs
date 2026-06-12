// Machine-translate src/i18n/locales/en.json into every supported language via Gemini.
//
//   GEMINI_API_KEY=xxxx node scripts/gen-locales.mjs            # all languages
//   GEMINI_API_KEY=xxxx node scripts/gen-locales.mjs hi kn      # only these
//
// Re-run whenever en.json changes. Placeholders like {{name}} are kept verbatim.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY in your environment.'); process.exit(1); }

const LANGS = {
  hi: 'Hindi', bn: 'Bengali', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
  ml: 'Malayalam', gu: 'Gujarati', pa: 'Punjabi', or: 'Odia', ur: 'Urdu',
};
const MODEL = 'gemini-2.5-flash';

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out); else out[key] = v;
  }
  return out;
};
const unflatten = (flat) => {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.'); let o = out;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] ??= {}; o = o[parts[i]]; }
    o[parts.at(-1)] = v;
  }
  return out;
};

async function translateBatch(strings, langName) {
  const numbered = strings.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt =
    `Translate each numbered UI string for a mobile app used by residents of an Indian apartment society into ${langName}. ` +
    'These are short interface labels/buttons. Keep {{placeholders}} EXACTLY as-is (never translate text inside double braces). ' +
    'Keep emojis. Keep it concise and natural for a UI. Return JSON {"t":[...]} with one translation per input, in the same order.\n\n' +
    numbered;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'object', properties: { t: { type: 'array', items: { type: 'string' } } }, required: ['t'] },
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text).t;
}

const flat = flatten(JSON.parse(readFileSync(join(LOCALES, 'en.json'), 'utf8')));
const keys = Object.keys(flat);
const values = keys.map((k) => flat[k]);

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LANGS);
for (const code of targets) {
  const langName = LANGS[code];
  if (!langName) { console.warn('skip unknown lang', code); continue; }
  process.stdout.write(`→ ${code} (${langName}) … `);
  const out = {};
  const BATCH = 40;
  for (let i = 0; i < values.length; i += BATCH) {
    const slice = values.slice(i, i + BATCH);
    const t = await translateBatch(slice, langName);
    slice.forEach((_, j) => { out[keys[i + j]] = t[j] ?? values[i + j]; });
  }
  writeFileSync(join(LOCALES, `${code}.json`), JSON.stringify(unflatten(out), null, 2) + '\n');
  console.log(`done (${keys.length} keys)`);
}
console.log('All locales generated.');
