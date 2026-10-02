// Network first with a short timeout:
// - with internet: always serves the newest files from the server and refreshes the offline copy
// - with no or weak signal: falls back to the saved copy after TIMEOUT_MS
const CACHE = 'dealcheck';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const TIMEOUT_MS = 3000;

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

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const key = req.mode === 'navigate' ? './index.html' : req;
  const fromNet = fetch(req, { cache: 'no-store' }).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  const timeout = new Promise(r => setTimeout(r, TIMEOUT_MS));
  try {
    const res = await Promise.race([fromNet, timeout]);
    if (res) return res;
  } catch (_) { /* offline */ }
  const cached = await cache.match(key, { ignoreSearch: true });
  return cached || fromNet; // nothing saved yet: keep waiting for the network
}
