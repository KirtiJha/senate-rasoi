// Frame-accurate renderer: node render.mjs <cut> <outDir> [workers] [fps]
// Expects marketing/ served on http://127.0.0.1:8766/ (film2 reads ../ad/fonts).
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));

const [cut = 'long', out = 'out', W = '3', FPS = '30'] = process.argv.slice(2);
const workers = Number(W), fps = Number(FPS);
const exe = process.env.CHROME || undefined;
fs.mkdirSync(out, { recursive: true });

async function chunk(id, f0, f1) {
  const b = await chromium.launch({ executablePath: exe, args: ['--disable-gpu-vsync', '--force-device-scale-factor=1'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(`http://127.0.0.1:8766/film2/index.html?render=1&cut=${cut}`);
  await p.evaluate(() => window.__ready);
  const file = path.join(out, `part${String(id).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '9M', '-bufsize', '18M', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await p.evaluate((t) => window.__seek(t), f / fps);
    const buf = await p.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 300 === 0) console.log(`w${id} ${f - f0}/${f1 - f0} ${((Date.now() - t0) / Math.max(1, f - f0)).toFixed(0)}ms/f`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  return file;
}

const probe = await chromium.launch({ executablePath: exe });
const pp = await probe.newPage({ viewport: { width: 1920, height: 1080 } });
await pp.goto(`http://127.0.0.1:8766/film2/index.html?render=1&cut=${cut}`);
const { dur } = await pp.evaluate(() => window.__ready);
await probe.close();
const total = Math.round(dur * fps);
const per = Math.ceil(total / workers);
console.log(cut, 'dur', dur, 'frames', total);
const parts = await Promise.all(Array.from({ length: workers }, (_, i) => chunk(i, i * per, Math.min(total, (i + 1) * per))));
fs.writeFileSync(path.join(out, 'parts.txt'), parts.map((f) => `file '${path.resolve(f)}'`).join('\n'));
console.log('done', parts);
