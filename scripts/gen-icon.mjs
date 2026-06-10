// Generates Aangan app icons from assets/images/aangan_icon.svg
// (teal courtyard-arch tile). Run: node scripts/gen-icon.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'assets/images/aangan_icon.svg'));

const targets = [
  { out: 'assets/images/icon.png', size: 1024 },
  { out: 'assets/images/favicon.png', size: 196 },
  { out: 'public/icon-512.png', size: 512 },
  { out: 'public/favicon.png', size: 196 },
  { out: 'assets/images/splash-icon.png', size: 512 },
  { out: 'assets/images/android-icon-foreground.png', size: 1024 },
];

for (const t of targets) {
  await sharp(svg, { density: 384 }).resize(t.size, t.size).png().toFile(join(root, t.out));
  console.log('wrote', t.out, `(${t.size}px)`);
}
console.log('done');
