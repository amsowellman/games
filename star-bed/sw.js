/* STAR BED service worker — offline support (e.g. GitHub Pages).
   Strategy: navigations (page loads) are network-first with a cache
   fallback, so updated game code reaches players on their next reload;
   same-origin assets are cache-first. */
const CACHE = "star-bed-v2";
const ASSETS = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.mode === "navigate") {
    // Always try the fresh page first; fall back to cache when offline.
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { // never cache 404/500 pages as the offline fallback
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        }
        return caches.match(req, { ignoreSearch: true }).then(hit => hit || res);
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./")))
    );
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
