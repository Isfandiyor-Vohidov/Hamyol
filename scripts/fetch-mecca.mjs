// Сборщик реальных данных для Safar.
// Источники: OpenStreetMap (Overpass API) и Wikidata.
// Запуск:  node scripts/fetch-data.mjs          — Узбекистан → data/
//          node scripts/fetch-data.mjs --sa     — Мекка и Медина (Хиджаз: провинции Мекка и Медина) → data/sa/
// Результат: cities.js, pois.js, services.js (приложение грузит папку по выбранному направлению).

import { writeFile, mkdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Отдельный сборщик для приложения «Мекка и Медина» (страница /mecca). Узбекский сборщик — scripts/fetch-data.mjs, его не трогаем.
const SA = true;
// Настройки направления: где искать, куда писать, сколько данных «нормально»
const CFG = SA ? {
  label: "sa-", out: "data", prefix: "mk-",
  // Хиджаз: провинции Мекка (SA-02) и Медина (SA-03)
  areaCountry: `area["ISO3166-1"="SA"][admin_level=2]->.uz;`,
  zone: `area["ISO3166-2"~"^SA-0(2|3)$"]->.uz;`,
  regionsRel: `rel["admin_level"="4"]["boundary"="administrative"]["ISO3166-2"~"^SA-0(2|3)$"](area.uz);`,
  places: "city|town",
  minCities: 8, minPois: 800, minSvc: 300, maxCityKm: 60, tz: "Asia%2FRiyadh"
} : {
  label: "", out: "data", prefix: "",
  areaCountry: `area["ISO3166-1"="UZ"][admin_level=2]->.uz;`,
  zone: `area["ISO3166-1"="UZ"][admin_level=2]->.uz;`,
  regionsRel: `rel["admin_level"="4"]["boundary"="administrative"](area.uz);
      rel(196241);`,
  places: "city|town",
  minCities: 250, minPois: 5000, minSvc: 3000, maxCityKm: 80, tz: "Asia%2FTashkent"
};
const UA = "SafarTravelApp/1.0 (data builder; contact: github.com/safar)";
const OVERPASS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

// ISO 3166-2 → ключ региона в приложении
const ISO_REGION = {
  "UZ-TK": "tashkent_city", "UZ-TO": "tashkent", "UZ-SA": "samarkand", "UZ-BU": "bukhara",
  "UZ-XO": "khorezm", "UZ-QR": "karakalpakstan", "UZ-NW": "navoi", "UZ-QA": "kashkadarya",
  "UZ-SU": "surkhandarya", "UZ-JI": "jizzakh", "UZ-SI": "syrdarya", "UZ-FA": "fergana",
  "UZ-AN": "andijan", "UZ-NG": "namangan",
  "SA-02": "makkah", "SA-03": "madinah"
};

// Города, которых может не быть в OSM как place=city/town (добавляются вручную)
const EXTRA_CITIES = [
  { en: "Nurafshon", ru: "Нурафшон", uz: "Nurafshon", r: "tashkent", lat: 41.0167, lon: 69.3417, pop: 50000 }
];

// Мекка и Медина: мечеть Куба, Мина, Муздалифа, мечети аль-Машар аль-Харам, аль-Хайф, Аиши в Танъиме (микат для умры)
const SA_KEY_PLACES = { node: [12407794803, 7758270150, 4543956102], way: [457318293, 372402102, 431611519] };
const SHOP_TYPES = /^(mall|department_store|souvenir|gift|art|craft|carpet|jewelry|tea|spices|confectionery)$/;
const SIGHT_TOURISM = /^(attraction|museum|viewpoint|gallery|zoo|theme_park)$/;
const SIGHT_HISTORIC = /^(castle|fort|ruins|archaeological_site|tomb|monument|city_gate|minaret|building)$/;

// Q5 — человек, Q14660 — флаг, Q14659 — герб
const SUBJECT_NOT_PLACE = ["Q5", "Q14660", "Q14659"];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Опорные точки климата (по 1–3 на регион); город получает данные ближайшей
const CLIMATE_REFS = SA ? [
  ["Мекка", 21.4225, 39.8262], ["Медина", 24.4672, 39.6111], ["Джидда", 21.5433, 39.1728], ["Таиф", 21.2703, 40.4158],
  ["Янбу", 24.0890, 38.0618], ["Рабиг", 22.7986, 39.0349], ["Аль-Ула", 26.6085, 37.9232]
] : [
  ["Ташкент", 41.30, 69.24], ["Газалкент", 41.558, 69.771], ["Ангрен", 41.017, 70.144], ["Самарканд", 39.654, 66.96],
  ["Бухара", 39.775, 64.43], ["Хива", 41.378, 60.364], ["Нукус", 42.453, 59.61], ["Муйнак", 43.768, 59.021],
  ["Кунград", 43.076, 58.907], ["Навои", 40.084, 65.379], ["Учкудук", 42.157, 63.556], ["Карши", 38.861, 65.789],
  ["Шахрисабз", 39.058, 66.834], ["Термез", 37.224, 67.278], ["Денау", 38.267, 67.9], ["Джизак", 40.116, 67.842],
  ["Заамин", 39.96, 68.396], ["Гулистан", 40.49, 68.784], ["Фергана", 40.386, 71.786], ["Андижан", 40.782, 72.344],
  ["Наманган", 40.998, 71.673], ["Коканд", 40.529, 70.943]
];

// Климат по месяцам из архива наблюдений Open-Meteo (ERA5) за 4 года: [макс °C, мин °C, осадки мм/мес, дней с осадками]
async function fetchClimate() {
  const file = join(CACHE, CFG.label + "climate.json");
  try {
    const { mtimeMs } = await stat(file);
    if (Date.now() - mtimeMs < 30 * 24 * 3600e3 && !process.argv.includes("--fresh")) return JSON.parse(await readFile(file, "utf8"));
  } catch { /* кэша нет */ }
  const out = [];
  for (let i = 0; i < CLIMATE_REFS.length; i += 3) {
    const batch = CLIMATE_REFS.slice(i, i + 3);
    const url = `https://archive-api.open-meteo.com/v1/archive?start_date=2021-01-01&end_date=2024-12-31&timezone=${CFG.tz}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" +
      "&latitude=" + batch.map(r => r[1]).join(",") + "&longitude=" + batch.map(r => r[2]).join(",");
    const json = await fetchJSONRetry(url);
    for (const [k, loc] of (Array.isArray(json) ? json : [json]).entries()) {
      const m = Array.from({ length: 12 }, () => ({ tx: 0, tn: 0, p: 0, rd: 0, n: 0 }));
      const years = new Set();
      loc.daily.time.forEach((d, j) => {
        const mo = +d.slice(5, 7) - 1;
        years.add(d.slice(0, 4));
        const x = m[mo];
        x.tx += loc.daily.temperature_2m_max[j]; x.tn += loc.daily.temperature_2m_min[j]; x.n++;
        const pr = loc.daily.precipitation_sum[j] || 0;
        x.p += pr; if (pr >= 1) x.rd++;
      });
      const Y = years.size;
      out.push({ n: batch[k][0], lat: batch[k][1], lon: batch[k][2],
        m: m.map(x => [+(x.tx / x.n).toFixed(1), +(x.tn / x.n).toFixed(1), Math.round(x.p / Y), +(x.rd / Y).toFixed(1)]) });
    }
    process.stdout.write(`\r  климат: ${Math.min(i + 3, CLIMATE_REFS.length)}/${CLIMATE_REFS.length}`);
    await sleep(12000);   // бесплатный лимит Open-Meteo — ограничение запросов в минуту
  }
  console.log();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(out));
  return out;
}

// Ответы Overpass кэшируются на 12 часов в scripts/.cache (флаг --fresh отключает кэш)
const CACHE = join(ROOT, "scripts/.cache");
async function overpass(query, label, minCount) {
  const hash = createHash("sha1").update(query).digest("hex").slice(0, 8);
  const file = join(CACHE, label + "-" + hash + ".json");
  if (!process.argv.includes("--fresh")) {
    try {
      const { mtimeMs } = await stat(file);
      if (Date.now() - mtimeMs < 12 * 3600e3) {
        const els = JSON.parse(await readFile(file, "utf8"));
        if (els.length >= minCount) {
          console.log(`  ${label}: из кэша (${els.length})`);
          return els;
        }
      }
    } catch { /* кэша нет */ }
  }
  const els = await overpassFetch(query, label, minCount);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(els));
  return els;
}

async function overpassFetch(query, label, minCount) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of OVERPASS) {
      try {
        process.stdout.write(`  ${label}: ${new URL(url).host}… `);
        const res = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(240000)
        });
        const text = await res.text();
        if (!res.ok || !text.trimStart().startsWith("{")) throw new Error("HTTP " + res.status);
        const json = JSON.parse(text);
        // Перегруженный сервер иногда отдаёт пустой или обрезанный ответ
        if (json.elements.length < minCount) throw new Error(`слишком мало данных (${json.elements.length})`);
        console.log(`ok (${json.elements.length})`);
        return json.elements;
      } catch (e) {
        console.log("fail: " + e.message);
      }
    }
    await sleep(5000);
  }
  throw new Error("Overpass недоступен: " + label);
}

// JSON с повторами: Википедия временно ограничивает частоту запросов
let lastStatus = 0;
async function fetchJSONRetry(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) });
      const text = await res.text();
      if (res.status === 429) { lastStatus = 429; throw new Error("HTTP 429"); }
      if (!res.ok || !/^[[{]/.test(text)) throw new Error("HTTP " + res.status);
      return JSON.parse(text);
    } catch (e) {
      if (i >= tries - 1) throw e;
      // 429 — лимит запросов в минуту: ждём дольше
      await sleep(lastStatus === 429 ? 65000 : 3000 * (i + 1));
      lastStatus = 0;
    }
  }
}

async function wikidata(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks|claims|labels" +
      "&languages=ru|uz|en|tr|de|zh|zh-hans|zh-cn|ko&ids=" + batch.join("|");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60000) });
        const json = await res.json();
        Object.assign(out, json.entities || {});
        break;
      } catch (e) {
        console.log("  wikidata retry: " + e.message);
        await sleep(3000);
      }
    }
    process.stdout.write(`\r  wikidata ${Math.min(i + 50, ids.length)}/${ids.length}`);
    await sleep(300);
  }
  console.log();
  return out;
}

// Узбекская латиница → кириллица (для названий без name:ru)
function uzToCyr(s) {
  const pairs = [["o'", "у"], ["o‘", "у"], ["oʻ", "у"], ["g'", "г"], ["g‘", "г"], ["gʻ", "г"], ["sh", "ш"], ["ch", "ч"],
    ["yo", "ё"], ["yu", "ю"], ["ya", "я"], ["ye", "е"], ["ts", "ц"]];
  const single = { a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
    p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", "'": "ъ", "’": "ъ" };
  let out = "", low = s.toLowerCase(), i = 0;
  while (i < s.length) {
    const p = pairs.find(([k]) => low.startsWith(k, i));
    let ch, len;
    if (p) { ch = p[1]; len = p[0].length; }
    else { ch = single[low[i]] ?? s[i]; len = 1; }
    if (i === 0 && low[i] === "e") ch = "э";
    const upper = s[i] !== low[i];
    out += upper ? ch.charAt(0).toUpperCase() + ch.slice(1) : ch;
    i += len;
  }
  return out;
}

const slug = s => s.toLowerCase().normalize("NFKD").replace(/[ʻ'‘’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const round = n => Math.round(n * 1e5) / 1e5;
const claim = (ent, p) => ent?.claims?.[p];
function latestPopulation(ent) {
  const c = claim(ent, "P1082");
  if (!c) return 0;
  const best = c.find(x => x.rank === "preferred") || c[c.length - 1];
  return Math.round(+best?.mainsnak?.datavalue?.value?.amount || 0);
}
const image = ent => {
  const f = claim(ent, "P18")?.[0]?.mainsnak?.datavalue?.value;
  return f ? f.replace(/ /g, "_") : "";
};

async function main() {
  console.log("1/4 Города и посёлки (OpenStreetMap)…");
  const cityEls = await overpass(`
    [out:json][timeout:180];
    ${CFG.areaCountry}
    (
      ${CFG.regionsRel}
    );
    map_to_area->.regions;
    foreach.regions->.r(
      .r out tags;
      node["place"~"^(${CFG.places})$"](area.r);
      out;
    );`, CFG.label + "cities", CFG.minCities);

  let region = null;
  const seen = new Set();
  let cities = [];
  for (const e of cityEls) {
    if (e.type === "area") {
      // Каракалпакстан в OSM — admin_level=3 (relation 196241), у него может не быть ISO-тега
      region = ISO_REGION[e.tags["ISO3166-2"]] || (e.id === 3600196241 ? "karakalpakstan" : null);
      continue;
    }
    if (!region || seen.has(e.id)) continue;
    seen.add(e.id);
    const t = e.tags;
    if (!t.name && !t["name:en"]) continue;
    // В Саудовской Аравии основное имя в OSM — арабское: латиницей берём английское
    const uz = t["name:uz"] || t["name:uz-Latn"] || (SA ? t["name:en"] || t.name : t.name);
    const en = t["name:en"] || uz;
    const ru = t["name:ru"] || (SA ? en : /[а-яё]/i.test(t.name) ? t.name : uzToCyr(uz));
    const wiki = {};
    if (t.wikipedia) { const [l, ...rest] = t.wikipedia.split(":"); if (["ru", "uz", "en"].includes(l)) wiki[l] = rest.join(":"); }
    cities.push({
      id: slug(en) || "c" + e.id, n: { uz, ru, en, ...(SA ? { ar: t["name:ar"] || t.name } : {}) }, r: region, lat: round(e.lat), lon: round(e.lon),
      pop: +String(t.population || "").replace(/\D/g, "") || 0, t: t.place, wd: t.wikidata || "", wiki
    });
  }
  for (const x of SA ? [] : EXTRA_CITIES) {
    if (cities.some(c => km(c, x) < 1.5)) continue;
    cities.push({ id: slug(x.en), n: { uz: x.uz, ru: x.ru, en: x.en }, r: x.r, lat: x.lat, lon: x.lon, pop: x.pop, t: "city", wd: "", wiki: {} });
  }
  // Уникальные id
  const ids = {};
  for (const c of cities) {
    if (ids[c.id]) c.id = c.id + "-" + c.r.replace(/_/g, "-");
    while (ids[c.id]) c.id += "-2";
    ids[c.id] = 1;
  }
  console.log(`  найдено городов и посёлков: ${cities.length}`);

  console.log("2/4 Места: отели, шопинг, достопримечательности, еда…");
  const poiEls = await overpass(`
    [out:json][timeout:240];
    ${CFG.zone}
    (
      nwr["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"]["name"](area.uz);
      ${SA ? `nwr["amenity"="place_of_worship"]["religion"="muslim"]["wikidata"](area.uz);
      nwr["natural"~"^(peak|hill)$"]["wikidata"](area.uz);
      nwr["landuse"="cemetery"]["wikidata"](area.uz);
      nwr["amenity"="grave_yard"]["wikidata"](area.uz);
      node(id:${SA_KEY_PLACES.node.join(",")});
      way(id:${SA_KEY_PLACES.way.join(",")});` : ""}
      nwr["amenity"="marketplace"]["name"](area.uz);
      nwr["shop"~"${SHOP_TYPES.source}"]["name"](area.uz);
      nwr["tourism"~"${SIGHT_TOURISM.source}"]["name"](area.uz);
      nwr["historic"~"${SIGHT_HISTORIC.source}"]["name"](area.uz);
      nwr["amenity"~"^(restaurant|cafe)$"]["name"](area.uz);
    )->.all;
    node.all; out;
    way.all; out tags center;
    rel.all; out tags center;`, CFG.label + "places", CFG.minPois);

  const pois = [];
  const seenPoi = new Set();
  for (const e of poiEls) {
    const key = e.type + e.id;
    if (seenPoi.has(key)) continue;
    seenPoi.add(key);
    const t = e.tags;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat == null) continue;
    // Категория определяется только по тем значениям тегов, которые запрашивались
    let c, s;
    if (/^(hotel|guest_house|hostel|motel|apartment)$/.test(t.tourism)) { c = "h"; s = t.tourism; }
    else if (t.amenity === "marketplace") { c = "s"; s = "marketplace"; }
    else if (SHOP_TYPES.test(t.shop)) { c = "s"; s = t.shop; }
    else if (SIGHT_TOURISM.test(t.tourism)) { c = "a"; s = t.tourism; }
    else if (SIGHT_HISTORIC.test(t.historic)) { c = "a"; s = t.historic; }
    else if (t.amenity === "restaurant" || t.amenity === "cafe") { c = "f"; s = t.amenity; }
    else if (SA && t.amenity === "place_of_worship") { c = "a"; s = "mosque"; }
    else if (SA && /^(peak|hill)$/.test(t.natural)) { c = "a"; s = "peak"; }
    else if (SA && (t.landuse === "cemetery" || t.amenity === "grave_yard")) { c = "a"; s = "cemetery"; }
    else if (SA && SA_KEY_PLACES[e.type]?.includes(e.id)) { c = "a"; s = "attraction"; }
    else continue;

    // Ближайший город
    let best = -1, bestD = Infinity;
    cities.forEach((ct, i) => { const d = km(ct, { lat, lon }); if (d < bestD) { bestD = d; best = i; } });
    if (bestD > CFG.maxCityKm) continue;

    // id = тип OSM + номер: стабилен между обновлениями, используется для отзывов и избранного
    // В Хиджазе основное имя — латиницей (английское), арабское — отдельно (для «Показать таксисту» и поиска)
    const nameLatin = SA ? (t["name:en"] || t.name) : t.name;
    const p = { id: e.type[0] + e.id, c, s, n: nameLatin, la: round(lat), lo: round(lon), ci: best };
    if (SA && t.name && t.name !== nameLatin) p.na = t.name;
    if (SA && t["name:ar"] && t["name:ar"] !== nameLatin) p.na = t["name:ar"];
    if (t["name:ru"] && t["name:ru"] !== t.name) p.nr = t["name:ru"];
    if (t["name:en"] && t["name:en"] !== t.name) p.ne = t["name:en"];
    if (t["name:uz"] && t["name:uz"] !== t.name) p.nu = t["name:uz"];
    const stars = parseInt(t.stars);
    if (stars >= 1 && stars <= 5) p.st = stars;
    const phone = t.phone || t["contact:phone"];
    if (phone) p.ph = phone.split(";")[0].trim();
    const web = t.website || t["contact:website"] || t["contact:instagram"];
    if (web) p.w = web.split(";")[0].trim();
    if (t.opening_hours) p.oh = t.opening_hours;
    const addr = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    if (addr) p.ad = addr;
    if (t.cuisine) p.cu = t.cuisine.split(";").slice(0, 3).join(", ");
    // Отметки для еды: o — терраса, w — Wi-Fi, d — доставка, t — навынос, v — вегетарианское, h — халяль
    if (c === "f") {
      const yes = v => v === "yes" || v === "only";
      const fl = [
        yes(t.outdoor_seating) && "o", (t.internet_access === "wlan" || t.internet_access === "yes") && "w",
        yes(t.delivery) && "d", yes(t.takeaway) && "t",
        (yes(t["diet:vegetarian"]) || yes(t["diet:vegan"])) && "v", yes(t["diet:halal"]) && "h"
      ].filter(Boolean).join("");
      if (fl) p.fl = fl;
    }
    if (t.wikidata) p.wd = t.wikidata;
    if (t.wikipedia) p.wp = t.wikipedia;
    if (t.description) p.de = t.description.slice(0, 300);
    pois.push(p);
  }
  console.log(`  мест: ${pois.length}`);

  console.log("2б. Полезное: банкоматы, банки, аптеки, больницы, туалеты, АЗС, вокзалы, аэропорты…");
  const svcEls = await overpass(`
    [out:json][timeout:240];
    ${CFG.zone}
    (
      nwr["amenity"~"^(atm|bureau_de_change|bank|pharmacy|hospital|clinic|toilets|fuel|bus_station)$"](area.uz);
      nwr["railway"="station"]["name"](area.uz);
      nwr["aeroway"="aerodrome"]["iata"](area.uz);
    )->.all;
    node.all; out;
    way.all; out tags center;
    rel.all; out tags center;`, CFG.label + "services", CFG.minSvc);
  // Компактно: [тип, широта, долгота, индекс города, название, часы работы, телефон]
  const SVC_TYPE = { atm: "atm", bureau_de_change: "exchange", bank: "bank", pharmacy: "pharmacy", hospital: "hospital",
    clinic: "clinic", toilets: "toilets", fuel: "fuel", bus_station: "bus" };
  const services = [];
  const seenSvc = new Set();
  for (const e of svcEls) {
    if (seenSvc.has(e.type + e.id)) continue;
    seenSvc.add(e.type + e.id);
    const t = e.tags || {};
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat == null) continue;
    const type = t.aeroway === "aerodrome" ? "airport" : t.railway === "station" ? "rail" : SVC_TYPE[t.amenity];
    if (!type) continue;
    let best = -1, bestD = Infinity;
    cities.forEach((ct, i) => { const d = km(ct, { lat, lon }); if (d < bestD) { bestD = d; best = i; } });
    if (bestD > CFG.maxCityKm) continue;
    let name = t["name:ru"] || (SA ? t["name:en"] : "") || t.name || t.brand || t.operator || "";
    if (type === "airport" && t.iata) name = `${name} (${t.iata})`;
    const row = [type, round(lat), round(lon), best, name.slice(0, 80), t.opening_hours || "", (t.phone || t["contact:phone"] || "").split(";")[0]];
    while (row.length > 4 && !row[row.length - 1]) row.pop();
    services.push(row);
  }
  console.log(`  полезных объектов: ${services.length}`);

  console.log("3/4 Wikidata: фото, население, статьи Википедии…");
  const wdIds = [...new Set([...cities.map(c => c.wd), ...pois.filter(p => p.c === "a").map(p => p.wd)].filter(x => /^Q\d+$/.test(x)))];
  const ents = await wikidata(wdIds);
  for (const c of cities) {
    const ent = ents[c.wd];
    if (!ent) continue;
    const pop = latestPopulation(ent);
    if (pop) c.pop = pop;
    const img = image(ent);
    if (img) c.img = img;
    for (const l of ["ru", "uz", "en", "tr", "de", "zh", "ko"]) {
      const sl = ent.sitelinks?.[l + "wiki"]?.title;
      if (sl) c.wiki[l] = sl;
      // для китайского — упрощённое письмо
      const lb = (l === "zh" ? ent.labels?.["zh-hans"] || ent.labels?.["zh-cn"] || ent.labels?.zh : ent.labels?.[l])?.value;
      if (lb && l !== "uz") c.n[l] = lb.replace(/\s*\(.*\)$/, "");
    }
  }
  for (const p of pois) {
    const ent = ents[p.wd];
    if (!ent) continue;
    // В OSM у памятника wikidata часто указывает на самого человека или флаг — тогда это не данные о месте
    const kinds = (claim(ent, "P31") || []).map(c => c.mainsnak?.datavalue?.value?.id);
    if (kinds.some(k => SUBJECT_NOT_PLACE.includes(k))) continue;
    // Известность: на скольких языках о месте есть статья в Википедии
    const fame = Object.keys(ent.sitelinks || {}).filter(k => /wiki$/.test(k) && !/^(commons|species|meta)wiki$/.test(k)).length;
    if (fame) p.fm = fame;
    const img = image(ent);
    if (img) p.im = img;
    for (const l of ["ru", "en", "uz"]) {
      const lb = ent.labels?.[l]?.value;
      const k = { ru: "nr", en: "ne", uz: "nu" }[l];
      if (lb && !p[k] && lb !== p.n) p[k] = lb;
    }
  }

  // Фото из статей Википедии для городов без P18
  for (const lang of ["ru", "en", "uz"]) {
    const need = cities.filter(c => !c.img && c.wiki[lang]);
    for (let i = 0; i < need.length; i += 50) {
      const batch = need.slice(i, i + 50);
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&redirects=1&titles=` +
        encodeURIComponent(batch.map(c => c.wiki[lang]).join("|"));
      try {
        const json = await fetchJSONRetry(url);
        const alias = {};
        for (const r of [...(json.query?.normalized || []), ...(json.query?.redirects || [])]) alias[r.to] = r.from;
        for (const pg of Object.values(json.query?.pages || {})) {
          if (!pg.pageimage) continue;
          let title = pg.title;
          while (alias[title] && !batch.some(c => c.wiki[lang] === title)) title = alias[title];
          const c = batch.find(c => c.wiki[lang] === title);
          if (c) c.img = pg.pageimage;
        }
      } catch (e) { console.log("  pageimages: " + e.message); }
      await sleep(1000);
    }
  }
  // Если сервис был недоступен — берём фото и статьи из прошлой сборки
  try {
    const prevText = await readFile(join(ROOT, CFG.out, CFG.prefix + "cities.js"), "utf8");
    const prev = JSON.parse(prevText.slice(prevText.indexOf("{"), prevText.lastIndexOf("}") + 1)).cities;
    const byId = Object.fromEntries(prev.map(c => [c.id, c]));
    for (const c of cities) {
      const old = byId[c.id];
      if (!old) continue;
      if (!c.img && old.img) c.img = old.img;
      c.wiki = { ...(old.wiki || {}), ...c.wiki };
    }
  } catch { /* прошлой сборки нет */ }
  console.log(`  фото найдено для ${cities.filter(c => c.img).length} городов`);

  console.log("Климат по месяцам (Open-Meteo, 2021–2024)…");
  let climate = [];
  try {
    climate = await fetchClimate();
    for (const c of cities) {
      let best = 0, bd = Infinity;
      climate.forEach((r, i) => { const d = km(c, r); if (d < bd) { bd = d; best = i; } });
      c.cl = best;
    }
    console.log(`  опорных точек: ${climate.length}`);
  } catch (e) {
    console.log("  климат недоступен: " + e.message);
    // берём из прошлой сборки
    try {
      const prevText = await readFile(join(ROOT, CFG.out, CFG.prefix + "cities.js"), "utf8");
      const prev = JSON.parse(prevText.slice(prevText.indexOf("{"), prevText.lastIndexOf("}") + 1));
      if (prev.climate?.length) {
        climate = prev.climate;
        const byId = Object.fromEntries(prev.cities.map(c => [c.id, c.cl]));
        for (const c of cities) if (byId[c.id] != null) c.cl = byId[c.id];
      }
    } catch { /* прошлой сборки нет */ }
  }

  console.log("4/4 Сохранение…");
  // Сортировка городов: сначала крупные; индексы мест пересчитываются
  const order = cities.map((c, i) => i).sort((a, b) => (cities[b].pop || 0) - (cities[a].pop || 0));
  const remap = {};
  order.forEach((oldIdx, newIdx) => { remap[oldIdx] = newIdx; });
  cities = order.map(i => cities[i]);
  for (const p of pois) p.ci = remap[p.ci];
  for (const x of services) x[3] = remap[x[3]];
  for (const c of cities) if (!Object.keys(c.wiki).length) delete c.wiki;

  if (cities.length < CFG.minCities || pois.length < CFG.minPois)
    throw new Error(`Подозрительно мало данных (${cities.length} городов, ${pois.length} мест) — файлы не перезаписаны`);
  await mkdir(join(ROOT, CFG.out), { recursive: true });
  const stamp = new Date().toISOString();
  const header = `// Сгенерировано scripts/fetch-data.mjs ${stamp}\n// Данные © участники OpenStreetMap (ODbL), Wikidata (CC0)\n`;
  await writeFile(join(ROOT, CFG.out, CFG.prefix + "cities.js"), header + `window.SAFAR_CITIES = ${JSON.stringify({ updated: stamp, cities, climate: climate.map(({ n, m }) => ({ n, m })) })};\n`);
  await writeFile(join(ROOT, CFG.out, CFG.prefix + "pois.js"), header + `window.SAFAR_POIS = ${JSON.stringify(pois)};\n`);
  // Полезное грузится лениво — отдельный файл
  if (services.length > CFG.minSvc) await writeFile(join(ROOT, CFG.out, CFG.prefix + "services.js"), header + `window.SAFAR_SERVICES = ${JSON.stringify(services)};\n`);
  const count = k => pois.filter(p => p.c === k).length;
  console.log(`Готово: ${cities.length} городов, отелей ${count("h")}, шопинг ${count("s")}, места ${count("a")}, еда ${count("f")}, полезное ${services.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
