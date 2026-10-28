// Офлайн-карты городов для приложения «Азербайджан»: векторные плитки Protomaps (данные OpenStreetMap).
// Карту города сервер вырезает один раз по первому запросу (server/pmtiles-extract.js) и хранит в STORAGE/az-maps;
// телефон скачивает её кусками (Range, с докачкой) и показывает без интернета (js/az-maps.js, библиотека protomaps-leaflet).
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const env = require("./env");
const { send, sendJSON, HttpError } = require("./http");
const { extract } = require("./pmtiles-extract");

const DIR = path.join(env.STORAGE, "az-maps");
const LIB = path.join(env.ROOT, "vendor", "protomaps", "protomaps-leaflet.js");
const AZ = [44.75, 38.39, 50.6, 41.92];   // вся страна — мелко (уровни 0–9), чтобы видеть, где вы
// Города — из data/az-cities.js (тот же список, что «Без интернета» в приложении)
let CITIES = null;
function cities() {
  if (CITIES) return CITIES;
  const win = {};
  new Function("window", fs.readFileSync(path.join(env.ROOT, "data", "az-cities.js"), "utf8"))(win);
  CITIES = new Map((win.SAFAR_CITIES?.cities || []).map(c => [c.id, c]));
  return CITIES;
}
// Рамки города: весь город — подробно (до 14), центр — очень подробно (15). Баку — с Апшероном
function areasFor(c) {
  const km = c.n?.en === "Baku" ? null : (c.pop || 0) > 200000 ? 10 : (c.pop || 0) > 50000 ? 6 : 4;
  const box = (r, la = c.lat, lo = c.lon) => [lo - r / (111 * Math.cos(la * Math.PI / 180)), la - r / 111, lo + r / (111 * Math.cos(la * Math.PI / 180)), la + r / 111];
  const city = km ? box(km) : [49.65, 40.28, 50.15, 40.55];
  const core = km ? box(Math.min(km, 3)) : [49.78, 40.34, 49.93, 40.43];
  return [{ bbox: AZ, minz: 0, maxz: 9 }, { bbox: city, minz: 10, maxz: 14 }, { bbox: core, minz: 15, maxz: 15 }];
}
// Самая свежая сборка Protomaps (список обновляем раз в сутки)
let build = { at: 0, url: "" };
async function sourceUrl() {
  if (build.url && Date.now() - build.at < 864e5) return build.url;
  try {
    const list = await (await fetch("https://build-metadata.protomaps.dev/builds.json", { signal: AbortSignal.timeout(20e3) })).json();
    build = { at: Date.now(), url: "https://build.protomaps.com/" + list[list.length - 1].key };
  } catch {
    // Список сборок не ответил — ищем свежую сборку по дате (выходят почти каждый день)
    if (!build.url) for (let d = 0; d < 10 && !build.url; d++) {
      const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      const ok = await fetch(`https://build.protomaps.com/${day}.pmtiles`, { method: "HEAD", signal: AbortSignal.timeout(15e3) }).then(r => r.ok, () => false);
      if (ok) build = { at: Date.now() - 864e5 + 3600e3, url: `https://build.protomaps.com/${day}.pmtiles` };   // через час спросим список снова
    }
    if (!build.url) throw new HttpError(502, "map source unavailable");
  }
  return build.url;
}

const jobs = new Map();   // id → { progress, error, promise }
const file = id => path.join(DIR, id + ".pmtiles");
const ready = id => fsp.stat(file(id)).then(s => s.size, () => 0);
async function status(id) {
  const size = await ready(id), j = jobs.get(id);
  const c = cities().get(id);
  return { id, ready: size > 0, size, building: !!j && !j.error, progress: j ? Math.round(j.progress) : size ? 100 : 0, error: j?.error || "", bbox: c ? areasFor(c)[1].bbox.map(v => +v.toFixed(4)) : null };
}
function startBuild(id, c) {
  if (jobs.has(id) && !jobs.get(id).error) return;
  if ([...jobs.values()].filter(j => !j.error).length >= 2) throw new HttpError(429, "busy");
  const job = { progress: 0, error: "" };
  jobs.set(id, job);
  job.promise = (async () => {
    try {
      const { buf } = await extract(await sourceUrl(), areasFor(c), [c.lat, c.lon], (d, t) => { job.progress = d / t * 100; });
      await fsp.mkdir(DIR, { recursive: true });
      const tmp = file(id) + "." + process.pid + ".part";
      await fsp.writeFile(tmp, buf);
      await fsp.rename(tmp, file(id));
      jobs.delete(id);
    } catch (e) { job.error = String(e.message || e).slice(0, 200); console.error("az-maps", id, e.message); setTimeout(() => jobs.get(id) === job && jobs.delete(id), 60e3); }
  })();
}
const cityOr404 = id => { const c = cities().get(id); if (!c) throw new HttpError(404, "no city"); return c; };

const routes = [
  // Библиотека отрисовки векторной карты (protomaps-leaflet, BSD-3) — со своего сервера, чтобы работала офлайн
  ["GET", "/az-maps/lib.js", async (req, res) => send(req, res, 200, await fsp.readFile(LIB), "text/javascript; charset=utf-8", "no-cache")],
  ["GET", /^\/api\/az\/maps\/([\w-]+)$/, async (req, res, url, m) => { cityOr404(m[1]); sendJSON(req, res, 200, await status(m[1])); }],
  // Подготовить карту города (если ещё нет) — телефон потом спрашивает, готово ли
  ["POST", /^\/api\/az\/maps\/([\w-]+)$/, async (req, res, url, m) => {
    const c = cityOr404(m[1]);
    if (!(await ready(m[1]))) startBuild(m[1], c);
    sendJSON(req, res, 200, await status(m[1]));
  }],
  // Сам файл карты — целиком или кусками (Range): телефон докачивает с места обрыва
  ["GET", /^\/az-maps\/([\w-]+)\.pmtiles$/, async (req, res, url, m) => {
    const size = await ready(m[1]);
    if (!size) return send(req, res, 404, "Not ready", "text/plain; charset=utf-8");
    const head = { "Content-Type": "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
    const rg = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    if (rg) {
      const start = +rg[1], end = Math.min(rg[2] ? +rg[2] : size - 1, size - 1);
      if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { ...head, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}` });
      return fs.createReadStream(file(m[1]), { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, "Content-Length": size });
    fs.createReadStream(file(m[1])).pipe(res);
  }]
];

module.exports = { routes, areasFor };
