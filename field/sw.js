const CACHE = 'svampespot-field-v33';
const SHELL = [
  './',
  './index.html',
  './app.js?v=2026-08-17-28',
  './core.js',
  './default-spots.js?v=2026-08-17-28',
  './map.js?v=2026-08-17-28',
  './map-modes.js?v=2026-08-17-28',
  './rank-display.js?v=2026-08-17-28',
  './spot-mode.js?v=2026-08-17-28',
  './storage.js',
  './styles.css?v=2026-08-17-28',
  './spot-styles.css?v=2026-08-17-28',
  './weather.js',
  './spots/regions.json',
  './spots/silkeborg.json',
  './public-land/silkeborg.json',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const needsFreshData = url.pathname.includes('/spots/')
    || url.pathname.includes('/public-land/');
  if (event.request.mode === 'navigate' || needsFreshData) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(async (response) => {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
      return response;
    }).catch(async () => (
      await caches.match(event.request)
      || (event.request.mode === 'navigate' ? await caches.match('./index.html') : null)
    )));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })),
  );
});
