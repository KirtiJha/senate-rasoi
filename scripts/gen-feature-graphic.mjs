// Generates the Google Play feature graphic (1024x500) for Aangan.
// Brand dark tile + multicolour diversity flower + wordmark + tagline.
// Run: node scripts/gen-feature-graphic.mjs   (needs sharp: npm i --no-save sharp)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// One flower petal ring, reused from assets/images/aangan_diversity_icon_dark.svg
const petals = (rx, ry, cy, op, colors) =>
  colors
    .map(
      (c, i) =>
        `<g transform="rotate(${i * 45},0,0)"><ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${op}"/></g>`,
    )
    .join('');
const OUTER = ['#E8650A', '#D4537E', '#5DCAA5', '#AFA9EC', '#FAC775', '#F0997B', '#85B7EB', '#97C459'];

const flower = `
  <g transform="translate(250,250) scale(1.02)">
    ${petals(30, 90, -90, 0.95, OUTER)}
    <circle cx="0" cy="0" r="52" fill="#1a1a1a"/>
    ${petals(18, 26, -30, 0.28, OUTER)}
    <circle cx="0" cy="0" r="30" fill="#ffffff" opacity="0.95"/>
    <circle cx="0" cy="0" r="20" fill="#E8650A"/>
    <circle cx="0" cy="0" r="8"  fill="#ffffff"/>
    <circle cx="0" cy="0" r="3.5" fill="#E8650A"/>
  </g>`;

const svg = `<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="24%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#0F6E56" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0F6E56" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="#1a1a1a"/>
  <rect width="1024" height="500" fill="url(#glow)"/>
  ${flower}
  <text x="486" y="238" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="800" fill="#ffffff">Aangan</text>
  <text x="490" y="298" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="500" fill="#E7E5E4">Your society, in one app</text>
  <text x="491" y="346" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="0.8" fill="#5DCAA5">NOTICES · MARKETPLACE · FOOD · EVENTS</text>
</svg>`;

await sharp(Buffer.from(svg), { density: 300 })
  .resize(1024, 500)
  .png()
  .toFile(join(root, 'assets/images/play-feature-graphic.png'));
console.log('wrote assets/images/play-feature-graphic.png (1024x500)');
