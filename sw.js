// Bump the version after any change so phones pick up the new files
const CACHE = 'dealcheck-v3';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// cache:'reload' skips the browser's HTTP cache, so a new version
// never gets filled with the previous version's files
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first: opens instantly and works with no connection at all
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))
  );
});
