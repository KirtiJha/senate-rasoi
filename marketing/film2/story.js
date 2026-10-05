// Film 2 — "One Courtyard". A product-ad cut: camera moves, real UI lifted
// out of the app, and key moments rebuilt big. Pure data so the score can
// read the same timing. Scenes overlap by `ov` (default 0.5s); every start
// lands on the 120 BPM beat grid.
//
// Two cuts: `long` (4:50) and `short` (~2:00). A scene may play a trimmed
// window of its own timeline: `from` is its local start time, `dur` how long
// it stays on screen. The same scene can appear twice with different windows.
(function (root) {
  const CUTS = {
    long: [
      { id: 'ping', dur: 11, music: 'tension', short: false },
      { id: 'spark', dur: 7, tin: 'zoomthru', music: 'intro' },
      { id: 'hero', dur: 13, tin: 'flash', music: 'drop' },
      { id: 'find', dur: 22, tin: 'zoomthru', music: 'groove', chap: '01', name: 'Find your society' },
      { id: 'home', dur: 17, tin: 'whip', music: 'groove', chap: '02', name: 'Home' },
      { id: 'food', dur: 27, tin: 'petal', music: 'groove2', chap: '03', name: 'Home food' },
      { id: 'ask', dur: 18, tin: 'iris', music: 'float', chap: '04', name: 'Saathi AI' },
      { id: 'doit', dur: 16, tin: 'whip', music: 'float' },
      { id: 'watch', dur: 13, tin: 'slice', music: 'float' },
      { id: 'translate', dur: 13, tin: 'zoomthru', music: 'float' },
      { id: 'feed', dur: 17, tin: 'petal', music: 'groove', chap: '05', name: 'Community' },
      { id: 'celebrate', dur: 18, tin: 'whip', music: 'groove2' },
      { id: 'sports', dur: 10, tin: 'slice', music: 'groove2' },
      { id: 'market', dur: 20, tin: 'petal', music: 'groove2', chap: '06', name: 'Marketplace' },
      { id: 'safety', dur: 18, tin: 'colorwipe', music: 'groove', chap: '07', name: 'Safety & money' },
      { id: 'money', dur: 14, tin: 'whip', music: 'groove' },
      { id: 'trust', dur: 13, tin: 'zoomthru', music: 'float' },
      { id: 'dark', dur: 7, tin: 'slice', music: 'groove2' },
      { id: 'montage', dur: 12, tin: 'flash', music: 'peak' },
      { id: 'cta', dur: 14, tin: 'petal', music: 'outro' },
    ],
    short: [
      { id: 'ping', dur: 11 },
      { id: 'spark', dur: 7, tin: 'zoomthru' },
      { id: 'hero', dur: 13, tin: 'flash' },
      { id: 'find', dur: 10.5, tin: 'zoomthru' },
      { id: 'food', dur: 8, tin: 'petal' },
      { id: 'food', from: 17.5, dur: 6.5, tin: 'whip' },
      { id: 'ask', dur: 10.5, tin: 'iris' },
      { id: 'doit', from: 4.4, dur: 8.5, tin: 'whip' },
      { id: 'translate', dur: 6.5, tin: 'slice' },
      { id: 'feed', from: 5.6, dur: 6, tin: 'petal' },
      { id: 'celebrate', dur: 6, tin: 'whip' },
      { id: 'market', from: 7.9, dur: 6, tin: 'slice' },
      { id: 'safety', dur: 5.5, tin: 'colorwipe' },
      { id: 'money', dur: 7, tin: 'whip' },
      { id: 'montage', dur: 10, tin: 'flash' },
      { id: 'cta', dur: 12, tin: 'petal' },
    ],
  };
  const out = {};
  for (const k in CUTS) {
    let t = 0;
    const S = CUTS[k].map((s0, i) => {
      const s = { ...s0 };
      s.ov = s.ov ?? (i === 0 ? 0 : 0.5);
      s.tin = s.tin || 'fade';
      s.from = s.from || 0;
      if (i > 0) t -= s.ov;
      s.start = t;
      t += s.dur;
      return s;
    });
    out[k] = { scenes: S, dur: t };
  }
  if (typeof module !== 'undefined') module.exports = out;
  else {
    const c = new URLSearchParams(location.search).get('cut');
    root.STORY = out[c === 'short' ? 'short' : 'long'];
    root.STORY_CUT = c === 'short' ? 'short' : 'long';
  }
})(typeof window !== 'undefined' ? window : globalThis);
