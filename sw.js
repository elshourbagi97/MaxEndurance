/* AeroCalc offline app shell. Map imagery is intentionally network-only. */
const CACHE_NAME = "aerocalc-shell-v2";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("aerocalc-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Cache same-origin app files. HTML uses network-first so deployments update cleanly.
  if (url.origin === self.location.origin) {
    if (request.mode === "navigate" || (request.destination === "document")) {
      event.respondWith(fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
        return response;
      }).catch(() => caches.match("./index.html").then(response => response || caches.match("./"))));
      return;
    }
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }
  // Remember third-party static libraries (Leaflet JS/CSS) after first online load.
  // Do not cache map tiles: they are large, dynamic imagery served by the map provider.
  if (/unpkg\.com|cdn\.jsdelivr\.net/.test(url.hostname) && /leaflet/i.test(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === "opaque")) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        const fallback = await cache.match(request);
        if (fallback) return fallback;
        throw error;
      }
    }));
  }
});
