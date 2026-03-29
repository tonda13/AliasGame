// ==============================================
// sw.js – Alias Game Service Worker
// ==============================================
const CACHE_NAME = 'alias-game-v1.2.18';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/sounds.js',
  '/js/helpers.js',
  '/js/navigation.js',
  '/js/state.js',
  '/js/screen-home.js',
  '/js/screen-setup.js',
  '/js/screen-game.js',
  '/js/screen-cards.js',
  '/js/main.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API volání: network-first (offline = chyba)
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline – API není dostupné' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }
  // Statické soubory: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
