/* Aangan launch film — a seekable, deterministic timeline.
 * Every frame is a pure function of time t, so the same page plays live in a
 * browser and renders frame-by-frame to video (?render=1). */
(() => {
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  const W = 1920, H = 1080, SW = 412, SH = 892;
  const PETALS = ['#E8650A', '#D4537E', '#1D9E75', '#534AB7', '#BA7517', '#D85A30', '#185FA5', '#3B6D11'];
  if (RENDER) document.documentElement.classList.add('render');

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    lin: (t) => t,
    out2: (t) => 1 - (1 - t) * (1 - t),
    out3: (t) => 1 - Math.pow(1 - t, 3),
    out5: (t) => 1 - Math.pow(1 - t, 5),
    in3: (t) => t * t * t,
    io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    io5: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    outBack: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  };
  const pw = (keys, t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * (t - a) / (b - a); }
    }
    return keys[keys.length - 1][1];
  };
  const slope = (keys, t) => {
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return (vb - va) / (b - a); }
    return 0;
  };
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // ---------- dom ----------
  const h = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  const css = (e, o) => { for (const k in o) { if (k.startsWith('--')) e.style.setProperty(k, o[k]); else e.style[k] = o[k]; } };
  const tf = (e, s) => { if (e._tf !== s) { e.style.transform = s; e._tf = s; } };
  const op = (e, v) => { v = Math.round(v * 1000) / 1000; if (e._op !== v) { e.style.opacity = v; e._op = v; } };
  const vis = (e, v) => { if (e._vis !== v) { e.style.visibility = v ? 'visible' : 'hidden'; e._vis = v; } };
  const fl = (e, s) => { if (e._fl !== s) { e.style.filter = s; e._fl = s; } };
  const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

  // ---------- icons (24px stroke) ----------
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    megaphone: '<path d="M3 11v3a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    food: '<path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18"/><path d="M17 3c-2 0-3 2.5-3 6s1 4 3 4v8"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    rupee: '<path d="M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l9 7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.1A8 8 0 1 1 21 12z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
    bell: '<path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.7"/>',
    android: '<path d="M6 10h12v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M6 9a6 6 0 0 1 12 0zM9 19v3M15 19v3M3 11v5M21 11v5M8 4 6.5 2M16 4l1.5-2"/>',
  };
  const icon = (k, sw = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${P[k] || P.spark}</svg>`;

  // ---------- media ----------
  const MAN = {};
  let PENDING = [];
  let PLAYING = false;
  // ?fmt=webm is only for testing in browsers without H.264.
  const VSRC = (n) => (Q.get('fmt') === 'webm' ? `test_webm/${n}.webm` : `media/video/${n}.mp4`);

  class Clip {
    constructor(parent, name, cls = 'media') {
      this.name = name; this.m = MAN[name];
      let acc = 0;
      this.cum = this.m.frames.map((f) => { const s = acc; acc += f.d; return s / this.m.fps; });
      this.dur = acc / this.m.fps;
      if (RENDER) { this.el = h('img', cls, parent); this.el.decoding = 'sync'; }
      else {
        this.el = h('video', cls, parent);
        this.el.muted = true; this.el.playsInline = true; this.el.preload = 'none';
        this.el.setAttribute('muted', ''); this.el.setAttribute('playsinline', '');
        this.loaded = false;
      }
      this.t = -1;
    }
    frameAt(t) {
      const c = this.cum; let lo = 0, hi = c.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (c[mid] <= t) lo = mid; else hi = mid - 1; }
      return this.m.frames[lo].f;
    }
    load() { if (!RENDER && !this.loaded) { this.loaded = true; this.el.preload = 'auto'; this.el.src = VSRC(this.name); } }
    set(t, rate = 1) {
      t = clamp(t, 0, this.dur - 0.02); this.t = t;
      if (RENDER) {
        const src = `frames/${this.name}/${this.frameAt(t)}`;
        if (this.el._src !== src) { this.el._src = src; this.el.src = src; PENDING.push(this.el.decode().catch(() => {})); }
        return;
      }
      this.load();
      const v = this.el;
      if (v.readyState < 1) return;
      if (v.seeking) return;
      if (!PLAYING || rate === 0) {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - t) > 0.03) v.currentTime = t;
      } else {
        const r = clamp(rate, 0.25, 6);
        if (Math.abs(v.playbackRate - r) > 0.01) v.playbackRate = r;
        // Re-sync only on real drift, and not every frame: a video that is
        // still buffering would otherwise be re-seeked forever.
        const now = performance.now();
        if (Math.abs(v.currentTime - t) > 0.4 && now - (this.lastSeek || 0) > 900) { v.currentTime = t; this.lastSeek = now; }
        if (v.paused) v.play().catch(() => {});
      }
    }
    sleep() { if (!RENDER && this.el && !this.el.paused) this.el.pause(); }
  }

  const img = (parent, src, cls = 'media') => {
    const e = h('img', cls, parent); e.src = src;
    if (RENDER) PENDING.push(e.decode().catch(() => {}));
    return e;
  };

  // ---------- phone ----------
  class Phone {
    constructor(parent, { sw = 380, clip, still, image, dark = false, label, labelColor, blur } = {}) {
      this.sw = sw; this.sh = sw * SH / SW;
      const b = Math.round(sw * 0.032), sb = Math.round(sw * 0.068), r = Math.round(sw * 0.14);
      this.w = sw + 2 * b; this.h = this.sh + sb + 2 * b;
      this.root = h('div', 'phone' + (dark ? ' ph-dark' : ''), parent);
      css(this.root, { width: this.w + 'px', height: this.h + 'px', '--b': b + 'px', '--sb': sb + 'px', '--r': r + 'px' });
      const body = h('div', 'ph-body', this.root);
      h('div', 'ph-btn', this.root).style.cssText = `top:${this.h * 0.22}px;height:${this.h * 0.07}px`;
      h('div', 'ph-btn', this.root).style.cssText = `top:${this.h * 0.32}px;height:${this.h * 0.12}px`;
      const scr = h('div', 'ph-screen', body);
      h('div', 'ph-status', scr, `<span>9:41</span><span class="cam"></span><span class="icons"><i style="width:${sb * .3}px;height:${sb * .22}px;border-radius:50% 50% 0 0"></i><i style="width:${sb * .28}px;height:${sb * .28}px;clip-path:polygon(100% 0,100% 100%,0 100%)"></i><i style="width:${sb * .5}px;height:${sb * .26}px"></i></span>`);
      this.view = h('div', 'ph-view', scr);
      this.s = sw / SW; // css px of app → stage px
      if (clip) { this.clip = new Clip(this.view, clip); if (still != null) this.still = still; }
      if (image) this.image = img(this.view, image);
      this.taps = h('div', '', this.view); css(this.taps, { position: 'absolute', inset: 0 });
      this.tapEl = h('div', 'tap', this.taps, '<div class="ring"></div><div class="dot"></div>');
      this.hl = h('div', 'ph-hl', this.view); op(this.hl, 0);
      if (blur) { const [x, y, w, hh] = blur; const bl = h('div', '', this.view); css(bl, { position: 'absolute', left: x * this.s + 'px', top: y * this.s + 'px', width: w * this.s + 'px', height: hh * this.s + 'px', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', borderRadius: '8px', zIndex: 2 }); }
      h('div', 'ph-glare', this.root);
      if (label) this.label = h('div', 'ph-label', this.root, `<i style="background:${labelColor || '#3FB98B'}"></i>${label}`);
      op(this.tapEl, 0);
    }
    // place centre at (x,y) with extra transform
    at(x, y, { s = 1, ry = 0, rx = 0, rz = 0, z = 0 } = {}) {
      tf(this.root, `translate3d(${x - this.w / 2}px,${y - this.h / 2}px,${z}px) perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`);
    }
    play(ct, rate = 1) {
      if (!this.clip) return;
      const t = this.still != null ? this.still : ct;
      this.clip.set(t, this.still != null ? 0 : rate);
      // tap indicators
      let shown = false;
      for (const tp of this.clip.m.taps) {
        const d = t - tp.t;
        if (d > -0.35 && d < 0.65) {
          const pre = seg(d, -0.35, 0), post = seg(d, 0, 0.65);
          css(this.tapEl, { left: tp.x * this.s + 'px', top: tp.y * this.s + 'px' });
          tf(this.tapEl.firstChild, `scale(${0.6 + post * 1.6})`); op(this.tapEl.firstChild, d < 0 ? 0 : 1 - post);
          tf(this.tapEl.lastChild, `scale(${d < 0 ? 0.6 + 0.4 * E.out3(pre) : 1 - 0.25 * post})`);
          op(this.tapEl.lastChild, d < 0 ? E.out3(pre) : 1 - E.in3(post));
          shown = true; break;
        }
      }
      op(this.tapEl, shown ? 1 : 0);
    }
    highlight(rect, p) {
      if (!rect) return;
      const [x, y, w, hh] = rect;
      css(this.hl, { left: x * this.s + 'px', top: y * this.s + 'px', width: w * this.s + 'px', height: hh * this.s + 'px' });
      op(this.hl, p);
    }
    sleep() { this.clip && this.clip.sleep(); }
  }

  // Magnified live region of a clip.
  class Lens {
    constructor(parent, clipName, rect, k = 1.3, tag) {
      this.rect = rect; this.k = k;
      const [x, y, w, hh] = rect;
      this.w = w * k; this.h = hh * k;
      this.root = h('div', 'lens', parent); css(this.root, { width: this.w + 'px', height: this.h + 'px' });
      const inner = h('div', 'inner', this.root); css(inner, { width: SW + 'px', height: SH + 'px', transform: `scale(${k}) translate(${-x}px,${-y}px)` });
      this.clip = new Clip(inner, clipName);
      if (tag) h('div', 'tag', this.root, tag);
    }
    at(cx, cy, s = 1, extra = '') { tf(this.root, `translate3d(${cx - this.w / 2}px,${cy - this.h / 2}px,0) ${extra} scale(${s})`); }
  }

  // ---------- text ----------
  class Title {
    constructor(parent, text, cls = 'title') {
      this.root = h('div', cls, parent);
      this.words = [];
      const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
      for (const part of parts) {
        const hl = part.startsWith('*');
        const txt = hl ? part.slice(1, -1) : part;
        txt.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) { this.root.appendChild(document.createTextNode(' ')); return; }
          const s = h('span', 'w' + (hl ? ' hl' : ''), this.root, w);
          this.words.push(s);
        });
      }
    }
    update(t, start, { stagger = 0.06, dur = 0.75, dy = 0.55, blur = 10 } = {}) {
      this.words.forEach((w, i) => {
        const p = E.out3(seg(t, start + i * stagger, start + i * stagger + dur));
        tf(w, `translate3d(0,${(1 - p) * dy}em,0) rotate(${(1 - p) * 4}deg)`);
        op(w, p); fl(w, p >= 1 ? 'none' : `blur(${(1 - p) * blur}px)`);
      });
    }
  }
  const fadeUp = (e, t, start, dur = 0.7, dy = 30) => {
    const p = E.out3(seg(t, start, start + dur));
    tf(e, `translate3d(0,${(1 - p) * dy}px,0)`); op(e, p);
    return p;
  };

  // ---------- backgrounds ----------
  const BG = {
    cream: { base: 'linear-gradient(160deg,#F7F5EE,#EEF3EC 60%,#F4EFE5)', blobs: ['#9fd9be', '#ffd3a8', '#bfe3d1'], dots: 1 },
    mint: { base: 'linear-gradient(160deg,#EAF5EE,#DDEFE4 55%,#F2F7F0)', blobs: ['#7fd6b0', '#b9e6cf', '#ffe1bd'], dots: 1 },
    warm: { base: 'linear-gradient(160deg,#FFF6EB,#FCEBD9 55%,#FFF4E8)', blobs: ['#ffc48a', '#ffdcb4', '#f9a77a'], dots: 1 },
    festive: { base: 'linear-gradient(160deg,#FFF7EC,#FFEBD6 55%,#FFF1F2)', blobs: ['#ffc34d', '#f7a3bf', '#ffb27a'], dots: 1 },
    night: { base: 'radial-gradient(ellipse at 30% 20%,#0d1a24,#05080c 70%)', blobs: ['#1D9E75', '#534AB7', '#185FA5'], dark: 1, stars: 1 },
    deep: { base: 'radial-gradient(ellipse at 50% 35%,#0d4a37,#052a1f 55%,#03160f)', blobs: ['#1D9E75', '#0E6B4E', '#E8650A'], dark: 1, dots: 1 },
  };
  class Bg {
    constructor(parent, kind) {
      const k = BG[kind] || BG.cream; this.k = k;
      this.root = h('div', 'bg', parent); this.root.style.background = k.base;
      this.blobs = k.blobs.map((c, i) => {
        const b = h('div', 'blob', this.root);
        css(b, { width: [1100, 960, 880][i] + 'px', height: [1100, 960, 880][i] + 'px', background: `radial-gradient(circle at 50% 50%, ${c} 0%, ${c}cc 18%, ${c}55 42%, ${c}00 70%)`, opacity: k.dark ? 0.42 : 0.62 });
        return b;
      });
      if (k.dots) h('div', 'dots' + (k.dark ? ' light' : ''), this.root);
      if (k.stars) {
        const r = rng(7); this.stars = [];
        for (let i = 0; i < 70; i++) {
          const s = h('i', '', this.root); const z = r();
          css(s, { position: 'absolute', left: r() * 2000 + 'px', top: r() * 1160 + 'px', width: 1 + z * 2.4 + 'px', height: 1 + z * 2.4 + 'px', borderRadius: '50%', background: '#fff', opacity: 0.15 + z * 0.5 });
          this.stars.push([s, r() * 6.28, 0.5 + r()]);
        }
      }
    }
    update(T) {
      const pos = [[0.15, 0.2], [0.85, 0.75], [0.6, 0.15]];
      this.blobs.forEach((b, i) => {
        const [px, py] = pos[i];
        const x = px * W - 550 + Math.sin(T * 0.21 + i * 2.1) * 140, y = py * H - 550 + Math.cos(T * 0.17 + i * 1.3) * 110;
        tf(b, `translate3d(${x}px,${y}px,0) scale(${1 + 0.08 * Math.sin(T * 0.3 + i)})`);
      });
      if (this.stars) this.stars.forEach(([s, ph, sp]) => op(s, 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(T * sp + ph))));
    }
  }

  // ---------- logo ----------
  function Logo(parent, size) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '-130 -130 260 260'); svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.style.position = 'absolute'; svg.style.overflow = 'visible';
    parent.appendChild(svg);
    const mk = (tag, attrs, p = svg) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); p.appendChild(e); return e; };
    const ring = mk('circle', { r: 118, fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1, 'stroke-dasharray': '742', 'stroke-dashoffset': '742' });
    const petals = PETALS.map((c, i) => {
      const g = mk('g', {});
      mk('ellipse', { cx: 0, cy: -58, rx: 22, ry: 58, fill: c, opacity: 0.92 }, g);
      return { g, a: i * 45 };
    });
    const dots = PETALS.map((c, i) => { const a = (i * 45 - 90) * Math.PI / 180; return mk('circle', { cx: Math.cos(a) * 115, cy: Math.sin(a) * 115, r: 4, fill: c, opacity: 0 }); });
    const core = mk('g', {});
    mk('circle', { r: 54, fill: '#fff', opacity: 0.94 }, core);
    PETALS.forEach((c, i) => { const g = mk('g', { transform: `rotate(${i * 45})` }, core); mk('ellipse', { cx: 0, cy: -33, rx: 13, ry: 19, fill: c, opacity: 0.28 }, g); });
    const c1 = mk('circle', { r: 22, fill: '#1a1a1a' }), c2 = mk('circle', { r: 14, fill: '#E8650A' }), c3 = mk('circle', { r: 6, fill: '#fff' }), c4 = mk('circle', { r: 2.5, fill: '#E8650A' });
    return {
      svg,
      update(t, speed = 1) {
        // t = local seconds since bloom start
        t *= speed;
        petals.forEach((p, i) => {
          const q = E.outBack(seg(t, 0.12 * i, 0.12 * i + 0.7));
          p.g.setAttribute('transform', `rotate(${p.a - (1 - q) * 70}) scale(${Math.max(0.001, q)})`);
          p.g.style.opacity = clamp(q * 1.5);
        });
        const d = E.outBack(seg(t, 0.75, 1.3));
        core.style.transform = `scale(${Math.max(0.001, d)})`; core.style.opacity = clamp(d);
        const c = E.outBack(seg(t, 1.0, 1.5));
        [c1, c2, c3, c4].forEach((e, i) => { e.style.transform = `scale(${Math.max(0.001, c)})`; });
        ring.setAttribute('stroke-dashoffset', 742 * (1 - E.io3(seg(t, 0.4, 1.8))));
        dots.forEach((e, i) => e.setAttribute('opacity', 0.6 * seg(t, 1.2 + i * 0.05, 1.5 + i * 0.05)));
      },
      setRing(color) { ring.setAttribute('stroke', color); },
    };
  }

  // ---------- reusable bits ----------
  function Kicker(parent, chap, text) {
    const k = h('div', 'kicker', parent);
    if (chap) h('span', 'num', k, chap);
    const bar = h('span', 'bar', k); PETALS.slice(0, 4).forEach((c) => (h('i', '', bar).style.background = c));
    h('span', '', k, text);
    return k;
  }
  function Caps(parent, list, dark) {
    const wrap = h('div', 'caps', parent);
    return list.map(([at, text, ic], i) => {
      const c = h('div', 'cap', wrap, `<span class="ic" style="background:${PETALS[(i * 3 + 2) % 8]}">${icon(ic)}</span><span>${text}</span>`);
      return { el: c, at };
    });
  }
  const capsUpdate = (caps, t) => caps.forEach(({ el, at }) => {
    const p = E.out3(seg(t, at, at + 0.6));
    tf(el, `translate3d(${(1 - p) * -40}px,0,0)`); op(el, p);
  });

  // ---------- scene: phone (1–2 phones + copy) ----------
  function scPhone(root, cfg) {
    const bg = new Bg(root, cfg.bg);
    const dark = !!BG[cfg.bg]?.dark;
    root.classList.add(cfg.bg); if (dark) root.classList.add('on-dark');
    const right = cfg.side === 'right';
    const Cx = right ? 1395 : 525;
    const col = h('div', 'col', root); css(col, { left: (right ? 150 : 1060) + 'px', width: '720px' });
    const kick = Kicker(col, cfg.chap, cfg.kicker);
    const title = new Title(col, cfg.title);
    const sub = cfg.sub ? h('div', 'sub', col, cfg.sub) : null;
    const caps = Caps(col, cfg.caps || []);
    let extra = null;
    const phones = cfg.phones.map((p, i) => new Phone(root, { sw: 384, clip: p.clip, still: p.still, image: p.image }));
    if (cfg.extra) extra = EXTRAS[cfg.extra.type](root, cfg, col, Cx, right);
    let lens = null;
    if (cfg.lens) lens = new Lens(root, cfg.lens.clip, cfg.lens.rect, 1.32);
    const second = cfg.phones[1];
    return {
      update(t, T) {
        bg.update(T);
        fadeUp(kick, t, 0.25, 0.6, 20);
        title.update(t, 0.35);
        if (sub) fadeUp(sub, t, 0.9, 0.8, 24);
        capsUpdate(caps, t);
        // main phone
        const pin = E.out5(seg(t, 0.05, 1.2));
        const dir = right ? 1 : -1;
        let x = Cx, s = 1, ry = -dir * 9, bright = 1;
        if (second) {
          const q = E.io3(seg(t, second.enter, second.enter + 0.9));
          x = Cx - dir * 150 * q; s = 1 - 0.1 * q; ry = lerp(-dir * 9, -dir * 18, q); bright = 1 - 0.22 * q;
        }
        const floatY = Math.sin(T * 0.9) * 6;
        phones[0].at(x + dir * (1 - pin) * 260, 540 + (1 - pin) * 520 + floatY, { s: s * (0.9 + 0.1 * pin), ry: ry + dir * (1 - pin) * 30, rx: (1 - pin) * 14 });
        fl(phones[0].root, bright < 1 ? `brightness(${bright})` : 'none');
        const m0 = cfg.phones[0];
        const ct0 = m0.map ? pw(m0.map, t) : Math.max(0, t - 0.6);
        phones[0].play(ct0, m0.map ? slope(m0.map, t) : 1);
        if (second) {
          const q = E.out5(seg(t, second.enter, second.enter + 1.1));
          const x2 = Cx + dir * 135 + dir * (1 - q) * 900;
          phones[1].at(x2, 560 + floatY * -0.8 + (1 - q) * 60, { s: 0.96, ry: -dir * 6 + dir * (1 - q) * 25, rz: dir * (1 - q) * 6 });
          vis(phones[1].root, q > 0);
          const ct1 = second.map ? pw(second.map, t) : Math.max(0, t - second.enter);
          phones[1].play(ct1, second.map ? slope(second.map, t) : 1);
        }
        if (lens) {
          const L = cfg.lens; const q = E.outBack(seg(t, L.at, L.at + 0.8)), qa = seg(t, L.at, L.at + 0.4);
          const lx = Cx + dir * 205, ly = 560 + Math.sin(T * 0.8 + 1) * 5;
          lens.at(lx - dir * (1 - q) * 120, ly + (1 - q) * 40, 0.55 + 0.45 * q);
          op(lens.root, qa); vis(lens.root, qa > 0);
          lens.clip.set(L.t != null && L.clip !== m0.clip ? L.t : (L.clip === m0.clip ? ct0 : L.t), 0);
          const src = phones.find((p) => p.clip && p.clip.name === L.clip) || phones[0];
          src.highlight(L.rect, qa * 0.9);
        }
        if (extra) extra.update(t, T);
      },
      sleep() { phones.forEach((p) => p.sleep()); lens && lens.clip.sleep(); },
    };
  }

  // ---------- extras ----------
  const EXTRAS = {
    orderFlow(root, cfg, col) {
      const box = h('div', '', col); css(box, { marginTop: '40px', position: 'relative', height: '120px', width: '680px' });
      const steps = [['Placed', 'list'], ['Accepted', 'check'], ['Cooking', 'food'], ['Delivered', 'home']];
      const line = h('div', '', box); css(line, { position: 'absolute', left: '40px', right: '40px', top: '38px', height: '6px', borderRadius: '3px', background: 'rgba(14,107,78,.15)' });
      const fill = h('div', '', line); css(fill, { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0%', borderRadius: '3px', background: 'linear-gradient(90deg,#E8650A,#F08A2C)' });
      const nodes = steps.map(([s, ic], i) => {
        const n = h('div', '', box); css(n, { position: 'absolute', left: (40 + i * 200) - 40 + 'px', top: 0, width: '80px', textAlign: 'center' });
        const c = h('div', '', n, icon(ic)); css(c, { width: '80px', height: '80px', borderRadius: '24px', display: 'grid', placeItems: 'center', background: '#fff', color: '#E8650A', boxShadow: '0 14px 30px -14px rgba(0,0,0,.35)' });
        c.firstChild.style.cssText = 'width:34px;height:34px';
        h('div', '', n, s).style.cssText = "font:700 20px/1 Hanken;margin-top:14px;color:#0F1A15;white-space:nowrap;margin-left:-20px;margin-right:-20px";
        return { n, c };
      });
      const at = cfg.extra.at;
      return {
        update(t) {
          op(box, seg(t, at - 0.2, at + 0.3));
          fill.style.width = E.io3(seg(t, at + 0.2, at + 2.6)) * 100 + '%';
          nodes.forEach(({ n, c }, i) => {
            const p = E.outBack(seg(t, at + i * 0.75, at + i * 0.75 + 0.5));
            tf(n, `scale(${0.6 + 0.4 * p})`); op(n, clamp(p * 1.4));
            const on = t > at + i * 0.75 + 0.2;
            css(c, { background: on ? '#E8650A' : '#fff', color: on ? '#fff' : '#E8650A' });
          });
        },
      };
    },
    langs(root, cfg, col) {
      const L = [['नमस्ते', 'Hindi'], ['ನಮಸ್ಕಾರ', 'Kannada'], ['வணக்கம்', 'Tamil'], ['నమస్కారం', 'Telugu'], ['নমস্কার', 'Bengali'], ['नमस्कार', 'Marathi'], ['നമസ്കാരം', 'Malayalam'], ['નમસ્તે', 'Gujarati'], ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'Punjabi'], ['ନମସ୍କାର', 'Odia'], ['آداب', 'Urdu'], ['Hello', 'English']];
      const box = h('div', '', col); css(box, { marginTop: '38px', position: 'relative', height: '150px', width: '700px' });
      const items = L.map(([w, n]) => {
        const e = h('div', '', box, `<div style="font:600 78px/1.1 Indic, Bricolage;color:#fff;white-space:nowrap">${w}</div><div style="font:700 20px/1 Hanken;letter-spacing:.2em;text-transform:uppercase;color:#7fd6b0;margin-top:10px">${n}</div>`);
        css(e, { position: 'absolute', left: 0, top: 0 });
        return e;
      });
      const at = cfg.extra.at, step = Math.max(0.42, (cfg.dur - at - 1.2) / L.length);
      return {
        update(t) {
          items.forEach((e, i) => {
            const a = at + i * step;
            const pin = E.out3(seg(t, a, a + 0.3)), pout = i === L.length - 1 ? 0 : E.in3(seg(t, a + step - 0.1, a + step + 0.2));
            tf(e, `translate3d(0,${(1 - pin) * 50 - pout * 50}px,0)`); op(e, pin * (1 - pout)); fl(e, `blur(${(1 - pin + pout) * 8}px)`);
          });
        },
      };
    },
    money(root, cfg, col, Cx, right) {
      const dir = right ? 1 : -1;
      const card = h('div', 'card', root); css(card, { width: '520px' });
      card.innerHTML = `<h4>Ganesh Chaturthi 2026 · Collecting</h4>
        <div style="display:flex;gap:26px;align-items:flex-end">
          <div><div style="font:600 18px Hanken;color:#55625B">Collected</div><div class="v" style="font:800 64px/1 Bricolage;letter-spacing:-.02em;color:#0E6B4E">₹0</div></div>
          <div style="margin-left:auto;text-align:right"><div style="font:600 18px Hanken;color:#55625B">Budget</div><div style="font:800 30px/1.2 Bricolage">₹50,000</div></div>
        </div>
        <div style="height:14px;border-radius:7px;background:#E7EEE9;margin:22px 0 12px;overflow:hidden"><div class="f" style="height:100%;width:0;border-radius:7px;background:linear-gradient(90deg,#0E6B4E,#3FB98B)"></div></div>
        <div style="display:flex;justify-content:space-between;font:600 20px Hanken;color:#55625B"><span class="fl">0 flats contributed</span><span class="pc">0%</span></div>`;
      const v = card.querySelector('.v'), f = card.querySelector('.f'), flats = card.querySelector('.fl'), pc = card.querySelector('.pc');
      const at = cfg.extra.at;
      return {
        update(t, T) {
          const q = E.outBack(seg(t, at, at + 0.8)), a = seg(t, at, at + 0.35);
          tf(card, `translate3d(${Cx + dir * 200 - 260 - dir * (1 - q) * 120}px,${640 + Math.sin(T * 0.8) * 5}px,0) scale(${0.6 + 0.4 * q})`);
          op(card, a); vis(card, a > 0);
          const c = E.out3(seg(t, at + 0.3, at + 2.6));
          v.textContent = fmtINR(42401 * c); f.style.width = 85 * c + '%';
          flats.textContent = Math.round(23 * c) + ' flats contributed'; pc.textContent = Math.round(85 * c) + '%';
        },
      };
    },
    ledger(root, cfg, col, Cx, right) {
      const dir = right ? 1 : -1;
      const card = h('div', 'card', root); css(card, { width: '470px', padding: '26px 28px' });
      const rows = [['Pratibha P.', 'Butter Chicken', 250], ['Manjunath N.', 'Car pooling', 200], ['Ashif S.', 'Butter Chicken', 250]];
      card.innerHTML = `<h4>UPI ledger</h4>` + rows.map(([n, w, a], i) => `<div class="r" style="display:flex;align-items:center;gap:14px;padding:12px 0;border-top:${i ? '1px solid #EEF1EE' : '0'}">
        <div style="width:46px;height:46px;border-radius:50%;background:${PETALS[i * 3 % 8]};color:#fff;display:grid;place-items:center;font:700 17px Hanken">${n.split(' ').map((x) => x[0]).join('')}</div>
        <div style="flex:1"><div style="font:700 21px Hanken">${n}</div><div style="font:500 17px Hanken;color:#55625B">${w}</div></div>
        <div style="text-align:right"><div style="font:800 24px Bricolage">₹${a}</div><div class="ok" style="font:700 13px Hanken;letter-spacing:.1em;color:#0E6B4E;background:#DCEBE2;border-radius:6px;padding:4px 7px;margin-top:4px;opacity:0">✓ RECEIVED</div></div></div>`).join('');
      const rs = [...card.querySelectorAll('.r')], oks = [...card.querySelectorAll('.ok')];
      const at = cfg.extra.at;
      return {
        update(t, T) {
          const q = E.outBack(seg(t, at, at + 0.8)), a = seg(t, at, at + 0.35);
          tf(card, `translate3d(${Cx + dir * 215 - 235 - dir * (1 - q) * 120}px,${300 + Math.sin(T * 0.8) * 5}px,0) scale(${0.6 + 0.4 * q})`);
          op(card, a); vis(card, a > 0);
          rs.forEach((r, i) => fadeUp(r, t, at + 0.3 + i * 0.25, 0.5, 16));
          oks.forEach((o, i) => { const p = E.outBack(seg(t, at + 1.3 + i * 0.35, at + 1.7 + i * 0.35)); op(o, clamp(p)); tf(o, `scale(${0.5 + 0.5 * p})`); });
        },
      };
    },
  };

  // ---------- scene: intro ----------
  function scIntro(root, cfg) {
    const bg = h('div', 'bg', root); bg.style.background = 'radial-gradient(ellipse at 50% 45%,#0b3427,#03120d 60%,#010806)';
    const r = rng(3); const motes = [];
    for (let i = 0; i < 60; i++) { const m = h('i', '', root); const z = r(); css(m, { position: 'absolute', left: r() * W + 'px', top: r() * H + 'px', width: 2 + z * 4 + 'px', height: 2 + z * 4 + 'px', borderRadius: '50%', background: PETALS[i % 8], opacity: 0, filter: `blur(${(1 - z) * 2}px)` }); motes.push([m, z, r() * 6.28]); }
    const glow = h('div', '', root); css(glow, { position: 'absolute', left: '610px', top: '190px', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(232,101,10,.32),rgba(232,101,10,.12) 35%,transparent 65%)' });
    const holder = h('div', '', root); css(holder, { position: 'absolute', left: '960px', top: '470px', width: 0, height: 0 });
    const logo = Logo(holder, 360); css(logo.svg, { left: '-180px', top: '-180px' });
    const word = h('div', '', root); css(word, { position: 'absolute', left: 0, right: 0, top: '690px', textAlign: 'center', font: "800 150px/1 'Bricolage'", color: '#fff', letterSpacing: '-.03em' });
    const letters = [...'Aangan'].map((c) => h('span', '', word, c));
    letters.forEach((l) => (l.style.display = 'inline-block'));
    const dev = h('div', '', root, 'आँगन <span style="opacity:.5">·</span> <span style="font-family:Hanken;letter-spacing:.32em">YOUR COURTYARD</span>');
    css(dev, { position: 'absolute', left: 0, right: 0, top: '860px', textAlign: 'center', font: "600 30px/1 Indic, Hanken", color: '#7fd6b0', letterSpacing: '.08em' });
    const bars = h('div', '', root); css(bars, { position: 'absolute', left: '50%', top: '920px', marginLeft: '-140px', width: '280px', display: 'flex', gap: '6px' });
    const barEls = PETALS.map((c) => { const b = h('i', '', bars); css(b, { flex: 1, height: '5px', borderRadius: '3px', background: c, display: 'block', transformOrigin: 'left' }); return b; });
    const tag = h('div', '', root, 'every home. every language. one courtyard.');
    css(tag, { position: 'absolute', left: 0, right: 0, top: '958px', textAlign: 'center', font: "500 26px/1 'Hanken'", color: 'rgba(255,255,255,.55)', letterSpacing: '.12em' });
    const k = 9 / cfg.dur;
    return {
      update(t0, T) {
        const t = t0 * k;
        motes.forEach(([m, z, ph]) => { op(m, seg(t, 0.2, 2) * (0.25 + 0.5 * z) * (0.6 + 0.4 * Math.sin(T * 1.3 + ph))); tf(m, `translate3d(${Math.sin(T * 0.3 + ph) * 30 * z}px,${-T * 18 * z}px,0)`); });
        logo.update(t - 0.4, 1);
        const lift = E.io3(seg(t, 2.6, 3.6));
        tf(holder, `translate3d(0,${-lift * 120}px,0) scale(${1 - 0.25 * lift}) rotate(${t * 6}deg)`);
        op(glow, 0.4 + 0.6 * seg(t, 0.5, 2)); tf(glow, `translate3d(0,${-lift * 120}px,0) scale(${0.8 + 0.2 * Math.sin(T * 1.6)})`);
        letters.forEach((l, i) => { const p = E.out5(seg(t, 3.0 + i * 0.07, 3.8 + i * 0.07)); tf(l, `translate3d(0,${(1 - p) * 80}px,0) rotate(${(1 - p) * 8}deg)`); op(l, p); fl(l, `blur(${(1 - p) * 12}px)`); });
        tf(word, `translate3d(0,${-lift * 150}px,0)`);
        fadeUp(dev, t, 3.9, 0.8); dev.style.marginTop = -lift * 150 + 'px';
        barEls.forEach((b, i) => { const p = E.out3(seg(t, 4.3 + i * 0.06, 4.9 + i * 0.06)); tf(b, `scaleX(${p})`); });
        bars.style.marginTop = -lift * 150 + 'px';
        fadeUp(tag, t, 5.0, 0.9); tag.style.marginTop = -lift * 150 + 'px';
      },
    };
  }

  // ---------- scene: problem ----------
  function scProblem(root, cfg) {
    const bg = h('div', 'bg', root); bg.style.background = 'radial-gradient(ellipse at 70% 50%,#14211c,#070b09 70%)';
    const S = cfg.short;
    const msgs = ['Anyone has a good plumber’s number?', 'Water tanker coming today??', '+1', '+1', 'Who parked in front of C-204 again', 'Selling kids cycle, barely used. DM', 'Ganesh puja contribution kahan dena hai?', 'Lost: keys with an elephant keychain', 'Is the gym open tomorrow?', 'Need a maths tutor for class 8', 'Veg tiffin service anyone?', '+1', 'Good morning 🌸🙏', 'Can someone share the security number?', 'Any 2BHK for rent here?', 'Badminton tonight 9PM?', 'Ok', '👍', 'Who is collecting for Diwali?', 'Electrician urgently needed!!', 'Plz check above msg', 'Lift not working in B block', 'Admin please add my neighbour', 'Same question as above', 'Is the water back??', 'Forwarded as received'];
    const flats = ['A-101', 'B-204', 'C-12', 'Flat 149', 'D-310', 'B-46', 'Flat 209', 'A-1102', 'C-707', 'Flat 31'];
    const r = rng(11);
    const zone = h('div', '', root); css(zone, { position: 'absolute', inset: 0 });
    const n = S ? 18 : 26;
    const end = cfg.dur - (S ? 2.6 : 3.6);
    const bubbles = msgs.slice(0, n).map((m, i) => {
      const b = h('div', '', zone, `<div style="font:700 15px Hanken;color:${PETALS[i % 8]};margin-bottom:5px">${flats[i % flats.length]}</div><div>${m}</div><div style="text-align:right;font:500 13px Hanken;color:rgba(255,255,255,.4);margin-top:4px">${8 + (i % 4)}:${String(10 + i * 2).padStart(2, '0')} pm ✓✓</div>`);
      const w = 230 + Math.min(260, m.length * 8);
      css(b, { position: 'absolute', left: 0, top: 0, maxWidth: w + 'px', padding: '14px 18px 10px', borderRadius: '18px 18px 18px 4px', background: i % 3 === 0 ? '#1f5140' : '#1d2522', color: 'rgba(255,255,255,.9)', font: "500 22px/1.3 'Hanken'", boxShadow: '0 20px 40px -20px rgba(0,0,0,.8)' });
      const x = 880 + r() * 900, y = 60 + r() * 900;
      return { b, x: Math.min(x, 1880 - w), y: Math.min(y, 980), at: 0.5 + (i / n) * (end - 1.6) + r() * 0.3, rot: (r() - 0.5) * 8, ph: r() * 6 };
    });
    const col = h('div', 'col on-dark', root); css(col, { left: '140px', width: '780px' });
    const lines = (S ? [['400 flats.', 0.4], ['14 WhatsApp groups.', 1.6], ['3,248 unread.', 2.8]] : [['400 flats.', 0.5], ['14 WhatsApp groups.', 2.4], ['3,248 unread.', 4.4], ['And nobody knows *who the plumber is*.', 7.2]])
      .map(([tx, at], i) => { const T2 = new Title(col, tx, 'title'); css(T2.root, { fontSize: i === 3 ? '58px' : '92px', marginBottom: '18px', color: '#fff' }); return { T2, at }; });
    const unread = lines[2].T2.words[0];
    const fin = h('div', '', root); css(fin, { position: 'absolute', left: 0, right: 0, top: '470px', textAlign: 'center' });
    const finT = new Title(fin, 'There’s a *better way*.'); css(finT.root, { fontSize: '120px', color: '#fff' });
    return {
      update(t, T) {
        const suck = E.in3(seg(t, end, end + 1.1));
        bubbles.forEach(({ b, x, y, at, rot, ph }) => {
          const p = E.outBack(seg(t, at, at + 0.45));
          const fx = x + Math.sin(T * 0.7 + ph) * 8, fy = y + Math.cos(T * 0.6 + ph) * 8;
          const cx = lerp(fx, 960, suck), cy = lerp(fy, 540, suck);
          tf(b, `translate3d(${cx}px,${cy}px,0) rotate(${rot + suck * 200}deg) scale(${(0.5 + 0.5 * p) * (1 - suck)})`);
          op(b, clamp(p * 1.5) * (1 - suck * 0.6)); vis(b, p > 0 && suck < 1);
        });
        lines.forEach(({ T2, at }) => T2.update(t, at, { stagger: 0.08 }));
        const c = E.out3(seg(t, lines[2].at, lines[2].at + 1.6));
        unread.textContent = Math.round(3248 * c).toLocaleString('en-IN');
        unread.style.color = '#ff6b5a';
        op(col, 1 - seg(t, end - 0.2, end + 0.4));
        tf(col, `translate3d(${-seg(t, end - 0.2, end + 0.6) * 80}px,0,0)`);
        finT.update(t, end + 0.6, { stagger: 0.1 });
      },
    };
  }

  // ---------- scene: reveal ----------
  function scReveal(root, cfg) {
    const bg = new Bg(root, 'cream');
    const k = 9 / cfg.dur;
    const q = h('div', '', root); css(q, { position: 'absolute', left: 0, right: 0, top: '420px', textAlign: 'center' });
    const qT = new Title(q, 'What if your society had *one courtyard*?'); css(qT.root, { fontSize: '96px', padding: '0 120px' });
    const col = h('div', 'col', root); css(col, { left: '170px', width: '820px' });
    const brand = h('div', '', col); css(brand, { position: 'relative', height: '150px', display: 'flex', alignItems: 'center', gap: '28px' });
    const lh = h('div', '', brand); css(lh, { position: 'relative', width: '130px', height: '130px', flex: 'none' });
    const logo = Logo(lh, 130); css(logo.svg, { left: 0, top: 0 }); logo.setRing('rgba(14,107,78,.25)');
    const word = h('div', '', brand, 'Aangan'); css(word, { font: "800 150px/1 'Bricolage'", letterSpacing: '-.03em', color: '#0F1A15' });
    const tg = new Title(col, 'Everything neighbours do for each other — *in one private app*.'); css(tg.root, { fontSize: '58px', marginTop: '34px' });
    const chips = h('div', '', col); css(chips, { display: 'flex', gap: '14px', marginTop: '40px', flexWrap: 'wrap' });
    const ch = [['Only your society', 'shield'], ['Free for residents', 'heart'], ['No ads, ever', 'eye']].map(([tx, ic], i) => {
      const c = h('div', '', chips, `<span style="width:30px;height:30px;color:${PETALS[i * 2]}">${icon(ic)}</span>${tx}`);
      css(c, { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 22px', borderRadius: '18px', background: '#fff', font: "700 24px/1 'Hanken'", boxShadow: '0 16px 30px -18px rgba(0,0,0,.3)' });
      c.firstChild.firstChild.style.cssText = 'width:30px;height:30px'; return c;
    });
    const ph = new Phone(root, { sw: 392, clip: 'onboard', still: 0.4 });
    return {
      update(t0, T) {
        const t = t0 * k;
        bg.update(T);
        qT.update(t, 0.2, { stagger: 0.07 });
        const qo = E.io3(seg(t, 2.4, 3.1));
        tf(q, `translate3d(0,${-qo * 120}px,0) scale(${1 - 0.1 * qo})`); op(q, 1 - qo);
        const p = E.out5(seg(t, 2.7, 4.2));
        ph.at(1390, 545 + (1 - p) * 700 + Math.sin(T) * 6, { ry: -12 + (1 - p) * -30, rx: (1 - p) * 25, s: 0.9 + 0.1 * p });
        ph.play(0);
        logo.update(t - 3.0, 1.3);
        const wp = E.out5(seg(t, 3.3, 4.2)); tf(word, `translate3d(${(1 - wp) * -60}px,0,0)`); op(word, wp); fl(word, `blur(${(1 - wp) * 10}px)`);
        tg.update(t, 4.1, { stagger: 0.05 });
        ch.forEach((c, i) => { const pp = E.outBack(seg(t, 5.6 + i * 0.2, 6.2 + i * 0.2)); tf(c, `scale(${0.7 + 0.3 * pp})`); op(c, clamp(pp)); });
      },
      sleep() { ph.sleep(); },
    };
  }

  // ---------- scene: categories ----------
  function scCategories(root, cfg) {
    const bg = new Bg(root, cfg.bg); root.classList.add('on-dark');
    const cats = [['🍲', 'Home Food'], ['🍱', 'Tiffins'], ['📚', 'Tuitions'], ['🧵', 'Tailoring'], ['🧾', 'Income Tax'], ['🩺', 'Clinic'], ['🍛', 'Catering'], ['🎉', 'Decoration'], ['💼', 'Job Referral'], ['🛍️', 'Buy & Sell'], ['🔧', 'Service Directory'], ['🧸', 'Day Care'], ['🧘', 'Yoga & Fitness'], ['🎨', 'Arts & Activities'], ['🔮', 'Astrology'], ['🚗', 'Carpooling']];
    const col = h('div', '', root); css(col, { position: 'absolute', left: '130px', top: '96px', width: '1200px' });
    const kick = Kicker(col, cfg.chap, cfg.kicker);
    const title = new Title(col, cfg.title); css(title.root, { fontSize: '68px' });
    const grid = h('div', '', root); css(grid, { position: 'absolute', left: '130px', top: '370px', width: '1150px', height: '640px' });
    const r = rng(5);
    const tiles = cats.map(([e, n], i) => {
      const c = i % 4, rr = Math.floor(i / 4);
      const el = h('div', '', grid, `<div style="width:62px;height:62px;border-radius:18px;display:grid;place-items:center;font-size:34px;background:${PETALS[i % 8]}">${e}</div><div style="font:700 25px/1.15 Hanken;color:#fff">${n}</div>`);
      css(el, { position: 'absolute', left: c * 288 + 'px', top: rr * 156 + 'px', width: '268px', height: '136px', padding: '20px', borderRadius: '26px', background: 'rgba(255,255,255,.08)', boxShadow: '0 0 0 1px rgba(255,255,255,.12) inset', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' });
      return { el, sx: (r() - 0.5) * 2400, sy: (r() - 0.5) * 1400, rot: (r() - 0.5) * 120, d: r() * 0.4 };
    });
    const ph = new Phone(root, { sw: 360, clip: cfg.phones[0].clip });
    const S = cfg.short ? 0.6 : 1;
    return {
      update(t, T) {
        bg.update(T);
        fadeUp(kick, t, 0.2, 0.6, 20); title.update(t, 0.3);
        tiles.forEach(({ el, sx, sy, rot, d }, i) => {
          const a = 0.7 + i * 0.09 * S + d * S;
          const p = E.out5(seg(t, a, a + 1.0));
          tf(el, `translate3d(${(1 - p) * sx}px,${(1 - p) * sy}px,0) rotate(${(1 - p) * rot}deg) scale(${0.4 + 0.6 * p})`);
          op(el, clamp(p * 2));
          const hot = Math.max(0, 1 - Math.abs(((t - 3.2) * 3.2) % 16 - i)) * seg(t, 3, 3.4);
          el.style.background = `rgba(255,255,255,${0.08 + hot * 0.16})`;
        });
        const pp = E.out5(seg(t, 0.4, 1.6));
        ph.at(1610 + (1 - pp) * 400, 560 + Math.sin(T) * 6, { ry: -14, s: 0.95 });
        const m = cfg.phones[0].map;
        ph.play(pw(m, t), slope(m, t));
      },
      sleep() { ph.sleep(); },
    };
  }

  // ---------- scene: carousel ----------
  function scCarousel(root, cfg) {
    const bg = new Bg(root, cfg.bg);
    const head = h('div', '', root); css(head, { position: 'absolute', left: 0, right: 0, top: '70px', textAlign: 'center' });
    const kick = Kicker(head, cfg.chap, cfg.kicker); css(kick, { justifyContent: 'center' });
    const title = new Title(head, cfg.title); css(title.root, { fontSize: '64px' });
    const n = cfg.phones.length, gap = 380;
    const phones = cfg.phones.map((p, i) => new Phone(root, { sw: 300, clip: p.clip, label: p.label, labelColor: PETALS[i % 8] }));
    return {
      update(t, T) {
        bg.update(T);
        fadeUp(kick, t, 0.2, 0.6, 20); title.update(t, 0.3);
        const span = (n - 1) * gap;
        const off = lerp(420, 1500 - span, E.io3(seg(t, 0.3, cfg.dur - 0.6)));
        phones.forEach((ph, i) => {
          const x = off + i * gap;
          const d = (x - 960) / 960;
          const p = E.out3(seg(t, 0.2 + i * 0.12, 1.2 + i * 0.12));
          ph.at(x, 640 + (1 - p) * 600 + Math.sin(T + i) * 5, { ry: -d * 28, s: 1 - Math.min(0.18, Math.abs(d) * 0.16), z: -Math.abs(d) * 120 });
          ph.play(Math.max(0, t - 0.4 - i * 0.6));
          if (ph.label) op(ph.label, 1 - Math.min(1, Math.max(0, Math.abs(d) - 0.55) * 2));
        });
      },
      sleep() { phones.forEach((p) => p.sleep()); },
    };
  }

  // ---------- scene: trio ----------
  function scTrio(root, cfg) {
    const bg = new Bg(root, cfg.bg);
    if (BG[cfg.bg]?.dark) root.classList.add('on-dark');
    root.classList.add(cfg.bg);
    const head = h('div', '', root); css(head, { position: 'absolute', left: 0, right: 0, top: '58px', textAlign: 'center' });
    const kick = Kicker(head, cfg.chap, cfg.kicker); css(kick, { justifyContent: 'center', marginBottom: '18px' });
    const title = new Title(head, cfg.title); css(title.root, { fontSize: '64px' });
    const phones = cfg.phones.map((p, i) => new Phone(root, { sw: 300, clip: p.clip, still: p.still, label: p.label, labelColor: PETALS[(i * 3 + 2) % 8], blur: p.blur }));
    const X = [480, 960, 1440];
    return {
      update(t, T) {
        bg.update(T);
        fadeUp(kick, t, 0.2, 0.6, 20); title.update(t, 0.3);
        phones.forEach((ph, i) => {
          const order = [1, 0, 2][i];
          const p = E.out5(seg(t, 0.3 + order * 0.25, 1.5 + order * 0.25));
          const side = i - 1;
          ph.at(X[i] + side * (1 - p) * 300, 600 + (1 - p) * 700 + Math.sin(T * 0.9 + i) * 6, { ry: -side * 16, rz: side * (1 - p) * 10, s: i === 1 ? 1 : 0.94 });
          const m = cfg.phones[i].map;
          ph.play(m ? pw(m, t) : Math.max(0, t - 0.6), m ? slope(m, t) : 1);
          if (ph.label) op(ph.label, seg(t, 1.4 + order * 0.25, 2 + order * 0.25));
        });
      },
      sleep() { phones.forEach((p) => p.sleep()); },
    };
  }

  // ---------- scene: dark mode ----------
  function scDark(root, cfg) {
    const mk = (dark) => {
      const L = h('div', 'layer' + (dark ? ' on-dark night' : ''), root);
      const bg = new Bg(L, dark ? 'night' : 'cream');
      const head = h('div', '', L); css(head, { position: 'absolute', left: 0, right: 0, top: '70px', textAlign: 'center' });
      const ti = new Title(head, dark ? 'Easy on the eyes, *day or night*.' : 'Easy on the eyes, *day or night*.'); css(ti.root, { fontSize: '66px' });
      const sub = h('div', 'sub', head, 'Light, dark, or follow your phone.'); css(sub, { margin: '14px auto 0', maxWidth: 'none' });
      const shots = dark
        ? [['image', 'media/dark/home.jpg'], ['image', 'media/dark/food.jpg'], ['image', 'media/dark/ask.jpg'], ['image', 'media/dark/sports.jpg']]
        : [['clip', 'home', 0.2], ['clip', 'food', 0.5], ['clip', 'saathi_ask', 0.3], ['clip', 'sports', 0.2]];
      const phones = shots.map((s) => new Phone(L, s[0] === 'image' ? { sw: 290, image: s[1], dark: true } : { sw: 290, clip: s[1], still: s[2] }));
      return { L, bg, ti, sub, phones };
    };
    const A = mk(false), B = mk(true);
    const line = h('div', '', root); css(line, { position: 'absolute', top: '-200px', width: '6px', height: '1500px', background: 'linear-gradient(#7fd6b0,#fff,#9d95ff)', boxShadow: '0 0 40px 10px rgba(127,214,176,.6)' });
    const X = [420, 780, 1140, 1500];
    return {
      update(t, T) {
        A.bg.update(T); B.bg.update(T);
        const w = E.io3(seg(t, 3.0, 5.6));
        const edge = lerp(-300, 2300, w);
        // diagonal wipe: dark revealed on the left of the moving edge
        B.L.style.clipPath = `polygon(0 0, ${edge + 200}px 0, ${edge - 200}px 100%, 0 100%)`;
        tf(line, `translate3d(${edge}px,0,0) rotate(20deg)`); op(line, w > 0 && w < 1 ? 1 : 0);
        [A, B].forEach((S) => {
          S.ti.update(t, 0.3); fadeUp(S.sub, t, 0.9);
          S.phones.forEach((ph, i) => {
            const p = E.out5(seg(t, 0.2 + i * 0.15, 1.4 + i * 0.15));
            ph.at(X[i], 640 + (1 - p) * 650 + Math.sin(T + i) * 6, { ry: (i - 1.5) * -8, s: 1 });
            ph.play(0);
          });
        });
      },
      sleep() { A.phones.concat(B.phones).forEach((p) => p.sleep()); },
    };
  }

  // ---------- scene: trust ----------
  function scTrust(root, cfg) {
    const bg = new Bg(root, 'deep'); root.classList.add('on-dark');
    const head = h('div', '', root); css(head, { position: 'absolute', left: 0, right: 0, top: '120px', textAlign: 'center' });
    const kick = Kicker(head, '', 'Built on trust'); css(kick, { justifyContent: 'center' });
    const ti = new Title(head, 'Neighbours, *not strangers*.'); css(ti.root, { fontSize: '92px', color: '#fff' });
    const items = [['shield', 'Society-scoped', 'You only ever see your own society. Never strangers.'], ['users', 'Real neighbours', 'Owner or tenant, flat and profession — a directory that is actually true.'], ['lock', 'Yours alone', 'No ads. No selling data. You choose which number to show.']];
    const cards = items.map(([ic, a, b], i) => {
      const c = h('div', 'card', root, `<div style="width:76px;height:76px;border-radius:22px;background:${PETALS[[2, 3, 0][i]]};color:#fff;display:grid;place-items:center;margin-bottom:26px">${icon(ic)}</div><div style="font:800 40px/1.1 Bricolage;letter-spacing:-.01em">${a}</div><div style="font:500 24px/1.45 Hanken;color:#55625B;margin-top:14px">${b}</div>`);
      c.querySelector('svg').style.cssText = 'width:38px;height:38px';
      css(c, { width: '500px', padding: '40px 40px 44px', left: 140 + i * 560 + 'px', top: '440px' });
      return c;
    });
    const note = h('div', '', root, '<b style="color:#fff">UPI, neighbour to neighbour.</b> Aangan never holds your money.');
    css(note, { position: 'absolute', left: 0, right: 0, top: '930px', textAlign: 'center', font: "500 28px/1 'Hanken'", color: 'rgba(255,255,255,.7)' });
    return {
      update(t, T) {
        bg.update(T); fadeUp(kick, t, 0.2); ti.update(t, 0.35);
        cards.forEach((c, i) => { const p = E.out5(seg(t, 1.2 + i * 0.3, 2.3 + i * 0.3)); tf(c, `translate3d(0,${(1 - p) * 160 + Math.sin(T * 0.9 + i) * 5}px,0) rotateX(${(1 - p) * 30}deg)`); op(c, p); });
        fadeUp(note, t, 3.4);
      },
    };
  }

  // ---------- scene: wall ----------
  function scWall(root, cfg) {
    const bg = new Bg(root, 'deep'); root.classList.add('on-dark');
    const plane = h('div', '', root); css(plane, { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transformStyle: 'preserve-3d' });
    const stills = window.STILLS || [];
    const rows = 4, cols = 9, tw = 250, th = tw * SH / SW, gap = 34;
    const r = rng(9);
    const tiles = [];
    for (let y = 0; y < rows; y++) {
      const row = h('div', '', plane); css(row, { position: 'absolute', left: -(cols * (tw + gap)) / 2 + 'px', top: (y - rows / 2) * (th + gap) + 'px', width: cols * (tw + gap) + 'px', height: th + 'px' });
      for (let x = 0; x < cols; x++) {
        const s = stills[(y * cols + x * 3 + y) % stills.length];
        const c = h('div', '', row); css(c, { position: 'absolute', left: x * (tw + gap) + 'px', top: 0, width: tw + 'px', height: th + 'px', borderRadius: '26px', overflow: 'hidden', background: '#123', boxShadow: '0 30px 60px -20px rgba(0,0,0,.6), 0 0 0 4px #0b0f0d' });
        if (s) img(c, 'media/stills/' + s);
        tiles.push({ c, d: r() });
      }
      tiles.push({ row, y });
    }
    const glass = h('div', '', root); css(glass, { position: 'absolute', left: '50%', top: '50%', width: '1240px', marginLeft: '-620px', padding: '56px 60px 60px', marginTop: '-210px', borderRadius: '40px', textAlign: 'center', background: 'rgba(4,30,22,.86)', boxShadow: '0 0 0 1px rgba(255,255,255,.14) inset, 0 60px 120px -30px rgba(0,0,0,.7)' });
    const ti = new Title(glass, 'One courtyard. *Everything your society needs.*'); css(ti.root, { fontSize: '76px', color: '#fff' });
    const feats = h('div', '', glass, ['Home food', 'Saathi AI', 'Marketplace', 'Feed & polls', 'Celebrations', 'Sports', 'Emergency', 'Blood & SOS', 'UPI ledger', 'Documents', 'Nearby', 'Carpool', '12 languages'].map((f, i) => `<span style="display:inline-block;margin:6px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.1);font:700 21px Hanken;color:#fff"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${PETALS[i % 8]};margin-right:9px"></i>${f}</span>`).join(''));
    css(feats, { marginTop: '28px' });
    const fspans = [...feats.children];
    return {
      update(t, T) {
        bg.update(T);
        const z = E.io3(seg(t, 0, cfg.dur));
        tf(plane, `perspective(1600px) rotateX(${32 - z * 8}deg) rotateZ(${-14 + z * 4}deg) scale(${0.9 + z * 0.25}) translateZ(0)`);
        tiles.forEach((o) => {
          if (o.row) { const dir = o.y % 2 ? 1 : -1; tf(o.row, `translate3d(${dir * (t * 70 - 150)}px,0,0)`); return; }
          const p = E.out3(seg(t, 0.1 + o.d * 0.8, 0.8 + o.d * 0.8)); op(o.c, p); tf(o.c, `translateZ(${(1 - p) * 300}px)`);
        });
        const g = E.out5(seg(t, 1.0, 2.0)); op(glass, g); tf(glass, `scale(${0.9 + 0.1 * g})`);
        ti.update(t, 1.2);
        fspans.forEach((s, i) => { const p = E.outBack(seg(t, 2.2 + i * 0.08, 2.6 + i * 0.08)); op(s, clamp(p)); tf(s, `scale(${0.6 + 0.4 * p})`); });
      },
    };
  }

  // ---------- scene: cta ----------
  function scCta(root, cfg) {
    const bg = new Bg(root, 'cream');
    const holder = h('div', '', root); css(holder, { position: 'absolute', left: '960px', top: '300px', width: 0, height: 0 });
    const logo = Logo(holder, 250); css(logo.svg, { left: '-125px', top: '-125px' }); logo.setRing('rgba(14,107,78,.25)');
    const word = h('div', '', root); css(word, { position: 'absolute', left: 0, right: 0, top: '450px', textAlign: 'center', font: "800 150px/1 'Bricolage'", letterSpacing: '-.03em', color: '#0F1A15' });
    const letters = [...'Aangan'].map((c) => { const s = h('span', '', word, c); s.style.display = 'inline-block'; return s; });
    const line = h('div', '', root); css(line, { position: 'absolute', left: 0, right: 0, top: '628px', textAlign: 'center' });
    const lt = new Title(line, 'Your society, *finally in one place*.'); css(lt.root, { fontSize: '62px' });
    const btns = h('div', '', root); css(btns, { position: 'absolute', left: 0, right: 0, top: '750px', display: 'flex', justifyContent: 'center', gap: '20px' });
    const b1 = h('div', '', btns, `<span style="width:34px;height:34px;display:block">${icon('android')}</span>Get it on Android`);
    const b2 = h('div', '', btns, `<span style="width:34px;height:34px;display:block">${icon('globe')}</span>my-aangan.vercel.app`);
    [b1, b2].forEach((b, i) => { css(b, { display: 'flex', alignItems: 'center', gap: '14px', padding: '24px 34px', borderRadius: '24px', font: "700 30px/1 'Hanken'", background: i ? '#fff' : '#0E6B4E', color: i ? '#0E6B4E' : '#fff', boxShadow: '0 24px 44px -20px rgba(14,107,78,.55)' }); b.firstChild.firstChild.style.cssText = 'width:34px;height:34px'; });
    const note = h('div', '', root, 'Free for residents · Set up in a couple of minutes · Phone + PIN, no OTP');
    css(note, { position: 'absolute', left: 0, right: 0, top: '880px', textAlign: 'center', font: "600 25px/1 'Hanken'", color: '#55625B' });
    const bars = h('div', '', root); css(bars, { position: 'absolute', left: '50%', top: '950px', marginLeft: '-140px', width: '280px', display: 'flex', gap: '6px' });
    const barEls = PETALS.map((c) => { const b = h('i', '', bars); css(b, { flex: 1, height: '5px', borderRadius: '3px', background: c, display: 'block', transformOrigin: 'left' }); return b; });
    const tag = h('div', '', root, 'every home. every language. one courtyard.');
    css(tag, { position: 'absolute', left: 0, right: 0, top: '984px', textAlign: 'center', font: "500 22px/1 'Hanken'", color: '#8a948e', letterSpacing: '.14em' });
    return {
      update(t, T) {
        bg.update(T);
        logo.update(t - 0.3, 1.2);
        tf(holder, `rotate(${t * 5}deg) scale(${1 + 0.02 * Math.sin(T * 2)})`);
        letters.forEach((l, i) => { const p = E.out5(seg(t, 1.2 + i * 0.06, 2.0 + i * 0.06)); tf(l, `translate3d(0,${(1 - p) * 70}px,0)`); op(l, p); fl(l, `blur(${(1 - p) * 10}px)`); });
        lt.update(t, 2.0);
        [b1, b2].forEach((b, i) => { const p = E.outBack(seg(t, 3.0 + i * 0.2, 3.7 + i * 0.2)); tf(b, `translate3d(0,${(1 - p) * 40}px,0) scale(${0.8 + 0.2 * p})`); op(b, clamp(p)); });
        fadeUp(note, t, 3.8);
        barEls.forEach((b, i) => tf(b, `scaleX(${E.out3(seg(t, 4.2 + i * 0.06, 4.8 + i * 0.06))})`));
        fadeUp(tag, t, 4.6);
        const outro = seg(t, cfg.dur - 1.4, cfg.dur);
        op(root.querySelector('.fadeout') || (() => { const f = h('div', 'fadeout', root); css(f, { position: 'absolute', inset: 0, background: '#03120d', pointerEvents: 'none' }); return f; })(), E.in3(outro));
      },
    };
  }

  const TYPES = { intro: scIntro, problem: scProblem, reveal: scReveal, phone: scPhone, categories: scCategories, carousel: scCarousel, trio: scTrio, dark: scDark, trust: scTrust, wall: scWall, cta: scCta };

  // ---------- engine ----------
  const stage = document.getElementById('stage');
  const flash = h('div', '', stage); flash.id = 'flash';
  const petals = h('div', '', stage); petals.id = 'petals';
  const petalBars = PETALS.map((c) => { const b = h('i', '', petals); b.style.background = c; return b; });
  h('div', '', stage).id = 'vignette';
  const grain = h('div', '', stage); grain.id = 'grain';
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); const id = g.createImageData(256, 256); const r = rng(1);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); grain.style.backgroundImage = `url(${cv.toDataURL()})`;
  }

  let CUT = null, SCENES = [];
  function buildCut(key) {
    SCENES.forEach((s) => s.wrap.remove());
    CUT = window.CUTS[key];
    SCENES = CUT.scenes.map((cfg, i) => {
      const wrap = h('div', 'scene'); stage.insertBefore(wrap, flash);
      wrap.style.zIndex = i + 1;
      const inst = TYPES[cfg.type](wrap, cfg);
      return { cfg, wrap, inst, on: false };
    });
  }

  function transitionStyle(kind, p, entering) {
    // returns [transform, opacity, clipPath, filter]
    const q = E.io3(p);
    switch (kind) {
      case 'zoom': return entering ? [`scale(${1.3 - 0.3 * E.out3(p)})`, E.out2(p), '', p < 1 ? `blur(${(1 - p) * 14}px)` : ''] : [`scale(${1 + 0.7 * E.in3(p)})`, 1 - E.in3(p), '', ''];
      case 'push': return entering ? [`translate3d(${(1 - q) * W}px,0,0)`, 1, '', ''] : [`translate3d(${-q * W * 0.35}px,0,0) scale(${1 - 0.08 * q})`, 1 - 0.5 * q, '', ''];
      case 'iris': return entering ? ['', 1, `circle(${E.io3(p) * 120}% at 50% 50%)`, ''] : [`scale(${1 + 0.06 * p})`, 1, '', ''];
      case 'flash': return entering ? ['', p > 0.5 ? 1 : 0, '', ''] : ['', p > 0.5 ? 0 : 1, '', ''];
      case 'petals': return entering ? ['', p > 0.5 ? 1 : 0, '', ''] : ['', p > 0.5 ? 0 : 1, '', ''];
      default: return entering ? ['', p, '', ''] : ['', 1, '', ''];
    }
  }

  let lastT = 0;
  function render(t) {
    lastT = t;
    let flashA = 0, petalP = -1;
    SCENES.forEach((S, i) => {
      const { cfg, wrap, inst } = S;
      const next = SCENES[i + 1];
      const end = cfg.start + cfg.dur;
      const on = t >= cfg.start && t < end + 1e-6;
      if (on !== S.on) { wrap.style.display = on ? 'block' : 'none'; S.on = on; if (!on && inst.sleep) inst.sleep(); }
      if (!on) return;
      const lt = t - cfg.start;
      let T1 = '', O = 1, CP = '', F = '';
      if (i > 0 && cfg.ov > 0 && lt < cfg.ov) {
        const p = lt / cfg.ov;
        [T1, O, CP, F] = transitionStyle(cfg.tin, p, true);
        if (cfg.tin === 'flash') flashA = Math.max(flashA, 1 - Math.abs(p - 0.5) * 2);
        if (cfg.tin === 'petals') petalP = p;
      }
      if (next && t > next.cfg.start) {
        const p = (t - next.cfg.start) / next.cfg.ov;
        const [t2, o2, c2, f2] = transitionStyle(next.cfg.tin, p, false);
        T1 = (T1 + ' ' + t2).trim(); O *= o2; CP = CP || c2; F = F || f2;
      }
      tf(wrap, T1); op(wrap, O);
      if (wrap._cp !== CP) { wrap.style.clipPath = CP; wrap._cp = CP; }
      fl(wrap, F);
      inst.update(lt, t);
    });
    op(flash, flashA);
    if (petalP >= 0) {
      petals.style.display = 'block';
      petalBars.forEach((b, i) => {
        const d = i * 0.035;
        const p = clamp((petalP - d) / (1 - 8 * 0.035));
        const x = lerp(-700, W + 500, E.io3(p));
        tf(b, `translate3d(${x - 330 + i * 0}px,0,0) skewX(-18deg)`);
        b.style.left = (i * 70 - 300) + 'px';
      });
    } else if (petals.style.display !== 'none') petals.style.display = 'none';
  }

  // ---------- boot ----------
  async function loadAll() {
    const names = new Set();
    for (const k in window.CUTS) window.CUTS[k].scenes.forEach((s) => {
      (s.phones || []).forEach((p) => p.clip && names.add(p.clip));
      if (s.lens) names.add(s.lens.clip);
    });
    ['home', 'food', 'saathi_ask', 'sports', 'onboard'].forEach((n) => names.add(n));
    await Promise.all([...names].map(async (n) => { MAN[n] = await (await fetch(`media/clips/${n}.json`)).json(); }));
    try { window.STILLS = await (await fetch('media/stills/index.json')).json(); } catch { window.STILLS = []; }
    await document.fonts.load("800 100px Bricolage"); await document.fonts.load("600 30px Hanken");
    await Promise.all(['नमस्ते', 'ನಮಸ್ಕಾರ', 'வணக்கம்', 'నమస్కారం', 'নমস্কার', 'നമസ്കാരം', 'નમસ્તે', 'ਸਤ', 'ନମସ୍କାର', 'آداب'].map((s) => document.fonts.load('600 40px Indic', s)));
  }

  // Render-mode API used by the frame renderer.
  window.__seek = async (t) => {
    PENDING = []; render(t);
    await Promise.all(PENDING);
    // let layout/paint settle
    await new Promise((r) => requestAnimationFrame(() => r()));
  };

  // ---------- player ----------
  function fit() {
    const vw = innerWidth, vh = innerHeight; const s = Math.min(vw / W, vh / H);
    stage.style.transform = `translate(${(vw - W * s) / 2}px,${(vh - H * s) / 2}px) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  window.__ready = (async () => {
    await loadAll();
    const key = Q.get('cut') === 'short' ? 'short' : 'long';
    buildCut(key);
    render(Number(Q.get('t') || 0));
    await window.__seek(Number(Q.get('t') || 0));
    if (!RENDER) setupPlayer(key);
    return { dur: CUT.dur };
  })();

  function setupPlayer(initial) {
    const audio = new Audio(); audio.preload = 'auto';
    const ui = document.getElementById('ui');
    const $ = (id) => document.getElementById(id);
    let key = initial, t = 0, playing = false, last = 0, muted = false;
    const setAudio = () => { audio.src = `media/music_${key}.mp3`; audio.muted = muted; };
    setAudio();
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const playBtn = $('play');
    const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
    function chapters() {
      const box = $('chapters'); box.innerHTML = '';
      const sc = $('scrub'); sc.querySelectorAll('.tick').forEach((e) => e.remove());
      const seen = new Set();
      CUT.scenes.forEach((s) => {
        const name = s.kicker || { intro: 'Opening', problem: 'The problem', reveal: 'Meet Aangan', dark: 'Dark mode', trust: 'Trust', wall: 'Everything', cta: 'Get Aangan' }[s.type];
        if (!name || seen.has(s.chap || name)) return; seen.add(s.chap || name);
        const label = s.chap ? `${s.chap} · ${{ '01': 'Find your society', '02': 'Home', '03': 'Home food', '04': 'Saathi AI', '05': 'Community', '06': 'Marketplace', '07': 'Safety & money' }[s.chap]}` : name;
        const b = h('button', 'btn', box, label); b.dataset.t = s.start + (s.ov || 0); b.onclick = () => seek(s.start + (s.ov || 0) + 0.01);
        const tick = h('div', 'tick', sc); tick.style.left = (s.start / CUT.dur) * 100 + '%';
      });
    }
    function syncUI() {
      $('time').textContent = `${fmt(t)} / ${fmt(CUT.dur)}`;
      $('fill').style.width = (t / CUT.dur) * 100 + '%'; $('knob').style.left = (t / CUT.dur) * 100 + '%';
      let cur = null; document.querySelectorAll('#chapters .btn').forEach((b) => { if (Number(b.dataset.t) <= t + 0.05) cur = b; b.classList.remove('on'); });
      cur && cur.classList.add('on');
      playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      document.querySelectorAll('[data-cut]').forEach((b) => b.classList.toggle('on', b.dataset.cut === key));
    }
    function seek(nt) {
      t = clamp(nt, 0, CUT.dur - 0.01);
      if (audio.readyState > 0) audio.currentTime = t;
      render(t); syncUI();
    }
    function play() {
      if (t >= CUT.dur - 0.05) seek(0);
      playing = true; PLAYING = true; last = performance.now();
      audio.currentTime = t; audio.play().catch(() => {});
      syncUI(); poke();
    }
    function pause() { playing = false; PLAYING = false; audio.pause(); render(t); syncUI(); poke(); }
    function switchCut(k) {
      if (k === key) return; pause(); key = k; buildCut(k); setAudio(); chapters(); seek(0);
      const u = new URL(location); u.searchParams.set('cut', k); history.replaceState(null, '', u);
    }
    function loop(now) {
      if (playing) {
        const dt = (now - last) / 1000; last = now;
        if (!audio.paused && audio.readyState >= 2 && Math.abs(audio.currentTime - (t + dt)) < 0.3) t = audio.currentTime;
        else t += dt;
        if (t >= CUT.dur) { t = CUT.dur - 0.01; pause(); }
        render(t); syncUI();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    let hideTimer = 0;
    function poke() { ui.classList.remove('hide'); clearTimeout(hideTimer); if (playing) hideTimer = setTimeout(() => ui.classList.add('hide'), 2600); }
    addEventListener('mousemove', poke); addEventListener('touchstart', poke, { passive: true });
    playBtn.onclick = () => (playing ? pause() : play());
    $('viewport').onclick = () => { if (!$('start').hidden) return; playing ? pause() : play(); };
    document.querySelectorAll('[data-cut]').forEach((b) => (b.onclick = () => switchCut(b.dataset.cut)));
    $('mute').onclick = () => { muted = !muted; audio.muted = muted; $('mute').classList.toggle('on', muted); };
    $('fs').onclick = () => { try { const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); r?.catch?.(() => {}); } catch {} };
    const sc = $('scrub');
    const pos = (e) => { const r = sc.getBoundingClientRect(); return clamp(((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width) * CUT.dur; };
    let drag = false;
    sc.addEventListener('pointerdown', (e) => { drag = true; sc.setPointerCapture(e.pointerId); seek(pos(e)); });
    sc.addEventListener('pointermove', (e) => {
      if (drag) seek(pos(e));
      const tip = sc.querySelector('.tip'); const tt = pos(e); tip.style.display = 'block'; tip.style.left = (tt / CUT.dur) * 100 + '%';
      const s = [...CUT.scenes].reverse().find((s) => s.start <= tt); tip.textContent = `${fmt(tt)} · ${s.kicker || s.type}`;
    });
    sc.addEventListener('pointerup', () => (drag = false));
    sc.addEventListener('pointerleave', () => (sc.querySelector('.tip').style.display = 'none'));
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
      if (e.code === 'ArrowRight') seek(t + 5);
      if (e.code === 'ArrowLeft') seek(t - 5);
      if (e.key === 'm') $('mute').click();
      if (e.key === 'f') $('fs').click();
    });
    document.querySelectorAll('#start .choice').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation(); $('start').hidden = true; switchCut(b.dataset.go); seek(0); play();
    }));
    chapters(); syncUI();
  }
})();
