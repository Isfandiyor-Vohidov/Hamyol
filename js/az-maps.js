// Офлайн-карты городов в приложении «Азербайджан»: векторная карта города (Protomaps, данные OpenStreetMap)
// скачивается кусками по 2 МБ с докачкой (кэш safar-az-maps) и показывается без интернета библиотекой protomaps-leaflet.
// Сервер готовит карту города по первому запросу (server/az-maps.js). Сервис-воркер отдаёт куски файла из кэша (Range).
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const MAPS_CACHE = "safar-az-maps", MAPS_PARTS = "safar-az-maps-parts", MAPS_CHUNK = 2 * 1048576;
const MAPS_TX = {
  prep: ["Готовим карту города… {p}%", "Preparing the city map… {p}%"], dl: ["Скачиваем карту… {p}%", "Downloading the map… {p}%"],
  done: ["Карта города скачана — работает без интернета", "City map downloaded — works offline"],
  fail: ["Карту скачать не удалось — места сохранены. Попробуйте «Обновить» позже, скачанное не пропадёт.", "Could not download the map — places are saved. Try “Update” later; what was downloaded is kept."],
  has: ["карта {mb} МБ", "map {mb} MB"]
};
const mt2 = (k, v = {}) => { let s = MAPS_TX[k][LANG === "en" ? 1 : 0]; for (const x in v) s = s.replaceAll("{" + x + "}", v[x]); return s; };
const mapPacks = () => store.get("az_map_packs", {});
// Какая скачанная карта покрывает точку
const mapPackAt = (la, lo) => Object.entries(mapPacks()).find(([, p]) => p.b && lo >= p.b[0] && la >= p.b[1] && lo <= p.b[2] && la <= p.b[3])?.[0] || null;

// Скачать карту города: сервер готовит (если ещё нет) → кусками в кэш → собрать файл. onProgress(текст)
async function mapDownload(id, onProgress = () => {}) {
  const post = await fetch("/api/az/maps/" + encodeURIComponent(id), { method: "POST" });
  if (!post.ok) throw new Error("prepare " + post.status);
  let st = await post.json();
  while (!st.ready) {
    if (st.error) throw new Error(st.error);
    onProgress(mt2("prep", { p: st.progress || 0 }));
    await new Promise(r => setTimeout(r, 2500));
    st = await (await fetch("/api/az/maps/" + encodeURIComponent(id), { cache: "no-store" })).json();
  }
  const url = `/az-maps/${id}.pmtiles`, size = st.size, n = Math.ceil(size / MAPS_CHUNK);
  const cache = await caches.open(MAPS_CACHE), parts = await caches.open(MAPS_PARTS);
  // Та же карта уже есть — только обновляем запись
  const have = await cache.match(url);
  if (!have || +have.headers.get("X-Size") !== size) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const key = `${url}?v=${size}&part=${i}`, from = i * MAPS_CHUNK, to = Math.min(size, from + MAPS_CHUNK) - 1;
      if (await parts.match(key)) { got += to - from + 1; continue; }
      const res = await fetch(url + "?dl=1", { cache: "no-store", headers: { Range: `bytes=${from}-${to}` } });
      if (res.status !== 206) throw new Error("http " + res.status);
      const buf = [], reader = res.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf.push(value); got += value.length; onProgress(mt2("dl", { p: Math.round(got / size * 100) })); }
      await parts.put(key, new Response(new Blob(buf)));
    }
    const blobs = await Promise.all(Array.from({ length: n }, async (_, i) => (await parts.match(`${url}?v=${size}&part=${i}`)).blob()));
    await cache.put(url, new Response(new Blob(blobs), { headers: { "Content-Type": "application/octet-stream", "X-Size": String(size) } }));
    await Promise.all(Array.from({ length: n }, (_, i) => parts.delete(`${url}?v=${size}&part=${i}`)));
  }
  const packs = mapPacks();
  packs[id] = { b: st.bbox, size, at: Date.now() };
  store.set("az_map_packs", packs);
  return size;
}
async function mapDelete(id) {
  try { await (await caches.open(MAPS_CACHE)).delete(`/az-maps/${id}.pmtiles`); } catch { /* уже нет */ }
  const packs = mapPacks();
  delete packs[id];
  store.set("az_map_packs", packs);
}

// Подложка карты: в скачанном городе — своя векторная карта (работает офлайн), иначе — плитки OpenStreetMap
let pmLibP = null;
function loadPmLib() {
  if (window.protomapsL) return Promise.resolve(true);
  pmLibP ||= new Promise(ok => {
    const s = document.createElement("script");
    s.src = "/az-maps/lib.js";
    s.onload = () => ok(!!window.protomapsL);
    s.onerror = () => { pmLibP = null; ok(false); };
    document.head.appendChild(s);
  });
  return pmLibP;
}
function azBase(map, center, opts = {}) {
  const id = center && mapPackAt(center[0], center[1]);
  const raster = () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: opts.noAttr ? "" : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  if (!id) return raster();
  loadPmLib().then(ok => {
    if (!ok || !map._container?.isConnected) return ok || raster();
    protomapsL.leafletLayer({ url: `/az-maps/${id}.pmtiles`, flavor: isDark() ? "dark" : "light", lang: LANG === "en" ? "en" : "ru", maxZoom: 19,
      attribution: opts.noAttr ? "" : '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    map.getContainer().classList.add("az-map-vector");
  });
}
