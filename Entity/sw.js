/* ============================================================
   DarkTrace — Service Worker (sw.js)
   Network-first strategy for HTML and API; cache fallback for offline.
   ============================================================ */

const CACHE_NAME = 'darktrace-v4';

// Assets to pre-cache on install
const PRE_CACHE = [
  '/',
  '/index.html',
  '/signin',
  '/signin.html',
  '/signup',
  '/signup.html',
  '/style.css',
  '/auth.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: pre-cache shell assets ───────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRE_CACHE))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Network-first for pages and API; cache fallback ────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: Network only (with offline fallback JSON)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — no network connection.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // HTML pages & CSS & JS: Network-first so updates are immediately visible
  if (request.mode === 'navigate' || request.destination === 'document' || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && request.method === 'GET' && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other static assets (images, icons): Cache-first with network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET' && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
