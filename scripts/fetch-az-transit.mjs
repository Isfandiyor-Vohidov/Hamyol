// Сборщик транспорта для приложения «Азербайджан»: метро и автобусы Баку (OpenStreetMap, маршруты и остановки)
// и расписание поездов ADY (электрички по Апшерону и межгород — с rail.day.az, данные ADY / ticket.ady.az).
// Запуск:  node scripts/fetch-az-transit.mjs   (--fresh — без кэша)
// Результат: data/az-transit.js (window.SAFAR_TRANSIT). Узбекские и мекканские данные не трогает.
import { writeFile, mkdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "az-transit");
const FRESH = process.argv.includes("--fresh");
const UA = "HamyolTravelApp/1.0 (data builder)";
const OVERPASS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"   // бывает неполным — последним
];
// Баку и Апшерон (Сумгаит, Хырдалан) — здесь городской транспорт
const BBOX = "40.25,49.55,40.70,50.45";
const RAIL = "https://rail.day.az/en";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cached(key, fn) {
  const file = join(CACHE, createHash("sha1").update(key).digest("hex") + ".json");
  if (!FRESH) try { if ((await stat(file)).mtimeMs > Date.now() - 7 * 864e5) return JSON.parse(await readFile(file, "utf8")); } catch { /* нет кэша */ }
  const data = await fn();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}
async function overpass(query, label, minCount = 0) {
  return cached("op:" + query, async () => {
    for (let round = 0; round < 4; round++) {
      for (const url of OVERPASS) {
        try {
          const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: AbortSignal.timeout(240e3),
            headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } });
          if (!r.ok) { console.log(`  ${label}: ${new URL(url).host} → ${r.status}`); continue; }
          const j = await r.json();
          if (j.remark || (minCount && j.elements.length < minCount)) { console.log(`  ${label}: ${new URL(url).host} → неполный ответ (${j.elements.length})`); continue; }
          console.log(`  ${label}: ${j.elements.length} элементов (${new URL(url).host})`);
          return j;
        } catch (e) { console.log(`  ${label}: ${new URL(url).host} → ${e.message}`); }
      }
      await sleep(15000 * (round + 1));
    }
    throw new Error("Overpass недоступен: " + label);
  });
}
async function page(path) {
  return cached("rail:" + path, async () => {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(RAIL + path, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40e3) });
        if (r.ok) { await sleep(700); return await r.text(); }
      } catch { /* повтор */ }
      await sleep(3000);
    }
    throw new Error("rail.day.az: " + path);
  });
}
const text = h => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const toMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

// ---------- 1. Метро и автобусы из OpenStreetMap ----------
async function cityTransit() {
  // Тремя запросами поменьше: одним большим серверы Overpass часто не справляются (504)
  const REL = `rel(${BBOX})[type=route][route~"^(subway|bus|trolleybus|minibus)$"]`;
  const rels = await overpass(`[out:json][timeout:180];${REL};out body;`, "маршруты", 200);
  const pts = await overpass(`[out:json][timeout:180];${REL}->.r;node(r.r);out body;`, "остановки", 500);
  const plat = await overpass(`[out:json][timeout:180];${REL}->.r;way(r.r)[~"^(public_transport|highway|railway)$"~"^(platform|bus_stop)$"];out center tags;`, "платформы");
  const j = { elements: [...rels.elements, ...pts.elements, ...plat.elements] };
  const nodes = new Map(j.elements.filter(e => e.type === "node").map(e => [e.id, e]));
  // Платформы, нарисованные линией, — берём их центр
  const ways = new Map(j.elements.filter(e => e.type === "way" && e.center).map(e => [e.id, { id: "w" + e.id, lat: e.center.lat, lon: e.center.lon, tags: e.tags }]));
  const stops = [], stopIdx = new Map();
  // Остановки с одинаковым названием ближе 60 м — одна (обе стороны улицы)
  const addStop = n => {
    const name = n.tags?.["name:az"] || n.tags?.name || "";
    const key = n.id;
    if (stopIdx.has(key)) return stopIdx.get(key);
    const near = name ? stops.findIndex(s => s[2] === name && Math.abs(s[0] - n.lat) < 0.0006 && Math.abs(s[1] - n.lon) < 0.0008) : -1;
    if (near >= 0) { stopIdx.set(key, near); return near; }
    stops.push([+n.lat.toFixed(5), +n.lon.toFixed(5), name, n.tags?.["name:ru"] || "", n.tags?.["name:en"] || ""]);
    stopIdx.set(key, stops.length - 1);
    return stops.length - 1;
  };
  const routes = [];
  for (const r of j.elements.filter(e => e.type === "relation")) {
    const t = r.tags || {};
    const seq = [];
    for (const m of r.members || []) {
      if (m.type === "relation" || !/^(stop|stop_entry_only|stop_exit_only|platform|platform_entry_only|platform_exit_only|)$/.test(m.role)) continue;
      const n = m.type === "node" ? nodes.get(m.ref) : ways.get(m.ref);
      if (!n) continue;
      // Для остановки берём сам «stop» или платформу — что есть
      const i = addStop(n);
      if (seq[seq.length - 1] !== i) seq.push(i);
    }
    if (seq.length < 2) continue;
    const mode = t.route === "subway" ? "metro" : "bus";
    routes.push({
      m: mode, ref: t.ref || "", n: t["name:az"] || t.name || "", nr: t["name:ru"] || "", ne: t["name:en"] || "",
      c: t.colour || "", fr: t.from || "", to: t.to || "",
      hw: +((t.interval || "").match(/\d+/)?.[0] || 0) || 0,
      s: seq
    });
  }
  console.log(`  метро: ${routes.filter(r => r.m === "metro").length} направлений, автобусы: ${routes.filter(r => r.m === "bus").length}, остановок: ${stops.length}`);
  return { stops, routes };
}

// ---------- 2. Поезда ADY: маршруты (будни и выходные) → страницы поездов с остановками ----------
async function railTimetable() {
  const home = await page("/");
  const routePaths = [...new Set([...home.matchAll(/href="\/en(\/route\/[\w-]+)"/g)].map(m => m[1]))];
  const trains = new Map();
  for (const rp of routePaths) {
    for (const day of ["", "?day=holidays"]) {
      const h = await page(rp + day);
      for (const m of h.matchAll(/href="\/en\/train\/([\w-]+)"/g)) trains.set(m[1], true);
    }
  }
  console.log(`  поездов: ${trains.size} (${routePaths.length} направлений)`);
  const out = [];
  for (const num of trains.keys()) {
    // Поезда только выходного дня (Баку–Габала и др.) — их остановки на вкладке «Non-working days»
    let h = await page("/train/" + num);
    if (!/timeline__time/.test(h)) h = await page("/train/" + num + "?day=holidays");
    const x = text(h.slice(h.indexOf("<main")));
    const route = x.match(/Route (.+?) → (.+?) Train type/);
    const days = x.match(/Days of operation (.+?) Trip/)?.[1] || "";
    // Остановки — пункты «timeline»: время и станция (в названии бывают цифры: «Zabrat 2»)
    const stops = [...h.matchAll(/timeline__time">(\d\d:\d\d)<\/span>[\s\S]*?timeline__station"[^>]*>([^<]+)</g)].map(m => [m[1], text(m[2])]);
    if (!route || stops.length < 2) { console.log("  ! не разобрал поезд", num); continue; }
    // Через полночь — время продолжается (23:00 → 24:15)
    let prev = 0, add = 0;
    const st = stops.map(([tm, name]) => { let v = toMin(tm) + add; if (v < prev) { add += 1440; v += 1440; } prev = v; return [v, name]; });
    out.push({
      n: num, f: route[1].trim(), t: route[2].trim(),
      k: /^6\d{3}$/.test(num) ? "sub" : /-/.test(num) || /Tbilisi/.test(route[2] + route[1]) ? "int" : "dom",
      ex: /Express/i.test(x.slice(0, 400)),
      d: { w: /Working days/i.test(days), sa: /Saturday/i.test(days), h: /Non-working days/i.test(days) },
      s: st
    });
  }
  return out;
}

// ---------- 3. Вокзалы и станции: координаты (OSM, railway=station|halt по Азербайджану) ----------
async function railStations() {
  const j = await overpass(`[out:json][timeout:120];
area["ISO3166-1"="AZ"][admin_level=2]->.a;
node(area.a)["railway"~"^(station|halt)$"];
out body;`, "станции");
  return j.elements.map(e => ({ la: +e.lat.toFixed(5), lo: +e.lon.toFixed(5), n: e.tags?.name || "", az: e.tags?.["name:az"] || "", en: e.tags?.["name:en"] || "", ru: e.tags?.["name:ru"] || "", sub: e.tags?.station === "subway" || e.tags?.subway === "yes" }));
}
// Английское имя ADY → станция OSM (транслитерация азербайджанских букв)
const latin = s => (s || "").toLowerCase().replace(/ə/g, "a").replace(/ı/g, "i").replace(/ş/g, "sh").replace(/ç/g, "ch").replace(/ğ/g, "gh").replace(/ö/g, "o").replace(/ü/g, "u").replace(/x/g, "kh")
  .replace(/q/g, "g").replace(/[^a-z0-9]/g, "");
const ALIAS = { baku: ["bakidemiryolvagzali", "baki", "bakuraliwaystation", "baku"], ganja: ["ganja", "gandja", "ganca"], aghstafa: ["aghstafa", "agstafa"], khirdalan: ["khirdalan", "xirdalan"], sumgayit: ["sumgayit", "sumgait", "sumgayit"] };
function matchStation(name, stations) {
  const want = [latin(name), ...(ALIAS[latin(name)] || [])];
  const cand = stations.filter(s => !s.sub).map(s => ({ s, keys: [s.en, s.az, s.n].map(latin).map(k => k.replace(/(demiryolu?)?(vagzali|stansiyasi|station|railwaystation|stansiya)$/, "")) }));
  return (cand.find(c => c.keys.some(k => want.includes(k))) || cand.find(c => c.keys.some(k => want.some(w => w && k.startsWith(w)))))?.s || null;
}

const city = await cityTransit();
const trains = await railTimetable();
const stations = await railStations();
const names = [...new Set(trains.flatMap(t => t.s.map(s => s[1])))];
// Станции, которых в OSM нет под таким именем, — координаты вручную (по карте)
const MANUAL_ST = { Baku: [40.37835, 49.84725, "Bakı Dəmiryol Vağzalı"], Koroglu: [40.4183, 49.9203, "Koroğlu"], Kurdamir: [40.3426, 48.1597, "Kürdəmir"], Ujar: [40.5145, 47.6527, "Ucar"], Gardabani: [41.4593, 45.0919, "Gardabani"], Tbilisi: [41.7212, 44.7975, "Tbilisi"] };
const railSt = names.map(n => { if (MANUAL_ST[n]) return [n, ...MANUAL_ST[n]]; const s = matchStation(n, stations); return [n, s ? s.la : null, s ? s.lo : null, s?.az || s?.n || ""]; });
const missing = railSt.filter(s => s[1] == null).map(s => s[0]);
if (missing.length) console.log("  ! нет координат для станций:", missing.join(", "));
const idx = new Map(railSt.map((s, i) => [s[0], i]));
const data = {
  at: new Date().toISOString().slice(0, 10),
  stops: city.stops, routes: city.routes,
  rail: { st: railSt, tr: trains.map(t => ({ ...t, s: t.s.map(([m, n]) => [m, idx.get(n)]) })) }
};
const js = `// Сгенерировано scripts/fetch-az-transit.mjs ${new Date().toISOString()}
// Маршруты и остановки © участники OpenStreetMap (ODbL); расписание поездов — ADY (через rail.day.az)
window.SAFAR_TRANSIT = ${JSON.stringify(data)};
`;
await writeFile(join(ROOT, "data", "az-transit.js"), js);
console.log(`Готово: data/az-transit.js — ${(js.length / 1024).toFixed(0)} КБ`);
