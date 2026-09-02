/* Service worker de dots — conservador a propósito.
 *
 * Reglas inviolables (romperlas afecta a usuarios reales de forma pegajosa):
 *  - JAMÁS interceptar cross-origin: la API (cookie HttpOnly + Bearer, con
 *    su 401→refresh→retry en axios) y Cloudinary quedan intactos.
 *  - JAMÁS cachear HTML ni fetches RSC (?_rsc=): el HTML va autenticado y un
 *    HTML stale referencia chunks de un BUILD_ID purgado (404s tras deploy).
 *  - JAMÁS tocar métodos ≠ GET ni requests con Range (seek de <audio controls>).
 *
 * Si cambias este archivo u offline.html, BUMPEA SW_VERSION: activate borra
 * los caches dots-* de versiones anteriores.
 * Emergencia en producción: instrucciones en public/sw.kill.js.
 */
const SW_VERSION = "v1";

const PRECACHE = `dots-precache-${SW_VERSION}`; // fijo, sin trim
const STATIC = `dots-static-${SW_VERSION}`; //   runtime, con trim
const MEDIA = `dots-media-${SW_VERSION}`; //     runtime, con trim

const OFFLINE_URL = "/offline.html";
// Rutas EXACTAS como las pide la app (lib/feedback-sounds.ts, manifest).
// Si una 404ea, addAll aborta el install completo: verificar al tocar.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/sounds/answers/correct.wav",
  "/sounds/answers/wrong.wav",
];

const STATIC_MAX = 150;
const MEDIA_MAX = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keep = new Set([PRECACHE, STATIC, MEDIA]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("dots-") && !keep.has(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/* keys() conserva orden de inserción: borrar desde el inicio ≈ LRU barato. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    trim(cacheName, max); // sin await: limpieza oportunista
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) {
        cache.put(request, res.clone()).then(() => trim(cacheName, max));
      }
      return res;
    })
    .catch(() => undefined);
  if (cached) return cached;
  return (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; //             POST/PUT/DELETE: ni mirarlos
  if (req.headers.has("range")) return; //         seek de audio: directo a red
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API/Cloudinary: intactos

  // Navegaciones (todo HTML, incl. /readings/[id] e /invite/[token]):
  // red siempre; solo si la red FALLA, la página offline precacheada.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(req);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.searchParams.has("_rsc")) return; //     payloads RSC: nunca cachear

  // Chunks/CSS/fuentes hasheados: inmutables por contenido → cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC, STATIC_MAX));
    return;
  }

  // Optimizador de imágenes (proxy same-origin, también de las de Cloudinary).
  if (url.pathname === "/_next/image") {
    event.respondWith(staleWhileRevalidate(req, MEDIA, MEDIA_MAX));
    return;
  }

  // Estáticos locales de public/ (NUNCA precache: pesan 80+ MB en total).
  if (/^\/(images|sounds|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(req, MEDIA, MEDIA_MAX));
    return;
  }

  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(staleWhileRevalidate(req, STATIC, STATIC_MAX));
    return;
  }
  // Todo lo demás same-origin: sin respondWith — camino normal del navegador.
});
