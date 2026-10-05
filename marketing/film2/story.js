// Film 2 — "One Courtyard". A product-ad cut: camera moves, real UI lifted
// out of the app, and key moments rebuilt big. Pure data so the score can
// read the same timing. Scenes overlap by `ov` (default 0.5s); every start
// lands on the 120 BPM beat grid.
(function (root) {
  const S = [
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
  ];
  let t = 0;
  S.forEach((s, i) => {
    s.ov = s.ov ?? (i === 0 ? 0 : 0.5);
    s.tin = s.tin || 'fade';
    if (i > 0) t -= s.ov;
    s.start = t;
    t += s.dur;
  });
  const STORY = { scenes: S, dur: t };
  if (typeof module !== 'undefined') module.exports = STORY; else root.STORY = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
