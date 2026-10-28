// Данные приложения на сервере: те же файлы, что грузит браузер (data/*.js, js/content.js, js/i18n.js).
// Нужны для SEO-страниц, проверки отзывов и инструментов ИИ-гида. Перечитываются после обновления файлов.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { ROOT } = require("./env");

function run(file, expr, extra = {}) {
  const ctx = vm.createContext({ window: {}, navigator: { language: "ru" }, console, ...extra });
  return vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8") + "\n;" + expr, ctx, { filename: file });
}

const D = {};
function load() {
  const cityData = run("data/cities.js", "window.SAFAR_CITIES");
  const pois = run("data/pois.js", "window.SAFAR_POIS");
  Object.assign(D, run("js/content.js", "({ REGIONS, CITY_STORIES, TYPE_ICON, CAT_ICON, COLLECTIONS, HOTEL_BASE_USD, STAR_USD, CITY_PRICE_FACTOR, DEFAULT_TARIFFS })"));
  D.DICT = run("js/i18n.js", "DICT", { localStorage: undefined });
  D.updated = cityData.updated;
  D.climate = cityData.climate || [];
  D.CITIES = cityData.cities.map((c, idx) => ({ ...c, idx, counts: { h: 0, a: 0, s: 0, f: 0 } }));
  D.CITY = Object.fromEntries(D.CITIES.map(c => [c.id, c]));
  D.POIS = pois.filter(p => D.CITIES[p.ci]).map(p => {
    const city = D.CITIES[p.ci];
    city.counts[p.c]++;
    return { ...p, city };
  });
  D.POI = Object.fromEntries(D.POIS.map(p => [p.id, p]));
  console.log(`Данные: ${D.CITIES.length} городов, ${D.POIS.length} мест (${D.updated})`);
}
load();

// Перечитать, если scripts/fetch-data.mjs обновил файлы
let timer = null;
for (const f of ["data/cities.js", "data/pois.js", "js/content.js", "js/i18n.js"]) {
  fs.watchFile(path.join(ROOT, f), { interval: 30000 }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { load(); } catch (e) { console.error("Не удалось перечитать данные:", e.message); } }, 2000);
  }).unref?.();
}

// ---------- Помощники (те же правила, что в браузере) ----------
const LI = { uz: 0, ru: 1, en: 2 };
const lang3 = l => (l in LI ? l : "ru");
function t(lang, key, vars) {
  const row = D.DICT[key];
  let s = row ? row[LI[lang3(lang)]] : key;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}
const cityName = (lang, c) => c.n[lang3(lang)] || c.n.ru;
const poiName = (lang, p) => ({ ru: p.nr, en: p.ne, uz: p.nu }[lang3(lang)]) || p.n;
const regionName = (lang, r) => D.REGIONS[r]?.[LI[lang3(lang)]] || r;
const typeLabel = (lang, s) => D.DICT["t_" + s] ? t(lang, "t_" + s) : s;
function km(a, b) {
  const la = o => o.la ?? o.lat, lo = o => o.lo ?? o.lon;
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin((la(b) - la(a)) * rad / 2) ** 2 + Math.cos(la(a) * rad) * Math.cos(la(b) * rad) * Math.sin((lo(b) - lo(a)) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// Простая «интересность» для сортировки (как в браузере, без отзывов)
const score = p => Math.min(p.fm || 0, 60) / 5 + (p.im ? 3 : 0) + (p.wd || p.wp ? 2 : 0) + (p.w ? 1 : 0) + (p.ph ? 1 : 0) + (p.oh ? 1 : 0);
const commonsImg = (file, width = 1200) => file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}` : "";

module.exports = { D, t, cityName, poiName, regionName, typeLabel, km, score, commonsImg, lang3 };
