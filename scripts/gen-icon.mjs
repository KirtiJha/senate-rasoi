// Generates Aangan app icons from an SVG (coral gradient + white "courtyard"
// mark: a frame of homes around an open central space). Run: node scripts/gen-icon.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Shared defs: coral gradient + a mask that punches the courtyard hole.
const defs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF7A57"/>
      <stop offset="1" stop-color="#F5492B"/>
    </linearGradient>
    <mask id="hole">
      <rect x="266" y="266" width="492" height="492" rx="154" fill="white"/>
      <rect x="389" y="389" width="246" height="246" rx="82" fill="black"/>
    </mask>
  </defs>`;

// The white mark: a ring of homes (with the courtyard cut out) + a gathering dot.
const mark = `
  <rect x="266" y="266" width="492" height="492" rx="154" fill="#ffffff" mask="url(#hole)"/>
  <circle cx="512" cy="512" r="46" fill="#ffffff"/>`;

// Full-bleed square icon (iOS masks the corners itself). The courtyard shows the gradient.
const square = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${defs}<rect width="1024" height="1024" fill="url(#g)"/>${mark}</svg>`;

// Mark on transparent — for the splash + Android adaptive foreground (already inset).
const fgTransparent = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${defs}${mark}</svg>`;

const targets = [
  { svg: square, out: 'assets/images/icon.png', size: 1024 },
  { svg: square, out: 'assets/images/favicon.png', size: 196 },
  { svg: square, out: 'public/icon-512.png', size: 512 },
  { svg: square, out: 'public/favicon.png', size: 196 },
  { svg: fgTransparent, out: 'assets/images/splash-icon.png', size: 512 },
  { svg: fgTransparent, out: 'assets/images/android-icon-foreground.png', size: 1024 },
];

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(join(root, t.out));
  console.log('wrote', t.out, `(${t.size}px)`);
}
console.log('done');
