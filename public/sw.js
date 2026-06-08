/* Aangan service worker — offline shell + fast repeat loads.
   Only same-origin GETs are touched; Supabase API/realtime (cross-origin)
   always go straight to the network. */
const CACHE = 'aangan-v2';
const SHELL = ['/', '/manifest.json', '/favicon.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  // Pre-cache the app shell so the very first offline visit still loads.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.addAll(SHELL);
      } catch {
        /* best-effort — never block install on a missing asset */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave Supabase & other APIs alone

  // HTML navigations: network-first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(req)) || (await caches.match('/')) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets (JS/CSS/fonts/images): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const network = fetch(req)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});
