// Сервис-воркер приложения «Азербайджан» (/az): своё приложение открывается без интернета.
// Отдельный от узбекского sw.js и управляет только страницей /az (scope "/az"); чужие кэши не трогает.
const V = "safar-az-v30";
const DATA = "safar-az-offline";   // скачанные города (/az-offline/…) — обновления приложения их не удаляют
const TILES = "safar-az-tiles";    // подложка карты — только те места, которые человек уже смотрел
const TILE_LIMIT = 800;
const PHOTOS = "safar-az-photos";   // фото городов и мест (Wikimedia) — для скачанных городов и всего, что уже смотрели
const PHOTO_LIMIT = 1500;
const MT = "safar-az-mt";          // офлайн-переводчик (движок и модели Mozilla) — скачивается по кнопке, обновления его не удаляют
const OCR = "safar-az-ocr";        // перевод по фото (распознавание текста) — скачивается по кнопке
const MAPS = "safar-az-maps";      // офлайн-карты городов (векторные, js/az-maps.js) — обновления приложения их не удаляют
const SHELL = ["/az", "/css/style.css", "/css/az.css", "/js/az-app.js", "/js/az-nav.js", "/js/az-transit.js", "/js/az-talk.js", "/js/az-places.js", "/js/az-maps.js", "/js/az-photo.js", "/js/az-taxi.js", "/js/az-simple.js", "/az-maps/lib.js", "/data/az-transit.js", "/js/icons.js", "/icons/icon.svg", "/data/az-cities.js", "/data/az-pois.js"];
const LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    await (await caches.open(V)).addAll(SHELL);
    // Карта (Leaflet) — чтобы офлайн-карта городов открывалась и без сети; не вышло — не страшно
    try { await (await caches.open(V + "-lib")).addAll(LIBS); } catch { /* без сети */ }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("safar-az-v") && k !== V && k !== V + "-lib").map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(V);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 5000))]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // Сначала — свой кэш: в кэшах узбекского приложения могут лежать старые копии тех же файлов
    return (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("/az") : null) ||
      (await caches.match(req, { ignoreSearch: true })) || Response.error();
  }
}
async function cacheFirst(req, name, limit) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") {
      await cache.put(req, res.clone());
      if (limit) cache.keys().then(k => { if (k.length > limit) k.slice(0, k.length - limit).forEach(r => cache.delete(r)); });
    }
    return res;
  } catch { return Response.error(); }
}

async function mapRange(req, url) {
  const hit = await (await caches.open(MAPS)).match(url.pathname);
  if (!hit) { try { return await fetch(req); } catch { return new Response("", { status: 404 }); } }
  const blob = await hit.blob(), m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") || "");
  if (!m) return new Response(blob, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(blob.size) } });
  const start = +m[1], end = m[2] ? Math.min(+m[2], blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(start, end + 1), { status: 206, headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${start}-${end}/${blob.size}`, "Content-Length": String(end - start + 1) } });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/")) return;                       // чат и вход — только из сети
    // Переводчик (движок и модели не меняются): из кэша; ?dl=1 — скачивание по кнопке, его приложение кладёт в кэш само
    if (url.pathname.startsWith("/az-mt/")) return url.searchParams.has("dl") ? undefined : e.respondWith(cacheFirst(req, MT));
    if (url.pathname.startsWith("/az-ocr/")) return url.searchParams.has("dl") ? undefined : e.respondWith(cacheFirst(req, OCR));
    // Офлайн-карта города: файл целиком в кэше, библиотека карты читает его кусками (Range) — отдаём нужный кусок
    if (/^\/az-maps\/[\w-]+\.pmtiles$/.test(url.pathname) && !url.searchParams.has("dl")) return e.respondWith(mapRange(req, url));
    if (url.pathname.startsWith("/az-offline/")) return e.respondWith(caches.match(req).then(r => r || new Response("{}", { status: 404 })));
    return e.respondWith(networkFirst(req));
  }
  if (url.hostname.endsWith("tile.openstreetmap.org")) return e.respondWith(cacheFirst(req, TILES, TILE_LIMIT));
  if (/(^|\.)wikimedia\.org$/.test(url.hostname)) return e.respondWith(cacheFirst(req, PHOTOS, PHOTO_LIMIT));
  if (url.hostname === "cdnjs.cloudflare.com" || url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) return e.respondWith(cacheFirst(req, V + "-lib"));
});
