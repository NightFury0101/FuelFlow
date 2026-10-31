// FuelFlow service worker — lets the app open and work without a connection.
// build.mjs fills in the version and the list of files at build time.
// It caches only the app itself and its fonts. It never caches account data, food searches
// or AI requests, which always go to the network.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP_CACHE = `fuelflow-app-${VERSION}`;
const FONT_CACHE = 'fuelflow-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      // cache: 'reload' skips the browser's HTTP cache. GitHub Pages lets browsers reuse files
      // for 10 minutes, so without it a fresh deploy could be saved with a stale main.js that
      // still points at the previous version's code.
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fuelflow-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const indexUrl = () => new URL('./index.html', self.registration.scope).href;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      // Newest page when online; the saved copy when offline.
      event.respondWith(
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(APP_CACHE).then((c) => c.put(indexUrl(), copy));
            }
            return res;
          })
          .catch(() => caches.match(indexUrl()).then((hit) => hit || Response.error())),
      );
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Fonts: use the saved copy straight away and refresh it in the background.
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const fresh = fetch(req)
            .then((res) => {
              if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || fresh;
        }),
      ),
    );
  }
});
