// Minimal service worker — exists so the site is installable ("Add to Home Screen")
// and shell pages still open if the connection drops. Not caching live data.
const CACHE = "full-regalia-shell-v2";
const SHELL = [
  "./",
  "./index.html",
  "./standings.html",
  "./picks.html",
  "./history.html",
  "./player.html",
  "./live.html",
  "./betting-guide.html",
  "./css/style.css",
  "./js/app.js",
  "./js/gate.js",
  "./js/standings-data.js",
  "./js/history-data.js",
  "./js/picks.js",
  "./js/live-scores.js",
  "./js/grading.js",
  "./manifest.json",
  "./icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  // Cache each shell file individually (not cache.addAll) so one bad response —
  // e.g. a host that 301-redirects "/page.html" to "/page" — can't abort the whole
  // install and leave every other page uncached.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => {}))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Page navigations go network-first: some hosts (e.g. local dev servers) redirect
  // "/page.html" to "/page", and serving a cached response for a navigation request
  // in that situation fails in Chromium. Only fall back to cache when offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
