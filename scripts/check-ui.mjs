// Guard against the failure mode that cost this project a whole day.
//
// NativeWind's cssInterop maps `className` onto the `style` prop. That makes
// two patterns silently wrong — no error, no warning, just styles quietly
// dropped on native while the code reads correctly:
//
//   1. `className` on a component whose `style` is ALSO being set internally
//      (Touchable sets an animated style, so a background in its className
//      loses). Every Button in the app rendered without its fill this way.
//
//   2. `className` on a Reanimated `Animated.*` component, whose interop
//      registration depends on module load order rather than on the source in
//      front of you. The Home hero laid out as a column because of this, and
//      an invisible absolutely-positioned pill fell into normal flow and put a
//      42dp gap under the header that survived four attempts to remove it.
//
// The rule both cases share: if a component animates, its layout and paint go
// in `style`. Never a className.
//
// Run: node scripts/check-ui.mjs   (also wired to `npm run check:ui`)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) files.push(p);
  }
})(SRC);

/** Paint and layout that must never ride on a className of an animated node. */
const PAINT = /\b(bg-|border|rounded|flex-row|flex-1|absolute|items-|justify-|gap-|p-|px-|py-|mt-|mb-|mx-|my-)/;

/**
 * Blank out comments, keeping length and newlines so reported line numbers
 * stay true — otherwise every rule flags the examples that explain it,
 * including the ones in this file's own header.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
    .replace(/^([^\n]*?)\/\/[^\n]*$/gm, (s, keep) => keep + ' '.repeat(s.length - keep.length));
}

const BACKSLASH = String.fromCharCode(92);

/**
 * Where a JSX opening tag actually ends.
 *
 * Every rule below used to find this with `[\s\S]*?>`, which stops at the
 * FIRST `>` in the props — and an arrow function hands it one. So a tag
 * written `<Touchable onPress={() => go()} className="flex-1">` was only ever
 * read as far as the `=>`, and every prop after it was invisible to the guard.
 * That is not a corner case: it is how most press targets in this app are
 * written, and it is why three contact buttons on the neighbour profile could
 * collapse to the width of their own labels with the guard reporting a clean
 * run.
 *
 * So: walk forward, count braces, skip string literals, and stop at the first
 * `>` that is at depth zero and is not the tail of an arrow.
 */
function tagEnd(code, from) {
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === BACKSLASH) i++;
        i++;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0 && code[i - 1] !== '=') return i;
  }
  return -1;
}

/** Every opening tag of the named components, with its full prop text. */
function* openTags(code, nameRe) {
  const re = new RegExp('<(' + nameRe + ')\\b', 'g');
  let m;
  while ((m = re.exec(code)) !== null) {
    const from = m.index + m[0].length;
    const end = tagEnd(code, from);
    if (end === -1) continue;
    yield { tag: m[1], props: code.slice(from, end), index: m.index, end };
  }
}

const problems = [];

for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'));

  for (const { tag, props, index } of openTags(code, 'Animated\\.\\w+|Touchable')) {
    const cls = props.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
    if (!cls) continue;
    const value = cls[1] ?? cls[2] ?? '';
    if (!PAINT.test(value)) continue;

    const line = code.slice(0, index).split('\n').length;
    problems.push({
      file: relative(SRC, file).split('\\').join('/'),
      line,
      tag,
      value: value.trim().slice(0, 60),
    });
  }
}

// ── Layout on an animated press target ──────────────────────────────
//
// Touchable composes its own animated style, so a `flex`, `width` or
// `position` handed to it does not reliably reach the layout. It has produced
// the same symptom four times now: two tab labels jammed together instead of
// splitting the row, three action tiles stopping short of the edge. Margins
// are fine — those describe the element's own box, not how its parent sizes
// it.
const LAYOUT_KEY = /\b(flex|width|position)\s*:/;

for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const { props, index } of openTags(code, 'Touchable')) {
    const style = props.match(/style=\{\{([^}]*)\}\}/);
    if (!style || !LAYOUT_KEY.test(style[1])) continue;
    problems.push({
      file: relative(SRC, file).split('\\').join('/'),
      line: code.slice(0, index).split('\n').length,
      tag: 'Touchable',
      prop: 'style',
      value: style[1].trim().slice(0, 60),
    });
  }
}

// ── `active:` on a child of a press target ──────────────────────────
//
// NativeWind implements `active:` on native by attaching its OWN press
// responder to the element that carries it. Put one on a child of a
// Touchable and that child becomes interactive: it wins the responder, and
// the Touchable above it is never offered the touch. The press target then
// receives the finger and does nothing — silently, and on native only, since
// on web `active:` compiles to CSS `:active` with no responder involved.
//
// Every Button in the app was dead this way. The paint had been moved off
// Touchable onto a child View to fix an invisible background, and it carried
// `bg-accent active:bg-accent-press` along with it.
//
// Touchable already animates the press, so `active:` inside one is redundant
// as well as harmful.
for (const file of files) {
  const code = stripComments(readFileSync(file, 'utf8'));
  for (const { end } of openTags(code, 'Touchable')) {
    const bodyStart = end + 1;
    const close = code.indexOf('</Touchable>', bodyStart);
    if (close === -1) continue;
    const body = code.slice(bodyStart, close);
    // Only inert children matter. An `active:` on a nested Pressable is that
    // element styling its own press, which is fine. The bug is `active:` on
    // something that is NOT a press target, because NativeWind turns it into
    // one, and it then outranks the Touchable wrapping it.
    const PRESSY = /^(Pressable|Touchable|TouchableOpacity|TouchableHighlight|APressable)$/;
    let hit = null;
    for (const m of body.matchAll(new RegExp("\\bactive:[\\w[\\]/.-]+", "g"))) {
      const before = body.slice(0, m.index);
      const open2 = before.lastIndexOf("<");
      const name = open2 === -1 ? "" : (before.slice(open2 + 1).match(/^[A-Za-z][\w.]*/) || [""])[0];
      if (PRESSY.test(name)) continue;
      hit = m;
      break;
    }
    if (!hit) continue;
    problems.push({
      file: relative(SRC, file).split('\\').join('/'),
      line: code.slice(0, bodyStart + hit.index).split('\n').length,
      tag: 'child of Touchable',
      prop: 'active',
      value: hit[0],
    });
  }
}

// ── Type scale: no half-pixels, nothing under 11px ──────────────────
//
// Twenty-five distinct font sizes had accumulated, six of them halves
// (11.5px, 12.5px, 13.5px) that exist for no reason a reader could name,
// and text down to 9px on the resident directory — unreadable for the
// older neighbours the app is partly for. The scale's floor is 11.
const typeProblems = [];
for (const file of files) {
  const code = stripComments(readFileSync(file, "utf8"));
  const rel = file.slice(SRC.length + 1).split("\\").join("/");
  const re = /text-\[([0-9.]+)px\]/g;
  let hit;
  while ((hit = re.exec(code))) {
    const n = Number(hit[1]);
    if (Number.isInteger(n) && n >= 11) continue;
    typeProblems.push({
      file: rel,
      line: code.slice(0, hit.index).split("\n").length,
      value: hit[0],
      why: Number.isInteger(n) ? "below the 11px floor" : "a half-pixel size",
    });
  }
}
if (typeProblems.length) {
  console.error(`check-ui: ${typeProblems.length} type-scale problem(s).\n`);
  for (const t of typeProblems) {
    console.error(`  ${t.file}:${t.line}`);
    console.error(`    ${t.value} — ${t.why}. Use 11, 12, 13, 14 or 15.\n`);
  }
  process.exit(1);
}

if (problems.length === 0) {
  console.log(`check-ui: ${files.length} files, no animated components carrying layout or paint in a className.`);
  process.exit(0);
}

console.error(`check-ui: ${problems.length} problem(s) — styles here are dropped silently on native.\n`);
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}`);
  console.error(
    p.prop === 'active'
      ? `    ${p.value}  (inside a <Touchable>)`
      : `    <${p.tag} ${p.prop ?? 'className'}="${p.value}${p.value.length >= 60 ? '…' : ''}">`,
  );
  console.error(
    p.prop === 'active'
      ? `    Remove it — Touchable animates the press, and this steals the touch.\n`
      : p.prop === 'style'
        ? `    Wrap it in a plain <View> that carries the layout.\n`
        : `    Move layout and paint to \`style\`, or wrap a plain <View> inside.\n`,
  );
}
process.exit(1);
