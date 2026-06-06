// Generates Senate Rasoi app icons from an SVG (coral gradient + white pot).
// Run: node scripts/gen-icon.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// White steaming-pot artwork on a 1024 canvas (centered).
const pot = `
  <g transform="translate(0,-30)">
    <g fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round">
      <path d="M430 322 q-42 46 0 92 q42 46 0 92"/>
      <path d="M512 300 q-46 50 0 100 q46 50 0 100"/>
      <path d="M594 322 q-42 46 0 92 q42 46 0 92"/>
    </g>
    <g fill="#ffffff">
      <rect x="250" y="628" width="64" height="46" rx="23"/>
      <rect x="710" y="628" width="64" height="46" rx="23"/>
      <ellipse cx="512" cy="606" rx="244" ry="44"/>
      <rect x="470" y="556" width="84" height="40" rx="20"/>
      <path d="M300 606 H724 L702 772 q-8 44 -52 44 H354 q-44 0 -52 -44 Z"/>
    </g>
  </g>`;

const gradient = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF6A3D"/>
      <stop offset="1" stop-color="#FF9E45"/>
    </linearGradient>
  </defs>`;

// Full-bleed square icon (iOS masks the corners itself).
const square = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  ${gradient}<rect width="1024" height="1024" fill="url(#g)"/>${pot}</svg>`;

// Pot on transparent, scaled into the Android adaptive-icon safe zone (~66%).
const fgTransparent = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(174,174) scale(0.66)">${pot}</g></svg>`;

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
