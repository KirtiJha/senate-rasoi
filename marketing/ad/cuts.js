// Storyboards for the two cuts. Pure data so the music generator can read the
// same timing the picture uses. Times are seconds; every scene overlaps the
// next by `ov` (default 1), so cut points land on the 120 BPM beat grid.
(function (root) {
  const C = {};

  // Clip maps are [sceneTime, clipTime] keyframes — linear between them.
  C.long = {
    label: 'Full film',
    scenes: [
      { id: 'intro', type: 'intro', dur: 9, music: 'intro' },
      { id: 'problem', type: 'problem', dur: 14, tin: 'zoom', music: 'tension' },
      { id: 'reveal', type: 'reveal', dur: 9, tin: 'flash', music: 'drop' },

      { id: 'find', type: 'phone', dur: 16, tin: 'petals', bg: 'cream', side: 'right', chap: '01', kicker: 'Find your society',
        title: 'Your building is *already here*.', sub: 'Search any society in India. If your neighbours are on Aangan, join them in one tap.',
        phones: [{ clip: 'onboard', map: [[0.8, 0], [15.6, 13.8]] }],
        caps: [[3.2, 'Search anywhere in India', 'search'], [8.6, 'Already on Aangan? Tap Join', 'check'], [11.6, 'Phone + 6-digit PIN. No SMS. No OTP.', 'lock']], music: 'groove' },
      { id: 'founder', type: 'phone', dur: 13, tin: 'push', bg: 'cream', side: 'left', chap: '01', kicker: 'Not on Aangan yet?',
        title: 'Start it. Become its *first admin*.', sub: 'Pick your society from the map. Aangan fills in the address — you invite the neighbours.',
        phones: [{ clip: 'onboard_new', map: [[0.6, 0], [12.4, 11.76]] }],
        caps: [[3, 'Pulled straight from the map', 'pin'], [7.6, 'You become the society admin', 'crown'], [9.6, 'Invite neighbours by WhatsApp', 'send']], music: 'groove' },
      { id: 'signin', type: 'phone', dur: 10, tin: 'push', bg: 'cream', side: 'right', chap: '01', kicker: 'Sign in',
        title: 'Back in, in *six digits*.', sub: 'Your phone number and a PIN you chose. That is the whole login.',
        phones: [{ clip: 'signin', map: [[0.6, 0], [9.6, 10.9]] }],
        caps: [[2.6, 'No SMS · No OTP · No passwords', 'lock'], [5.4, 'Straight to your society’s home', 'home']], music: 'groove' },

      { id: 'home', type: 'phone', dur: 18, tin: 'iris', bg: 'mint', side: 'left', chap: '02', kicker: 'Home',
        title: 'Everything your society does. *One home.*', sub: 'Announcements, food, the marketplace and every service — on one screen that is only for your gate.',
        phones: [{ clip: 'home', map: [[0.6, 0], [12.6, 15.6]] }, { clip: 'digest', map: [[9.6, 0.6], [17.6, 9.2]], enter: 9.4 }],
        caps: [[3.4, 'Announcements up top', 'megaphone'], [6, 'Fresh from neighbours’ kitchens', 'food'], [9.8, 'An AI digest of your society’s week', 'spark']],
        lens: { clip: 'digest', rect: [0, 580, 412, 180], at: 13.2, t: 6 }, music: 'groove' },

      { id: 'food', type: 'phone', dur: 14, tin: 'petals', bg: 'warm', side: 'right', chap: '03', kicker: 'Home food',
        title: 'Dinner from the *flat upstairs*.', sub: 'Neighbours post what they are cooking. You reserve a plate, or subscribe to a tiffin.',
        phones: [{ clip: 'food', map: [[0.6, 0], [13.6, 13.93]] }],
        caps: [[3, 'Today & upcoming menus, veg filters', 'food'], [6.4, 'Reserve plates · subscribe to tiffins', 'check'], [9.4, 'Pay the cook directly over UPI', 'rupee']],
        extra: { type: 'orderFlow', at: 9.6 }, music: 'groove2' },
      { id: 'kitchen', type: 'phone', dur: 13, tin: 'push', bg: 'warm', side: 'left', chap: '03', kicker: 'For home chefs',
        title: 'Your kitchen, *run like a business*.', sub: 'Orders, plates left, earnings and reviews — in one dashboard.',
        phones: [{ clip: 'food_tabs', map: [[0.6, 0], [12.6, 15.5]] }],
        caps: [[3.4, 'Order lifecycle: placed → delivered', 'list'], [7, 'Plates left & earnings at a glance', 'rupee'], [9.6, '“Would order again” reviews', 'heart']],
        lens: { clip: 'food_tabs', rect: [8, 220, 396, 200], at: 8.6, t: 13 }, music: 'groove2' },

      { id: 'saathi', type: 'phone', dur: 18, tin: 'iris', bg: 'night', side: 'right', chap: '04', kicker: 'Meet Saathi',
        title: 'Ask your society *anything*.', sub: 'Saathi is an AI that knows your society — the food, the flats, the notices and every reply under them.',
        phones: [{ clip: 'saathi_ask', map: [[0.6, 0], [2.6, 2.0], [5.6, 10.0], [6.4, 10.6], [18, 22]] }],
        caps: [[3.6, 'Plain-language questions', 'chat'], [6.6, 'Answers from your society’s own data', 'spark'], [9.4, 'Follow-ups ready to tap', 'arrow']],
        lens: { clip: 'saathi_ask', rect: [8, 148, 396, 178], at: 9.8, t: 14 }, music: 'float' },
      { id: 'saathi_do', type: 'phone', dur: 15, tin: 'push', bg: 'night', side: 'left', chap: '04', kicker: 'Saathi does things too',
        title: 'Tell it what to do. *You confirm.*', sub: 'Draft the notice, start a poll, reserve the plates — Saathi shows exactly what it will do first.',
        phones: [{ clip: 'saathi_do', map: [[0.6, 0], [4.6, 4.2], [7, 9.8], [15, 16]] }],
        caps: [[2.4, '“Post a notice about the water tanker”', 'chat'], [7.4, 'A ready-to-post draft', 'doc'], [10.4, 'Nothing happens until you tap', 'check']],
        lens: { clip: 'saathi_do', rect: [8, 165, 396, 395], at: 8.2, t: 13 }, music: 'float' },
      { id: 'saathi_watch', type: 'phone', dur: 14, tin: 'push', bg: 'night', side: 'right', chap: '04', kicker: 'Saathi keeps watch',
        title: 'It waits, so *you don’t have to*.', sub: '“Tell me when a 2 BHK is listed.” Saathi watches and pings you the moment it appears.',
        phones: [{ clip: 'saathi_watch', map: [[0.6, 0], [2.8, 2.2], [5, 9.9], [14, 13.2]] }],
        caps: [[5.4, 'Alerts for flats, items, services', 'bell'], [7.6, 'Speaks 12 Indian languages', 'globe']],
        extra: { type: 'langs', at: 7.8 }, music: 'float' },

      { id: 'feed', type: 'phone', dur: 14, tin: 'petals', bg: 'cream', side: 'left', chap: '05', kicker: 'Feed & polls',
        title: 'Talk it out. Then *decide together*.', sub: 'Announcements, issues, events and lost & found — with live polls instead of forty “+1” messages.',
        phones: [{ clip: 'feed', map: [[0.6, 0], [13.6, 13.4]] }, { clip: 'polls', still: 2, enter: 6.6 }],
        caps: [[3, 'Posts with comment threads', 'chat'], [6.8, 'Live poll results', 'chart']],
        lens: { clip: 'polls', rect: [8, 140, 396, 280], at: 8.4, t: 2 }, music: 'groove' },
      { id: 'celebrate', type: 'phone', dur: 15, tin: 'push', bg: 'festive', side: 'right', chap: '05', kicker: 'Celebrations',
        title: 'Plan the festival. *Track every rupee.*', sub: 'Budget, programme, tasks and contributions — with an accounts report every resident can open.',
        phones: [{ clip: 'events', map: [[0.6, 0], [14.6, 17.8]] }],
        caps: [[3.4, 'Contributions by flat', 'rupee'], [6.6, 'Line-by-line budget', 'list'], [9.6, 'Open accounts for everyone', 'eye']],
        extra: { type: 'money', at: 5.2 }, music: 'groove' },
      { id: 'sports', type: 'phone', dur: 10, tin: 'push', bg: 'cream', side: 'left', chap: '05', kicker: 'Sports',
        title: 'Teams, practice & *court bookings*.', sub: 'Badminton, cricket, football — with captains, schedules and who is in tonight.',
        phones: [{ clip: 'sports', map: [[0.6, 0], [9.6, 9.4]] }],
        caps: [[3, 'Practice schedule & members', 'calendar'], [5.6, 'Book courts, split the cost', 'rupee']], music: 'groove' },

      { id: 'cats', type: 'categories', dur: 12, tin: 'petals', bg: 'deep', chap: '06', kicker: 'Marketplace',
        title: 'Buy, sell & find help — *inside your gate*.', phones: [{ clip: 'post', map: [[0.6, 0], [11, 7.1]] }], music: 'groove2' },
      { id: 'market', type: 'carousel', dur: 12, tin: 'push', bg: 'cream', chap: '06', kicker: 'Marketplace',
        title: 'Flats, things to borrow, *lost keys*, lifts to work.',
        phones: [{ clip: 'listings', label: 'All listings' }, { clip: 'properties', label: 'Flats for rent & sale' }, { clip: 'borrow', label: 'Borrow & lend' },
          { clip: 'lostfound', label: 'Lost & found' }, { clip: 'rides', label: 'Carpool' }, { clip: 'search', label: 'Search everything' }], music: 'groove2' },

      { id: 'safety', type: 'trio', dur: 14, tin: 'iris', bg: 'deep', chap: '07', kicker: 'Safety & services',
        title: 'Help, *in one tap*.',
        phones: [{ clip: 'emergency', still: 0.5, label: 'Emergency quick-dial', blur: [56, 556, 300, 274] }, { clip: 'helpers', map: [[0.6, 0], [8, 5.7]], label: 'Blood donors & SOS helpers' }, { clip: 'places', map: [[0.6, 0], [13, 12.6]], label: 'Nearby hospitals, schools, shops' }],
        music: 'groove' },
      { id: 'money', type: 'phone', dur: 12, tin: 'push', bg: 'mint', side: 'right', chap: '07', kicker: 'Payments & documents',
        title: 'Pay neighbour to neighbour. *Over UPI.*', sub: 'A ledger both sides confirm — and a vault for society files, public or shared privately.',
        phones: [{ clip: 'payments', still: 2 }, { clip: 'documents', still: 0.5, enter: 5.4 }],
        caps: [[3, 'Aangan never holds your money', 'shield'], [5.6, 'Receipts both sides confirm', 'check'], [8, 'Society document vault', 'doc']],
        extra: { type: 'ledger', at: 2.2 }, music: 'groove' },

      { id: 'dark', type: 'dark', dur: 9, tin: 'petals', bg: 'split', music: 'groove2' },
      { id: 'trust', type: 'trust', dur: 10, tin: 'zoom', bg: 'deep', music: 'groove2' },
      { id: 'wall', type: 'wall', dur: 10, tin: 'flash', bg: 'deep', music: 'peak' },
      { id: 'cta', type: 'cta', dur: 13, tin: 'iris', bg: 'cream', music: 'outro' },
    ],
  };

  C.short = {
    label: 'Short cut',
    scenes: [
      { id: 'intro', type: 'intro', dur: 6, music: 'intro' },
      { id: 'problem', type: 'problem', dur: 8, tin: 'zoom', short: true, music: 'tension' },
      { id: 'reveal', type: 'reveal', dur: 7, tin: 'flash', music: 'drop' },
      { id: 'find', type: 'phone', dur: 10, tin: 'petals', bg: 'cream', side: 'right', chap: '01', kicker: 'Find your society',
        title: 'Find your society. *Join in a tap.*', sub: 'Phone + 6-digit PIN. No SMS, no OTP.',
        phones: [{ clip: 'onboard', map: [[0.6, 0], [1.6, 1.4], [3.6, 6.0], [9.6, 13.8]] }],
        caps: [[3, 'Search anywhere in India', 'search'], [6, 'Not listed? Add it — become its admin', 'crown']], music: 'groove' },
      { id: 'home', type: 'phone', dur: 9, tin: 'push', bg: 'mint', side: 'left', chap: '02', kicker: 'Home',
        title: 'Your whole society. *One home.*', sub: 'Announcements, food, marketplace and services — only for your gate.',
        phones: [{ clip: 'home', map: [[0.6, 0], [8.6, 15.6]] }],
        caps: [[3, 'AI weekly digest', 'spark'], [5.4, 'Fresh from neighbours’ kitchens', 'food']], music: 'groove' },
      { id: 'food', type: 'phone', dur: 11, tin: 'petals', bg: 'warm', side: 'right', chap: '03', kicker: 'Home food',
        title: 'Dinner from the *flat upstairs*.', sub: 'Reserve a plate, subscribe to a tiffin, pay the cook over UPI.',
        phones: [{ clip: 'food', map: [[0.6, 0], [10.6, 13.9]] }, { clip: 'food_tabs', still: 13, enter: 5.6 }],
        caps: [[2.6, 'Daily dishes from home chefs', 'food'], [5.8, 'A kitchen dashboard for cooks', 'rupee']],
        lens: { clip: 'food_tabs', rect: [8, 220, 396, 200], at: 7, t: 13 }, music: 'groove2' },
      { id: 'saathi', type: 'phone', dur: 11, tin: 'iris', bg: 'night', side: 'left', chap: '04', kicker: 'Meet Saathi',
        title: 'Ask your society *anything*.', sub: 'An AI that knows your society — and answers from it.',
        phones: [{ clip: 'saathi_ask', map: [[0.6, 0], [2.4, 2.0], [4.4, 10.0], [5, 10.6], [11, 14]] }],
        lens: { clip: 'saathi_ask', rect: [8, 148, 396, 178], at: 5.6, t: 14 }, caps: [[2.6, 'Answers from your society’s own data', 'spark']], music: 'float' },
      { id: 'saathi_do', type: 'phone', dur: 11, tin: 'push', bg: 'night', side: 'right', chap: '04', kicker: 'Saathi does things',
        title: 'Tell it what to do. *You confirm.*', sub: 'Draft notices, start polls, watch for a flat — in 12 Indian languages.',
        phones: [{ clip: 'saathi_do', map: [[0.6, 0], [3.4, 4.2], [5, 9.8], [11, 14]] }],
        lens: { clip: 'saathi_do', rect: [8, 165, 396, 395], at: 5.8, t: 13 }, caps: [[2.4, 'Nothing happens until you tap', 'check']], music: 'float' },
      { id: 'community', type: 'trio', dur: 10, tin: 'petals', bg: 'festive', chap: '05', kicker: 'Community',
        title: 'Talk, vote, *celebrate*.',
        phones: [{ clip: 'feed', map: [[0.6, 0], [9.6, 6]], label: 'Feed & announcements' }, { clip: 'events', map: [[0.6, 4], [9.6, 10]], label: 'Festivals — every rupee tracked' }, { clip: 'polls', still: 2, label: 'Live polls' }],
        music: 'groove' },
      { id: 'cats', type: 'categories', dur: 8, tin: 'push', bg: 'deep', chap: '06', kicker: 'Marketplace', short: true,
        title: '15 categories. *All neighbours.*', phones: [{ clip: 'post', map: [[0.6, 0], [8, 7.1]] }], music: 'groove2' },
      { id: 'safety', type: 'trio', dur: 9, tin: 'iris', bg: 'deep', chap: '07', kicker: 'Safety & services',
        title: 'Help & payments, *in one tap*.',
        phones: [{ clip: 'emergency', still: 0.5, label: 'Emergency quick-dial', blur: [56, 556, 300, 274] }, { clip: 'places', map: [[0.6, 0], [8.6, 8]], label: 'Nearby places' }, { clip: 'payments', still: 2, label: 'UPI ledger' }],
        music: 'groove' },
      { id: 'wall', type: 'wall', dur: 7, tin: 'flash', bg: 'deep', short: true, music: 'peak' },
      { id: 'cta', type: 'cta', dur: 10, tin: 'iris', bg: 'cream', music: 'outro' },
    ],
  };

  // Resolve absolute start times.
  for (const k in C) {
    let t = 0;
    C[k].scenes.forEach((s, i) => {
      s.ov = s.ov ?? (i === 0 ? 0 : 1);
      if (i > 0) t -= s.ov;
      s.start = t;
      t += s.dur;
    });
    C[k].dur = t;
  }

  if (typeof module !== 'undefined') module.exports = C; else root.CUTS = C;
})(typeof window !== 'undefined' ? window : globalThis);
