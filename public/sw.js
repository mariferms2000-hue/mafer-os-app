/* Service worker de Mafer OS — comportamiento offline amable.
   Estrategia: red primero; si no hay red, página de aviso. Los íconos se cachean. */
const CACHE = "mafer-os-v1";
const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Mafer OS</title>
<style>body{font-family:system-ui;background:#faf7f1;color:#2e2b25;display:grid;place-items:center;min-height:100dvh;margin:0;text-align:center;padding:24px}
h1{color:#324230;font-weight:600}p{color:#7c766a;max-width:34ch}</style></head>
<body><div><h1>🌿 Sin conexión a internet</h1>
<p>Mafer OS necesita internet para cargar. Revisa tu conexión Wi-Fi o datos móviles e intenta de nuevo. Tus datos están a salvo.</p>
</div></body></html>`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() =>
        new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      )
    );
  }
});
