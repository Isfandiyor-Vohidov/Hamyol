// Живые данные из внешних сервисов (все бесплатные и без ключей) + кэш в localStorage

const Cache = {
  get(key, maxAgeMs) {
    try {
      const v = JSON.parse(localStorage.getItem("c:" + key));
      if (v && Date.now() - v.t < maxAgeMs) return v.d;
    } catch { /* нет доступа или битые данные */ }
    return null;
  },
  set(key, d) {
    try { localStorage.setItem("c:" + key, JSON.stringify({ t: Date.now(), d })); }
    catch { /* переполнено или приватный режим */ }
  },
  // Сохранённое любой давности — когда сети нет
  stale(key) { return this.get(key, Infinity); }
};
// Запрос с запасным вариантом: сеть не ответила — берём сохранённое, иначе пробрасываем ошибку
async function orStale(key, load) {
  try { return await load(); }
  catch (e) { const old = Cache.stale(key); if (old != null) return old; throw e; }
}

const HOUR = 3600e3;

async function getJSON(url, { timeout = 12000, ...opts } = {}) {
  let res;
  try { res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout) }); }
  catch (e) { if (typeof netSuspect === "function") netSuspect(); throw e; }
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Ссылка на картинку Wikimedia Commons нужной ширины
// (кавычки и скобки тоже кодируются — ссылка вставляется в CSS url('…'))
const commonsImg = (file, width = 640) =>
  file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file).replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())}?width=${width}` : "";
const commonsPage = file => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;

const API = {
  // Официальные курсы Центрального банка Узбекистана
  async rates() {
    const cached = Cache.get("rates", 6 * HOUR);
    if (cached) return cached;
    try {
      const list = await getJSON("https://cbu.uz/ru/arkhiv-kursov-valyut/json/");
      const out = { rates: { UZS: 1 }, diff: {}, date: "", live: true };
      for (const r of list) {
        if (!CURRENCIES.includes(r.Ccy)) continue;
        const nominal = +r.Nominal || 1;
        out.rates[r.Ccy] = +r.Rate / nominal;
        out.diff[r.Ccy] = +r.Diff / nominal;
        out.date = r.Date;
      }
      Cache.set("rates", out);
      return out;
    } catch {
      const stale = Cache.get("rates", 365 * 24 * HOUR);
      return stale ? { ...stale, live: false } : { rates: { ...FALLBACK_RATES }, diff: {}, date: "", live: false };
    }
  },

  // Погода Open-Meteo: сразу для нескольких точек
  async weather(points, withDaily = false) {
    const key = "w:" + points.map(p => p.lat.toFixed(2) + "," + p.lon.toFixed(2)).join(";") + (withDaily ? ":d" : "");
    const cached = Cache.get(key, HOUR);
    if (cached) return cached;
    const url = "https://api.open-meteo.com/v1/forecast?timezone=Asia%2FTashkent" +
      "&latitude=" + points.map(p => p.lat.toFixed(3)).join(",") +
      "&longitude=" + points.map(p => p.lon.toFixed(3)).join(",") +
      "&current=temperature_2m,weather_code,is_day,wind_speed_10m,relative_humidity_2m" +
      (withDaily ? "&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7" : "");
    return orStale(key, async () => {
      const json = await getJSON(url);
      const arr = Array.isArray(json) ? json : [json];
      Cache.set(key, arr);
      return arr;
    });
  },

  // Краткое содержание статьи Википедии
  async wikiSummary(lang, title) {
    const key = `wiki:${lang}:${title}`;
    const cached = Cache.get(key, 7 * 24 * HOUR);
    if (cached) return cached;
    return orStale(key, async () => {
    // Китайская Википедия отдаёт текст в упрощённом письме по заголовку Accept-Language
    const json = await getJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      lang === "zh" ? { headers: { "Accept-Language": "zh-Hans" } } : {});
    if (json.type === "disambiguation" || !json.extract) throw new Error("no article");
    const out = {
      lang, title: json.title, extract: json.extract,
      img: json.thumbnail?.source || "", url: json.content_urls?.desktop?.page || ""
    };
    Cache.set(key, out);
    return out;
    });
  },

  // Названия статей по Wikidata ID
  async wikiTitles(qid) {
    const key = "wd:" + qid;
    const cached = Cache.get(key, 30 * 24 * HOUR);
    if (cached) return cached;
    return orStale(key, async () => {
      const json = await getJSON(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=sitelinks&sitefilter=ruwiki|uzwiki|enwiki&ids=${qid}`);
      const sl = json.entities?.[qid]?.sitelinks || {};
      const out = {};
      for (const l of ["ru", "uz", "en"]) if (sl[l + "wiki"]) out[l] = sl[l + "wiki"].title;
      Cache.set(key, out);
      return out;
    });
  },

  // Подбирает статью на языке интерфейса, иначе на другом доступном
  async wikiFor(titles) {
    const want = LANG === "uzc" ? "uz" : LANG;
    const order = [want, ...["ru", "en", "uz"].filter(l => l !== want)];
    for (const l of order) {
      if (!titles?.[l]) continue;
      try {
        const w = await API.wikiSummary(l, titles[l]);
        return LANG === "uzc" && l === "uz" ? { ...w, lang: "uzc", extract: toCyr(w.extract) } : w;
      } catch { /* пробуем следующий язык */ }
    }
    return null;
  },

  // Реальные дороги: OSRM. Возвращает участки маршрута (км, минуты) и линию на карте
  async route(points) {
    const key = "r:" + points.map(p => p.lon.toFixed(3) + "," + p.lat.toFixed(3)).join(";");
    const cached = Cache.get(key, 30 * 24 * HOUR);
    if (cached) return cached;
    const coords = points.map(p => p.lon.toFixed(5) + "," + p.lat.toFixed(5)).join(";");
    return orStale(key, async () => {
      const json = await getJSON(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`, { timeout: 15000 });
      if (json.code !== "Ok") throw new Error(json.code);
      const r = json.routes[0];
      const out = {
        legs: r.legs.map(l => ({ km: l.distance / 1000, min: l.duration / 60 })),
        line: r.geometry.coordinates.map(([lo, la]) => [la, lo])
      };
      Cache.set(key, out);
      return out;
    });
  }
};

// Отзывы: общий сервер (server.js) или, если его нет, localStorage этого устройства
const Reviews = {
  mode: "local",
  summary: {},

  async init() {
    if (location.protocol.startsWith("http")) {
      try {
        this.summary = await getJSON("/api/reviews/summary", { timeout: 4000 });
        this.mode = "server";
        return;
      } catch { /* сервер не запущен — локальный режим */ }
    }
    this.mode = "local";
    const all = this._local();
    this.summary = {};
    for (const k in all) this.summary[k] = [all[k].reduce((a, r) => a + r.stars, 0), all[k].length];
  },

  _local() {
    try { return JSON.parse(localStorage.getItem("safar_reviews") || "{}"); } catch { return {}; }
  },

  rating(key) {
    const s = this.summary[key];
    return s && s[1] ? { avg: s[0] / s[1], count: s[1] } : { avg: 0, count: 0 };
  },

  async list(key) {
    if (this.mode === "server") return getJSON("/api/reviews?key=" + encodeURIComponent(key));
    return (this._local()[key] || []).slice().reverse();
  },

  async add(key, review) {
    if (this.mode === "server") {
      const token = (() => { try { return localStorage.getItem("safar_token"); } catch { return null; } })();
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ key, ...review })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const { summary } = await res.json();
      this.summary[key] = summary;
      return;
    }
    const all = this._local();
    (all[key] = all[key] || []).push({ ...review, date: Date.now() });
    localStorage.setItem("safar_reviews", JSON.stringify(all));
    const s = this.summary[key] || [0, 0];
    this.summary[key] = [s[0] + review.stars, s[1] + 1];
  }
};
