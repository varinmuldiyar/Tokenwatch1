// TokenWatch Service Worker v2
const CACHE_NAME = 'tokenwatch-v2';
const SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: shell from cache, API calls through network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Let Anthropic API calls pass through untouched
  if (url.hostname === 'api.anthropic.com') return;
  // Serve shell files from cache, falling back to network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
