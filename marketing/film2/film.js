/* Aangan — Film 2, "One Courtyard".
 * A deterministic timeline: every frame is a pure function of t, so it plays
 * live and renders frame-by-frame (?render=1). Real UI is lifted out of the
 * app (media/ui, captured at 3x) and key moments are rebuilt big. */
(() => {
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  const W = 1920, H = 1080, SW = 412, SH = 892;
  const PET = ['#E8650A', '#D4537E', '#1D9E75', '#534AB7', '#BA7517', '#D85A30', '#185FA5', '#3B6D11'];
  if (RENDER) document.documentElement.classList.add('render');

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    out2: (t) => 1 - (1 - t) * (1 - t), out3: (t) => 1 - Math.pow(1 - t, 3), out5: (t) => 1 - Math.pow(1 - t, 5),
    in2: (t) => t * t, in3: (t) => t * t * t, io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    io5: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    back: (t) => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  };
  const sp = (t, a, b, e = E.out3) => e(seg(t, a, b));
  // eased keyframes: [[t, value|{...}], ...]
  const kf = (keys, t, e = E.io3) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [a, va] = keys[i - 1], [b, vb] = keys[i]; const p = e((t - a) / (b - a));
        if (typeof va === 'number') return lerp(va, vb, p);
        const o = {}; for (const k in va) o[k] = lerp(va[k], vb[k] ?? va[k], p); return o;
      }
    }
    return keys[keys.length - 1][1];
  };
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // ---------- dom ----------
  const h = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const css = (e, o) => { for (const k in o) { if (k.startsWith('--')) e.style.setProperty(k, o[k]); else e.style[k] = o[k]; } return e; };
  const tf = (e, s) => { if (e._tf !== s) { e.style.transform = s; e._tf = s; } };
  const op = (e, v) => { v = Math.round(clamp(v) * 1000) / 1000; if (e._op !== v) { e.style.opacity = v; e._op = v; } e.style.visibility = v > 0 ? 'visible' : 'hidden'; };
  const fl = (e, s) => { if (e._fl !== s) { e.style.filter = s; e._fl = s; } };
  const txt = (e, s) => { if (e._tx !== s) { e.textContent = s; e._tx = s; } };
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  // centre-anchored placement
  const put = (e, w, hh, x, y, { s = 1, rx = 0, ry = 0, rz = 0, z = 0, o = 1, b = 0 } = {}) => {
    tf(e, `translate3d(${x - w / 2}px,${y - hh / 2}px,${z}px) perspective(1800px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`);
    op(e, o); fl(e, b > 0.3 ? `blur(${b}px)` : 'none');
  };

  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', check: '<path d="M20 6 9 17l-5-5"/>',
    building: '<path d="M4 21V5l8-3v19M12 9l8 3v9M2 21h20M7 8h2M7 12h2M7 16h2M15 14h2M15 18h2"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>', up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    bell: '<path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21h4"/>', mega: '<path d="M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>', fire: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-9 0 4-4 7-4 13 0 4 3 7 7 7z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', drop: '<path d="M12 2s7 7.5 7 13a7 7 0 0 1-14 0c0-5.5 7-13 7-13z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    android: '<path d="M6 10h12v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M6 9a6 6 0 0 1 12 0zM9 19v3M15 19v3M3 11v5M21 11v5M8 4 6.5 2M16 4l1.5-2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    scooter: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h7l3-8h3M13 17l-2-6H7"/>', pot: '<path d="M4 10h16v3a8 8 0 0 1-16 0zM2 10h20M9 6c0-2 2-2 2-4M13 6c0-2 2-2 2-4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>', users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.7"/>',
  };
  const icon = (k, sw = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${P[k] || P.spark}</svg>`;

  // ---------- assets ----------
  let LIB = {}, MAN = {}, PENDING = [], PLAYING = false;
  const img = (parent, src, cls = 'abs') => { const e = h('img', cls, parent); e.decoding = 'sync'; e.src = src; if (RENDER) PENDING.push(e.decode().catch(() => {})); return e; };
  const UI = (parent, name, s = 1.5, r = 16) => {
    const m = LIB[name]; const e = h('div', 'ui', parent);
    css(e, { width: m.w * s + 'px', height: m.h * s + 'px', backgroundImage: `url(media/ui/${name}.png)`, borderRadius: r * s + 'px' });
    if (RENDER) { const i = new Image(); i.src = `media/ui/${name}.png`; PENDING.push(i.decode().catch(() => {})); }
    return { el: e, w: m.w * s, h: m.h * s, m, at(x, y, o) { put(e, this.w, this.h, x, y, o); } };
  };
  // film-1 recordings (for the montage)
  class Clip {
    constructor(parent, name) {
      this.name = name; this.m = MAN[name]; let acc = 0;
      this.cum = this.m.frames.map((f) => { const s = acc; acc += f.d; return s / 30; }); this.dur = acc / 30;
      if (RENDER) this.el = h('img', 'abs', parent); else { this.el = h('video', 'abs', parent); this.el.muted = true; this.el.playsInline = true; this.el.preload = 'auto'; this.el.src = `../ad/media/video/${name}.mp4`; }
      css(this.el, { width: '100%', height: '100%' });
    }
    set(t) {
      t = clamp(t, 0, this.dur - 0.05);
      if (RENDER) { let lo = 0, hi = this.cum.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.cum[m] <= t) lo = m; else hi = m - 1; }
        const src = `../ad/frames/${this.name}/${this.m.frames[lo].f}`; if (this.el._s !== src) { this.el._s = src; this.el.src = src; PENDING.push(this.el.decode().catch(() => {})); } return; }
      const v = this.el; if (v.readyState < 1 || v.seeking) return;
      if (!PLAYING) { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - t) > 0.05) v.currentTime = t; }
      else { if (Math.abs(v.currentTime - t) > 0.4) v.currentTime = t; if (v.paused) v.play().catch(() => {}); }
    }
    sleep() { if (!RENDER && !this.el.paused) this.el.pause(); }
  }

  // ---------- building blocks ----------
  class Phone {
    // screen: image path, or {tall: path, h: cssHeight} for scrolling, or {clip: name}
    constructor(parent, sw = 420, screen = null, back = true) {
      this.sw = sw; this.sh = sw * SH / SW; const b = Math.round(sw * 0.03), r = Math.round(sw * 0.13);
      this.w = sw + 2 * b; this.h = this.sh + 2 * b; this.s = sw / SW;
      this.root = h('div', 'phone', parent); css(this.root, { width: this.w + 'px', height: this.h + 'px', '--b': b + 'px', '--r': r + 'px', transformStyle: 'preserve-3d' });
      const body = h('div', 'ph-body', this.root); css(body, { backfaceVisibility: 'hidden' });
      const scr = h('div', 'ph-screen', body); this.view = h('div', 'ph-view', scr);
      h('div', 'ph-cam', this.root);
      h('div', 'ph-glare', this.root).style.backfaceVisibility = 'hidden';
      if (back) { const bk = h('div', '', this.root); css(bk, { position: 'absolute', inset: 0, borderRadius: r + 'px', background: 'linear-gradient(150deg,#1d2a25,#0b1210 55%,#18241f)', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', boxShadow: '0 0 0 3px #0b0d0c' });
        const lg = h('div', '', bk); css(lg, { position: 'absolute', left: '50%', top: '45%', width: 0, height: 0 }); const L = Logo(lg, sw * 0.32); css(L.svg, { left: -sw * 0.16 + 'px', top: -sw * 0.16 + 'px' }); L.update(5); }
      this.layer = null; this.setScreen(screen);
    }
    setScreen(screen) {
      if (!screen || this._scr === screen) return; this._scr = screen;
      this.view.innerHTML = ''; this.clip = null; this.tall = null;
      if (typeof screen === 'string') { this.im = img(this.view, screen); css(this.im, { width: '100%', height: '100%' }); }
      else if (screen.tall) { this.tall = img(this.view, screen.tall); this.tallH = screen.h; css(this.tall, { width: '100%', height: screen.h * this.s + 'px' }); }
      else if (screen.clip) { this.clip = new Clip(this.view, screen.clip); }
    }
    scroll(cssY) { if (this.tall) tf(this.tall, `translate3d(0,${-cssY * this.s}px,0)`); }
    at(x, y, o) { put(this.root, this.w, this.h, x, y, o); }
    // screen-space point of an app css coordinate, for a phone placed upright at (x,y) with scale s
    pt(x, y, cx, cy, s = 1) { return [x + (cx - SW / 2) * this.s * s, y + (cy - SH / 2) * this.s * s]; }
  }
  function Logo(parent, size) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '-130 -130 260 260'); svg.setAttribute('width', size); svg.setAttribute('height', size);
    css(svg, { position: 'absolute', overflow: 'visible' }); parent.appendChild(svg);
    const mk = (tag, a, p = svg) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
    const petals = PET.map((c, i) => { const g = mk('g', {}); mk('ellipse', { cx: 0, cy: -58, rx: 22, ry: 58, fill: c, opacity: 0.93 }, g); return g; });
    const core = mk('g', {}); mk('circle', { r: 54, fill: '#fff', opacity: 0.95 }, core);
    PET.forEach((c, i) => { const g = mk('g', { transform: `rotate(${i * 45})` }, core); mk('ellipse', { cx: 0, cy: -33, rx: 13, ry: 19, fill: c, opacity: 0.28 }, g); });
    const eye = mk('g', {}); mk('circle', { r: 22, fill: '#1a1a1a' }, eye); mk('circle', { r: 14, fill: '#E8650A' }, eye); mk('circle', { r: 6, fill: '#fff' }, eye); mk('circle', { r: 2.5, fill: '#E8650A' }, eye);
    return { svg, update(t) {
      petals.forEach((g, i) => { const q = E.back(seg(t, 0.1 * i, 0.1 * i + 0.6)); g.setAttribute('transform', `rotate(${i * 45 - (1 - q) * 80}) scale(${Math.max(0.001, q)})`); g.style.opacity = clamp(q * 1.5); });
      const d = E.back(seg(t, 0.6, 1.1)); core.style.transform = `scale(${Math.max(0.001, d)})`; core.style.opacity = clamp(d);
      const c = E.back(seg(t, 0.85, 1.3)); eye.style.transform = `scale(${Math.max(0.001, c)})`;
    } };
  }
  // words with *highlight* markup
  class Words {
    constructor(parent, text, cls = 'big', hl = 'hl-green') {
      this.root = h('div', cls, parent); this.w = [];
      text.split(/(\*[^*]+\*)/).filter(Boolean).forEach((part) => {
        const isH = part.startsWith('*'); const tx = isH ? part.slice(1, -1) : part;
        tx.split(/(\s+)/).forEach((w) => { if (!w) return; if (/^\s+$/.test(w)) { this.root.appendChild(document.createTextNode(' ')); return; } this.w.push(h('span', 'w' + (isH ? ' ' + hl : ''), this.root, w)); });
      });
    }
    up(t, a, { st = 0.055, d = 0.7, dy = 0.6, out = null, outD = 0.45 } = {}) {
      this.w.forEach((w, i) => {
        const p = sp(t, a + i * st, a + i * st + d, E.out5);
        const q = out == null ? 0 : sp(t, out + i * 0.03, out + i * 0.03 + outD, E.in3);
        tf(w, `translate3d(0,${(1 - p) * dy - q * 0.5}em,0) rotate(${(1 - p) * 3}deg)`); op(w, p * (1 - q)); fl(w, p < 1 || q > 0 ? `blur(${(1 - p + q) * 10}px)` : 'none');
      });
    }
  }
  const abs = (parent, cls, html, o = {}) => css(h('div', 'abs ' + (cls || ''), parent, html), o);
  const fadeIn = (e, t, a, d = 0.6, dy = 24, out = null) => { const p = sp(t, a, a + d); const q = out == null ? 0 : sp(t, out, out + 0.4, E.in3); tf(e, `translate3d(0,${(1 - p) * dy - q * 20}px,0)`); op(e, p * (1 - q)); return p; };
  function Blobs(parent, cols, alpha = 0.6, seed = 1) {
    const r = rng(seed);
    const bs = cols.map((c, i) => { const b = abs(parent, '', '', { width: '1200px', height: '1200px', borderRadius: '50%', background: `radial-gradient(circle, ${c} 0%, ${c}aa 22%, ${c}44 46%, ${c}00 70%)`, opacity: alpha }); return { b, px: r(), py: r(), ph: r() * 6 }; });
    return (T) => bs.forEach(({ b, px, py, ph }, i) => tf(b, `translate3d(${px * W - 600 + Math.sin(T * 0.2 + ph) * 180}px,${py * H - 600 + Math.cos(T * 0.17 + ph) * 140}px,0)`));
  }
  const bgSolid = (root, bg) => abs(root, 'fill', '', { background: bg });
  const tap = (parent) => { const e = abs(parent, '', '<div style="position:absolute;inset:0;border-radius:50%;border:4px solid rgba(255,255,255,.9);box-shadow:0 0 0 3px rgba(14,107,78,.5)"></div><div style="position:absolute;inset:22px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 6px 20px rgba(0,0,0,.35)"></div>', { width: '90px', height: '90px' });
    return (t, at, x, y) => { const d = t - at; if (d < -0.4 || d > 0.7) { op(e, 0); return; }
      const pre = sp(d, -0.4, 0), post = sp(d, 0, 0.7); tf(e, `translate3d(${x - 45}px,${y - 45}px,0) scale(${d < 0 ? 1.3 - 0.4 * pre : 0.9 + post * 0.8})`); op(e, d < 0 ? pre : 1 - post); }; };
  const typed = (s, t, a, cps = 14) => s.slice(0, Math.max(0, Math.floor((t - a) * cps)));

  // ---------- scenes ----------
  const SC = {};

  SC.ping = (root, S) => {
    bgSolid(root, 'linear-gradient(180deg,#05070d,#0b1322 60%,#101a2a)');
    const stars = rng(2); for (let i = 0; i < 80; i++) abs(root, '', '', { left: stars() * W + 'px', top: stars() * 500 + 'px', width: '2px', height: '2px', borderRadius: '50%', background: '#fff', opacity: 0.2 + stars() * 0.5 });
    const world = abs(root, 'world');
    const r = rng(5); const wins = [];
    const towers = [[180, 330, 7, 15], [520, 230, 8, 19], [880, 300, 9, 16], [1250, 200, 8, 20], [1590, 340, 7, 14]];
    towers.forEach(([x, top, cols, rows]) => {
      const w = cols * 34 + 26; abs(world, '', '', { left: x + 'px', top: top + 'px', width: w + 'px', height: (1080 - top) + 'px', background: 'linear-gradient(180deg,#141d2c,#0d141f)', borderRadius: '6px 6px 0 0', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.04)' });
      for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
        const e = abs(world, '', '', { left: x + 16 + c * 34 + 'px', top: top + 20 + rr * 42 + 'px', width: '22px', height: '16px', borderRadius: '5px 5px 5px 1px' });
        wins.push({ e, cx: x + 27 + c * 34, cy: top + 28 + rr * 42, on: r(), col: r() < 0.3 ? '#3FB98B' : '#F2B25C', off: r() });
      }
    });
    // the first window: the one we start inside
    const first = wins.reduce((a, b) => (Math.hypot(b.cx - 1000, b.cy - 640) < Math.hypot(a.cx - 1000, a.cy - 640) ? b : a));
    first.on = 0;
    const bubble = abs(root, 'bubble-a', '<div style="font:700 22px Hanken;color:#D4537E;margin-bottom:8px">B-204</div>Water tanker coming today??<div style="text-align:right;font:500 18px Hanken;color:#8a948e;margin-top:6px">7:42 am ✓✓</div>', { whiteSpace: 'nowrap', width: '560px' });
    const shade = abs(root, 'fill', '', { background: 'linear-gradient(90deg,rgba(5,7,13,.92) 0%,rgba(5,7,13,.75) 38%,rgba(5,7,13,0) 62%)' });
    const lines = [['400 flats.', 2.4], ['14 WhatsApp groups.', 4.2], ['3,248 unread.', 6.0]].map(([s, a], i) => { const w = new Words(abs(root, '', '', { left: '120px', top: 300 + i * 120 + 'px' }), s, 'big'); css(w.root, { color: '#fff' }); return { w, a }; });
    const cnt = lines[2].w.w[0];
    const last = new Words(abs(root, '', '', { left: 0, right: 0, top: '470px', textAlign: 'center', width: '1920px' }), 'And nobody can find *anything*.', 'big', 'hl-orange'); css(last.root, { color: '#fff' });
    return { update(t, T) {
      const z = kf([[0, 9], [1.4, 9], [8.6, 1]], t, E.io5);
      const f = (9 - z) / 8; // 0 at the first window, 1 at the full skyline
      tf(world, `translate(960px,540px) scale(${z}) translate(${-lerp(first.cx, 960, f)}px,${-lerp(first.cy, 540, f)}px)`);
      const n = Math.pow(2, Math.max(0, (t - 1.2) * 1.45)); const frac = clamp(n / wins.length);
      const offWave = sp(t, 8.6, 9.6, E.in2);
      wins.forEach((w) => { const on = w === first ? t > 0.2 : w.on < frac; const off = w.off < offWave && w !== first;
        const v = on && !off ? 1 : 0; if (w._v !== v) { w._v = v; css(w.e, { background: v ? w.col : '#1b2433', boxShadow: v ? `0 0 14px ${w.col}88` : 'none' }); } });
      const bq = sp(t, 0.2, 0.7, E.back), bo = 1 - sp(t, 1.2, 1.9);
      put(bubble, 560, 160, 960, 520, { s: 0.6 + 0.4 * bq, o: Math.min(bq * 1.5, bo) });
      op(shade, sp(t, 2.0, 2.6) * (1 - sp(t, 8.4, 9.0)));
      lines.forEach(({ w, a }) => w.up(t, a, { out: 8.4 }));
      txt(cnt, Math.round(3248 * sp(t, 6.0, 7.6)).toLocaleString('en-IN')); cnt.style.color = '#ff6b5a';
      last.up(t, 9.0, { st: 0.08 });
    } };
  };

  SC.spark = (root, S) => {
    const bg = bgSolid(root, '#0b1322');
    const glow = abs(root, '', '', { left: '960px', top: '540px', width: '44px', height: '30px', marginLeft: '-22px', marginTop: '-15px', borderRadius: '8px', background: '#F2B25C', boxShadow: '0 0 60px 20px rgba(242,178,92,.6)' });
    const warm = bgSolid(root, 'radial-gradient(ellipse at 50% 45%,#0f5a42,#063526 55%,#021a12)');
    const blobs = Blobs(warm, ['#E8650A', '#1D9E75', '#534AB7'], 0.35, 7);
    const hold = abs(root, '', '', { left: '960px', top: '400px' }); const L = Logo(hold, 300); css(L.svg, { left: '-150px', top: '-150px' });
    const wm = new Words(abs(root, '', '', { left: 0, top: '600px', width: '1920px', textAlign: 'center' }), 'Aangan', 'mega'); css(wm.root, { color: '#fff' });
    const sub = abs(root, 'eyebrow', 'आँगन &nbsp;·&nbsp; your courtyard', { left: 0, top: '780px', width: '1920px', textAlign: 'center', color: '#7fd6b0', fontFamily: 'Indic, Hanken' });
    const tag = abs(root, 'lede', 'Everything neighbours do for each other — in one private app.', { left: 0, top: '850px', width: '1920px', textAlign: 'center', color: 'rgba(255,255,255,.75)' });
    return { update(t, T) {
      const z = kf([[0, 1], [1.4, 60]], t, E.in3); tf(glow, `scale(${z})`); op(glow, 1);
      const w = sp(t, 1.1, 1.8); op(warm, w); blobs(T);
      tf(hold, `rotate(${t * 8}deg)`); L.update(t - 1.5);
      wm.up(t, 2.4, { st: 0.07 }); fadeIn(sub, t, 3.2); fadeIn(tag, t, 3.8);
    } };
  };

  SC.hero = (root, S) => {
    bgSolid(root, 'radial-gradient(ellipse at 50% 40%,#0f5a42,#063526 55%,#021a12)');
    const blobs = Blobs(root, ['#1D9E75', '#E8650A', '#3FB98B'], 0.3, 3);
    const ph = new Phone(root, 420, 'media/screens/home.jpg');
    const parts = ['search', 'notice', 'kitchen_card', 'workshop'].map((n) => ({ n, u: UI(root, n, ph.s, 16) }));
    const targets = { search: [520, 250, 1.55], notice: [430, 520, 1.6], kitchen_card: [1460, 600, 1.5], workshop: [1460, 270, 1.6] };
    const labels = { search: 'Search everything', notice: 'Notices', kitchen_card: 'Home food', workshop: 'Marketplace' };
    const lbl = parts.map(({ n }) => abs(root, 'eyebrow', labels[n], { color: '#7fd6b0', whiteSpace: 'nowrap' }));
    const top = new Words(abs(root, '', '', { left: 0, top: '70px', width: '1920px', textAlign: 'center' }), 'Everything your society does.', 'mid'); css(top.root, { color: '#fff' });
    const bot = new Words(abs(root, '', '', { left: 0, top: '930px', width: '1920px', textAlign: 'center' }), '*One place.*', 'mid', 'hl-mint'); css(bot.root, { color: '#fff' });
    return { update(t, T) {
      blobs(T);
      const enter = sp(t, 0, 2.4, E.out5);
      const ry = lerp(-560, 0, enter);
      const pushIn = sp(t, 10.4, 12.9, E.in3);
      const zs = 1 + pushIn * 7;
      // push toward the search bar: its point moves to screen centre as we scale
      const cx = 960 - ((LIB.search.x + LIB.search.w / 2 - SW / 2) * ph.s) * 0.78 * zs * pushIn;
      const cy = 540 - ((LIB.search.y + LIB.search.h / 2 - SH / 2) * ph.s) * 0.78 * zs * pushIn;
      ph.at(cx, cy + (1 - enter) * 120 + Math.sin(T) * 4 * (1 - pushIn), { ry, s: (0.56 + 0.22 * enter) * zs, rx: (1 - enter) * 10 });
      const ex = sp(t, 3.0, 4.6, E.io3) * (1 - sp(t, 8.2, 9.6, E.io3));
      parts.forEach(({ n, u }, i) => {
        const m = LIB[n]; const [x0, y0] = ph.pt(960, 540, m.x + m.w / 2, m.y + m.h / 2, 0.78);
        const [tx, ty, ts] = targets[n];
        const q = sp(ex, i * 0.08, 0.7 + i * 0.08, E.io3);
        u.at(lerp(x0, tx, q), lerp(y0, ty, q) + Math.sin(T * 1.2 + i) * 6 * q, { s: lerp(0.78, ts, q), z: q * 80, o: ex > 0.001 ? 1 : 0, rz: Math.sin(i * 1.7) * 2 * q });
        const lw = lbl[i]; const lx = tx < 960 ? tx - u.w * ts / 2 : tx - u.w * ts / 2; css(lw, { left: lx + 'px', top: ty - u.h * ts / 2 - 44 + 'px' }); op(lw, sp(ex, 0.75, 1));
      });
      top.up(t, 3.4, { out: 9.4 }); bot.up(t, 5.0, { out: 9.4 });
    } };
  };

  SC.find = (root, S) => {
    bgSolid(root, 'linear-gradient(135deg,#F39A3D,#E8650A 55%,#D24E05)');
    const blobs = Blobs(root, ['#FFC27A', '#D4537E', '#F7B267'], 0.35, 11);
    const h1 = new Words(abs(root, '', '', { left: '130px', top: '130px', width: '1700px', color: '#fff' }), 'Find your society.', 'big');
    const h2 = new Words(abs(root, '', '', { left: '130px', top: '130px', width: '1700px', color: '#fff' }), 'Join in *one tap*.', 'big', 'hl-ink');
    const h3 = new Words(abs(root, '', '', { left: '130px', top: '130px', width: '1700px', color: '#fff' }), 'Not on Aangan yet? *Start it.*', 'big', 'hl-ink');
    [h2, h3].forEach((w) => w.w.forEach((s) => s.classList.contains('hl-ink') && (s.style.color = '#2b0f00')));
    const field = abs(root, 'field', `${icon('search', 2.4)}<span class="tx"></span><span class="caret"></span>`, { width: '1180px' });
    const ftx = field.querySelector('.tx'), caret = field.querySelector('.caret');
    const res = abs(root, 'card', `<div style="display:flex;align-items:center;gap:28px;padding:30px 34px">
      <div style="width:96px;height:96px;border-radius:26px;background:#E3EEE7;color:#0E6B4E;display:grid;place-items:center">${icon('building', 2)}</div>
      <div style="flex:1"><div style="font:800 46px/1.1 Bricolage">DS Max Senate</div><div style="font:500 28px Hanken;color:#5d6a63;margin-top:8px">Begur, Bangalore, KA · <span style="color:#0E6B4E;font-weight:700">Already on Aangan</span></div></div>
      <div class="join pill btn-g" style="font-size:32px;padding:22px 40px">Join</div></div>`, { width: '1180px' });
    res.querySelector('svg').style.cssText = 'width:52px;height:52px';
    const join = res.querySelector('.join');
    const pin = abs(root, '', '', { left: '960px', top: '600px' });
    const dots = Array.from({ length: 6 }, (_, i) => abs(pin, '', '', { left: (i - 2.5) * 150 - 55 + 'px', top: '-55px', width: '110px', height: '110px', borderRadius: '30px', background: 'rgba(255,255,255,.18)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.55)', display: 'grid', placeItems: 'center', font: "800 54px/1 Bricolage", color: '#fff' }));
    const pinLbl = abs(root, 'lede', 'Your phone number + a 6-digit PIN you choose', { left: 0, width: '1920px', top: '720px', textAlign: 'center', color: 'rgba(255,255,255,.9)' });
    const chips = ['No SMS', 'No OTP', 'No passwords'].map((s, i) => abs(root, 'pill', `${icon('check', 3)}${s}`, { background: '#fff', color: '#B8470A', top: '800px', left: 960 + (i - 1) * 300 - 130 + 'px', width: '260px', justifyContent: 'center' }));
    chips.forEach((c) => (c.querySelector('svg').style.cssText = 'width:26px;height:26px'));
    const map = UI(root, 'map', 2.7, 16);
    const pinM = abs(root, '', `<svg viewBox="0 0 24 24" width="120" height="120" fill="#E8650A" stroke="#fff" stroke-width="1.2"><path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>`, { width: '120px', height: '120px' });
    const badge = abs(root, 'pill', `${icon('crown', 2.4)}New society — you’ll be its admin`, { background: '#fff', color: '#0E6B4E', fontSize: '30px', padding: '20px 30px' });
    badge.querySelector('svg').style.cssText = 'width:32px;height:32px';
    const cont = UI(root, 'continue', 2.4, 12);
    const tp = tap(root);
    const av = ['KJ', 'PP', 'MN', 'B', 'VP', 'AS', 'DR', 'SN'].map((s, i) => abs(root, '', s, { width: '92px', height: '92px', borderRadius: '50%', background: PET[i], color: '#fff', display: 'grid', placeItems: 'center', font: "700 32px Hanken", boxShadow: '0 0 0 5px #fff' }));
    const inv = abs(root, 'lede', 'Invite neighbours over WhatsApp — they join your courtyard.', { left: '130px', top: '740px', width: '760px', color: '#fff', fontWeight: 600 });
    return { update(t, T) {
      blobs(T);
      h1.up(t, 0.3, { out: 5.3 }); h2.up(t, 5.8, { out: 11.2 }); h3.up(t, 11.7);
      // search
      const fIn = sp(t, 0.6, 1.3, E.out5), fOut = sp(t, 5.3, 6.0, E.in3);
      const s = typed('DS Max Senate', t, 1.4, 11); txt(ftx, s || 'Search any society in India'); ftx.style.color = s ? '#0F1A15' : '#9aa49f';
      op(caret, Math.floor(T * 2.2) % 2 ? 1 : 0.15);
      put(field, 1180, 120, 960, 400 - fOut * 200, { s: 0.85 + 0.15 * fIn, o: fIn * (1 - fOut) });
      const rIn = sp(t, 2.9, 3.5, E.back);
      put(res, 1180, 156, 960, 590 - fOut * 200, { s: 0.9 + 0.1 * rIn, o: Math.min(1, rIn) * (1 - fOut) });
      join.style.background = t > 4.6 ? '#0A5340' : '#0E6B4E';
      tp(t, 4.6, 960 + 590 - 105, 590);
      // pin
      const pIn = sp(t, 5.9, 6.6), pOut = sp(t, 11.0, 11.6, E.in3);
      dots.forEach((d, i) => { const a = 6.4 + i * 0.32; const f = t > a; const q = sp(t, a, a + 0.25, E.back);
        css(d, { background: f ? '#fff' : 'rgba(255,255,255,.18)', color: '#E8650A' }); txt(d, f ? (t < a + 0.35 ? '735202'[i] : '●') : '');
        tf(d, `translate3d(0,${(1 - pIn) * 60 - pOut * 100}px,0) scale(${f ? 0.9 + 0.1 * q : 1})`); op(d, pIn * (1 - pOut)); });
      fadeIn(pinLbl, t, 6.2, 0.6, 24, 11.0);
      chips.forEach((c, i) => { const q = sp(t, 8.6 + i * 0.2, 9.1 + i * 0.2, E.back); tf(c, `scale(${0.6 + 0.4 * q}) translateY(${-pOut * 80}px)`); op(c, Math.min(1, q) * (1 - pOut)); });
      // founder path
      const mIn = sp(t, 11.8, 12.8, E.out5);
      map.at(1230 + (1 - mIn) * 700, 560, { s: 1, ry: -8 * mIn, o: mIn });
      const pd = sp(t, 12.9, 13.5, E.out3); put(pinM, 120, 120, 1230, 450 - (1 - pd) * 300, { o: pd, s: 1 + 0.2 * Math.max(0, Math.sin((t - 13.5) * 6) * Math.exp(-(t - 13.5) * 3)) });
      const bq = sp(t, 13.8, 14.4, E.back); put(badge, 700, 76, 560, 470, { s: 0.6 + 0.4 * bq, o: Math.min(1, bq) });
      const cq = sp(t, 14.6, 15.2, E.out5); cont.at(1230, 905, { o: cq, s: 0.9 + 0.1 * cq });
      tp(t, 16.0, 1230, 905);
      // neighbours joining
      const jq = sp(t, 16.6, 19.4, E.io3);
      av.forEach((a, i) => { const q = sp(t, 16.6 + i * 0.12, 17.3 + i * 0.12, E.back); const sx = -200 + (i % 2) * 300, sy = 1200;
        put(a, 92, 92, lerp(sx, 180 + i * 84, Math.min(1, q)), lerp(sy, 660, Math.min(1, q)), { o: Math.min(1, q * 2), s: 0.7 + 0.3 * Math.min(1, q) }); });
      fadeIn(inv, t, 17.6);
    } };
  };

  SC.home = (root, S) => {
    bgSolid(root, 'linear-gradient(160deg,#EAF6EF,#D5EDE0 55%,#F4F9F5)');
    const blobs = Blobs(root, ['#7fd6b0', '#bfe3d1', '#ffe1bd'], 0.6, 13);
    const ph = new Phone(root, 470, { tall: 'media/screens/home_tall.jpg', h: 3333 });
    const head = new Words(abs(root, '', '', { left: '130px', top: '230px', width: '820px' }), 'Your society’s *home screen*.', 'big');
    const calls = [['Notices & a weekly AI digest', 'mega', 1.6], ['Dinner from neighbours’ kitchens', 'pot', 3.4], ['The marketplace, around the aangan', 'list', 5.2], ['Every service, one tap away', 'spark', 7.0]]
      .map(([s, ic, a], i) => { const e = abs(root, '', `<span style="width:66px;height:66px;border-radius:20px;background:${PET[i * 2]};color:#fff;display:grid;place-items:center;flex:none">${icon(ic)}</span><span>${s}</span>`,
        { left: '130px', top: 520 + i * 92 + 'px', display: 'flex', alignItems: 'center', gap: '22px', font: "700 34px/1.2 Hanken" }); e.querySelector('svg').style.cssText = 'width:32px;height:32px'; return { e, a }; });
    const tiles = ['tile_home_0', 'tile_home_1', 'tile_home_2', 'tile_home_3', 'tile_home_4', 'tile_home_5', 'tile_home_6', 'tile_home_7', 'tile_home_8', 'tile_home_9', 'tile_home_10', 'tile_home_11',
      'tile_home_13', 'tile_home_14', 'tile_home_15', 'tile_home_16', 'tile_home_17', 'tile_home_18', 'tile_home_19', 'tile_home_20', 'tile_home_21', 'tile_home_22', 'tile_home_23', 'tile_home_24'].map((n) => UI(root, n, 1.42, 14));
    const wallT = new Words(abs(root, '', '', { left: 0, top: '58px', width: '1920px', textAlign: 'center' }), 'One app. *Everything your society does.*', 'mid');
    return { update(t, T) {
      blobs(T);
      head.up(t, 0.4, { out: 9.0 }); calls.forEach(({ e, a }) => fadeIn(e, t, a, 0.6, 24, 9.0));
      const sc = kf([[0.6, 0], [1.6, 0], [2.6, 330], [3.4, 330], [4.4, 690], [5.2, 690], [6.4, 1250], [7.2, 1250], [8.4, 1900]], t);
      ph.scroll(sc);
      const out = sp(t, 8.8, 9.8, E.in3);
      const pin = sp(t, 0, 1.0, E.out5);
      ph.at(1380 + (1 - pin) * 500, 560 + Math.sin(T) * 5, { ry: -14, rx: 4, s: 1 - out * 0.4, o: 1 - out, z: -out * 400 });
      // wall
      const cols = 6, gx = 278, gy = 202;
      tiles.forEach((u, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const x = 960 + (c - 2.5) * gx, y = 600 + (r - 1.5) * gy;
        const a = 9.4 + (c + r) * 0.09; const q = sp(t, a, a + 0.9, E.out5);
        const zoom = sp(t, 15.6, 17, E.in3);
        const hf = 'tile_home_16'; // Home Food
        const dx = (x - 960) * zoom * 3, dy = (y - 600) * zoom * 3;
        u.at(lerp(1380, x, q) + dx, lerp(560, y, q) + dy, { ry: (1 - q) * 90, s: (0.3 + 0.7 * q) * (1 + zoom * (u === tiles[15] ? 5 : 2)), o: q * (u === tiles[15] ? 1 : 1 - zoom) });
      });
      wallT.up(t, 10.4, { out: 15.4 });
    } };
  };

  SC.food = (root, S) => {
    bgSolid(root, 'linear-gradient(160deg,#FFF5EA,#FDE6CF 55%,#FFF2E2)');
    const blobs = Blobs(root, ['#ffc48a', '#f9a77a', '#ffdcb4'], 0.6, 17);
    const h1 = new Words(abs(root, '', '', { left: '130px', top: '300px', width: '860px' }), 'Dinner from the *flat upstairs*.', 'big', 'hl-orange');
    const s1 = abs(root, 'lede', 'Neighbours post what they’re cooking. Reserve a plate in one tap.', { left: '130px', top: '560px', width: '760px', color: '#6b5a4c' });
    const dish = UI(root, 'dish_card', 1.45, 16);
    const toast = abs(root, 'card', `<div style="display:flex;align-items:center;gap:20px;padding:24px 30px;font:700 30px Hanken"><span style="width:56px;height:56px;border-radius:50%;background:#0E6B4E;color:#fff;display:grid;place-items:center">${icon('check', 3)}</span>Order placed · 1 plate · ₹50</div>`, { width: '600px' });
    toast.querySelector('svg').style.cssText = 'width:30px;height:30px';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => abs(root, 'pill', d, { left: 130 + i * 112 + 'px', top: '720px', width: '100px', justifyContent: 'center', padding: '18px 0', background: '#fff', color: '#B8470A', fontSize: '24px' }));
    const tif = abs(root, 'lede', 'Or subscribe to a neighbour’s weekly tiffin.', { left: '130px', top: '640px', color: '#6b5a4c', fontWeight: 600 });
    const tp = tap(root);
    // timeline
    const h2 = new Words(abs(root, '', '', { left: 0, top: '170px', width: '1920px', textAlign: 'center' }), 'Track it, *start to plate*.', 'big', 'hl-orange');
    const steps = [['Placed', 'list', '7:02 pm'], ['Accepted', 'check', '7:05 pm'], ['Cooking', 'pot', '7:20 pm'], ['Delivered', 'home', '7:45 pm']];
    const line = abs(root, '', '<div class="f" style="position:absolute;left:0;top:0;bottom:0;width:0;border-radius:6px;background:linear-gradient(90deg,#E8650A,#F08A2C)"></div>', { left: '420px', top: '557px', width: '1080px', height: '12px', borderRadius: '6px', background: 'rgba(232,101,10,.15)' });
    const lf = line.querySelector('.f');
    const nodes = steps.map(([n, ic, tm], i) => { const e = abs(root, '', `<div class="c" style="width:200px;height:200px;border-radius:60px;display:grid;place-items:center;box-shadow:0 30px 60px -24px rgba(184,71,10,.5)">${icon(ic, 2)}</div><div style="font:800 40px Bricolage;margin-top:28px;color:#2b1a0e">${n}</div><div style="font:600 26px Hanken;color:#9a7b62;margin-top:6px">${tm}</div>`, { width: '240px', textAlign: 'center', left: 420 + i * 360 - 120 + 'px', top: '463px', display: 'flex', flexDirection: 'column', alignItems: 'center' });
      e.querySelector('svg').style.cssText = 'width:84px;height:84px'; return { e, c: e.querySelector('.c') }; });
    const scoot = abs(root, '', icon('scooter', 2), { width: '90px', height: '90px', color: '#0E6B4E' });
    // kitchen
    const h3 = new Words(abs(root, '', '', { left: '1000px', top: '170px', width: '820px' }), 'Home chefs get a *real kitchen*.', 'big', 'hl-orange');
    const kst = UI(root, 'kitchen_stats', 1.62, 16);
    const stats = [['2', 'orders today'], ['8', 'plates left'], ['₹500', 'earned']].map(([v, l], i) => abs(root, '', `<div class="v" style="font:800 110px/1 Bricolage;color:#0E6B4E;letter-spacing:-.03em">${v}</div><div style="font:600 30px Hanken;color:#6b5a4c;margin-top:4px">${l}</div>`, { left: 1000 + i * 290 + 'px', top: '520px' }));
    const rv = [UI(root, 'review1', 1.5, 16), UI(root, 'review2', 1.5, 16)];
    return { update(t, T) {
      blobs(T);
      // A: dish (0–9)
      const aOut = sp(t, 8.6, 9.4, E.in3);
      h1.up(t, 0.3, { out: 8.4 }); fadeIn(s1, t, 1.0, 0.6, 24, 8.4);
      const dq = sp(t, 0.2, 1.4, E.out5);
      dish.at(1360 + (1 - dq) * 600 + aOut * -200, 540 + Math.sin(T) * 6, { ry: -10 + (1 - dq) * -30, rz: 2, s: 1 - aOut * 0.3, o: dq * (1 - aOut) });
      tp(t, 3.0, 1360 + 140, 540 + 245);
      const tq = sp(t, 3.3, 3.9, E.back); put(toast, 600, 104, 1360, 920, { s: 0.7 + 0.3 * tq, o: Math.min(1, tq) * (1 - sp(t, 6.0, 6.5)) });
      fadeIn(tif, t, 5.0, 0.6, 20, 8.4);
      days.forEach((d, i) => { const q = sp(t, 5.4 + i * 0.12, 5.8 + i * 0.12, E.back); const on = i < 5 && t > 6.6 + i * 0.15; css(d, { background: on ? '#E8650A' : '#fff', color: on ? '#fff' : '#B8470A' }); tf(d, `scale(${0.6 + 0.4 * q}) translateY(${-aOut * 60}px)`); op(d, Math.min(1, q) * (1 - aOut)); });
      // B: timeline (9–17.5)
      const bIn = sp(t, 9.2, 9.9), bOut = sp(t, 17.0, 17.6, E.in3);
      h2.up(t, 9.3, { out: 17.0 });
      op(line, bIn * (1 - bOut)); lf.style.width = sp(t, 10.2, 15.4, E.io3) * 100 + '%';
      nodes.forEach(({ e, c }, i) => { const a = 10.0 + i * 1.6; const q = sp(t, a - 0.6, a, E.back); const on = t > a;
        css(c, { background: on ? '#E8650A' : '#fff', color: on ? '#fff' : '#E8650A' }); tf(e, `translateY(${(1 - Math.min(1, q)) * 60 - bOut * 80}px) scale(${on && t < a + 0.3 ? 1.06 : 1})`); op(e, Math.min(1, q) * (1 - bOut)); });
      const sx = 420 + sp(t, 10.2, 15.4, E.io3) * 1080; put(scoot, 90, 90, sx, 420, { o: bIn * (1 - bOut) * (t > 10 ? 1 : 0), rz: Math.sin(T * 12) * 2 });
      // C: kitchen (17.5–27)
      const cIn = sp(t, 17.6, 18.6, E.out5);
      h3.up(t, 17.8);
      kst.at(560 - (1 - cIn) * 500, 560 + Math.sin(T) * 5, { ry: 10, o: cIn });
      stats.forEach((e, i) => { const q = sp(t, 19.0 + i * 0.4, 19.6 + i * 0.4, E.back); tf(e, `scale(${0.6 + 0.4 * q})`); op(e, Math.min(1, q));
        const v = e.querySelector('.v'); const c = sp(t, 19.0 + i * 0.4, 20.6 + i * 0.4); txt(v, i === 2 ? inr(500 * c) : String(Math.round([2, 8][i] * c))); });
      rv.forEach((u, i) => { const q = sp(t, 21.6 + i * 0.6, 22.4 + i * 0.6, E.out5); u.at(1340 + (1 - q) * 500, 790 + i * 150, { o: q, rz: i ? 1.5 : -1.5 }); });
    } };
  };

  // shared Saathi stage
  function saathiStage(root) {
    bgSolid(root, 'radial-gradient(ellipse at 30% 20%,#0f2030,#05080d 70%)');
    const blobs = Blobs(root, ['#1D9E75', '#534AB7', '#185FA5'], 0.45, 21);
    const st = rng(4); const stars = Array.from({ length: 70 }, () => abs(root, '', '', { left: st() * W + 'px', top: st() * H + 'px', width: '2px', height: '2px', borderRadius: '50%', background: '#fff', opacity: 0.15 + st() * 0.4 }));
    const head = abs(root, '', `<div style="width:84px;height:84px;border-radius:50%;background:conic-gradient(from 0deg,#3FB98B,#534AB7,#185FA5,#3FB98B);box-shadow:0 0 50px rgba(127,214,176,.6)"></div><div><div style="font:800 40px Bricolage;color:#fff">Saathi</div><div style="font:500 22px Hanken;color:rgba(255,255,255,.6)">knows your society</div></div>`,
      { left: '780px', top: '90px', display: 'flex', alignItems: 'center', gap: '22px' });
    const input = abs(root, '', `<span class="tx" style="flex:1"></span><span class="sb" style="width:76px;height:76px;border-radius:50%;background:#0E6B4E;display:grid;place-items:center;color:#fff">${icon('up', 2.6)}</span>`,
      { left: '780px', top: '920px', width: '1020px', height: '104px', borderRadius: '52px', background: 'rgba(255,255,255,.1)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', padding: '0 14px 0 36px', font: "500 34px Hanken", color: '#fff' });
    input.querySelector('svg').style.cssText = 'width:36px;height:36px';
    const itx = input.querySelector('.tx'), sb = input.querySelector('.sb');
    return { blobs, head, input, itx, sb, upd(T) { blobs(T); } };
  }
  const thinking = (root) => abs(root, 'chip', '<span class="spin" style="width:24px;height:24px;border-radius:50%;border:3px solid rgba(14,107,78,.25);border-top-color:#0E6B4E"></span><span class="tt"></span>', { fontSize: '26px', padding: '16px 24px' });

  SC.ask = (root, S) => {
    const st = saathiStage(root);
    const left = new Words(abs(root, '', '', { left: '120px', top: '300px', width: '600px', color: '#fff' }), 'Meet *Saathi*.', 'big', 'hl-violet');
    const lede = abs(root, 'lede', 'An AI that knows your society — and answers from it.', { left: '120px', top: '430px', width: '560px', color: 'rgba(255,255,255,.75)' });
    const bul = ['Food, flats, services, people', 'Every notice and every reply', 'Plain words, any language'].map((s, i) => abs(root, '', `<span style="width:12px;height:12px;border-radius:50%;background:${PET[[2, 3, 6][i]]};flex:none"></span>${s}`, { left: '120px', top: 620 + i * 64 + 'px', display: 'flex', alignItems: 'center', gap: '18px', font: "600 30px Hanken", color: '#fff' }));
    const ub = abs(root, 'bubble-u', 'Is there a plumber?');
    const th = thinking(root); const thT = th.querySelector('.tt'), spin = th.querySelector('.spin');
    const ans = abs(root, 'bubble-a', '', { width: '960px', whiteSpace: 'normal' });
    const words = 'Yes — there’s a DS Max Plumber Manager in your society’s directory. I also found a gas-pipeline fitter and an interior service, if it’s related.'.split(' ');
    ans.innerHTML = words.map((w) => `<span class="w" style="opacity:0">${w.replace('DS', '<b>DS').replace('Manager', 'Manager</b>')} </span>`).join('');
    const ws = [...ans.querySelectorAll('.w')];
    const srcs = [['DS Max Plumber Manager', 'Service directory · Electrician / Plumber'], ['Gas pipeline & copper fitting', 'Service directory'], ['Interior & modification', 'Service directory']]
      .map(([a, b]) => { const e = abs(root, 'src', `<span class="ico">${icon('wrench')}</span><span>${a}<small>${b}</small></span>`, { width: '330px', height: '128px', alignItems: 'flex-start' }); return e; });
    const fol = ['Is the plumber available now?', 'Any electrician recommendations?'].map((s) => abs(root, 'chip', s, { fontSize: '24px', background: 'rgba(127,214,176,.16)', color: '#9fe5c4' }));
    const tp = tap(root);
    return { update(t, T) {
      st.upd(T); fadeIn(st.head, t, 0.2);
      left.up(t, 0.4); fadeIn(lede, t, 1.2); bul.forEach((b, i) => fadeIn(b, t, 11.8 + i * 0.5));
      const q = 'Is there a plumber?'; const typedQ = typed(q, t, 1.0, 16);
      txt(st.itx, t < 2.6 ? (typedQ || 'Ask Saathi anything…') : 'Ask Saathi anything…'); st.itx.style.color = typedQ && t < 2.6 ? '#fff' : 'rgba(255,255,255,.45)';
      fadeIn(st.input, t, 0.4);
      tp(t, 2.4, 780 + 1020 - 52, 972);
      const ubq = sp(t, 2.6, 3.1, E.out5); put(ub, 470, 102, 1800 - 235, lerp(970, 260, ubq), { o: ubq, s: 0.8 + 0.2 * ubq });
      const thIn = sp(t, 3.2, 3.5), thOut = sp(t, 5.6, 5.9);
      txt(thT, t < 4.4 ? 'Searching the service directory…' : 'Checked 1 thing'); tf(spin, `rotate(${T * 400}deg)`); op(spin, t < 4.4 ? 1 : 0);
      put(th, 520, 60, 780 + 260, 360, { o: thIn * (1 - thOut) });
      const aIn = sp(t, 5.6, 6.0); put(ans, 960, 250, 780 + 480, 470, { o: aIn });
      ws.forEach((w, i) => op(w, sp(t, 5.9 + i * 0.12, 6.1 + i * 0.12)));
      srcs.forEach((e, i) => { const qq = sp(t, 9.2 + i * 0.2, 9.8 + i * 0.2, E.out5); put(e, 330, 128, 780 + 165 + i * 345, 700, { o: qq, s: 0.85 + 0.15 * qq }); });
      fol.forEach((e, i) => { const qq = sp(t, 10.4 + i * 0.25, 10.9 + i * 0.25, E.back); css(e, { left: 780 + i * 470 + 'px', top: '800px' }); tf(e, `scale(${0.6 + 0.4 * qq})`); op(e, Math.min(1, qq)); });
    } };
  };

  SC.doit = (root, S) => {
    const st = saathiStage(root);
    const left = new Words(abs(root, '', '', { left: '120px', top: '280px', width: '600px', color: '#fff' }), 'Tell it what to do. *You confirm.*', 'big', 'hl-violet');
    const note = abs(root, 'lede', 'Nothing happens until you tap.', { left: '120px', top: '560px', width: '560px', color: '#9fe5c4', fontWeight: 700 });
    const more = ['Start a poll', 'Reserve plates', 'Message a neighbour', 'Set a reminder'].map((s) => abs(root, 'chip', s, { fontSize: '24px', background: 'rgba(255,255,255,.1)', color: '#fff' }));
    const cmd = 'Post a notice: water tanker arrives 7 AM tomorrow';
    const ub = abs(root, 'bubble-u', cmd, { fontSize: '32px' });
    const th = thinking(root); const spin = th.querySelector('.spin'); txt(th.querySelector('.tt'), 'Drafting the notice…');
    const card = abs(root, 'card', `<div style="padding:22px 34px;border-radius:30px 30px 0 0;background:#E3EEE7;color:#0E6B4E;font:800 30px Bricolage;display:flex;gap:14px;align-items:center">${icon('mega', 2.2)}Post to the feed</div>
      <div style="padding:26px 34px 30px">
      <div class="r"><div class="lbl">Category</div><div style="font:600 32px Hanken;margin:8px 0 22px">Announcement</div></div>
      <div class="r"><div class="lbl">Title</div><div style="font:800 38px/1.2 Bricolage;margin:8px 0 22px">Water tanker arriving tomorrow at 7 AM</div></div>
      <div class="r"><div class="lbl">Body</div><div style="font:500 30px/1.45 Hanken;margin:8px 0 26px;color:#33403a">The tanker arrives tomorrow at 7:00 AM. Please store enough water tonight.</div></div>
      <div class="r" style="display:flex;gap:18px"><div class="post pill btn-g" style="flex:1;justify-content:center;font-size:30px;padding:24px">Post it</div><div class="pill btn-soft" style="flex:1;justify-content:center;font-size:30px;padding:24px">Not now</div></div></div>`, { width: '1000px' });
    card.querySelector('svg').style.cssText = 'width:34px;height:34px';
    const rows = [...card.querySelectorAll('.r')], post = card.querySelector('.post');
    const toast = abs(root, 'pill', `${icon('check', 3)}Posted to the feed`, { background: '#fff', color: '#0E6B4E', fontSize: '32px', padding: '22px 34px' });
    toast.querySelector('svg').style.cssText = 'width:32px;height:32px';
    const tp = tap(root);
    return { update(t, T) {
      st.upd(T); op(st.head, 1); op(st.input, 1);
      left.up(t, 0.3); fadeIn(note, t, 9.4);
      more.forEach((e, i) => { const q = sp(t, 12.6 + i * 0.18, 13.1 + i * 0.18, E.back); css(e, { left: 120 + (i % 2) * 290 + 'px', top: 680 + Math.floor(i / 2) * 76 + 'px' }); tf(e, `scale(${0.6 + 0.4 * q})`); op(e, Math.min(1, q)); });
      const ty = typed(cmd, t, 0.4, 22); txt(st.itx, t < 3.0 ? (ty || 'Ask Saathi anything…') : 'Ask Saathi anything…'); st.itx.style.color = ty && t < 3 ? '#fff' : 'rgba(255,255,255,.45)';
      tp(t, 2.8, 1748, 972);
      const uq = sp(t, 3.0, 3.5, E.out5); put(ub, 880, 92, 1800 - 440, lerp(970, 230, uq), { o: uq });
      tf(spin, `rotate(${T * 400}deg)`); put(th, 380, 60, 780 + 190, 320, { o: sp(t, 3.6, 3.9) * (1 - sp(t, 4.9, 5.2)) });
      const cOut = sp(t, 11.2, 11.9, E.in3);
      const cq = sp(t, 5.0, 5.6, E.out5);
      put(card, 1000, 600, 1290 + cOut * 500, 600 - cOut * 500, { o: cq * (1 - cOut), s: (0.92 + 0.08 * cq) * (1 - cOut * 0.7), rz: cOut * 8 });
      rows.forEach((r, i) => fadeIn(r, t, 5.4 + i * 0.6, 0.5, 16));
      const glow = t > 8.6 && t < 11.2 ? 0.5 + 0.5 * Math.sin((t - 8.6) * 6) : 0;
      post.style.boxShadow = `0 0 0 ${6 * glow}px rgba(127,214,176,.55), 0 0 ${40 * glow}px rgba(127,214,176,.8)`;
      tp(t, 10.9, 1290 - 250, 600 + 230);
      const tq = sp(t, 11.9, 12.4, E.back); put(toast, 440, 84, 1290, 600, { s: 0.6 + 0.4 * tq, o: Math.min(1, tq) * (1 - sp(t, 14.8, 15.3)) });
    } };
  };

  SC.watch = (root, S) => {
    const st = saathiStage(root);
    const sky = bgSolid(root, 'linear-gradient(180deg,#9fd3ff,#e8f4ff)'); sky.style.zIndex = 0;
    const left = new Words(abs(root, '', '', { left: '120px', top: '280px', width: '620px', color: '#fff' }), 'It keeps watch, *so you don’t have to.*', 'big', 'hl-violet');
    const ub = abs(root, 'bubble-u', 'Tell me when a 2 BHK is listed');
    const card = abs(root, 'card', `<div style="padding:22px 34px;border-radius:30px 30px 0 0;background:#E3EEE7;color:#0E6B4E;font:800 30px Bricolage;display:flex;gap:14px;align-items:center">${icon('bell', 2.2)}Keep watching for this</div>
      <div style="padding:26px 34px 30px;display:grid;grid-template-columns:1fr 1fr;gap:18px 30px">
      <div><div class="lbl">Watching for</div><div style="font:700 32px Hanken;margin-top:8px">2 BHK listings</div></div>
      <div><div class="lbl">Only in</div><div style="font:700 32px Hanken;margin-top:8px">Flats</div></div>
      <div style="grid-column:1/3"><div class="lbl">Notifies</div><div style="font:500 28px Hanken;margin-top:8px;color:#33403a">You, once per match. Switch it off any time.</div></div>
      <div class="go pill btn-g" style="justify-content:center;font-size:30px;padding:22px">Watch for it</div><div class="pill btn-soft" style="justify-content:center;font-size:30px;padding:22px">Not now</div></div>`, { width: '1000px' });
    card.querySelector('svg').style.cssText = 'width:34px;height:34px'; const go = card.querySelector('.go');
    const clock = abs(root, '', `<svg viewBox="-100 -100 200 200" width="300" height="300"><circle r="92" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.5)" stroke-width="4"/><line class="hh" x1="0" y1="0" x2="0" y2="-48" stroke="#fff" stroke-width="8" stroke-linecap="round"/><line class="mh" x1="0" y1="0" x2="0" y2="-74" stroke="#7fd6b0" stroke-width="5" stroke-linecap="round"/><circle r="7" fill="#fff"/></svg><div class="day" style="font:800 56px Bricolage;color:#fff;text-align:center;margin-top:18px"></div>`, { width: '300px' });
    const hh = clock.querySelector('.hh'), mh = clock.querySelector('.mh'), day = clock.querySelector('.day');
    const notif = abs(root, 'notif', `<div class="app"><div class="lg" style="position:relative;width:0;height:0"></div></div><div style="flex:1"><div style="display:flex;justify-content:space-between;font:700 22px Hanken;color:#5d6a63"><span>AANGAN · SAATHI</span><span>now</span></div><div style="font:800 32px/1.25 Bricolage;margin-top:8px">A 2 BHK was just listed in DS Max Senate</div><div style="font:500 26px Hanken;color:#33403a;margin-top:6px">For rent · 1000 sq.ft · Furnished</div></div>`);
    const lg = Logo(notif.querySelector('.lg'), 54); css(lg.svg, { left: '-27px', top: '-27px' }); lg.update(5);
    const flat = UI(root, 'flat_rent', 2.3, 16);
    const tp = tap(root);
    return { update(t, T) {
      st.upd(T); op(st.head, 1); op(st.input, 0);
      const lapse = sp(t, 6.0, 9.0); op(sky, lapse > 0 && lapse < 1 ? 0.35 * (0.5 + 0.5 * Math.sin(lapse * Math.PI * 8 - Math.PI / 2)) : 0);
      left.up(t, 0.3);
      const uq = sp(t, 0.6, 1.1, E.out5); put(ub, 640, 102, 1800 - 320, 240, { o: uq, s: 0.8 + 0.2 * uq });
      const cq = sp(t, 1.6, 2.3, E.out5), cOut = sp(t, 5.8, 6.4, E.in3);
      put(card, 1000, 470, 1290, 560, { o: cq * (1 - cOut), s: (0.92 + 0.08 * cq) * (1 - 0.3 * cOut) });
      tp(t, 4.4, 1290 - 250, 560 + 175); txt(go, t > 4.6 ? '✓ Watching' : 'Watch for it');
      const kq = sp(t, 6.2, 6.7) * (1 - sp(t, 9.0, 9.4));
      put(clock, 300, 400, 1290, 560, { o: kq });
      const ang = sp(t, 6.4, 9.0, E.io3) * 360 * 4 * 12; hh.setAttribute('transform', `rotate(${ang / 12})`); mh.setAttribute('transform', `rotate(${ang})`);
      txt(day, 'Day ' + (1 + Math.floor(sp(t, 6.4, 9.0) * 3.99)));
      const nq = sp(t, 9.2, 9.8, E.out5); put(notif, 860, 170, 1290, lerp(-120, 230, nq), { o: nq });
      const fq = sp(t, 10.2, 11.0, E.out5); flat.at(1290, 560 + (1 - fq) * 120, { o: fq, s: 0.9 + 0.1 * fq });
    } };
  };

  SC.translate = (root, S) => {
    bgSolid(root, 'linear-gradient(150deg,#F6F3FF,#EAF6EF 60%,#FFF4E6)');
    const blobs = Blobs(root, ['#b9b2ff', '#7fd6b0', '#ffc48a'], 0.55, 23);
    const head = new Words(abs(root, '', '', { left: 0, top: '110px', width: '1920px', textAlign: 'center' }), 'Every post, *in your language*.', 'big');
    const L = [['English', 'Water tanker arriving tomorrow at 7 AM', 'Please store enough water tonight.'],
      ['हिन्दी · Hindi', 'पानी का टैंकर कल सुबह 7 बजे आएगा', 'कृपया आज रात पर्याप्त पानी भरकर रखें।'],
      ['ಕನ್ನಡ · Kannada', 'ನೀರಿನ ಟ್ಯಾಂಕರ್ ನಾಳೆ ಬೆಳಿಗ್ಗೆ 7 ಗಂಟೆಗೆ ಬರಲಿದೆ', 'ದಯವಿಟ್ಟು ಇಂದು ರಾತ್ರಿ ಸಾಕಷ್ಟು ನೀರು ಸಂಗ್ರಹಿಸಿ.'],
      ['தமிழ் · Tamil', 'தண்ணீர் லாரி நாளை காலை 7 மணிக்கு வரும்', 'இன்று இரவே போதுமான தண்ணீரைச் சேமித்து வையுங்கள்.'],
      ['తెలుగు · Telugu', 'నీటి ట్యాంకర్ రేపు ఉదయం 7 గంటలకు వస్తుంది', 'దయచేసి ఈ రాత్రే సరిపడా నీటిని నిల్వ చేసుకోండి.'],
      ['বাংলা · Bengali', 'জলের ট্যাঙ্কার আগামীকাল সকাল ৭টায় আসবে', 'অনুগ্রহ করে আজ রাতেই যথেষ্ট জল ধরে রাখুন।'],
      ['मराठी · Marathi', 'पाण्याचा टँकर उद्या सकाळी 7 वाजता येईल', 'कृपया आज रात्रीच पुरेसे पाणी भरून ठेवा.'],
      ['മലയാളം · Malayalam', 'വെള്ളത്തിന്റെ ടാങ്കർ നാളെ രാവിലെ 7 മണിക്ക് എത്തും', 'ദയവായി ഇന്ന് രാത്രി ആവശ്യത്തിന് വെള്ളം ശേഖരിച്ചു വയ്ക്കുക.'],
      ['ગુજરાતી · Gujarati', 'પાણીનું ટેન્કર આવતીકાલે સવારે 7 વાગ્યે આવશે', 'કૃપા કરીને આજે રાત્રે પૂરતું પાણી ભરી રાખો.'],
      ['ਪੰਜਾਬੀ · Punjabi', 'ਪਾਣੀ ਦਾ ਟੈਂਕਰ ਕੱਲ੍ਹ ਸਵੇਰੇ 7 ਵਜੇ ਆਵੇਗਾ', 'ਕਿਰਪਾ ਕਰਕੇ ਅੱਜ ਰਾਤ ਹੀ ਕਾਫ਼ੀ ਪਾਣੀ ਭਰ ਕੇ ਰੱਖੋ।'],
      ['ଓଡ଼ିଆ · Odia', 'ପାଣି ଟ୍ୟାଙ୍କର କାଲି ସକାଳ 7ଟାରେ ଆସିବ', 'ଦୟାକରି ଆଜି ରାତିରେ ଯଥେଷ୍ଟ ପାଣି ସଞ୍ଚୟ କରି ରଖନ୍ତୁ।'],
      ['اردو · Urdu', 'پانی کا ٹینکر کل صبح 7 بجے آئے گا', 'براہ کرم آج رات ہی کافی پانی بھر کر رکھیں۔']];
    const card = abs(root, 'card', `<div style="padding:34px 40px">
      <div style="display:flex;align-items:center;gap:16px"><span style="width:62px;height:62px;border-radius:50%;background:#3B6D11;color:#fff;display:grid;place-items:center;font:700 24px Hanken">PP</span>
      <div style="flex:1"><div style="font:700 28px Hanken">Pratibha Priti</div><div style="font:500 22px Hanken;color:#5d6a63">Flat 149 · Announcement</div></div>
      <span class="lang chip" style="font-size:24px"></span></div>
      <div class="tt" style="font:800 52px/1.3 Bricolage, Indic;margin:30px 0 14px;min-height:136px"></div>
      <div class="bd" style="font:500 34px/1.5 Hanken, Indic;color:#33403a;min-height:104px"></div>
      <div style="font:600 22px Hanken;color:#8a948e;margin-top:18px">Translated by Aangan · tap to see original</div></div>`, { width: '1240px' });
    const lang = card.querySelector('.lang'), tt = card.querySelector('.tt'), bd = card.querySelector('.bd');
    [tt, bd].forEach((e) => (e.style.fontFamily = "Indic, 'Bricolage', 'Hanken'"));
    const chips = L.map(([n], i) => abs(root, 'chip', n.split(' · ')[0], { fontSize: '30px', padding: '14px 24px', background: '#fff', color: PET[i % 8], boxShadow: '0 14px 30px -16px rgba(0,0,0,.35)', fontFamily: "Indic, Hanken" }));
    return { update(t, T) {
      blobs(T); head.up(t, 0.3);
      const cq = sp(t, 0.6, 1.4, E.out5); put(card, 1240, 470, 960, 600, { o: cq, s: 0.92 + 0.08 * cq });
      const step = 0.78; const k = clamp(Math.floor((t - 1.6) / step), 0, L.length - 1);
      const ph = ((t - 1.6) / step) % 1; const swap = t > 1.6 && k < L.length - 1 ? Math.max(sp(ph, 0, 0.18), 0) : 1;
      const [n, a, b] = L[k]; txt(lang, n); txt(tt, a); txt(bd, b);
      const rtl = n.startsWith('اردو'); tt.dir = bd.dir = rtl ? 'rtl' : 'ltr';
      [tt, bd].forEach((e) => { op(e, swap); fl(e, swap < 1 ? `blur(${(1 - swap) * 8}px)` : 'none'); });
      chips.forEach((c, i) => { const ang = (i / L.length) * Math.PI * 2 - Math.PI / 2; const q = sp(t, 11.0 + i * 0.05, 11.6 + i * 0.05, E.back);
        put(c, 220, 70, 960 + Math.cos(ang) * 840, 600 + Math.sin(ang) * 410, { o: Math.min(1, q) * 0.98, s: 0.6 + 0.4 * q }); });
    } };
  };

  SC.feed = (root, S) => {
    bgSolid(root, 'linear-gradient(160deg,#FFF9EC,#FDEBC8 60%,#FFF4DE)');
    const blobs = Blobs(root, ['#ffc34d', '#f7a3bf', '#ffb27a'], 0.5, 29);
    const stackW = abs(root, '', '', { left: '480px', top: '540px', width: 0, height: 0, perspective: '1600px' });
    const posts = ['post_tanker', 'post_security', 'post_welcome', 'post_tanker', 'post_security'].map((n) => UI(stackW, n, 1.45, 16));
    const h1 = new Words(abs(root, '', '', { left: '1000px', top: '220px', width: '820px' }), 'Talk it out.', 'big', 'hl-orange');
    const h2 = new Words(abs(root, '', '', { left: '1000px', top: '320px', width: '820px' }), 'Then *decide together*.', 'big', 'hl-orange');
    const plus = [0, 1, 2].map((i) => abs(root, 'bubble-a', '+1', { fontSize: '44px', padding: '18px 30px', background: '#E7EAE8' }));
    const strike = abs(root, 'lede', 'No more forty “+1”s.', { left: '1000px', top: '470px', color: '#9a6a1c', fontWeight: 700 });
    const opts = [['Open 24/7', 33], ['Close at 10:00 PM', 0], ['Close at 11:00 PM', 67], ['Close at 12:00 midnight', 0]];
    const poll = abs(root, 'card', `<div style="padding:34px 38px"><div style="font:600 24px Hanken;color:#5d6a63">Kirti Nath Jha · Flat 149 · Poll</div>
      <div style="font:800 42px/1.2 Bricolage;margin:14px 0 26px">What should the society gate timings be?</div>
      ${opts.map(([o], i) => `<div class="o" style="position:relative;height:84px;border-radius:22px;margin-bottom:14px;background:#F2F4F2;overflow:hidden;box-shadow:inset 0 0 0 2px ${i === 2 ? '#7a6ff0' : 'transparent'}"><div class="b" style="position:absolute;left:0;top:0;bottom:0;width:0;background:${i === 2 ? '#DCD8FF' : '#E3EEE7'}"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 28px;font:600 30px Hanken"><span>${o}</span><span class="p" style="font-variant-numeric:tabular-nums">0%</span></div></div>`).join('')}
      <div style="font:600 24px Hanken;color:#5d6a63;margin-top:6px">3 votes · live results</div></div>`, { width: '820px' });
    const bars = [...poll.querySelectorAll('.b')], pcts = [...poll.querySelectorAll('.p')];
    return { update(t, T) {
      blobs(T);
      const scroll = (t * 140) % (posts.length * 0);
      posts.forEach((u, i) => { const y = -260 + i * 330 - t * 70 + 400; const q = sp(t, 0.1 + i * 0.15, 0.9 + i * 0.15, E.out5);
        u.at(0, y + (1 - q) * 200, { rx: 22, ry: 18, rz: -6, o: q * clamp(1 - Math.abs(y) / 900) }); });
      h1.up(t, 0.4, { out: 5.6 }); h2.up(t, 6.0);
      plus.forEach((p, i) => { const q = sp(t, 1.8 + i * 0.35, 2.2 + i * 0.35, E.back), x = sp(t, 4.4, 5.2, E.in3);
        put(p, 110, 90, 1060 + i * 150, 600, { s: (0.6 + 0.4 * q) * (1 - x), o: Math.min(1, q) * (1 - x), rz: (i - 1) * 6 }); });
      fadeIn(strike, t, 3.2, 0.6, 20, 5.4);
      const pq = sp(t, 6.4, 7.2, E.out5); put(poll, 820, 680, 1410, 640, { o: pq, s: 0.9 + 0.1 * pq });
      const fillP = sp(t, 7.6, 10.4, E.io3);
      bars.forEach((b, i) => { const v = opts[i][1] * fillP; b.style.width = v + '%'; txt(pcts[i], Math.round(v) + '%' + (i === 2 && fillP > 0.98 ? '  ✓' : '')); });
    } };
  };

  SC.celebrate = (root, S) => {
    bgSolid(root, 'linear-gradient(160deg,#FFF7EA,#FFE2B8 55%,#FFEBD9)');
    const blobs = Blobs(root, ['#ffc34d', '#f7a3bf', '#ff9f43'], 0.5, 31);
    const r = rng(8); const petals = Array.from({ length: 46 }, () => ({ e: abs(root, '', '', { width: 16 + r() * 18 + 'px', height: 10 + r() * 10 + 'px', borderRadius: '50%', background: r() < 0.6 ? '#F5A300' : '#E8650A', opacity: 0.85 }), x: r() * W, sp: 60 + r() * 120, ph: r() * 6, d: r() * 9 }));
    const head = new Words(abs(root, '', '', { left: '130px', top: '120px', width: '1700px' }), 'Plan the festival. *Track every rupee.*', 'big', 'hl-orange');
    const ring = abs(root, '', `<svg viewBox="0 0 200 200" width="560" height="560"><circle cx="100" cy="100" r="86" fill="none" stroke="rgba(14,107,78,.12)" stroke-width="14"/><circle class="arc" cx="100" cy="100" r="86" fill="none" stroke="#0E6B4E" stroke-width="14" stroke-linecap="round" stroke-dasharray="540.4" stroke-dashoffset="540.4" transform="rotate(-90 100 100)"/></svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="v" style="font:800 104px/1 Bricolage;color:#0F1A15;letter-spacing:-.03em">₹0</div><div style="font:600 28px Hanken;color:#6b5a4c;margin-top:10px">collected of ₹50,000</div><div class="pc" style="font:800 40px Bricolage;color:#0E6B4E;margin-top:8px">0%</div></div>`, { width: '560px', height: '560px' });
    const arc = ring.querySelector('.arc'), rv = ring.querySelector('.v'), pc = ring.querySelector('.pc');
    const flatsT = abs(root, '', '<span class="n">0</span> flats have contributed', { left: '1010px', top: '330px', font: "800 46px Bricolage", color: '#0F1A15' });
    const fn = flatsT.querySelector('.n');
    const houses = Array.from({ length: 25 }, (_, i) => abs(root, '', icon('home', 2.4), { left: 1010 + (i % 5) * 96 + 'px', top: 420 + Math.floor(i / 5) * 92 + 'px', width: '72px', height: '72px', color: '#0E6B4E' }));
    const lines = [['Ganesh idol', 'decor · Vimal & Bisu', 6000], ['Tent setup', 'venue · Ashif & Manju', 12000], ['Pujari and pooja items', 'priest · Kirti & Abhishek', 7500], ['Chana and maha prasad', 'food · 200 plates', 15000], ['Crackers', 'misc · Ashif & Abhishek', 5000], ['Fruits set', 'food · Manju', 2000], ['Flowers and mala', 'decor', 1000], ['Vehicle for visarjan', 'misc', 1000], ['Banana leaves', 'decor', 200], ['Panchamruta', 'food · Dilip, flat 215', 200], ['Laddoo', 'Sponsored — flats 154 & 225', 0]];
    const rec = abs(root, 'card', `<div style="padding:34px 40px 10px"><div class="lbl">Ganesh Chaturthi 2026 · Estimated budget</div><div style="font:800 64px Bricolage;margin:10px 0 20px">₹49,900</div>${lines.map(([a, b, v]) => `<div class="li" style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid #EEF1EE"><div><div style="font:700 28px Hanken">${a}</div><div style="font:500 21px Hanken;color:#5d6a63">${b}</div></div><div style="font:800 30px Bricolage">${inr(v)}</div></div>`).join('')}</div>`, { width: '720px', overflow: 'hidden', borderRadius: '30px' });
    const lis = [...rec.querySelectorAll('.li')];
    const side = new Words(abs(root, '', '', { left: '130px', top: '380px', width: '820px' }), 'Budget, tasks and contributions — with accounts *every resident can open*.', 'mid', 'hl-orange');
    return { update(t, T) {
      blobs(T);
      petals.forEach((p) => { const y = ((t + p.d) * p.sp) % (H + 100) - 50; tf(p.e, `translate3d(${p.x + Math.sin(t * 1.3 + p.ph) * 40}px,${y}px,0) rotate(${t * 120 + p.ph * 60}deg)`); });
      head.up(t, 0.3, { out: 8.2 });
      const a = sp(t, 0.6, 1.3, E.out5), aOut = sp(t, 8.2, 9.0, E.in3);
      put(ring, 560, 560, 640 - aOut * 300, 640, { o: a * (1 - aOut), s: 0.9 + 0.1 * a });
      const c = sp(t, 1.0, 4.4, E.io3); arc.setAttribute('stroke-dashoffset', 540.4 * (1 - 0.848 * c)); txt(rv, inr(42401 * c)); txt(pc, Math.round(84.8 * c) + '%');
      fadeIn(flatsT, t, 2.2, 0.6, 20, 8.2); txt(fn, String(Math.round(23 * sp(t, 2.4, 5.0))));
      houses.forEach((hh, i) => { const on = i < 23 && t > 2.4 + i * 0.11; const q = sp(t, 2.0 + i * 0.03, 2.4 + i * 0.03, E.back); css(hh, { color: on ? '#E8650A' : 'rgba(14,107,78,.25)' }); tf(hh, `scale(${(0.5 + 0.5 * q) * (on && t < 2.7 + i * 0.11 ? 1.2 : 1)}) translateY(${-aOut * 60}px)`); op(hh, Math.min(1, q) * (1 - aOut)); });
      const rq = sp(t, 9.0, 9.8, E.out5); const grow = sp(t, 9.4, 15.0, E.io3);
      put(rec, 720, 960, 1380, 540 + (1 - rq) * 300 - grow * 240 + 240, { o: rq, rz: 1.5 });
      rec.style.clipPath = `inset(0 0 ${(1 - (0.17 + 0.83 * grow)) * 100}% 0 round 30px)`;
      lis.forEach((l, i) => op(l, sp(grow, i / lis.length, i / lis.length + 0.12)));
      side.up(t, 9.4);
    } };
  };

  SC.sports = (root, S) => {
    bgSolid(root, 'linear-gradient(160deg,#EEF8F2,#D4EEDF 60%,#F2FAF5)');
    const blobs = Blobs(root, ['#7fd6b0', '#9fd3ff', '#ffe1bd'], 0.55, 37);
    const head = new Words(abs(root, '', '', { left: 0, top: '80px', width: '1920px', textAlign: 'center' }), 'Teams, courts, and *who’s in tonight*.', 'big');
    const team = UI(root, 'team', 1.55, 16); const book = UI(root, 'booking', 1.9, 16);
    const slots = abs(root, 'card', `<div style="padding:30px 36px"><div class="lbl">Friday doubles · Court 2 · 7 PM</div><div style="display:flex;gap:22px;margin:22px 0 18px">${['KJ', 'B', 'VP', 'DR'].map((s, i) => `<div class="s" style="width:110px;height:110px;border-radius:50%;display:grid;place-items:center;font:700 36px Hanken;box-shadow:inset 0 0 0 3px #cfd8d3;color:transparent" data-c="${PET[[3, 0, 2, 6][i]]}">${s}</div>`).join('')}</div><div class="st" style="font:800 40px Bricolage"></div><div style="font:600 26px Hanken;color:#5d6a63;margin-top:6px">₹400 court · split ₹100 a head</div></div>`, { width: '600px' });
    const ss = [...slots.querySelectorAll('.s')], stt = slots.querySelector('.st');
    return { update(t, T) {
      blobs(T); head.up(t, 0.3);
      const a = sp(t, 0.4, 1.4, E.out5); team.at(470 - (1 - a) * 400, 600, { ry: 12, o: a, s: 0.95 + 0.05 * Math.sin(T) * 0 });
      const b = sp(t, 1.4, 2.4, E.out5); book.at(1430 + (1 - b) * 400, 420, { ry: -10, o: b });
      const c = sp(t, 2.8, 3.6, E.out5); put(slots, 600, 330, 1430, 760, { o: c, s: 0.9 + 0.1 * c });
      let n = 0; ss.forEach((s, i) => { const on = t > 4.0 + i * 0.6; if (on) n++; css(s, { background: on ? s.dataset.c : 'transparent', color: on ? '#fff' : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 3px #cfd8d3' }); tf(s, `scale(${on && t < 4.3 + i * 0.6 ? 1.15 : 1})`); });
      txt(stt, n < 4 ? `${n} of 4 · needs ${4 - n} more` : '4 of 4 · Game on ✓'); stt.style.color = n === 4 ? '#0E6B4E' : '#0F1A15';
    } };
  };

  SC.market = (root, S) => {
    bgSolid(root, 'radial-gradient(ellipse at 50% 40%,#2c2970,#17153f 60%,#0c0b24)');
    const blobs = Blobs(root, ['#534AB7', '#185FA5', '#D4537E'], 0.4, 41);
    const head = new Words(abs(root, '', '', { left: 0, top: '90px', width: '1920px', textAlign: 'center', color: '#fff' }), 'Buy, sell & find help — *inside your gate*.', 'big', 'hl-mint');
    const ringW = abs(root, '', '', { left: '960px', top: '600px', width: 0, height: 0, transformStyle: 'preserve-3d' });
    const tiles = Array.from({ length: 14 }, (_, i) => UI(ringW, 'tile_create_' + (27 + i), 1.3, 14));
    const beats = [
      ['flat_rent', 'Flats for rent & sale', '2 BHK · 1000 sq.ft · Furnished — straight from a neighbour.'],
      ['ladder', 'Borrow, *don’t buy*.', 'Ladders, drills, party gear — lent by the flat next door.'],
      ['lost_status', 'Lost your *keys*?', 'Key with an elephant keychain — reported, then found.'],
      ['ride', 'Share the *ride*.', 'DS Max Senate → Whitefield · 8:00 am · ₹130 · 3 seats.'],
    ].map(([n, a, b]) => ({ u: UI(root, n, n === 'lost_status' ? 1.9 : 2.3, 16), a: (() => { const w = new Words(abs(root, '', '', { left: '130px', top: '330px', width: '760px', color: '#fff' }), a, 'big', 'hl-mint'); return w; })(), b: abs(root, 'lede', b, { left: '130px', top: '590px', width: '720px', color: 'rgba(255,255,255,.75)' }) }));
    return { update(t, T) {
      blobs(T); head.up(t, 0.3, { out: 7.4 });
      const rIn = sp(t, 0.4, 1.8, E.out5), rOut = sp(t, 7.4, 8.2, E.in3);
      tf(ringW, `translate3d(0,${rOut * -200}px,0) perspective(2400px) rotateX(-8deg)`);
      tiles.forEach((u, i) => { const ang = (i / tiles.length) * 360 + t * 22; const rad = ang * Math.PI / 180; const R = 820 * rIn;
        const z = Math.cos(rad) * R; const x = Math.sin(rad) * R; const front = (z + 820) / 1640;
        u.at(x, 60, { z: z - 400, ry: ang, o: rIn * (1 - rOut) * (0.35 + 0.65 * front) }); u.el.style.zIndex = Math.round(front * 100); });
      beats.forEach(({ u, a, b }, i) => { const s0 = 8.2 + i * 2.95, s1 = s0 + 2.95;
        const qi = sp(t, s0, s0 + 0.6, E.out5), qo = i === beats.length - 1 ? 0 : sp(t, s1 - 0.4, s1, E.in3);
        u.at(1350, 560 + Math.sin(T) * 5, { ry: lerp(90, 0, qi) + qo * -90, o: Math.min(qi, 1 - qo) > 0 ? 1 : 0, s: 1 });
        a.up(t, s0 + 0.1, { out: i === beats.length - 1 ? null : s1 - 0.4 }); fadeIn(b, t, s0 + 0.4, 0.5, 16, i === beats.length - 1 ? null : s1 - 0.4); });
    } };
  };

  SC.safety = (root, S) => {
    const bg = bgSolid(root, 'radial-gradient(ellipse at 50% 30%,#4a1010,#200606 60%,#0d0303)');
    const bg2 = bgSolid(root, 'radial-gradient(ellipse at 50% 30%,#0e4a44,#062a26 60%,#031412)');
    const head = new Words(abs(root, '', '', { left: 0, top: '110px', width: '1920px', textAlign: 'center', color: '#fff' }), 'Help, *in one tap*.', 'big', 'hl-orange');
    const nums = [['112', 'Emergency'], ['108', 'Ambulance'], ['101', 'Fire'], ['100', 'Police']].map(([n, l], i) => abs(root, '', `<div class="d" style="display:flex;gap:10px;justify-content:center">${[...n].map(() => '<span style="display:inline-block;width:100px;height:150px;border-radius:18px;background:linear-gradient(#2a2a2a 49%,#111 51%);color:#fff;font:800 112px/150px Bricolage;text-align:center;box-shadow:0 20px 40px -16px rgba(0,0,0,.7)"></span>').join('')}</div><div style="font:700 32px Hanken;color:rgba(255,255,255,.85);text-align:center;margin-top:22px;display:flex;align-items:center;justify-content:center;gap:12px">${icon('phone', 2.4)}${l}</div>`, { width: '360px' }));
    nums.forEach((e) => (e.querySelector('svg').style.cssText = 'width:30px;height:30px;color:#ff8a7a'));
    const blood = UI(root, 'blood_ask', 2.2, 16);
    const bl = new Words(abs(root, '', '', { left: '130px', top: '640px', width: '820px', color: '#fff' }), 'Blood donors & SOS helpers *in your building*.', 'mid', 'hl-orange');
    const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((g) => abs(root, '', g, { width: '110px', height: '110px', borderRadius: '50%', background: '#fff', color: '#C0281C', display: 'grid', placeItems: 'center', font: "800 34px Bricolage", boxShadow: '0 20px 40px -16px rgba(0,0,0,.6)' }));
    const map = UI(root, 'map', 2.5, 18);
    const near = new Words(abs(root, '', '', { left: '1130px', top: '200px', width: '700px', color: '#fff' }), 'Everything nearby, *one tap to directions*.', 'mid', 'hl-mint');
    const cats = [['Hospitals', 24], ['Clinics & doctors', 26], ['Pharmacies', 18], ['Schools', 24], ['Supermarkets', 32], ['Gyms', 9]].map(([n, v], i) => abs(root, '', `<span style="flex:1">${n}</span><span class="v" style="font:800 40px Bricolage;color:#7fd6b0">0</span>`, { left: '1130px', top: 480 + i * 78 + 'px', width: '640px', display: 'flex', alignItems: 'center', font: "600 32px Hanken", color: '#fff', borderBottom: '1px solid rgba(255,255,255,.14)', paddingBottom: '14px' }));
    const pins = Array.from({ length: 9 }, (_, i) => abs(root, '', `<svg viewBox="0 0 24 24" width="64" height="64" fill="${PET[i % 8]}" stroke="#fff" stroke-width="1.4"><path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>`, { width: '64px', height: '64px' }));
    const pr = rng(12); const pp = pins.map(() => [120 + pr() * 700, 340 + pr() * 400]);
    return { update(t, T) {
      op(bg2, sp(t, 10.6, 11.6));
      head.up(t, 0.3, { out: 5.6 });
      nums.forEach((e, i) => { const q = sp(t, 0.6 + i * 0.25, 1.2 + i * 0.25, E.out5), o = sp(t, 5.6, 6.2, E.in3);
        put(e, 360, 230, 960 + (i - 1.5) * 400, 560, { o: q * (1 - o), s: 0.9 + 0.1 * q });
        const digits = [...e.querySelectorAll('.d span')]; const n = ['112', '108', '101', '100'][i];
        digits.forEach((d, k) => { const settle = 1.0 + i * 0.25 + k * 0.25; txt(d, t < settle ? String(Math.floor((t * 23 + k * 7 + i * 3) % 10)) : n[k]); }); });
      const bIn = sp(t, 6.2, 7.0, E.out5), bOut = sp(t, 10.4, 11.0, E.in3);
      blood.at(560, 420, { o: bIn * (1 - bOut), s: 0.9 + 0.1 * bIn }); bl.up(t, 6.6, { out: 10.4 });
      groups.forEach((g, i) => { const ang = (i / 8) * Math.PI * 2 + t * 0.6; const q = sp(t, 6.8 + i * 0.08, 7.3 + i * 0.08, E.back);
        put(g, 110, 110, 1400 + Math.cos(ang) * 300, 560 + Math.sin(ang) * 300, { o: Math.min(1, q) * (1 - bOut), s: 0.6 + 0.4 * q }); });
      const mIn = sp(t, 11.0, 11.9, E.out5);
      map.at(520 - (1 - mIn) * 400, 560, { o: mIn, ry: 10 });
      pins.forEach((p, i) => { const a = 12.0 + i * 0.22; const q = sp(t, a, a + 0.35, E.out3); const [x, y] = pp[i]; put(p, 64, 64, x + 40, y - (1 - q) * 160, { o: q * mIn }); });
      near.up(t, 11.4);
      cats.forEach((c, i) => { fadeIn(c, t, 12.4 + i * 0.25, 0.5, 16); txt(c.querySelector('.v'), String(Math.round([24, 26, 18, 24, 32, 9][i] * sp(t, 12.4 + i * 0.25, 13.6 + i * 0.25)))); });
    } };
  };

  SC.money = (root, S) => {
    bgSolid(root, 'radial-gradient(ellipse at 50% 40%,#12805C,#0A5340 60%,#063526)');
    const blobs = Blobs(root, ['#3FB98B', '#7fd6b0', '#E8650A'], 0.3, 43);
    const head = new Words(abs(root, '', '', { left: 0, top: '110px', width: '1920px', textAlign: 'center', color: '#fff' }), 'Pay neighbour to neighbour. *Over UPI.*', 'big', 'hl-orange');
    const av = [['KJ', 'Kirti · Flat 149', '#534AB7'], ['PP', 'Pratibha · Flat 149', '#D85A30']].map(([s, l, c], i) => abs(root, '', `<div style="width:220px;height:220px;border-radius:50%;background:${c};color:#fff;display:grid;place-items:center;font:800 76px Bricolage;box-shadow:0 0 0 8px rgba(255,255,255,.9),0 40px 80px -30px rgba(0,0,0,.6)">${s}</div><div style="font:700 32px Hanken;color:#fff;margin-top:26px">${l}</div><div class="ok pill" style="margin-top:16px;background:#fff;color:#0E6B4E;font-size:24px">${icon('check', 3)}${i ? 'Received' : 'Paid'}</div>`, { width: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }));
    av.forEach((a) => (a.querySelector('svg').style.cssText = 'width:24px;height:24px'));
    const oks = av.map((a) => a.querySelector('.ok'));
    const coin = abs(root, '', '₹250', { width: '170px', height: '170px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#FFE08A,#F5A300 60%,#C27C00)', color: '#5a3500', display: 'grid', placeItems: 'center', font: "800 44px Bricolage", boxShadow: '0 30px 60px -20px rgba(0,0,0,.6)' });
    const what = abs(root, 'lede', 'Butter Chicken · 1 plate', { left: 0, width: '1920px', top: '820px', textAlign: 'center', color: 'rgba(255,255,255,.85)', fontWeight: 600 });
    const never = new Words(abs(root, '', '', { left: 0, top: '900px', width: '1920px', textAlign: 'center', color: '#fff' }), 'A ledger both sides confirm. *Aangan never holds your money.*', 'mid', 'hl-mint');
    const ledger = UI(root, 'ledger', 1.45, 16);
    const docs = new Words(abs(root, '', '', { left: '1000px', top: '250px', width: '820px', color: '#fff' }), 'And a vault for *society documents*.', 'big', 'hl-mint');
    const doc = UI(root, 'doc_bill', 2.2, 16);
    const lockT = abs(root, '', '<span class="ic" style="width:64px;height:64px;display:grid;place-items:center"></span><span class="tx"></span>', { left: '1000px', top: '820px', display: 'flex', alignItems: 'center', gap: '16px', font: "700 36px Hanken", color: '#fff' });
    const lic = lockT.querySelector('.ic'), ltx = lockT.querySelector('.tx');
    return { update(t, T) {
      blobs(T);
      const A = 1 - sp(t, 7.4, 8.2, E.in3);
      head.up(t, 0.3, { out: 7.4 });
      av.forEach((a, i) => { const q = sp(t, 0.6 + i * 0.2, 1.4 + i * 0.2, E.out5); put(a, 320, 380, i ? 1440 : 480, 500, { o: q * A, s: 0.9 + 0.1 * q }); });
      const cp = sp(t, 1.8, 3.4, E.io3); const cx = lerp(560, 1360, cp), cy = 500 - Math.sin(cp * Math.PI) * 150;
      put(coin, 170, 170, cx, cy, { o: (t > 1.6 && t < 3.6 ? 1 : 0) * A, rz: cp * 360, s: 1 + Math.sin(cp * Math.PI) * 0.2 });
      oks.forEach((o, i) => { const q = sp(t, i ? 3.5 : 2.0, (i ? 3.5 : 2.0) + 0.4, E.back); tf(o, `scale(${q})`); op(o, Math.min(1, q)); });
      fadeIn(what, t, 1.8, 0.5, 16, 7.4);
      never.up(t, 4.4, { out: 7.4 });
      const lq = sp(t, 8.0, 8.9, E.out5); ledger.at(520 - (1 - lq) * 400, 560 + Math.sin(T) * 5, { ry: 12, o: lq });
      docs.up(t, 8.4);
      const dq = sp(t, 9.2, 10.0, E.out5); doc.at(1420, 680, { o: dq, s: 0.9 + 0.1 * dq });
      const pub = t > 11.6; lic.innerHTML = icon(pub ? 'unlock' : 'lock', 2.4); lic.firstChild.style.cssText = 'width:44px;height:44px;color:#7fd6b0';
      txt(ltx, pub ? 'Public to residents — or share privately' : 'Private — only who you choose'); fadeIn(lockT, t, 10.2);
    } };
  };

  SC.trust = (root, S) => {
    bgSolid(root, 'linear-gradient(180deg,#05070d,#0b1322 60%,#101a2a)');
    const world = abs(root, 'world');
    const r = rng(19); const blds = [];
    for (let gy = -6; gy <= 6; gy++) for (let gx = -10; gx <= 10; gx++) {
      const w = 60 + r() * 50, hh = 90 + r() * 160; const x = gx * 150 + (r() - 0.5) * 30, y = gy * 230 + (r() - 0.5) * 40;
      const e = abs(world, '', '', { left: x - w / 2 + 'px', top: y - hh + 'px', width: w + 'px', height: hh + 'px', borderRadius: '6px 6px 2px 2px', background: '#172233', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.04)' });
      blds.push({ e, gx, gy });
    }
    const me = blds.find((b) => b.gx === 0 && b.gy === 0); css(me.e, { background: 'linear-gradient(#1D9E75,#0E6B4E)', boxShadow: '0 0 60px 16px rgba(63,185,139,.55)' });
    const t1 = new Words(abs(root, '', '', { left: 0, top: '150px', width: '1920px', textAlign: 'center', color: '#fff' }), 'Only your society. *Never strangers.*', 'big', 'hl-mint');
    const items = [['ban', 'No ads.'], ['eye', 'No selling your data.'], ['lock', 'No OTP. Just your PIN.']].map(([ic, s]) => abs(root, '', `<span style="width:120px;height:120px;border-radius:36px;background:#fff;color:#0E6B4E;display:grid;place-items:center">${icon(ic, 2.2)}</span><span>${s}</span>`, { left: 0, top: '470px', width: '1920px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '36px', font: "800 110px/1 Bricolage", color: '#fff', letterSpacing: '-.03em' }));
    items.forEach((e) => (e.querySelector('svg').style.cssText = 'width:64px;height:64px'));
    return { update(t, T) {
      const z = kf([[0, 3.2], [5.6, 0.55]], t, E.io5); const fade = sp(t, 6.0, 6.6);
      tf(world, `translate(960px,${640 - fade * 100}px) scale(${z})`); op(world, 1 - fade * 0.75);
      blds.forEach((b) => b !== me && op(b.e, 0.35 + 0.65 * sp(t, 0.2 + Math.hypot(b.gx, b.gy) * 0.18, 0.6 + Math.hypot(b.gx, b.gy) * 0.18)));
      t1.up(t, 2.2, { out: 6.0 });
      items.forEach((e, i) => { const a = 6.6 + i * 2.1; const q = sp(t, a, a + 0.5, E.out5), o = i === 2 ? 0 : sp(t, a + 1.7, a + 2.1, E.in3);
        tf(e, `translate3d(0,${(1 - q) * 80 - o * 80}px,0) scale(${0.9 + 0.1 * q})`); op(e, q * (1 - o)); fl(e, q < 1 || o > 0 ? `blur(${(1 - q + o) * 12}px)` : 'none'); });
    } };
  };

  SC.dark = (root, S) => {
    const light = abs(root, 'fill'); bgSolid(light, 'linear-gradient(160deg,#F5F3EC,#E9F2EC)');
    const dark = abs(root, 'fill'); bgSolid(dark, 'radial-gradient(ellipse at 50% 30%,#14252e,#05080c 70%)');
    const shots = [['home', 'home'], ['food', 'food'], ['ask', 'ask']];
    const mk = (layer, isDark) => shots.map(([l, d], i) => { const p = new Phone(layer, 290, isDark ? `../ad/media/dark/${d}.jpg` : `media/screens/${l}.jpg`, false); return p; });
    const PL = mk(light, false), PD = mk(dark, true);
    const tl = new Words(abs(light, '', '', { left: 0, top: '80px', width: '1920px', textAlign: 'center' }), 'Bright by day.', 'big');
    const td = new Words(abs(dark, '', '', { left: 0, top: '80px', width: '1920px', textAlign: 'center', color: '#fff' }), 'Easy on the eyes *by night*.', 'big', 'hl-mint');
    const tog = abs(root, '', '<div class="k" style="position:absolute;top:10px;left:10px;width:100px;height:100px;border-radius:50%;background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.35)"></div>', { width: '220px', height: '120px', borderRadius: '60px', zIndex: 5 });
    const knob = tog.querySelector('.k');
    return { update(t, T) {
      const w = sp(t, 2.4, 3.6, E.io3);
      dark.style.clipPath = `circle(${w * 130}% at 50% 23%)`;
      put(tog, 220, 120, 960, 250, { o: sp(t, 0.6, 1.0) });
      css(tog, { background: w > 0.05 ? '#3FB98B' : '#cfd8d3' }); tf(knob, `translateX(${sp(t, 2.2, 2.6, E.out3) * 100}px)`);
      [PL, PD].forEach((PP) => PP.forEach((p, i) => { const q = sp(t, 0.1 + i * 0.15, 1.1 + i * 0.15, E.out5); p.at(960 + (i - 1) * 400, 680 + (1 - q) * 500 + Math.sin(T + i) * 5, { ry: (i - 1) * -10, s: i === 1 ? 1.05 : 0.95 }); }));
      tl.up(t, 0.3); td.up(t, 3.0);
    } };
  };

  SC.montage = (root, S) => {
    const bg = bgSolid(root, '#0E6B4E');
    const ph = new Phone(root, 360, null, false);
    const shots = ['media/screens/home.jpg', 'media/screens/dish.jpg', 'media/screens/kitchen.jpg', '../ad/media/dark/ask.jpg', 'media/screens/polls.jpg', 'media/screens/event.jpg', 'media/screens/sports.jpg', 'media/screens/create.jpg',
      'media/screens/properties.jpg', 'media/screens/borrow.jpg', 'media/screens/helpers.jpg', 'media/screens/places.jpg', 'media/screens/payments.jpg', '../ad/media/dark/home.jpg', 'media/screens/feed.jpg', 'media/screens/onboard_join.jpg',
      'media/screens/food.jpg', 'media/screens/lost.jpg', 'media/screens/rides.jpg', '../ad/media/dark/food.jpg', 'media/screens/home.jpg'];
    shots.forEach((s) => { if (RENDER) { const i = new Image(); i.src = s; PENDING.push(i.decode().catch(() => {})); } });
    const words = ['Food.', 'Saathi.', 'Polls.', 'Festivals.', 'Flats.', 'Help.', 'Money.', 'Neighbours.'].map((w, i) => abs(root, 'mega', w, { left: 0, top: '420px', width: '1920px', textAlign: 'center', color: '#fff', fontSize: '200px' }));
    const cols = ['#0E6B4E', '#E8650A', '#534AB7', '#D4537E', '#185FA5', '#BA7517', '#1D9E75', '#D85A30'];
    return { update(t, T) {
      const beat = Math.floor(t / 0.5); const bp = (t % 0.5) / 0.5;
      css(bg, { background: cols[beat % cols.length] });
      const isWord = beat % 3 === 2 && beat < 22;
      const wi = Math.floor(beat / 3) % words.length;
      words.forEach((w, i) => { if (i === wi && isWord) { tf(w, `scale(${1.15 - 0.15 * E.out3(bp)})`); op(w, 1); } else op(w, 0); });
      ph.setScreen(shots[beat % shots.length]);
      const side = beat % 2 ? 1 : -1;
      ph.at(960 + side * 380 * (beat % 4 < 2 ? 1 : -0.3), 545, { s: (1.08 - 0.1 * E.out3(bp)) * (beat > 20 ? 1 + sp(t, 10.5, 12, E.in3) * 3 : 1), ry: side * -18, rz: side * 3, o: isWord ? 0.25 : 1 });
    } };
  };

  SC.cta = (root, S) => {
    bgSolid(root, 'linear-gradient(160deg,#F7F5EE,#EAF3EC 60%,#F6EFE4)');
    const blobs = Blobs(root, ['#9fd9be', '#ffd3a8', '#bfe3d1'], 0.6, 47);
    const hold = abs(root, '', '', { left: '960px', top: '280px' }); const L = Logo(hold, 250); css(L.svg, { left: '-125px', top: '-125px' });
    const wm = new Words(abs(root, '', '', { left: 0, top: '430px', width: '1920px', textAlign: 'center' }), 'Aangan', 'mega');
    const ln = new Words(abs(root, '', '', { left: 0, top: '610px', width: '1920px', textAlign: 'center' }), 'Your society, *finally in one place*.', 'mid');
    const b1 = abs(root, 'pill btn-g', `${icon('android', 2.2)}Get it on Android`, { fontSize: '32px', padding: '26px 38px' });
    const b2 = abs(root, 'pill', `${icon('globe', 2.2)}my-aangan.vercel.app`, { fontSize: '32px', padding: '26px 38px', background: '#fff', color: '#0E6B4E', boxShadow: '0 20px 40px -20px rgba(14,107,78,.5)' });
    [b1, b2].forEach((b) => (b.querySelector('svg').style.cssText = 'width:36px;height:36px'));
    const note = abs(root, 'lede', 'Free for residents · Set up in minutes · Phone + PIN, no OTP', { left: 0, width: '1920px', top: '880px', textAlign: 'center', color: '#5d6a63', fontSize: '26px', fontWeight: 600 });
    const bars = PET.map((c, i) => abs(root, '', '', { left: 820 + i * 36 + 'px', top: '950px', width: '30px', height: '6px', borderRadius: '3px', background: c, transformOrigin: 'left' }));
    const tag = abs(root, '', 'every home. every language. one courtyard.', { left: 0, width: '1920px', top: '985px', textAlign: 'center', font: "500 22px Hanken", letterSpacing: '.16em', color: '#8a948e' });
    const credit = abs(root, '', 'Music: “Presenterator” by Kevin MacLeod (incompetech.com) · Licensed under CC BY 4.0', { left: 0, width: '1920px', top: '1036px', textAlign: 'center', font: "500 17px Hanken", color: '#9aa39e', letterSpacing: '.02em' });
    const end = abs(root, 'fill', '', { background: '#03120d' });
    return { update(t, T) {
      blobs(T); tf(hold, `rotate(${t * 6}deg)`); L.update(t - 0.3);
      wm.up(t, 1.1, { st: 0.07 }); ln.up(t, 1.9);
      const q1 = sp(t, 2.9, 3.5, E.back), q2 = sp(t, 3.1, 3.7, E.back);
      put(b1, 470, 96, 960 - 270, 790, { s: 0.7 + 0.3 * q1, o: Math.min(1, q1) }); put(b2, 520, 96, 960 + 270, 790, { s: 0.7 + 0.3 * q2, o: Math.min(1, q2) });
      fadeIn(credit, t, 5.0, 0.8, 0); fadeIn(note, t, 3.8); bars.forEach((b, i) => tf(b, `scaleX(${sp(t, 4.2 + i * 0.06, 4.8 + i * 0.06)})`)); fadeIn(tag, t, 4.6);
      op(end, sp(t, S.dur - 1.5, S.dur, E.in3));
    } };
  };

  // ---------- engine ----------
  const stage = document.getElementById('stage');
  const flash = h('div', '', stage); flash.id = 'flash';
  const wipe = h('div', '', stage); wipe.id = 'wipe';
  const wipeBars = [0, 1, 2].map((i) => h('i', '', wipe));
  h('div', '', stage).id = 'vig';
  const grain = h('div', '', stage); grain.id = 'grain';
  { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); const d = g.createImageData(256, 256); const r = rng(1);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); grain.style.backgroundImage = `url(${cv.toDataURL()})`; }
  const chapEl = h('div', '', stage); chapEl.id = 'chapter';
  const DARK = new Set(['ping', 'spark', 'hero', 'ask', 'doit', 'watch', 'market', 'safety', 'money', 'trust', 'montage', 'find']);
  const CHAP = { find: ['01', 'Find your society'], home: ['02', 'Home'], food: ['03', 'Home food'], ask: ['04', 'Saathi AI'], doit: ['04', 'Saathi AI'], watch: ['04', 'Saathi AI'], translate: ['04', 'Saathi AI'],
    feed: ['05', 'Community'], celebrate: ['05', 'Community'], sports: ['05', 'Community'], market: ['06', 'Marketplace'], safety: ['07', 'Safety & money'], money: ['07', 'Safety & money'] };

  let SCENES = [];
  function build() {
    SCENES = window.STORY.scenes.map((cfg, i) => { const wrap = h('div', 'scene'); stage.insertBefore(wrap, flash); wrap.style.zIndex = i + 1; return { cfg, wrap, inst: SC[cfg.id](wrap, cfg), on: false }; });
  }
  // flower clip path for 'petal'
  const petalPath = (p, rot) => {
    const R = 1600 * E.in2(p) + 1; const r = R * 0.42; const cx = 960, cy = 540; let d = '';
    for (let i = 0; i < 8; i++) { const a = (i * 45 + rot) * Math.PI / 180; const ox = cx + Math.cos(a) * R * 0.55, oy = cy + Math.sin(a) * R * 0.55;
      const ex = Math.cos(a) * R * 0.55, ey = Math.sin(a) * R * 0.55;
      d += `M${ox - ex} ${oy - ey}A${R * 0.55} ${r} ${i * 45 + rot} 1 0 ${ox + ex} ${oy + ey}A${R * 0.55} ${r} ${i * 45 + rot} 1 0 ${ox - ex} ${oy - ey}Z`; }
    d += `M${cx - R * 0.5} ${cy}A${R * 0.5} ${R * 0.5} 0 1 0 ${cx + R * 0.5} ${cy}A${R * 0.5} ${R * 0.5} 0 1 0 ${cx - R * 0.5} ${cy}Z`;
    return `path('${d}')`;
  };
  function tStyle(kind, p, enter) {
    const q = E.io3(p);
    switch (kind) {
      case 'zoomthru': return enter ? [`scale(${0.6 + 0.4 * E.out3(p)})`, E.out2(p), '', p < 1 ? `blur(${(1 - p) * 16}px)` : ''] : [`scale(${1 + 3 * E.in3(p)})`, 1 - E.in2(p), '', `blur(${p * 20}px)`];
      case 'whip': return enter ? [`translate3d(${(1 - q) * W}px,0,0) scaleX(${1 + Math.sin(p * Math.PI) * 0.08})`, 1, '', p < 1 ? `blur(${Math.sin(p * Math.PI) * 26}px)` : ''] : [`translate3d(${-q * W}px,0,0) scaleX(${1 + Math.sin(p * Math.PI) * 0.08})`, 1, '', `blur(${Math.sin(p * Math.PI) * 26}px)`];
      case 'iris': return enter ? ['', 1, `circle(${q * 120}% at 50% 50%)`, ''] : [`scale(${1 + 0.08 * p})`, 1, '', ''];
      case 'petal': return enter ? ['', 1, petalPath(p, p * 60), ''] : [`scale(${1 + 0.1 * p}) rotate(${p * 3}deg)`, 1, '', ''];
      case 'flash': case 'slice': case 'colorwipe': return enter ? ['', p > 0.5 ? 1 : 0, '', ''] : ['', p > 0.5 ? 0 : 1, '', ''];
      default: return enter ? ['', p, '', ''] : ['', 1, '', ''];
    }
  }
  function render(t) {
    let flashA = 0, wipeK = null, wipeP = 0, chap = null, chapA = 0, chapDark = true;
    SCENES.forEach((S, i) => {
      const { cfg, wrap, inst } = S; const next = SCENES[i + 1]; const end = cfg.start + cfg.dur;
      const on = t >= cfg.start && t < end + 1e-6;
      if (on !== S.on) { wrap.style.display = on ? 'block' : 'none'; S.on = on; }
      if (!on) return;
      const lt = t - cfg.start; let T1 = '', O = 1, CP = '', F = '';
      if (i > 0 && lt < cfg.ov) { const p = lt / cfg.ov; [T1, O, CP, F] = tStyle(cfg.tin, p, true);
        if (cfg.tin === 'flash') flashA = Math.max(flashA, 1 - Math.abs(p - 0.5) * 2);
        if (cfg.tin === 'slice' || cfg.tin === 'colorwipe') { wipeK = cfg.tin; wipeP = p; } }
      if (next && t > next.cfg.start) { const p = (t - next.cfg.start) / next.cfg.ov; const [a, b, c, d] = tStyle(next.cfg.tin, p, false); T1 = (T1 + ' ' + a).trim(); O *= b; CP = CP || c; F = F || d; }
      tf(wrap, T1); wrap.style.opacity = O; if (wrap._cp !== CP) { wrap.style.clipPath = CP; wrap._cp = CP; } fl(wrap, F || 'none');
      inst.update(lt, t);
      if (CHAP[cfg.id] && lt > 0.4) { chap = CHAP[cfg.id]; chapDark = DARK.has(cfg.id); chapA = Math.min(sp(lt, 0.4, 1.0), 1 - sp(lt, cfg.dur - 0.6, cfg.dur - 0.2)); }
    });
    flash.style.opacity = flashA;
    if (wipeK) {
      wipe.style.display = 'block';
      wipeBars.forEach((b, i) => {
        const d = i * 0.08, p = clamp((wipeP - d) / (1 - 0.16));
        if (wipeK === 'slice') { css(b, { left: 0, width: '100%', top: i * 33.4 + '%', height: '33.4%', background: ['#E8650A', '#0E6B4E', '#534AB7'][i] });
          const x = i % 2 ? lerp(W, -W, E.io3(p)) : lerp(-W, W, E.io3(p)); tf(b, `translate3d(${x}px,0,0)`); }
        else { css(b, { left: 0, top: '-20%', width: '140%', height: '140%', background: ['#C0281C', '#E8650A', '#0E6B4E'][i] }); tf(b, `translate3d(${lerp(-2900, 1500, E.io3(p))}px,0,0) skewX(-20deg)`); }
      });
    } else wipe.style.display = 'none';
    if (chap) { chapEl.innerHTML = `<span class="n" style="background:${chapDark ? '#fff' : '#0E6B4E'};color:${chapDark ? '#062E22' : '#fff'}">${chap[0]}</span><span style="color:${chapDark ? 'rgba(255,255,255,.85)' : '#0E6B4E'}">${chap[1]}</span>`; chapEl.style.opacity = chapA; }
    else chapEl.style.opacity = 0;
  }

  async function load() {
    LIB = await (await fetch('media/ui/index.json')).json();
    for (const n of ['home', 'food', 'saathi_ask', 'polls']) MAN[n] = await (await fetch(`../ad/media/clips/${n}.json`)).json();
    await document.fonts.load('800 100px Bricolage'); await document.fonts.load('600 30px Hanken'); await document.fonts.load('500 30px Hanken'); await document.fonts.load('700 30px Hanken');
    await Promise.all(['नमस्ते', 'ನಮಸ್ಕಾರ', 'வணக்கம்', 'నమస్కారం', 'নমস্কার', 'നമസ്കാരം', 'નમસ્તે', 'ਸਤ', 'ନମସ୍କାର', 'آداب'].map((s) => document.fonts.load('600 40px Indic', s)));
  }
  window.__seek = async (t) => { PENDING = []; render(t); await Promise.all(PENDING); await new Promise((r) => requestAnimationFrame(() => r())); };
  function fit() { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `translate(${(innerWidth - W * s) / 2}px,${(innerHeight - H * s) / 2}px) scale(${s})`; }
  addEventListener('resize', fit); fit();
  window.__ready = (async () => { await load(); build(); const t0 = Number(Q.get('t') || 0); await window.__seek(t0); if (!RENDER) player(); return { dur: window.STORY.dur }; })();

  function player() {
    const $ = (id) => document.getElementById(id);
    const audio = new Audio('media/music.mp3'); audio.preload = 'auto';
    const D = window.STORY.dur; let t = 0, playing = false, last = 0;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
    window.STORY.scenes.filter((s) => s.chap).forEach((s) => { const k = h('div', 'tick', $('scrub')); k.style.left = (s.start / D) * 100 + '%'; k.title = s.name; });
    const sync = () => { $('time').textContent = `${fmt(t)} / ${fmt(D)}`; $('fill2').style.width = (t / D) * 100 + '%'; $('play').innerHTML = playing ? PAUSE : PLAY; };
    const seek = (x) => { t = clamp(x, 0, D - 0.01); if (audio.readyState) audio.currentTime = t; render(t); sync(); };
    const play = () => { if (t >= D - 0.05) seek(0); playing = PLAYING = true; last = performance.now(); audio.currentTime = t; audio.play().catch(() => {}); sync(); poke(); };
    const pause = () => { playing = PLAYING = false; audio.pause(); sync(); poke(); };
    const loop = (now) => { if (playing) { const dt = (now - last) / 1000; last = now; t = !audio.paused && audio.readyState >= 2 && Math.abs(audio.currentTime - t - dt) < 0.3 ? audio.currentTime : t + dt; if (t >= D) { t = D - 0.01; pause(); } render(t); sync(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    let ht = 0; const poke = () => { $('ui').classList.remove('hide'); clearTimeout(ht); if (playing) ht = setTimeout(() => $('ui').classList.add('hide'), 2500); };
    addEventListener('pointermove', poke);
    $('play').onclick = () => (playing ? pause() : play());
    $('viewport').onclick = () => { if ($('start').hidden) playing ? pause() : play(); };
    $('go').onclick = (e) => { e.stopPropagation(); $('start').hidden = true; seek(0); play(); };
    $('fs').onclick = () => { try { const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); r?.catch?.(() => {}); } catch {} };
    const sc = $('scrub'); let drag = false; const pos = (e) => { const r = sc.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * D; };
    sc.addEventListener('pointerdown', (e) => { drag = true; sc.setPointerCapture(e.pointerId); seek(pos(e)); });
    sc.addEventListener('pointermove', (e) => drag && seek(pos(e))); sc.addEventListener('pointerup', () => (drag = false));
    addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); } if (e.code === 'ArrowRight') seek(t + 5); if (e.code === 'ArrowLeft') seek(t - 5); });
    sync();
  }
})();
