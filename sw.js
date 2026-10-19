// App shell: cache-first (updated in background). Data (./data/*.json, Supabase): network-first, cache fallback.
const V = "cc-v18";
const SHELL = ["./", "index.html", "js/config.js", "js/cfg.js", "js/pokedata.js", "css/app.css", "js/app.js", "js/data.js", "js/fields.js", "js/derive.js", "js/charts.js", "js/util.js", "js/price.js", "js/bottom.js", "js/adapters/local.js", "js/adapters/supabase.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const u = new URL(req.url);
  const isData = u.pathname.includes("/web-data/") || u.hostname.endsWith("supabase.co");
  if (u.hostname.endsWith("supabase.co") && (u.pathname.includes("/auth/") || u.pathname.includes("/realtime/"))) return;
  const key = u.hostname.endsWith("supabase.co") ? req.url : u.origin + u.pathname;
  if (isData) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put(key, cp)); } return r; })
      .catch(() => caches.match(key).then((r) => r || new Response("[]", { headers: { "content-type": "application/json" } }))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => { const net = fetch(req).then((r) => { if (r.ok && (u.origin === location.origin || u.hostname.includes("fonts") || u.hostname === "cdn.jsdelivr.net")) { const cp = r.clone(); caches.open(V).then((c) => c.put(req, cp)); } return r; }).catch(() => hit); return hit || net; }));
});
