// Generates Aangan app icons from an SVG (coral gradient + white "courtyard"
// mark: a frame of homes around an open central space). Run: node scripts/gen-icon.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Coral gradient.
const defs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF7A57"/>
      <stop offset="1" stop-color="#F5492B"/>
    </linearGradient>
  </defs>`;

// Two little homes (a neighbourhood) with doorways. Uses a 0–100 viewBox so the
// coordinates match src/components/BrandMark.tsx exactly.
const mark = `
  <path d="M34 24 L51 45 L51 73 Q51 78 46 78 L23 78 Q18 78 18 73 L18 45 Z" fill="#ffffff"/>
  <path d="M68 35 L83 53 L83 73 Q83 78 78 78 L59 78 Q54 78 54 73 L54 53 Z" fill="#ffffff"/>
  <rect x="29" y="62" width="11" height="16" rx="3" fill="url(#g)"/>
  <rect x="63" y="64" width="9" height="14" rx="2.5" fill="url(#g)"/>`;

// Full-bleed square icon (iOS masks the corners itself).
const square = `<svg width="1024" height="1024" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  ${defs}<rect width="100" height="100" fill="url(#g)"/>${mark}</svg>`;

// Mark on transparent — for the splash + Android adaptive foreground.
const fgTransparent = `<svg width="1024" height="1024" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
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
