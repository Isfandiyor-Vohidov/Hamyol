// Сервис-воркер Safar: приложение открывается без интернета, карты и фото кэшируются.
const VERSION = "safar-v155";
// Офлайн-наборы городов (js/offline.js): отдельный кэш, обновления приложения его не трогают
const OFFLINE = "safar-offline";
const MECCA_OFFLINE = "safar-mecca-offline-v1";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "css/style.css",
  "js/splash.js", "js/icons.js", "js/i18n.js", "js/i18n-extra.js", "js/content.js", "js/api.js", "js/picker.js", "js/app.js", "js/services.js", "js/climate.js", "js/planner.js", "js/account.js", "js/ai.js", "js/market.js", "js/business.js", "js/prices-data.js", "js/citypick.js", "js/prices.js", "js/map-prices.js", "js/offline.js", "js/push.js", "js/nav.js", "js/legal-data.js", "js/legal.js", "js/onboarding.js", "js/consent.js", "js/region-switch.js", "js/quicktrip.js", "js/swipe.js", "js/network.js", "js/autosave.js", "js/split.js", "js/travelinfo.js", "js/display.js", "js/recent.js", "js/packing.js", "js/report.js", "js/taxicard.js", "js/tipcalc.js", "js/partners.js", "js/poster.js", "js/holidays.js", "js/passport.js", "js/diary.js", "js/tickets.js", "js/docs.js", "js/sos.js", "js/translate-data.js", "js/translate.js", "js/triplayout.js", "js/mapfit.js", "js/homelayout.js", "js/print.js", "js/feedback.js", "js/quickfilters.js", "js/qa.js", "js/crowd.js", "js/together.js", "js/survey.js", "js/stats.js", "js/sharelist.js", "js/wordofday.js", "js/motion.js", "data/cities.js", "data/pois.js"
];
const LIB_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const MEDIA_HOSTS = ["tile.openstreetmap.org", "commons.wikimedia.org", "upload.wikimedia.org"];
const MEDIA_LIMIT = 400;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION) && k !== OFFLINE && k !== MECCA_OFFLINE && !k.startsWith("safar-az")).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

// Файлы приложения: сначала сеть (сервер отвечает 304, если файл не менялся), без связи — кэш
async function networkFirst(req, cacheName, timeout = 4000) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout))
    ]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // Без сети: свой кэш, затем офлайн-наборы (caches.match ищет во всех), затем оболочка приложения
    return (await caches.match(req)) || (await cache.match("index.html")) || Response.error();
  }
}

// Библиотеки, тайлы и фото: сначала кэш, параллельно обновление
async function staleWhileRevalidate(req, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(req)) || (await caches.match(req, { cacheName: OFFLINE }));
  const net = fetch(req).then(res => {
    if (res.ok || res.type === "opaque") {
      cache.put(req, res.clone());
      if (limit) trim(cacheName, limit);
    }
    return res;
  }).catch(() => hit);
  return hit || net;
}

// «Поделиться → Safar»: билет (PDF/фото) сохраняем в IndexedDB «Мои билеты» и открываем раздел
function shareTarget(req) {
  return (async () => {
    try {
      const form = await req.formData(), file = form.get("file");
      if (file && file.size && /^(application\/pdf|image\/)/.test(file.type)) {
        const db = await new Promise((ok, fail) => { const r = indexedDB.open("safar-tickets", 1); r.onupgradeneeded = () => r.result.createObjectStore("t", { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
        await new Promise((ok, fail) => {
          const tx = db.transaction("t", "readwrite");
          tx.objectStore("t").put({ id: "t" + Date.now().toString(36), name: String(form.get("title") || file.name || "Ticket").replace(/\.(pdf|jpe?g|png|webp)$/i, ""), mime: file.type, blob: file, date: "", kind: file.type === "application/pdf" ? "train" : "other", created: Date.now(), src: "share" });
          tx.oncomplete = ok; tx.onerror = () => fail(tx.error);
        });
      }
    } catch { /* не удалось — просто откроем раздел */ }
    return Response.redirect("./?start=tickets_new", 303);
  })();
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) return e.respondWith(shareTarget(req));
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/")) return;           // отзывы — только из сети
    // Данные (города, места, полезное) меняются редко и весят больше всего: сразу из кэша, обновление — в фоне.
    // Код и страницы — сначала из сети, чтобы старый и новый код не смешивались.
    if (url.pathname.startsWith("/data/")) return e.respondWith(staleWhileRevalidate(req, VERSION));
    e.respondWith(networkFirst(req, VERSION));
  } else if (LIB_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith(staleWhileRevalidate(req, VERSION + "-lib"));
  } else if (MEDIA_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith(staleWhileRevalidate(req, VERSION + "-media", MEDIA_LIMIT));
  }
  // Остальные API (курсы, погода, Википедия, маршруты) кэширует само приложение
});

// Push-уведомления о поездке (server/push.js): показать и по нажатию открыть нужный экран
self.addEventListener("push", e => {
  let msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch { msg = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(msg.title || "Hamyol", {
    body: msg.body || "", tag: msg.tag || "safar", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    data: { url: msg.url || "/" }, lang: msg.lang
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const win = list.find(c => c.url.startsWith(self.location.origin));
    if (win) { win.navigate?.(url); return win.focus(); }
    return self.clients.openWindow(url);
  }));
});
