// App files: network first with a short timeout
//   with internet -> always the newest version, and the offline copy is refreshed
//   no or weak signal -> the saved copy after TIMEOUT_MS
// vendor/ (OCR engine and language models, ~8MB): cache first, they never change
const CACHE = 'dealcheck';
const VENDOR = 'dealcheck-vendor-1'; // bump only when files in vendor/ change
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const VENDOR_FILES = ['./vendor/tesseract.min.js', './vendor/worker.min.js',
  './vendor/tesseract-core-simd-lstm.wasm.js',
  './vendor/lang/heb.traineddata.gz', './vendor/lang/eng.traineddata.gz'];
const TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))),
    caches.open(VENDOR).then(async c => {
      for (const f of VENDOR_FILES) if (!(await c.match(f))) await c.add(new Request(f, { cache: 'reload' }));
    })
  ]));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== VENDOR).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(url.pathname.includes('/vendor/') ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const c = await caches.open(VENDOR);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}

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
  return cached || fromNet;
}
