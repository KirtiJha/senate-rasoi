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

const problems = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  // Blank out comments first — keeping length and newlines so reported line
  // numbers stay true — so the rule never flags the examples that explain it.
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
    .replace(/^([^\n]*?)\/\/[^\n]*$/gm, (s, keep) => keep + ' '.repeat(s.length - keep.length));

  // Match an opening tag across lines so multi-line JSX props are seen.
  const tagRe = /<(Animated\.\w+|Touchable)\b([\s\S]*?)>/g;
  let m;
  while ((m = tagRe.exec(code)) !== null) {
    const [, tag, props] = m;
    const cls = props.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
    if (!cls) continue;
    const value = cls[1] ?? cls[2] ?? '';
    if (!PAINT.test(value)) continue;

    const line = code.slice(0, m.index).split('\n').length;
    problems.push({
      file: relative(SRC, file).split('\\').join('/'),
      line,
      tag,
      value: value.trim().slice(0, 60),
    });
  }
}

if (problems.length === 0) {
  console.log(`check-ui: ${files.length} files, no animated components carrying layout or paint in a className.`);
  process.exit(0);
}

console.error(`check-ui: ${problems.length} problem(s) — styles here are dropped silently on native.\n`);
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}`);
  console.error(`    <${p.tag} className="${p.value}${p.value.length >= 60 ? '…' : ''}">`);
  console.error(`    Move layout and paint to \`style\`, or wrap a plain <View> inside.\n`);
}
process.exit(1);
