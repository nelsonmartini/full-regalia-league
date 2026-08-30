// Minimal service worker — exists so the site is installable ("Add to Home Screen")
// and shell pages still open if the connection drops. Not caching live data.
const CACHE = "full-regalia-shell-v68";
const SHELL = [
  "./",
  "./index.html",
  "./standings.html",
  "./picks.html",
  "./history.html",
  "./player.html",
  "./live.html",
  "./betting-guide.html",
  "./admin.html",
  "./analytics.html",
  "./css/style.css",
  "./js/app.js",
  "./js/gate.js",
  "./js/pick-utils.js",
  "./js/players.js",
  "./js/season-data.js",
  "./js/awards.js",
  "./js/admin.js",
  "./js/picks.js",
  "./js/live-scores.js",
  "./js/grading.js",
  "./js/team-stats.js",
  "./js/supabase-client.js",
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

  // Cross-origin (ESPN, Supabase) — always straight to network, never
  // cached or used as a fallback. Same intent as the file header: this app
  // needs live data to mean anything, so a cached score/pick from an
  // earlier visit is actively wrong, not a helpful fallback.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Same-origin (this site's own shell files + page navigations):
  // network-first, with the cache as an offline-only fallback that's kept
  // fresh on every successful fetch. Previously this was cache-first for
  // non-navigation requests (js/css files) — meaning a device whose
  // service worker hadn't yet noticed a new deploy (iOS home-screen PWAs
  // are especially unreliable about checking) could keep running OLD
  // cached JS indefinitely despite having a perfectly good connection and
  // a newer version sitting one fetch away. Confirmed real-world impact
  // (2026-08-30): a phone running an old cached JS generation showed every
  // player stuck at 0 points on Standings. Network-first removes that
  // whole failure class — as long as there's connectivity, every device
  // always gets the latest files, full stop.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
