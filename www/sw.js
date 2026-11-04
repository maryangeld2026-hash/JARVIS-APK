/* Jarvis para Android (versión web): guarda la app en el celular para que abra sin internet.
   La IA sí necesita internet; las herramientas de la clase y los quices guardados funcionan sin conexión. */
const CACHE = "jarvis-3.13";
const FILES = ["./", "index.html", "css/app.css", "js/logica.js", "js/logica2.js", "js/app2.js", "js/hud.js", "js/logica3.js", "js/habilidades.js", "js/logica4.js", "js/mas.js", "js/omr.js", "js/logica5.js", "js/logica6.js", "vendor/nerdamer.min.js", "js/control.js", "js/extra.js", "js/live.js", "js/ahorro.js", "js/general.js", "js/logica7.js", "js/vida.js", "js/logica8.js", "js/casa.js", "js/logica9.js", "js/agente.js", "js/logica10.js", "vendor/qrcode.js", "js/datos.js", "js/voz.js", "js/ia.js", "js/pdf.js", "js/app.js", "js/mdmath.js",
  "vendor/katex/katex.min.js", "vendor/katex/katex.min.css", "vendor/jspdf.umd.min.js", "vendor/fuente-pdf.js", "manifest.webmanifest",
  "img/icono-192.png", "img/icono-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // la IA va directo a internet
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match("index.html"))));
});
