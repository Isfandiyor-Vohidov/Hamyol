/* ===================== Safar — приложение ===================== */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } }
};
// Расширения: функции из js/*.js (подключаются после app.js) встраиваются в маршруты, карточку города, карту и главную
const EXT = { routes: {}, cityTabs: [], mapLayers: [], homeTiles: [], onInit: [], onLang: [], onBudget: [], cityOverview: [], cityOverviewBind: [], onHome: [], onDataChange: [], accountSections: [], onConfig: [], onAccountRender: [], placeExtras: [], favsExtras: [] };
const dataChanged = what => EXT.onDataChange.forEach(fn => fn(what));

const debounce = (fn, ms) => { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };

// ---------- Данные ----------
const DB = window.SAFAR_CITIES || { cities: [], updated: "" };
const CITIES = DB.cities.map((c, idx) => {
  const story = CITY_STORIES[c.n.ru] || null;
  return {
    ...c, idx, story, key: "city:" + c.id,
    ico: story?.e || (c.t === "city" ? "city" : "house"),
    hay: [c.n.uz, c.n.ru, c.n.en].join(" ").toLowerCase(),
    counts: { h: 0, a: 0, s: 0, f: 0 }
  };
});
const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));
const byRu = name => CITIES.find(c => c.n.ru === name);

const POIS = (window.SAFAR_POIS || []).filter(p => CITIES[p.ci]).map(p => {
  const city = CITIES[p.ci];
  city.counts[p.c]++;
  return { ...p, city, key: "poi:" + p.id, hay: [p.n, p.nr, p.ne, p.nu].filter(Boolean).join(" ").toLowerCase() };
});
const POI = Object.fromEntries(POIS.map(p => [p.id, p]));
const HOTEL_TYPES = ["hotel", "guest_house", "hostel", "motel", "apartment"];

// ---------- Помощники отображения ----------
const cityName = c => c.n[LANG] || (LANG === "uzc" ? toCyr(c.n.uz) : "") || (isUz() ? c.n.uz : "") || c.n.en || c.n.ru;
// Названия мест: узбекское / русское / английское (для остальных языков — английское), иначе исходное из OSM
const poiName = p => (LANG === "ru" ? p.nr : LANG === "uz" ? p.nu : LANG === "uzc" ? ((p.nu || (isLatin(p.n) ? p.n : "")) && toCyr(p.nu || p.n)) : p.ne) || p.n;
const regionName = r => L3(REGIONS[r], X_REGIONS[r]) || r;
const cityStory = c => c.story ? L3(c.story.d, X_STORIES[c.n.ru]) : "";
const REGION_KEYS = Object.keys(REGIONS);
const hue = r => Math.round(REGION_KEYS.indexOf(r) * 360 / REGION_KEYS.length + 190) % 360;
const regionBg = r => `var(--ornament), linear-gradient(135deg, hsl(${hue(r)} 50% 36%), hsl(${(hue(r) + 40) % 360} 55% 18%))`;
// Фон шапок по категории — градиенты из css/style.css (--g-*)
const CAT_BG = { h: "var(--ornament), var(--g-h)", a: "var(--ornament), var(--g-a)", s: "var(--ornament), var(--g-s)", f: "var(--ornament), var(--g-f)" };
const pt = o => o.la != null ? { lat: o.la, lon: o.lo } : o;
function km(a, b) {
  a = pt(a); b = pt(b);
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const fmtNum = n => Math.round(n).toLocaleString(NUM_LOCALE[LANG]);
function popText(c) {
  if (!c.pop) return "";
  // В китайском и корейском население считают в десятках тысяч (万 / 만)
  if (LANG === "zh" || LANG === "ko") {
    const w = c.pop / 1e4;
    const n = w >= 10 ? Math.round(w) : w.toFixed(1);
    return LANG === "zh" ? `${n}万人` : `인구 ${n}만 명`;
  }
  return c.pop >= 1e6 ? t("pop_m", { n: (c.pop / 1e6).toFixed(1) }) : c.pop >= 1000 ? t("pop_k", { n: Math.round(c.pop / 1000) }) : fmtNum(c.pop);
}
const starStr = n => `<span class="stars" aria-label="${Math.round(n)}/5">${[1, 2, 3, 4, 5].map(i => icon("star", i <= Math.round(n) ? "fill" : "")).join("")}</span>`;
const hotelStars = n => `<span class="stars gold" aria-label="${n}★">${icon("star", "fill").repeat(n)}</span>`;
function ratingBadge(key) {
  const r = Reviews.rating(key);
  // «Выбор путешественников» (как в TripAdvisor): средняя от 4,5 и хотя бы 5 отзывов
  const choice = r.count >= 5 && r.avg >= 4.5 ? ` <span class="tc-choice">${icon("award")} ${t("tc_choice")}</span>` : "";
  return r.count ? `<span class="rating"><span class="gold">${icon("star", "fill")} ${r.avg.toFixed(1)}</span> <span class="muted">(${r.count})</span>${choice}</span>` : `<span class="rating none">${icon("star")} ${t("no_reviews")}</span>`;
}
// Окно «Вы уверены?» вместо системного confirm(): крупные кнопки, в стиле приложения.
// askConfirm({ title, text, ok, cancel, danger, icon }) → Promise<true|false>
function askConfirm({ title, text = "", ok, cancel, danger = false, icon: ic = "help" }) {
  return new Promise(resolve => {
    document.querySelector(".cf-wrap")?.remove();
    document.body.insertAdjacentHTML("beforeend", `
      <div class="cf-wrap" role="alertdialog" aria-modal="true" aria-labelledby="cfTitle">
        <div class="cf-card">
          <span class="cf-ic ${danger ? "danger" : ""}">${icon(ic)}</span>
          <h3 id="cfTitle">${title}</h3>${text ? `<p>${text}</p>` : ""}
          <div class="cf-acts">
            <button type="button" class="btn ghost" data-cf="0">${cancel || t("cf_cancel")}</button>
            <button type="button" class="btn ${danger ? "danger-btn" : "gold-btn"}" data-cf="1">${ok || t("cf_ok")}</button>
          </div>
        </div>
      </div>`);
    const wrap = document.querySelector(".cf-wrap");
    const done = v => { wrap.classList.add("out"); document.removeEventListener("keydown", key); setTimeout(() => wrap.remove(), 200); resolve(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    wrap.addEventListener("click", e => { const b = e.target.closest("[data-cf]"); if (b) done(b.dataset.cf === "1"); else if (e.target === wrap) done(false); });
    document.addEventListener("keydown", key);
    wrap.querySelector('[data-cf="0"]').focus();
  });
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}
function safeUrl(w) {
  if (!w) return "";
  w = w.trim();
  if (/^https?:\/\//i.test(w)) return w;
  if (/^@[\w.]+$/.test(w)) return "https://instagram.com/" + w.slice(1);
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(w)) return "https://" + w;
  return "";
}
const hostOf = u => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };
const osmUrl = id => `https://www.openstreetmap.org/${{ n: "node", w: "way", r: "relation" }[id[0]]}/${id.slice(1)}`;
const gmapsDir = o => `https://www.google.com/maps/dir/?api=1&destination=${pt(o).lat},${pt(o).lon}`;
const yandexUrl = o => `https://yandex.uz/maps/?pt=${pt(o).lon},${pt(o).lat}&z=17&l=map`;

// ---------- Валюта ----------
let RATES = { rates: { ...FALLBACK_RATES }, diff: {}, date: "", live: false };
let currency = store.get("safar_currency", "USD");
if (!CURRENCIES.includes(currency)) currency = "USD";
function money(uzs, cur = currency) {
  if (!isFinite(uzs)) return "—";
  if (cur === "UZS") return fmtNum(Math.round(uzs / 1000) * 1000) + " " + t("sum");
  const v = fmtNum(uzs / RATES.rates[cur]);
  return ["USD", "EUR", "GBP"].includes(cur) ? SYMBOL[cur] + v : v + SYMBOL[cur];
}
const usd = v => v * RATES.rates.USD;

function hotelUsd(p) {
  const base = p.st ? STAR_USD[p.st] : (HOTEL_BASE_USD[p.s] || 45);
  const f = CITY_PRICE_FACTOR[p.city.n.ru] || (p.city.t === "city" ? 0.9 : 0.75);
  return Math.max(10, Math.round(base * f / 5) * 5);
}
POIS.forEach(p => { if (p.c === "h") p.usd = hotelUsd(p); });

// Полнота информации — для сортировки «сначала интересные»
// + вес типа (базар важнее кондитерской), бонус туристическим городам
// и известность (на скольких языках есть статья в Википедии: Регистан — 55, районный музей — 1–2)
const infoScore = p => Reviews.rating(p.key).avg * 2 + Math.min(p.fm || 0, 60) / 5 + (p.im ? 3 : 0) + (p.wd || p.wp ? 2 : 0) +
  (p.w ? 1 : 0) + (p.ph ? 1 : 0) + (p.oh ? 1 : 0) + (p.nr || p.ne ? 0.5 : 0) +
  (TYPE_WEIGHT[p.s] || 0) + (CITY_PRICE_FACTOR[p.city.n.ru] ? 1.5 : 0) + (p.owned ? 1 : 0) + (p.pro ? 3 : 0);

// ---------- Открыто сейчас (по часам работы OSM, время Ташкента) ----------
const OH_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const TZ_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" });
function tashkentNow() {
  const p = Object.fromEntries(TZ_FMT.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday), min: (+p.hour % 24) * 60 + +p.minute };
}
function ohDays(spec) {
  const set = new Set();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = OH_DAYS.indexOf(m[1]), b = m[2] ? OH_DAYS.indexOf(m[2]) : a;
    for (let i = a; ; i = (i + 1) % 7) { set.add(i); if (i === b) break; }
  }
  return set;
}
// Понимает самые частые форматы: «24/7», «Mo-Fr 09:00-18:00; Sa 10:00-15:00; Su off», «10:00-02:00».
// Всё остальное — null (неизвестно), чтобы не показывать неправду.
function parseOH(oh) {
  oh = oh.trim();
  if (oh === "24/7") return "always";
  const rules = [];
  for (const raw of oh.split(";")) {
    const r = raw.trim();
    if (!r) continue;
    const m = r.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/);
    const days = m ? ohDays(m[1].replace(/\s/g, "")) : new Set([0, 1, 2, 3, 4, 5, 6]);
    const rest = (m ? m[2] : r).trim();
    if (!days) return null;
    if (/^(off|closed)$/i.test(rest)) { rules.push({ days, ranges: [] }); continue; }
    const ranges = [];
    for (const span of rest.split(",")) {
      const t = span.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\+?$/);
      if (!t) return null;
      ranges.push([+t[1] * 60 + +t[2], +t[3] * 60 + +t[4]]);
    }
    rules.push({ days, ranges });
  }
  return rules.length ? rules : null;
}
function openState(p, at = tashkentNow()) {
  if (!p.oh) return null;
  if (p._oh === undefined) p._oh = parseOH(p.oh);
  const rules = p._oh;
  if (!rules) return null;
  if (rules === "always") return "always";
  const rangesFor = day => { let res = []; for (const r of rules) if (r.days.has(day)) res = r.ranges; return res; };
  const { day, min } = at;
  for (const [a, b] of rangesFor(day)) if (b > a ? min >= a && min < b : min >= a) return "open";
  for (const [a, b] of rangesFor((day + 6) % 7)) if (b <= a && min < b) return "open";   // работа после полуночи
  return "closed";
}
function openBadge(p, at) {
  const st = p.c !== "h" && openState(p, at);
  if (!st) return "";
  return st === "closed" ? `<span class="oh closed">${t("closed_now")}</span>`
    : `<span class="oh">${st === "always" ? t("open_24") : t("open_now")}</span>`;
}

// Перезапуск CSS-анимации: снять класс, дождаться отрисовки и поставить снова
function replay(el, cls, ms = 800) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el["_rp_" + cls]);
  el["_rp_" + cls] = setTimeout(() => el.classList.remove(cls), ms);
}

// ---------- Избранное ----------
let FAVS = new Set(store.get("safar_favs", []));
function toggleFav(key) {
  FAVS.has(key) ? FAVS.delete(key) : FAVS.add(key);
  store.set("safar_favs", [...FAVS]);
  dataChanged("favs");
  $$(`[data-fav="${CSS.escape(key)}"]`).forEach(b => {
    b.classList.toggle("on", FAVS.has(key));
    if (b.dataset.label) b.querySelector("span").textContent = b.dataset.label === "short" ? t(FAVS.has(key) ? "pl_saved" : "pl_save") : FAVS.has(key) ? t("fav_remove") : t("fav_add");
    if (FAVS.has(key)) replay(b, "burst", 700);
  });
  $("#favCount").textContent = FAVS.size || "";
  replay($("#favBtn"), "bump", 700);
}
const heartBtn = key => `<button class="heart ${FAVS.has(key) ? "on" : ""}" data-fav="${esc(key)}" aria-label="${t("fav_add")}">${icon("heart")}</button>`;
const heartLabelBtn = key => `<button class="btn ghost ${FAVS.has(key) ? "on" : ""}" data-fav="${esc(key)}" data-label="1">${icon("heart")} <span>${FAVS.has(key) ? t("fav_remove") : t("fav_add")}</span></button>`;

// ---------- Геолокация ----------
let userPos = null;
async function locate() {
  if (!userPos && !(await requireConsent())) throw new Error("no consent");
  return new Promise((resolve, reject) => {
    if (userPos) return resolve(userPos);
    if (!navigator.geolocation) return reject(new Error("no geo"));
    navigator.geolocation.getCurrentPosition(
      p => { userPos = { lat: p.coords.latitude, lon: p.coords.longitude }; resolve(userPos); },
      e => reject(e), { timeout: 10000, maximumAge: 300000 });
  });
}
const distTag = o => userPos ? `<span class="dist">${icon("locate")} ${t("km_away", { km: km(userPos, o) < 10 ? km(userPos, o).toFixed(1) : fmtNum(km(userPos, o)) })}</span>` : "";

// ---------- Постраничный вывод ----------
function paged(el, items, render, size = 24) {
  el._io?.disconnect();
  el._more?.remove();
  el.innerHTML = "";
  if (!items.length) { el.innerHTML = `<div class="empty">${icon("compass", "empty-ico")}<span>${t("nothing")}</span></div>`; return; }
  let shown = 0;
  const more = document.createElement("div");
  more.className = "more-wrap";
  more.innerHTML = `<button class="btn ghost">${t("show_more")}</button>`;
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) next(); }, { rootMargin: "500px" });
  function next() {
    el.insertAdjacentHTML("beforeend", items.slice(shown, shown + size).map(render).join(""));
    shown += size;
    if (shown >= items.length) { io.disconnect(); more.remove(); }
  }
  more.firstChild.onclick = next;
  el.after(more);
  el._io = io; el._more = more;
  next();
  if (shown < items.length) io.observe(more);
}

// ---------- Карточки ----------
function cityCard(c) {
  const img = c.img ? `background-image:url('${commonsImg(c.img, 480)}')` : `background:${regionBg(c.r)}`;
  const story = c.story ? `<div class="story">${esc(cityStory(c))}</div>` : "";
  return `
    <div class="card" data-go="#city/${c.id}" tabindex="0" role="link">
      <div class="card-img ${c.img ? "has-img" : ""}" style="${img}">${c.img ? "" : `<span class="card-mono">${esc(cityName(c).slice(0, 1))}</span>`}<span class="card-ico">${icon(c.ico)}</span>
        <span class="tag">${c.t === "city" ? t("city") : t("town")}${c.pop ? " · " + popText(c) : ""}</span>
      </div>
      ${heartBtn(c.key)}
      <div class="card-body">
        <h3>${esc(cityName(c))}</h3>
        <div class="sub">${regionName(c.r)}</div>
        ${story}
        <div class="meta">${ratingBadge(c.key)} <span title="${t("cat_h")}">${icon("hotel")} ${c.counts.h}</span> <span title="${t("cat_a")}">${icon("dome")} ${c.counts.a}</span> <span title="${t("cat_f")}">${icon("food")} ${c.counts.f}</span> ${distTag(c)}</div>
      </div>
    </div>`;
}

const poiIcon = p => TYPE_ICON[p.s] || CAT_ICON[p.c];
function poiRow(p) {
  const ico = poiPhoto(p, 160) ? `<div class="ico img" style="background-image:url('${poiPhoto(p, 160)}')"></div>` : `<div class="ico cat-${p.c}">${icon(poiIcon(p))}</div>`;
  const stars = p.st ? " " + hotelStars(p.st) : "";
  const flags = p.fl ? FOOD_FLAGS.filter(([k]) => p.fl.includes(k)).map(([k, i]) => `<span class="flag" title="${t("ff_" + k)}">${icon(i)}</span>`).join("") : "";
  const extra = [p.ad && `<span>${icon("pin")} ${esc(p.ad)}</span>`, p.oh && `<span>${icon("clock")} ${esc(p.oh)}</span>`, p.cu && `<span>${icon("chef")} ${esc(p.cu)}</span>`, flags && `<span class="flags">${flags}</span>`].filter(Boolean).join(" · ");
  const price = p.c === "h" ? `<div class="price" title="${p.priceFrom != null ? "" : t("price_note")}">${hotelPrice(p)}</div>` : "";
  return `
    <div class="row" data-go="#place/${p.id}" tabindex="0" role="link">
      ${ico}
      <div>
        <h4>${esc(poiName(p))}${stars}<span class="badge type">${typeLabel(p.s)}</span>${ownerBadges(p)}</h4>
        <div class="sub"><span>${icon("city")} ${esc(cityName(p.city))}</span> · ${ratingBadge(p.key)} ${distTag(p)} ${openBadge(p)}</div>
        ${extra ? `<div class="sub">${extra}</div>` : ""}
        <div class="acts">
          ${p.c === "h" ? `<a class="btn small gold-btn" href="${bookingUrl(p)}" target="_blank" rel="noopener" data-track="booking" data-key="${p.key}">${icon("search")} ${t("check_booking")}</a>` : ""}
          ${p.ph ? `<a class="btn small ghost" href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${icon("phone")} ${esc(p.ph)}</a>` : ""}
          <button class="btn small ghost" data-fly="${p.la},${p.lo}">${icon("map")} ${t("on_map")}</button>
        </div>
      </div>
      <div class="side">${price}${heartBtn(p.key)}</div>
    </div>`;
}
// Фото: от владельца заведения или с Wikimedia Commons
const poiPhoto = (p, w) => p.photo || (p.im ? commonsImg(p.im, w) : "");
// Цена отеля: реальная от владельца («от $X») или оценка («≈ $X»)
const hotelPrice = p => p.priceFrom != null
  ? (p.priceTo ? t("price_range", { a: money(usd(p.priceFrom)), b: money(usd(p.priceTo)) }) : t("price_from", { p: money(usd(p.priceFrom)) }))
  : t("price_est", { p: money(usd(p.usd)) });
const ownerBadges = p => (p.owned ? `<span class="badge owner" title="${t("owner_verified_hint")}">${icon("badge-check")} ${t("owner_verified")}</span>` : "") +
  (p.pro ? `<span class="badge pro">${icon("crown")} ${t("partner")}</span>` : "");
const bookingUrl = p => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(poiName(p) + ", " + p.city.n.en)}${typeof SAFAR_CONFIG !== "undefined" && SAFAR_CONFIG.bookingAid ? "&aid=" + encodeURIComponent(SAFAR_CONFIG.bookingAid) + "&label=safar" : ""}&lang=${{ ru: "ru", tr: "tr", de: "de", zh: "zh-cn", ko: "ko" }[LANG] || "en-gb"}`;

// ---------- Вкладки и маршрутизация (#home, #city/samarkand, #place/n123) ----------
const TABS = ["home", "cities", "hotels", "places", "map", "budget"];
let currentTab = "home";
const rendered = {};

function showTab(name) {
  currentTab = name;
  $$("[data-tab]").forEach(a => a.classList.toggle("active", a.dataset.tab === name));
  $$(".tab").forEach(s => s.classList.toggle("active", s.id === "tab-" + name));
  if (!rendered[name]) { rendered[name] = true; RENDER[name]?.(); }
  if (name === "map") initBigMap();
  if (name === "budget") { initRouteMap(); renderBudget(); }
}

// ---------- Кнопка «Назад» ----------
// История переходов внутри приложения: «Назад» ведёт туда, где человек был до этого,
// а подпись показывает, куда именно («Назад · Самарканд»). Нет истории — на главную.
const NAV = [];
const NAV_SCROLL = new Map();
const MODAL_SCROLL = new Map();   // прокрутка внутри окна (город, место…) — чтобы «Назад» вернул туда же, а не наверх
let NAV_JUMP = -1;                // X: прыжок назад сразу на несколько шагов — до раздела под окном
try { history.scrollRestoration = "manual"; } catch { /* browser may not support it */ }
window.addEventListener("scroll", () => {
  if (document.documentElement.classList.contains("modal-open")) return;   // под окном страница не листается
  NAV_SCROLL.set(location.hash && location.hash !== "#" ? location.hash : "#home", window.scrollY);
}, { passive: true });
const navKind = x => (x || "#home").slice(1).split(/[/?]/)[0] || "home";
function navTrack() {
  const h = location.hash && location.hash !== "#" ? location.hash : "#home";
  const kindOf = navKind, last = NAV[NAV.length - 1];
  if (last && !document.documentElement.classList.contains("modal-open")) NAV_SCROLL.set(last, window.scrollY);
  if (last && !$("#modal").classList.contains("hidden")) MODAL_SCROLL.set(last, $("#modal").scrollTop);
  if (NAV_JUMP >= 0 && NAV[NAV_JUMP] === h) { NAV.length = NAV_JUMP + 1; NAV_JUMP = -1; renderBackButtons(); return true; }
  NAV_JUMP = -1;
  const goingBack = NAV.length > 1 && NAV[NAV.length - 2] === h;
  if (goingBack) NAV.pop();                                             // вернулись назад (кнопкой или жестом)
  // Раздел сменили на раздел (нижнее меню, свайп) — не копим: «Назад» ведёт туда, откуда пришли, а не по всем разделам
  else if (last && last !== "#home" && TABS.includes(kindOf(last)) && TABS.includes(kindOf(h)) && h !== "#home") NAV[NAV.length - 1] = h;
  else if (last !== h) NAV.push(h);
  if (NAV.length > 60) NAV.splice(0, NAV.length - 60);
  renderBackButtons();
  return goingBack;
}
function navTitle(h) {
  const [kind, id] = decodeURIComponent(h.slice(1)).split("/");
  if (kind === "city" && CITY[id]) return cityName(CITY[id]);
  if (kind === "place" && POI[id]) return poiName(POI[id]);
  if (TABS.includes(kind)) return t("nav_" + kind);
  const KEYS = { privacy: "legal_privacy", terms: "legal_terms", nav: "nav_title", prices: "pr_title", favs: "favorites", account: "acc_title", guide: "guide", tours: "tours_title", nearby: "nearby_title", business: "biz_title", admin: "admin_title", ai: "ai_title" };
  return KEYS[kind] ? t(KEYS[kind]) : t("nav_home");
}
// Переход в раздел нижнего меню: между разделами — без новой записи в истории (кнопка «Назад» телефона
// не листает все открытые разделы), на главную — назад по истории, если пришли с неё
function goTab(name) {
  const h = "#" + name, cur = (location.hash.slice(1) || "home").split("/")[0];
  if (location.hash === h || (!location.hash && name === "home")) return window.scrollTo({ top: 0, behavior: "smooth" });
  const fromTab = TABS.includes(cur) && cur !== "home";
  if (name === "home" && fromTab && NAV.length === 2 && NAV[0] === "#home") return history.back();
  if (fromTab && name !== "home") { history.replaceState(null, "", h); return route(); }
  location.hash = h;
}
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-tab]");
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  e.preventDefault();
  goTab(a.dataset.tab);
});
function goBack() {
  if (NAV.length > 1) return history.back();
  if (!$("#modal").classList.contains("hidden")) return closeModal();
  location.hash = "#home";
}
// Переход из кода (собрали поездку, «Показать на карте»…): адрес и история «Назад» меняются вместе.
// С главной — новая запись (назад вернёт на главную), из окна или раздела — замена, как в нижнем меню.
function navGo(h) {
  if (location.hash === h) return;
  const replace = !NAV.length || NAV[NAV.length - 1] !== "#home";
  history[replace ? "replaceState" : "pushState"](null, "", h);
  NAV[replace ? Math.max(0, NAV.length - 1) : NAV.length] = h;
  renderBackButtons();
}
function renderBackButtons() {
  const prev = NAV.length > 1 ? NAV[NAV.length - 2] : "#home";
  const html = `${icon("arrow-left")}<span><b>${t("back")}</b><small>${esc(navTitle(prev))}</small></span>`;
  for (const b of $$("[data-back]")) {
    b.innerHTML = html;
    b.title = `${t("back")} · ${navTitle(prev)}`;
  }
  // На главной полосы «Назад» нет никогда — это начало приложения.
  // На остальных разделах — только если пришли со страницы города, места и т.п. (между разделами есть нижнее меню)
  // и только если «Назад» ведёт не на ту же страницу.
  const kind = (location.hash.slice(1) || "home").split(/[/?]/)[0] || "home";
  const prevKind = prev.slice(1).split(/[/?]/)[0] || "home";
  $("#tabBack")?.classList.toggle("hidden", kind === "home" || !TABS.includes(kind) || NAV.length < 2 || TABS.includes(prevKind) || prev === location.hash);
}

function route() {
  const goingBack = navTrack();
  const h = decodeURIComponent(location.hash.slice(1));
  const [kind, id] = h.split("/");
  const opened = kind === "city" && CITY[id] ? openCity(CITY[id])
    : kind === "place" && POI[id] ? openPlace(POI[id])
    : kind === "favs" ? openFavs()
    : kind === "guide" ? openGuide(id)
    : EXT.routes[kind] ? EXT.routes[kind](id) : false;
  if (opened !== false) { if (goingBack) restoreModalScroll(location.hash); return; }
  closeModal(false);
  showTab(TABS.includes(kind) ? kind : currentTab);
  if (TABS.includes(kind)) window.scrollTo({ top: goingBack ? NAV_SCROLL.get(location.hash || "#home") || 0 : 0 });
}
// Вернулись «Назад» в окно — на то место, где человек его листал (содержимое может догружаться)
function restoreModalScroll(h) {
  const y = MODAL_SCROLL.get(h), m = $("#modal");
  if (!y || m.classList.contains("hidden")) return;
  let token = modalToken;
  const stop = () => { token = -1; };   // человек сам начал листать — не дёргаем
  m.addEventListener("touchstart", stop, { once: true, passive: true });
  m.addEventListener("wheel", stop, { once: true, passive: true });
  const set = () => { if (token === modalToken) m.scrollTop = y; };
  requestAnimationFrame(set);
  setTimeout(set, 250);
  setTimeout(set, 700);
}

// ---------- Главная ----------
const tileRank = href => href === "#sos" ? 2 : 0;
function renderHome() {
  const sam = byRu("Самарканд");
  if (sam?.img) typeof heroPhoto === "function" ? heroPhoto(sam.img) : ($("#hero").style.backgroundImage = `url('${commonsImg(sam.img, 1280)}')`);
  const cnt = c => POIS.filter(p => p.c === c).length;
  $("#stats").innerHTML = [
    ["#cities", CITIES.length, "stat_cities", "city"], ["#hotels", cnt("h"), "stat_hotels", "hotel"],
    ["#places/a", cnt("a"), "stat_sights", "dome"], ["#places/s", cnt("s"), "stat_shops", "shopping"], ["#places/f", cnt("f"), "stat_food", "food"]
  ].map(([href, n, k, ic]) => `<a class="stat" href="${href.split("/")[0]}" data-cat-link="${href.split("/")[1] || ""}"><i>${icon(ic)}</i><b>${fmtNum(n)}</b><span>${t(k)}</span></a>`).join("");

  $("#popularGrid").innerHTML = POPULAR.map(byRu).filter(Boolean).map(cityCard).join("");
  $("#guideTiles").innerHTML = [
    ["phrases", "languages", t("phrasebook"), t("phrasebook_sub", { n: PHRASES.length })],
    ["tips", "lightbulb", t("tips"), t("tips_sub")]
  ].map(([id, ic, title, sub]) => [`#guide/${id}`, ic, title, sub]).concat(EXT.homeTiles.map(fn => fn()).filter(Boolean))
    .sort((a, b) => tileRank(b[0]) - tileRank(a[0]))   // «Экстренная помощь» — всегда первой
    .map(([href, ic, title, sub]) => `<a class="guide-tile ${href === "#sos" ? "tile-sos" : ""}" href="${href}"><i>${icon(ic)}</i><b>${title}</b><span>${sub}</span>${icon("arrow-up-right", "tile-go")}</a>`).join("");

  const counts = {};
  CITIES.forEach(c => counts[c.r] = (counts[c.r] || 0) + 1);
  $("#regionChips").innerHTML = REGION_KEYS.map(r => `<a class="chip" href="#cities" data-region="${r}">${regionName(r)}<b>${counts[r] || 0}</b></a>`).join("");
  $("#dataUpdated").textContent = DB.updated ? t("updated", { date: fmtDate(new Date(DB.updated)) }) : "";
  renderWeatherStrip();
  renderRates();
  EXT.onHome.forEach(fn => fn());
}

async function renderWeatherStrip() {
  const list = WEATHER_CITIES.map(byRu).filter(Boolean);
  const box = $("#weatherStrip");
  if (!box.children.length) box.innerHTML = list.map(() => `<div class="wcard"><div class="skeleton"></div><div class="skeleton"></div></div>`).join("");
  try {
    const data = await API.weather(list);
    box.innerHTML = list.map((c, i) => {
      const cur = data[i]?.current;
      if (!cur) return "";
      const w = wmo(cur.weather_code, cur.is_day);
      return `<div class="wcard" data-go="#city/${c.id}" role="link" tabindex="0">
        <div class="wi">${w.icon}</div><b>${Math.round(cur.temperature_2m)}°</b>
        <div>${esc(cityName(c))}</div><small>${w.text}</small></div>`;
    }).join("");
  } catch {
    box.innerHTML = `<p class="hint">${t("weather_na")}</p>`;
  }
}

function wmo(code, isDay = 1) {
  const g = code === 0 ? ["clear", isDay ? "w-sun" : "w-moon"] : code <= 2 ? ["partly", isDay ? "w-partly" : "w-partly-night"] : code === 3 ? ["cloudy", "w-cloud"]
    : code <= 48 ? ["fog", "w-fog"] : code <= 57 ? ["drizzle", "w-drizzle"] : code <= 67 || (code >= 80 && code <= 82) ? ["rain", "w-rain"]
    : code <= 86 ? ["snow", "w-snow"] : ["storm", "w-storm"];
  return { text: t("w_" + g[0]), icon: icon(g[1], "wx wx-" + (g[0] === "clear" && !isDay ? "night" : g[0])) };
}

function renderRates() {
  const show = CURRENCIES.filter(c => c !== "UZS");
  $("#ratesBox").innerHTML = show.map(c => {
    const d = RATES.diff[c] || 0;
    const cls = d > 0 ? "up" : d < 0 ? "down" : "";
    const arrow = d > 0 ? icon("trending") : d < 0 ? icon("trending-down") : "";
    return `<div class="rate"><small>1 ${c}</small><b>${RATES.rates[c].toLocaleString(NUM_LOCALE[LANG], { maximumFractionDigits: 2 })}</b>
      <small class="${cls}">${arrow} ${d ? Math.abs(d).toLocaleString(NUM_LOCALE[LANG], { maximumFractionDigits: 2 }) : ""}</small></div>`;
  }).join("");
  $("#ratesSrc").textContent = RATES.live || RATES.date ? t("rates_src", { date: RATES.date }) : t("rates_offline");
  renderConverter();
}

function renderConverter() {
  const amount = +$("#convAmount").value || 0;
  const from = $("#convFrom").value || "USD";
  const uzs = amount * RATES.rates[from];
  const targets = ["UZS", "USD", "EUR", "RUB"].filter(c => c !== from).slice(0, 3);
  $("#convResult").innerHTML = targets.map(c => `<div>${money(uzs, c)}</div>`).join("");
}

// Спрятать элемент с анимацией закрытия: сначала класс .closing (CSS-анимация), потом .hidden
function hideAnimated(el, ms = 180) {
  if (!el || el.classList.contains("hidden") || el.classList.contains("closing")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return el.classList.add("hidden");
  el.classList.add("closing");
  clearTimeout(el._hideT);
  el._hideT = setTimeout(() => { el.classList.remove("closing"); el.classList.add("hidden"); }, ms);
}
function showAnimated(el) {
  if (!el) return;
  clearTimeout(el._hideT);
  el.classList.remove("closing", "hidden");
}

// Глобальный поиск
function globalSearch() {
  const q = $("#globalSearch").value.trim().toLowerCase();
  const box = $("#searchResults");
  if (q.length < 2) { hideAnimated(box); return; }
  const cities = CITIES.filter(c => c.hay.includes(q)).slice(0, 6);
  const pois = POIS.filter(p => p.hay.includes(q))
    .sort((a, b) => ({ a: 0, h: 1, s: 2, f: 3 }[a.c] - { a: 0, h: 1, s: 2, f: 3 }[b.c]) || infoScore(b) - infoScore(a))
    .slice(0, 10);
  const items = [
    ...cities.map(c => `<div class="sr-item" data-go="#city/${c.id}" tabindex="0" role="option"><span class="ic">${icon(ICON_SYMBOLS[c.ico] ? c.ico : "city")}</span><div>${esc(cityName(c))}<small>${regionName(c.r)}</small></div></div>`),
    ...pois.map(p => `<div class="sr-item" data-go="#place/${p.id}" tabindex="0"><span class="ic">${icon(poiIcon(p))}</span><div>${esc(poiName(p))}<small>${typeLabel(p.s)} · ${esc(cityName(p.city))}</small></div></div>`)
  ];
  box.innerHTML = items.length ? items.join("") : `<div class="empty">${t("nothing")}</div>`;
  showAnimated(box);
}

// ---------- Города ----------
function renderCities() {
  const q = $("#citySearch").value.trim().toLowerCase();
  const reg = $("#regionFilter").value;
  const type = $("#cityType").value;
  const sort = $("#citySort").value;
  const list = CITIES.filter(c => (!reg || c.r === reg) && (!type || c.t === type) && (!q || c.hay.includes(q)));
  const loc = LOCALE[LANG];
  list.sort(sort === "name" ? (a, b) => cityName(a).localeCompare(cityName(b), loc)
    : sort === "rating" ? (a, b) => Reviews.rating(b.key).avg - Reviews.rating(a.key).avg || b.pop - a.pop
    : sort === "dist" && userPos ? (a, b) => km(userPos, a) - km(userPos, b)
    : (a, b) => (b.pop || 0) - (a.pop || 0) || b.counts.h - a.counts.h);
  $("#cityFound").textContent = t("found", { n: list.length });
  paged($("#cityGrid"), list, cityCard, 24);
}

// ---------- Отели ----------
function renderHotels() {
  const q = $("#hotelSearch").value.trim().toLowerCase();
  const city = $("#hotelCity").value;
  const type = $("#hotelType").value;
  const minStars = +$("#hotelStars").value;
  const sort = $("#hotelSort").value;
  const list = POIS.filter(p => p.c === "h" && (!city || p.city.id === city) && (!type || p.s === type) &&
    (!minStars || (p.st || 0) >= minStars) && (!q || p.hay.includes(q) || p.city.hay.includes(q)) &&
    (typeof hotelQuickOk !== "function" || hotelQuickOk(p)));
  list.sort(sort === "-price" ? (a, b) => b.usd - a.usd
    : sort === "stars" ? (a, b) => (b.st || 0) - (a.st || 0) || infoScore(b) - infoScore(a)
    : sort === "rating" ? (a, b) => Reviews.rating(b.key).avg - Reviews.rating(a.key).avg || infoScore(b) - infoScore(a)
    : sort === "dist" && userPos ? (a, b) => km(userPos, a) - km(userPos, b)
    : (a, b) => a.usd - b.usd || infoScore(b) - infoScore(a));
  $("#hotelFound").textContent = t("found", { n: list.length });
  paged($("#hotelList"), list, poiRow, 20);
}

// ---------- Места ----------
let placeCat = "a";
function renderPlaces() {
  const q = $("#placeSearch").value.trim().toLowerCase();
  const city = $("#placeCity").value;
  const type = $("#placeType").value;
  const sort = $("#placeSort").value;
  const onlyOpen = $("#placeOpen").checked;
  const cuisine = placeCat === "f" ? $("#placeCuisine").value : "";
  const cuisineSet = cuisine && new Set(CUISINE_GROUPS[cuisine]);
  const flags = placeCat === "f" ? $$("#foodFlags .chip.on").map(b => b.dataset.flag) : [];
  const list = POIS.filter(p => p.c === placeCat && (!city || p.city.id === city) && (!type || p.s === type) &&
    (!q || p.hay.includes(q) || p.city.hay.includes(q)) && (!onlyOpen || ["open", "always"].includes(openState(p))) &&
    (!cuisineSet || (p.cu || "").split(", ").some(x => cuisineSet.has(x))) && flags.every(k => (p.fl || "").includes(k)));
  const loc = LOCALE[LANG];
  list.sort(sort === "name" ? (a, b) => poiName(a).localeCompare(poiName(b), loc)
    : sort === "rating" ? (a, b) => Reviews.rating(b.key).avg - Reviews.rating(a.key).avg || infoScore(b) - infoScore(a)
    : sort === "dist" && userPos ? (a, b) => km(userPos, a) - km(userPos, b)
    : (a, b) => infoScore(b) - infoScore(a) || (b.city.pop || 0) - (a.city.pop || 0));
  $("#placeFound").textContent = t("found", { n: list.length });
  paged($("#placeList"), list, poiRow, 20);
}

function setPlaceCat(cat) {
  placeCat = cat;
  $$("#placeCat button").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
  fillPlaceSelects();
  renderPlaces();
}

// ---------- Выпадающие списки ----------
function cityOptions(cat, allLabel) {
  const loc = LOCALE[LANG];
  return `<option value="">${allLabel}</option>` + CITIES.filter(c => c.counts[cat] > 0)
    .sort((a, b) => cityName(a).localeCompare(cityName(b), loc))
    .map(c => `<option value="${c.id}">${esc(cityName(c))} (${c.counts[cat]})</option>`).join("");
}
function typeOptions(cat) {
  const counts = {};
  POIS.forEach(p => { if (p.c === cat) counts[p.s] = (counts[p.s] || 0) + 1; });
  return `<option value="">${t("all_types")}</option>` + Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `<option value="${s}">${typeLabel(s)} (${n})</option>`).join("");
}
function setOptions(sel, html) {
  const v = sel.value;
  sel.innerHTML = html;
  if ([...sel.options].some(o => o.value === v)) sel.value = v;
}
function fillPlaceSelects() {
  setOptions($("#placeCity"), cityOptions(placeCat, t("all_cities")));
  setOptions($("#placeType"), typeOptions(placeCat));
  // Еда: группы кухонь и отметки (с количеством — видно реальное покрытие данных)
  const food = POIS.filter(p => p.c === "f");
  setOptions($("#placeCuisine"), `<option value="">${t("cu_all")}</option>` + Object.keys(CUISINE_GROUPS).map(g => {
    const set = new Set(CUISINE_GROUPS[g]);
    const n = food.filter(p => (p.cu || "").split(", ").some(x => set.has(x))).length;
    return `<option value="${g}">${t("cu_" + g)} (${n})</option>`;
  }).join(""));
  const on = new Set($$("#foodFlags .chip.on").map(b => b.dataset.flag));
  $("#foodFlags").innerHTML = FOOD_FLAGS.map(([k, ic]) => `<button class="chip ${on.has(k) ? "on" : ""}" data-flag="${k}">${icon(ic)} ${t("ff_" + k)} <b>${food.filter(p => (p.fl || "").includes(k)).length}</b></button>`).join("") +
    `<span class="hint">${t("ff_note")}</span>`;
  $("#placeCuisine").classList.toggle("hidden", placeCat !== "f");
  $("#foodFlags").classList.toggle("hidden", placeCat !== "f");
}
function fillSelects() {
  setOptions($("#langSelect"), Object.entries(LANGS).map(([k, v]) => `<option value="${k}" title="${v}">${LANG_CODE[k]} · ${v}</option>`).join(""));
  $("#langSelect").value = LANG;
  setOptions($("#currency"), CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join(""));
  $("#currency").value = currency;
  syncPickers();
  setOptions($("#convFrom"), CURRENCIES.filter(c => c !== "UZS").map(c => `<option value="${c}">${c}</option>`).join(""));
  setOptions($("#regionFilter"), `<option value="">${t("all_regions")}</option>` + REGION_KEYS.map(r => `<option value="${r}">${regionName(r)}</option>`).join(""));
  setOptions($("#hotelCity"), cityOptions("h", t("all_cities")));
  setOptions($("#hotelType"), `<option value="">${t("all_types")}</option>` + HOTEL_TYPES.map(s => `<option value="${s}">${typeLabel(s)}</option>`).join(""));
  setOptions($("#hotelStars"), `<option value="0">${t("any_stars")}</option>` + [3, 4, 5].map(n => `<option value="${n}">${t("stars_plus", { n })}</option>`).join(""));
  setOptions($("#bTransport"), Object.keys(DEFAULT_TARIFFS.transportPerKm).map(k => `<option value="${k}">${t("tr_" + k)}</option>`).join(""));
  if (!$("#bTransport").value) $("#bTransport").value = "train";
  fillPlaceSelects();
  const loc = LOCALE[LANG];
  $("#cityList").innerHTML = [...CITIES].sort((a, b) => cityName(a).localeCompare(cityName(b), loc))
    .map(c => `<option value="${esc(cityLabel(c))}">`).join("");
}
const cityLabel = c => `${cityName(c)} — ${regionName(c.r)}`;

// ---------- Модальные окна ----------
let miniMap = null, planMap = null, currentPlan = null, currentCity = null;
let modalToken = 0;

function openModal(html) {
  destroyMiniMap();
  modalToken++;
  document.querySelector(".ios-pointer")?.remove();
  $("#modalBody").innerHTML = html;
  $("#modal").classList.remove("hidden", "closing");
  $("#modal").scrollTop = 0;
  document.body.style.overflow = "hidden";
  document.documentElement.classList.add("modal-open");
  if (!rendered[currentTab]) showTab(currentTab);
  return modalToken;
}
function closeModal(updateHash = true) {
  const m = $("#modal");
  if (m.classList.contains("hidden") || m.classList.contains("closing")) return;
  // X / Esc / тап мимо окна: закрываем всю цепочку окон и возвращаемся в раздел под ними — назад по истории,
  // а не новой записью (иначе «Назад» телефона снова открывает закрытое окно)
  if (updateHash) {
    let i = NAV.length - 1;
    while (i >= 0 && !TABS.includes(navKind(NAV[i]))) i--;
    if (i >= 0 && i < NAV.length - 1) {
      NAV_JUMP = i;
      history.go(i - (NAV.length - 1));
      // Страховка: история браузера разошлась с нашей — просто закрываем окно
      return setTimeout(() => { if (NAV_JUMP === i && !m.classList.contains("hidden")) { NAV_JUMP = -1; closeModal(false); history.replaceState(null, "", "#" + currentTab); NAV.length = 0; navTrack(); } }, 500);
    }
    history.replaceState(null, "", "#" + currentTab);   // открыли окно по ссылке — истории нет
    NAV.length = 0;
    navTrack();
  }
  document.body.style.overflow = "";
  document.documentElement.classList.remove("modal-open");
  // Сначала анимация исчезновения, потом скрываем (если за это время не открыли новое окно)
  const token = modalToken;
  m.classList.add("closing");
  setTimeout(() => {
    if (token !== modalToken || !m.classList.contains("closing")) return;
    m.classList.remove("closing");
    m.classList.add("hidden");
    document.querySelector(".ios-pointer")?.remove();
    destroyMiniMap();
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
}
function destroyMiniMap() {
  miniMap?.remove();
  planMap?.remove();
  miniMap = planMap = currentPlan = null;
}

function tabsHtml(defs) {
  return `<div class="m-tabs">${defs.map(([id, label], i) => `<button class="${i ? "" : "active"}" data-pane="${id}">${label}</button>`).join("")}</div>`;
}

function openCity(c) {
  const img = c.img ? commonsImg(c.img, 1280) : "";
  const others = Object.entries(c.n).filter(([l, v]) => l !== LANG && v !== cityName(c)).map(([, v]) => v);
  const plan = dayPlan(c);
  const tab = (ic, label, n) => `${icon(ic)} ${label}${n != null ? ` <b class="n">${n}</b>` : ""}`;
  const tabs = [["overview", tab("info", t("overview"))], ...(plan ? [["plan", tab("calendar", t("day_plan"))]] : []), ["h", tab("hotel", t("cat_h"), c.counts.h)], ["a", tab("dome", t("cat_a"), c.counts.a)],
    ["s", tab("shopping", t("cat_s"), c.counts.s)], ["f", tab("food", t("cat_f"), c.counts.f)],
    ...EXT.cityTabs.map(x => [x.id, x.label(c)]).filter(x => x[1]), ["reviews", tab("message", t("reviews"))]];
  currentCity = c;
  const token = openModal(`
    <div class="m-head" style="${img ? `background-image:url('${img}')` : `background:${regionBg(c.r)}`}">
      ${img ? "" : `<div class="big-ico">${icon(c.ico)}</div>`}
      <h2>${esc(cityName(c))}</h2>
      ${others.length ? `<div class="alt">${esc([...new Set(others)].join(" · "))}</div>` : ""}
      <p>${regionName(c.r)}${c.pop ? ` · ${icon("users")} ${popText(c)}` : ""} · <span data-badge="${c.key}">${ratingBadge(c.key)}</span></p>
      ${img ? `<a class="credit" href="${commonsPage(c.img)}" target="_blank" rel="noopener">${t("photo")}: Wikimedia Commons</a>` : ""}
    </div>
    <div class="m-body">
      <div class="pl-acts" style="--n:${plan ? 4 : 3}">
        ${tripBtn(c.id)}
        ${plan ? `<button class="pl-act" data-pane-go="plan"><i>${icon("calendar")}</i><span>${t("pl_day")}</span></button>` : ""}
        <a class="pl-act" href="${navHref(c)}"><i>${icon("directions")}</i><span>${t("pl_route")}</span></a>
        <button class="pl-act ${FAVS.has(c.key) ? "on" : ""}" data-fav="${esc(c.key)}" data-label="short"><i>${icon("heart")}</i><span>${t(FAVS.has(c.key) ? "pl_saved" : "pl_save")}</span></button>
      </div>
      <div class="pl-more">
        <button type="button" data-fly="${c.lat},${c.lon},12">${icon("map")} ${t("on_map")}</button>
        <button type="button" data-share>${icon("share")} ${t("share")}</button>
      </div>
      ${tabsHtml(tabs)}
      <div class="m-pane active" data-pane="overview">
        <div class="wiki" id="wikiBox">${c.story ? `<p>${esc(cityStory(c))}</p>` : ""}<div class="skeleton"></div><div class="skeleton"></div></div>
        <div id="weatherBox"></div>
        ${EXT.cityOverview.map(fn => fn(c)).join("")}
        <div id="miniMap"></div>
      </div>
      ${plan ? `<div class="m-pane" data-pane="plan">${planHtml(plan)}</div>` : ""}
      ${["h", "a", "s", "f"].map(k => `<div class="m-pane" data-pane="${k}"><div class="list" id="mList-${k}"></div></div>`).join("")}
      ${EXT.cityTabs.map(x => `<div class="m-pane" data-pane="${x.id}"></div>`).join("")}
      <div class="m-pane" data-pane="reviews" id="revBox"></div>
    </div>`);

  currentPlan = plan;
  EXT.cityOverviewBind.forEach(fn => fn(c, $("#modalBody")));
  const pois = POIS.filter(p => p.city === c);
  for (const k of ["h", "a", "s", "f"]) {
    const list = pois.filter(p => p.c === k).sort(k === "h" ? (a, b) => a.usd - b.usd : (a, b) => infoScore(b) - infoScore(a));
    paged($("#mList-" + k), list, poiRow, 15);
  }
  renderReviews($("#revBox"), c.key);

  miniMap = makeMap("miniMap", { scrollWheelZoom: false }).setView([c.lat, c.lon], 13);
  L.marker([c.lat, c.lon], { icon: destPin("city") }).addTo(miniMap).bindPopup(esc(cityName(c)));
  const cluster = clusterGroup("a");
  pois.filter(p => p.c !== "f").forEach(p => cluster.addLayer(poiMarker(p)));
  miniMap.addLayer(cluster);

  // Википедия
  (async () => {
    const box = $("#wikiBox");
    const story = c.story ? `<p>${esc(cityStory(c))}</p>` : "";
    const w = c.wiki ? await API.wikiFor(c.wiki).catch(() => null) : null;
    if (token !== modalToken) return;
    if (w) {
      box.innerHTML = story + `<p>${esc(w.extract)}</p>
        <a href="${esc(w.url)}" target="_blank" rel="noopener">${t("wiki_read")} ${icon("arrow-right")}</a>
        ${w.lang !== LANG ? ` <span class="hint">${t("wiki_other_lang", { lang: w.lang.toUpperCase() })}</span>` : ""}`;
    } else {
      box.innerHTML = story || `<p>${esc(t("city_generic", { name: cityName(c), region: regionName(c.r), type: c.t === "city" ? t("city") : t("town") }))}</p>`;
    }
  })();

  // Погода
  (async () => {
    try {
      const [w] = await API.weather([c], true);
      if (token !== modalToken) return;
      const cur = wmo(w.current.weather_code, w.current.is_day);
      const days = w.daily.time.map((d, i) => {
        const wd = wmo(w.daily.weather_code[i]);
        const label = i === 0 ? t("today") : weekdayShort(new Date(d + "T12:00"));
        return `<div><small>${label}</small><i>${wd.icon}</i><b>${Math.round(w.daily.temperature_2m_max[i])}°</b> <span class="hint">${Math.round(w.daily.temperature_2m_min[i])}°</span></div>`;
      }).join("");
      $("#weatherBox").innerHTML = `
        <div class="now-weather"><span class="now-ico">${cur.icon}</span><b>${Math.round(w.current.temperature_2m)}°C</b>
          <span>${cur.text}</span><span>${icon("wind")} ${Math.round(w.current.wind_speed_10m)} ${t("kmh")}</span><span>${icon("droplets")} ${w.current.relative_humidity_2m}%</span></div>
        <div class="hint">${t("weather_week")}</div><div class="forecast">${days}</div>`;
    } catch { /* погода недоступна — блок просто не показываем */ }
  })();
}

function openPlace(p) {
  const img = poiPhoto(p, 1280);
  const web = safeUrl(p.w);
  const facts = [
    p.c === "h" && [p.priceFrom != null ? t("price_owner") : t("est_price"), `${hotelPrice(p)}${p.priceFrom != null ? "" : `<br><span class="hint">${t("price_note")}</span>`}`],
    p.st && [t("hotel_class"), hotelStars(p.st)],
    p.ad && [t("address"), esc(p.ad)],
    p.ph && [t("phone"), `<a href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${esc(p.ph)}</a>`],
    web && [t("website"), `<a href="${esc(web)}" target="_blank" rel="noopener" data-track="website" data-key="${p.key}">${esc(hostOf(web))}</a>`],
    p.oh && [t("hours"), esc(p.oh) + " " + openBadge(p)],
    p.cu && [t("cuisine"), esc(p.cu)],
    p.de && [t("description"), esc(p.de)]
  ].filter(Boolean);
  // Главные действия — крупными кнопками (как в Google Maps), остальное — мелкими ссылками ниже
  const fav = FAVS.has(p.key);
  const acts = [
    `<a class="pl-act main nav-main" href="${navHref(p)}" data-track="directions" data-key="${p.key}"><i>${icon("directions")}</i><span>${t("pl_route")}</span></a>`,
    `<button class="pl-act ${fav ? "on" : ""}" data-fav="${esc(p.key)}" data-label="short"><i>${icon("heart")}</i><span>${t(fav ? "pl_saved" : "pl_save")}</span></button>`,
    p.ph && `<a class="pl-act" href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}" data-track="phone" data-key="${p.key}"><i>${icon("phone")}</i><span>${t("pl_call")}</span></a>`,
    p.c === "h" ? `<a class="pl-act" href="${bookingUrl(p)}" target="_blank" rel="noopener" data-track="booking" data-key="${p.key}"><i>${icon("bed")}</i><span>${t("pl_book")}</span></a>`
      : web && `<a class="pl-act" href="${esc(web)}" target="_blank" rel="noopener" data-track="website" data-key="${p.key}"><i>${icon("globe")}</i><span>${t("website")}</span></a>`
  ].filter(Boolean);
  const FACT_IC = { [t("price_owner")]: "wallet", [t("est_price")]: "wallet", [t("hotel_class")]: "star", [t("address")]: "pin", [t("phone")]: "phone", [t("website")]: "globe", [t("hours")]: "clock", [t("cuisine")]: "food", [t("description")]: "info" };
  const token = openModal(`
    <div class="m-head pl-head" style="${img ? `background-image:url('${img}')` : `background:${CAT_BG[p.c]}`}">
      ${img ? "" : `<div class="big-ico">${icon(poiIcon(p))}</div>`}
      <h2>${esc(poiName(p))}</h2>
      ${p.owned || p.pro ? `<div>${ownerBadges(p)}</div>` : ""}
      ${poiName(p) !== p.n ? `<div class="alt">${esc(p.n)}</div>` : ""}
      <p>${typeLabel(p.s)} · <a href="#city/${p.city.id}" style="color:#fff">${icon("city")} ${esc(cityName(p.city))}</a> · <span data-badge="${p.key}">${ratingBadge(p.key)}</span></p>
      ${img && !p.photo ? `<a class="credit" href="${commonsPage(p.im)}" target="_blank" rel="noopener">${t("photo")}: Wikimedia Commons</a>` : ""}
    </div>
    <div class="m-body">
      <div class="pl-acts" style="--n:${acts.length}">${acts.join("")}</div>
      <div class="pl-more">
        <button type="button" data-fly="${p.la},${p.lo}">${icon("map")} ${t("on_map")}</button>
        <button type="button" data-share>${icon("share")} ${t("share")}</button>
        <a href="${gmapsDir(p)}" target="_blank" rel="noopener">${icon("external")} Google Maps</a>
        <a href="${yandexUrl(p)}" target="_blank" rel="noopener">${icon("external")} ${t("yandex")}</a>
      </div>
      ${facts.length ? `<div class="facts pl-facts">${facts.map(([k, v]) => `<div class="fact"><i>${icon(FACT_IC[k] || "info")}</i><div><small>${k}</small>${v}</div></div>`).join("")}</div>` : ""}
      <div class="wiki hidden" id="wikiBox"></div>
      <div id="miniMap"></div>
      <p class="hint"><a href="${osmUrl(p.id)}" target="_blank" rel="noopener">${t("view_osm")}</a> · © OpenStreetMap</p>
      ${EXT.placeExtras.map(fn => fn(p)).join("")}
      <h3 class="sec-title">${icon("message")} ${t("reviews")}</h3>
      <div id="revBox"></div>
    </div>`);

  renderReviews($("#revBox"), p.key);
  miniMap = makeMap("miniMap", { scrollWheelZoom: false }).setView([p.la, p.lo], 16);
  L.marker([p.la, p.lo], { icon: destPin(poiIcon(p)) }).addTo(miniMap);

  if (p.wd || p.wp) {
    (async () => {
      let titles = {};
      if (p.wp) { const [l, ...r] = p.wp.split(":"); if (["ru", "uz", "en"].includes(l)) titles[l] = r.join(":"); }
      if (p.wd) titles = { ...(await API.wikiTitles(p.wd).catch(() => ({}))), ...titles };
      const w = await API.wikiFor(titles).catch(() => null);
      if (token !== modalToken || !w) return;
      const box = $("#wikiBox");
      box.classList.remove("hidden");
      box.innerHTML = `${w.img && !img ? `<img src="${esc(w.img)}" alt="" loading="lazy" decoding="async" style="float:right;max-width:40%;border-radius:12px;margin:0 0 8px 12px">` : ""}
        <p>${esc(w.extract)}</p><a href="${esc(w.url)}" target="_blank" rel="noopener">${t("wiki_read")} ${icon("arrow-right")}</a>
        ${w.lang !== LANG ? ` <span class="hint">${t("wiki_other_lang", { lang: w.lang.toUpperCase() })}</span>` : ""}`;
    })();
  }
}

function openFavs() {
  const keys = [...FAVS];
  const cities = keys.filter(k => k.startsWith("city:")).map(k => CITY[k.slice(5)]).filter(Boolean);
  const pois = keys.filter(k => k.startsWith("poi:")).map(k => POI[k.slice(4)]).filter(Boolean);
  openModal(`
    <div class="m-head" style="background:${CAT_BG.f};min-height:160px;padding-top:60px"><h2>${icon("heart", "fill")} ${t("favorites")}</h2></div>
    <div class="m-body">
      ${EXT.favsExtras.map(fn => fn()).join("")}
      ${!cities.length && !pois.length ? `<p class="empty">${t("fav_empty")}</p>` : ""}
      ${cities.length ? `<div class="grid">${cities.map(cityCard).join("")}</div>` : ""}
      ${pois.length ? `<div class="list" style="margin-top:16px">${pois.map(poiRow).join("")}</div>` : ""}
    </div>`);
}

// ---------- План на день ----------
const fmtClock = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
// opts: used — места, уже стоящие в другие дни; max — сколько мест; start — время начала (мин от полуночи)
function dayPlan(c, opts = {}) {
  const { used = [], max = 6, start = 9 * 60, minStops = 2 } = opts;
  // Из шопинга — только базары; памятники — только известные (статуи людей пропускаем)
  const cand = POIS.filter(p => p.city === c && km(c, p) < 15 &&
    (p.c === "a" ? (p.s !== "monument" || (p.fm || 0) >= 20) : p.s === "marketplace"))
    .sort((a, b) => infoScore(b) - infoScore(a));
  const picked = [];
  for (const p of cand) {
    if (picked.length >= max) break;
    const nm = poiName(p).toLowerCase();
    if ([...picked, ...used].some(q => poiName(q).toLowerCase() === nm || km(q, p) < 0.15)) continue;
    if (p.c === "s" && picked.some(q => q.c === "s")) continue;      // один базар/магазин на день
    picked.push(p);
  }
  if (picked.length < minStops) return null;

  // Кратчайший порядок обхода (перебор — мест не больше шести)
  let best = picked, bestD = Infinity;
  const perm = (arr, l) => {
    if (l === arr.length) {
      let d = 0;
      for (let i = 1; i < arr.length && d < bestD; i++) d += km(arr[i - 1], arr[i]);
      if (d < bestD) { bestD = d; best = arr.slice(); }
      return;
    }
    for (let i = l; i < arr.length; i++) { [arr[l], arr[i]] = [arr[i], arr[l]]; perm(arr, l + 1); [arr[l], arr[i]] = [arr[i], arr[l]]; }
  };
  perm(picked.slice(), 0);

  // Расписание: старт в 9:00, обед после 12:30 в ближайшем ресторане
  const steps = [];
  let clock = start, walked = 0, lunched = start >= 12 * 60;
  best.forEach((p, i) => {
    if (i > 0) {
      const d = km(best[i - 1], p) * 1.3;
      const taxi = d > 2.2;
      const min = taxi ? d / 25 * 60 + 7 : d / 4.5 * 60;
      if (!taxi) walked += d;
      steps.push({ move: true, km: d, min, taxi });
      clock += min;
    }
    const dur = (VISIT_MIN[p.s] || 35) + ((p.fm || 0) >= 20 ? 25 : 0);
    steps.push({ p, at: clock, dur });
    clock += dur;
    if (!lunched && clock >= 12.5 * 60 && i < best.length - 1) {
      lunched = true;
      const food = POIS.filter(f => f.city === c && f.s === "restaurant" && km(f, p) < 1.2)
        .sort((a, b) => (infoScore(b) - km(b, p) * 2) - (infoScore(a) - km(a, p) * 2))[0];
      steps.push({ lunch: true, p: food, at: clock });
      clock += 60;
    }
  });
  return { steps, stops: best, walked, start, end: clock };
}

function planTimeline(plan) {
  return `<ol class="timeline">${plan.steps.map(s => {
    if (s.move) {
      const d = s.km < 10 ? s.km.toFixed(1) : Math.round(s.km);
      return `<li class="move">${t(s.taxi ? "plan_taxi" : "plan_walk", { km: d, min: Math.max(1, Math.round(s.min)) })}</li>`;
    }
    if (s.lunch) {
      return `<li class="stop lunch" ${s.p ? `data-go="#place/${s.p.id}" role="link" tabindex="0"` : ""}>
        <time>${fmtClock(s.at)}</time><div><b>${icon("food")} ${t("plan_lunch")}${s.p ? " — " + esc(poiName(s.p)) : ""}</b><small>${t("plan_min", { n: 60 })}</small></div></li>`;
    }
    return `<li class="stop" data-go="#place/${s.p.id}" role="link" tabindex="0">
      <time>${fmtClock(s.at)}</time>
      <div><b>${icon(poiIcon(s.p))} ${esc(poiName(s.p))}</b><small>${typeLabel(s.p.s)} · ${t("plan_min", { n: s.dur })} ${openBadge(s.p, { day: tashkentNow().day, min: s.at })}</small></div></li>`;
  }).join("")}</ol>`;
}

function planHtml(plan) {
  const st = plan.stops;
  const ll = p => `${p.la},${p.lo}`;
  const gmaps = `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${ll(st[0])}&destination=${ll(st[st.length - 1])}` +
    (st.length > 2 ? "&waypoints=" + encodeURIComponent(st.slice(1, -1).map(ll).join("|")) : "");
  return `<p class="hint">${t("plan_hint")}</p>
    ${planTimeline(plan)}
    <p class="plan-total">${t("plan_total", { stops: st.length, km: plan.walked.toFixed(1), start: fmtClock(plan.start), end: fmtClock(plan.end) })}</p>
    <div class="plan-acts">
      <a class="btn gold-btn" href="#nav/plan.${st[0].city.id}">${icon("route")} ${t("nav_plan_go")}</a>
      <a class="btn ghost" href="${gmaps}" target="_blank" rel="noopener">${icon("external")} Google Maps</a>
    </div>
    <div id="planMap"></div>`;
}

function drawPlanMap() {
  if (!currentPlan || !$("#planMap")) return;
  const pts = currentPlan.stops.map(p => [p.la, p.lo]);
  planMap = makeMap("planMap", { scrollWheelZoom: false });
  pts.forEach((pt, i) => L.marker(pt, { icon: pin(`<span>${i + 1}</span>`, "num-pin") })
    .bindTooltip(esc(poiName(currentPlan.stops[i]))).addTo(planMap));
  const lunch = currentPlan.steps.find(s => s.lunch && s.p);
  if (lunch) L.marker([lunch.p.la, lunch.p.lo], { icon: pin(icon("food"), "pin pin-f") }).bindTooltip(esc(poiName(lunch.p))).addTo(planMap);
  L.polyline(pts, { color: "#e6b450", weight: 4, dashArray: "6 8", className: "route-line march" }).addTo(planMap);
  planMap.fitBounds(pts, { padding: [30, 30] });
}

// ---------- Поделиться ----------
// Город и место — ссылкой на их публичную страницу (/city/<id>, /place/<id>, server/seo.js):
// она открывается и без приложения, а в мессенджерах показывает название, описание и фото
async function shareCurrent() {
  const title = "Hamyol — " + ($("#modalBody h2")?.textContent.trim() || "");
  const [kind, id] = decodeURIComponent(location.hash.slice(1)).split("/");
  const seo = location.protocol.startsWith("http") && ((kind === "city" && CITY[id]) || (kind === "place" && POI[id]));
  // Страница на языке человека (сервер знает uz, ru, en; остальные — по-русски)
  const url = seo ? `${location.origin}/${kind}/${encodeURIComponent(id)}${["uz", "en"].includes(LANG) ? "?lang=" + LANG : ""}` : location.href;
  try {
    if (navigator.share) return await navigator.share({ title, url });
    await navigator.clipboard.writeText(url);
    toast(t("link_copied"));
  } catch { /* пользователь закрыл окно «Поделиться» */ }
}

// ---------- Путеводитель: разговорник, экстренные номера, советы ----------
function openGuide(pane = "phrases") {
  if (!["phrases", "sos", "tips"].includes(pane)) pane = "phrases";
  const canSpeak = "speechSynthesis" in window;
  // Перевод фразы: для узбекского интерфейса — русский и английский, иначе на языке интерфейса
  const xi = ["tr", "de", "zh", "ko"].indexOf(LANG);
  const tr = (ph, i) => isUz() ? `${ph[2]} · ${ph[3]}` : LANG === "ru" ? ph[2] : LANG === "en" ? ph[3] : (X_PHRASES[i]?.[xi] || ph[3]);
  const tabs = [["phrases", icon("languages") + " " + t("phrasebook")], ["sos", icon("siren") + " " + t("sos")], ["tips", icon("lightbulb") + " " + t("tips")]];
  openModal(`
    <div class="m-head" style="background:${CAT_BG.a};min-height:170px;padding-top:70px"><h2>${icon("book")} ${t("guide")}</h2></div>
    <div class="m-body">
      <div class="m-tabs">${tabs.map(([id, label]) => `<button class="${id === pane ? "active" : ""}" data-pane="${id}">${label}</button>`).join("")}</div>
      <div class="m-pane ${pane === "phrases" ? "active" : ""}" data-pane="phrases">
        ${canSpeak ? `<p class="hint">${t("phrase_hint")}</p>` : ""}
        <div class="phrases">${PHRASES.map((ph, i) => `
          <div class="phrase">
            <div><b>${esc(uzText(ph[0]))}</b>${LANG === "ru" ? `<small>[${esc(ph[1])}]</small>` : ""}<span>${esc(tr(ph, i))}</span></div>
            ${canSpeak ? `<button class="say" data-say="${i}" aria-label="${t("listen")}">${icon("volume")}</button>` : ""}
          </div>`).join("")}</div>
      </div>
      <div class="m-pane ${pane === "sos" ? "active" : ""}" data-pane="sos">
        <div class="sos">${SOS.map(([num, ic, name]) => `<a class="sos-card" href="tel:${num}"><i>${icon(ic)}</i><b>${num}</b><span>${L3(name, X_SOS[SOS.findIndex(s => s[0] === num)])}</span></a>`).join("")}</div>
        <p class="hint">${t("sos_note")}</p>
        ${EXT.routes.sos ? `<a class="btn gold-btn em-open" href="#sos">${icon("locate")} ${t("em_open")}</a>` : ""}
      </div>
      <div class="m-pane ${pane === "tips" ? "active" : ""}" data-pane="tips">
        <div class="tips">${TIPS.map(([ic, title, text], i) => `<div class="tip"><i>${icon(ic)}</i><div><b>${L3(title, X_TIPS[i]?.[0])}</b><p>${L3(text, X_TIPS[i]?.[1])}</p></div></div>`).join("")}</div>
      </div>
    </div>`);
}

// Произношение: узбекский голос, если он есть в системе, иначе русский голос читает транскрипцию
function speak(i) {
  const ph = PHRASES[i];
  if (!ph || !("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  const uz = voices.find(v => v.lang.toLowerCase().startsWith("uz"));
  const ru = voices.find(v => v.lang.toLowerCase().startsWith("ru"));
  const u = new SpeechSynthesisUtterance((uz || !ru ? ph[0] : ph[1]).replace("…", ""));
  u.voice = uz || ru || null;
  u.lang = uz ? uz.lang : ru ? ru.lang : "uz-UZ";
  u.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ---------- Отзывы ----------
// Оценки по пунктам (как в Airbnb): средняя по каждому пункту — полосками над отзывами
const RV_CRIT = ["clean", "value", "service", "location"];
function critSummary(list) {
  const rows = RV_CRIT.map(k => { const v = list.map(r => +r.crit?.[k]).filter(x => x >= 1); return v.length ? [k, v.reduce((a, b) => a + b, 0) / v.length] : null; }).filter(Boolean);
  if (!rows.length) return "";
  return `<div class="rc-sum">${rows.map(([k, v]) => `<div class="rc-line"><span>${t("rc_" + k)}</span><i><b style="width:${(v / 5 * 100).toFixed(0)}%"></b></i><em>${v.toFixed(1)}</em></div>`).join("")}</div>`;
}
async function renderReviews(box, key) {
  box.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div>`;
  let list = [];
  try { list = await Reviews.list(key); } catch { /* показываем пустой список */ }
  if (!box.isConnected) return;
  const r = Reviews.rating(key);
  const uid = "r" + Math.random().toString(36).slice(2, 8);
  box.innerHTML = `
    <div class="rating-sum"><b>${r.count ? r.avg.toFixed(1) : "—"}</b><span class="gold">${starStr(r.avg)}</span>
      <span class="hint">${t("reviews_count", { n: r.count })}</span></div>
    ${critSummary(list)}
    <p class="hint">${Reviews.mode === "server" ? t("reviews_shared") : t("reviews_local")}</p>
    <form class="review-form" data-review-key="${esc(key)}">
      <div class="stars-input">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="st" id="${uid}_${n}" value="${n}"><label for="${uid}_${n}" title="${n}">${icon("star")}</label>`).join("")}</div>
      ${key.startsWith("poi:") ? `<details class="rv-crit-form"><summary>${icon("list")} ${t("rvc_title")}</summary>
        ${RV_CRIT.map(k => `<div class="rc-row"><span>${t("rc_" + k)}</span><div class="rc-pick" role="radiogroup">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="c_${k}" value="${n}"><b>${n}</b></label>`).join("")}</div></div>`).join("")}
      </details>` : ""}
      ${window.SAFAR_USER ? `<p class="hint">${t("review_as", { name: esc(SAFAR_USER.name) })}</p>` : `<input name="name" maxlength="40" placeholder="${t("your_name")}" required>`}
      <textarea name="text" rows="3" maxlength="1000" placeholder="${t("your_review")}" required></textarea>
      ${Reviews.mode === "server" ? `<div class="rv-add">
        <label class="btn ghost small rv-photo-btn">${icon("camera")} ${t("rv_add_photo")}<input type="file" accept="image/*" multiple hidden data-rv-photos></label>
        <div class="rv-thumbs"></div>
      </div>` : ""}
      <button class="btn gold-btn" type="submit">${t("leave_review")}</button>
      <p class="hint legal-accept">${t("legal_accept", { terms: `<a href="#terms">${t("legal_terms_gen")}</a>`, privacy: `<a href="#privacy">${t("legal_privacy_gen")}</a>` })}</p>
    </form>
    ${list.length ? list.map(rv => `
      <div class="review">
        <div class="r-head"><b>${esc(rv.name)}${rv.verified ? ` <span class="verified" title="${t("verified")}">${icon("badge-check")} ${t("rv_checked")}</span>` : ""}</b><span class="gold">${starStr(rv.stars)}</span></div>
        <div class="r-date">${fmtDate(new Date(rv.date))}</div>
        <p>${esc(rv.text)}</p>
        ${rv.photos?.length ? `<div class="rv-photos">${rv.photos.map(p => `<button type="button" class="rv-ph" data-photo="/photos/${esc(p)}" aria-label="${t("rv_photo")}"><img src="/photos/${esc(p)}" loading="lazy" decoding="async" alt=""></button>`).join("")}</div>` : ""}
        ${rv.reply ? `<div class="owner-reply"><b>${t("owner_reply")}</b><p>${esc(rv.reply)}</p></div>` : ""}
      </div>`).join("") : `<p class="hint">${t("first_review")}</p>`}`;
  // У места нет своего фото — ставим в шапку последнее фото из отзывов («Фото путешественника»)
  const ph = list.find(rv => rv.photos?.length)?.photos[0], head = $("#modalBody .pl-head");
  if (ph && head?.querySelector(".big-ico")) {
    head.style.backgroundImage = `url('/photos/${encodeURIComponent(ph)}')`;
    head.querySelector(".big-ico").remove();
    head.insertAdjacentHTML("beforeend", `<span class="credit">${icon("camera")} ${t("rv_traveller_photo")}</span>`);
  }
}

document.addEventListener("submit", async e => {
  const form = e.target.closest("[data-review-key]");
  if (!form) return;
  e.preventDefault();
  const stars = +(form.querySelector("input[name=st]:checked")?.value || 0);
  if (!stars) return toast(t("pick_stars"));
  if (!(await requireConsent())) return;
  const key = form.dataset.reviewKey;
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const crit = Object.fromEntries(RV_CRIT.map(k => [k, +(form.querySelector(`input[name=c_${k}]:checked`)?.value || 0)]).filter(([, v]) => v));
    await Reviews.add(key, { name: window.SAFAR_USER ? SAFAR_USER.name : form.name.value.trim(), text: form.text.value.trim(), stars,
      ...(Object.keys(crit).length ? { crit } : {}),
      ...(form._photos?.length ? { photos: form._photos } : {}) });
  } catch {
    btn.disabled = false;
    return toast(t("review_error"));
  }
  renderReviews(form.parentElement, key);
  $$(`[data-badge="${CSS.escape(key)}"]`).forEach(el => el.innerHTML = ratingBadge(key));
  rendered.cities = rendered.hotels = rendered.places = false;
});

// ---------- Фото к отзыву ----------
// Уменьшаем до 1280 px и пересохраняем: файл лёгкий, а скрытые данные снимка (в том числе GPS) не уходят на сервер
async function shrinkPhoto(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  let url = c.toDataURL("image/webp", .82);
  if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", .82);   // Safari без WebP-кодировщика
  if (url.length > 1_150_000) url = c.toDataURL("image/jpeg", .7);
  return url;
}
function renderThumbs(form) {
  form.querySelector(".rv-thumbs").innerHTML = (form._photos || []).map((p, i) =>
    `<span class="rv-thumb"><img src="${p}" alt=""><button type="button" data-rv-drop="${i}" aria-label="remove">${icon("x")}</button></span>`).join("");
  const full = (form._photos || []).length >= 3;
  form.querySelector(".rv-photo-btn").classList.toggle("hidden", full);
}
document.addEventListener("change", async e => {
  const input = e.target.closest("[data-rv-photos]");
  if (!input) return;
  const form = input.closest("form");
  form._photos ||= [];
  const files = [...input.files].slice(0, 3 - form._photos.length);
  if (input.files.length > files.length) toast(t("rv_photo_limit"));
  for (const f of files) {
    try { form._photos.push(await shrinkPhoto(f)); } catch { toast(t("rv_photo_err")); }
  }
  input.value = "";
  renderThumbs(form);
});
document.addEventListener("click", e => {
  const drop = e.target.closest("[data-rv-drop]");
  if (drop) { const form = drop.closest("form"); form._photos.splice(+drop.dataset.rvDrop, 1); return renderThumbs(form); }
  // Просмотр фото на весь экран
  const ph = e.target.closest(".rv-ph[data-photo]");   // только фото из отзывов (у баннера на главной свой data-hero-img)
  if (ph) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<img src="${ph.dataset.photo}" alt=""><button type="button" class="close" aria-label="Close">${icon("x")}</button>`;
    const close = () => { box.classList.add("out"); setTimeout(() => box.remove(), 250); document.removeEventListener("keydown", esc); };
    const esc = ev => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } };
    box.onclick = close;
    document.addEventListener("keydown", esc, true);
    document.body.appendChild(box);
  }
});

// ---------- Карты ----------
const isDark = () => document.documentElement.dataset.theme === "dark" ||
  (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
function makeMap(el, opts = {}) {
  const map = L.map(el, { zoomControl: true, ...opts });
  // Тёмная тема карты — CSS-фильтр на слое тайлов (см. style.css)
  L.tileLayer(MAP_TILES.url, { maxZoom: MAP_TILES.maxZoom, attribution: MAP_TILES.attribution }).addTo(map);
  return map;
}
const pin = (html, cls = "pin", size = 28) => L.divIcon({ className: cls, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
// Метка «вот это место» / «куда»: капля своим рисунком — без картинок со стороннего сайта, работает и без интернета
const destPin = ic => L.divIcon({ className: "dest-pin", html: `<span>${icon(ic)}</span>`, iconSize: [36, 44], iconAnchor: [18, 44], tooltipAnchor: [0, -40], popupAnchor: [0, -40] });
// Иконки видов транспорта
const TR_ICON = { train: "train", afrosiyob: "train-fast", bus: "bus", shared_taxi: "taxi", car: "car", plane: "plane" };
function clusterGroup(cat) {
  return L.markerClusterGroup({
    chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50, disableClusteringAtZoom: 17,   // вблизи — каждое место со своей ценой
    iconCreateFunction: cl => L.divIcon({
      html: `<div class="cl-bubble cl-${cat}">${cl.getChildCount()}</div>`,
      className: "cl-icon", iconSize: [40, 40]
    })
  });
}
function poiMarker(p) {
  const priced = typeof poiPrice === "function";
  return L.marker([p.la, p.lo], { icon: pin(icon(poiIcon(p)) + (priced ? poiPricePin(p) : ""), "pin pin-" + p.c) })
    .bindPopup(() => `<b>${esc(poiName(p))}</b><br><small>${typeLabel(p.s)} · ${esc(cityName(p.city))}</small>
      ${priced ? priceLine(poiPrice(p)) : p.c === "h" ? `<br><small>${hotelPrice(p)}</small>` : ""}
      <br><a class="btn small" style="margin-top:6px;color:var(--accent-text)" href="#place/${p.id}">${t("details")}</a>`);
}

let bigMap = null, layers = {}, meMarker = null, flyHighlight = null;
function initBigMap() {
  if (bigMap) { setTimeout(() => bigMap.invalidateSize(), 60); return; }
  bigMap = makeMap("bigMap", { preferCanvas: true }).setView([41.3, 64.5], 6);
  // Цены под значками (js/map-prices.js) — только при приближении, иначе сливаются
  const farCls = () => $("#bigMap").classList.toggle("map-far", bigMap.getZoom() < 14);
  bigMap.on("zoomend", farCls); farCls();
  if (typeof declutterMapPrices === "function") { let dt; bigMap.on("moveend layeradd", () => { clearTimeout(dt); dt = setTimeout(() => declutterMapPrices($("#bigMap")), 250); }); }
  const canvas = L.canvas({ padding: .5 });
  layers.c = L.layerGroup(CITIES.map(c => L.circleMarker([c.lat, c.lon], {
    renderer: canvas, radius: c.t === "city" ? 5 + Math.sqrt(c.pop || 1) / 90 : 4,
    color: "#0b1f3a", weight: 1.5, fillColor: c.t === "city" ? "#e6b450" : "#1fa7bd", fillOpacity: .9
  }).bindTooltip(() => cityName(c)).bindPopup(() => `<b>${esc(cityName(c))}</b><br><small>${regionName(c.r)}</small>
      <br><a class="btn small" style="margin-top:6px;color:var(--accent-text)" href="#city/${c.id}">${t("details")}</a>`)));
  for (const cat of ["h", "a", "s", "f"]) {
    layers[cat] = clusterGroup(cat);
    layers[cat].addLayers(POIS.filter(p => p.c === cat).map(poiMarker));
  }
  const on = store.get("safar_layers", { c: true, h: true, a: true, s: true, f: false });
  for (const k in layers) if (on[k]) layers[k].addTo(bigMap);

  $("#mapLayers").innerHTML = [["c", "city", "cat_c"], ["h", "hotel", "cat_h"], ["a", "dome", "cat_a"], ["s", "shopping", "cat_s"], ["f", "food", "cat_f"]]
    .map(([k, i, l]) => `<label class="layer layer-${k}"><input type="checkbox" data-layer="${k}" ${on[k] ? "checked" : ""}>${icon(i)} <span data-i18n="${l}">${t(l)}</span></label>`).join("") +
    `<button class="btn ghost" id="locateBtn">${icon("locate")} <span data-i18n="locate">${t("locate")}</span></button>`;
  $("#mapLayers").addEventListener("change", e => {
    const k = e.target.dataset.layer;
    if (!k) return;
    e.target.checked ? layers[k].addTo(bigMap) : layers[k].remove();
    on[k] = e.target.checked;
    store.set("safar_layers", on);
  });
  $("#locateBtn").onclick = async () => {
    try {
      const p = await locate();
      meMarker?.remove();
      meMarker = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", html: '<div class="me-pin"></div>', iconSize: [18, 18] }) })
        .addTo(bigMap).bindPopup(t("you_here"));
      bigMap.flyTo([p.lat, p.lon], 14);
    } catch { toast(t("geo_denied")); }
  };
  EXT.mapLayers.forEach(fn => fn(bigMap, on));
  setTimeout(() => bigMap.invalidateSize(), 60);
}

function flyTo(lat, lon, zoom = 17) {
  navGo("#map");
  closeModal(false);
  showTab("map");
  setTimeout(() => {
    bigMap.invalidateSize();
    bigMap.flyTo([lat, lon], zoom, { duration: 1.2 });
    flyHighlight?.remove();
    flyHighlight = L.circleMarker([lat, lon], { radius: 22, color: "#e6b450", weight: 3, fillOpacity: .15 }).addTo(bigMap);
  }, 120);
}

// ---------- Бюджет ----------
let TARIFFS = mergeTariffs(store.get("safar_tariffs", null));
function mergeTariffs(saved) {
  const base = JSON.parse(JSON.stringify(DEFAULT_TARIFFS));
  if (!saved) return base;
  for (const k of Object.keys(base)) {
    if (typeof base[k] === "object") Object.assign(base[k], saved[k] || {});
    else if (saved[k] != null) base[k] = saved[k];
  }
  return base;
}
const defaultRoute = [];   // новая поездка пустая — с чего начать, подсказывает js/triplayout.js
let tripRoute = store.get("safar_route", defaultRoute).filter(r => CITY[r.id]);
let routeInfo = { legs: [], line: null, real: false };
let routeMap = null, routeLayer = null;

function initRouteMap() {
  if (routeMap) { setTimeout(() => routeMap.invalidateSize(), 60); return; }
  routeMap = makeMap("routeMap", { scrollWheelZoom: false }).setView([41, 64.5], 5);
  routeLayer = L.layerGroup().addTo(routeMap);
  setTimeout(() => { routeMap.invalidateSize(); drawRoute(); }, 60);
}

function drawRoute() {
  if (!routeMap) return;
  routeLayer.clearLayers();
  const pts = tripRoute.map(r => [CITY[r.id].lat, CITY[r.id].lon]);
  pts.forEach((p, i) => L.marker(p, { icon: pin(`<span>${i + 1}</span>`, "num-pin") }).bindTooltip(cityName(CITY[tripRoute[i].id])).addTo(routeLayer));
  if (pts.length > 1) {
    const line = routeInfo.real && routeInfo.line ? routeInfo.line : pts;
    const pl = L.polyline(line, { color: "#e6b450", weight: 4, dashArray: routeInfo.real ? null : "8 6", className: "route-line " + (routeInfo.real ? "draw" : "march") }).addTo(routeLayer);
    if (routeInfo.real) pl.getElement()?.setAttribute("pathLength", "1");
    routeMap.fitBounds(pts, { padding: [30, 30] });
  } else if (pts.length) routeMap.setView(pts[0], 9);
}

// Расстояния: сразу прямая×1.25, затем реальные дороги через OSRM
const estimateLegs = () => tripRoute.slice(1).map((r, i) => {
  const d = km(CITY[tripRoute[i].id], CITY[r.id]);
  return { km: d * 1.25, min: d * 1.25 / 70 * 60 };
});
let routeReq = 0;
async function updateRoute() {
  store.set("safar_route", tripRoute);
  dataChanged("trip");
  routeInfo = { legs: estimateLegs(), line: null, real: false };
  renderBudget();
  if (tripRoute.length < 2) return;
  const req = ++routeReq;
  try {
    const r = await API.route(tripRoute.map(x => CITY[x.id]));
    if (req !== routeReq) return;
    routeInfo = { ...r, real: true };
    renderBudget();
  } catch { /* остаётся оценка */ }
}

function fmtTime(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return (h ? `${h} ${t("hours_short")} ` : "") + `${m} ${t("min_short")}`;
}

function renderRouteList() {
  const mode = $("#bTransport").value;
  $("#routeList").innerHTML = tripRoute.map((r, i) => {
    const c = CITY[r.id];
    let leg = "";
    if (i > 0 && routeInfo.legs[i - 1]) {
      const L1 = routeInfo.legs[i - 1];
      const d = mode === "plane" ? km(CITY[tripRoute[i - 1].id], c) : L1.km;
      leg = `<div class="leg">${icon(TR_ICON[mode] || "route")} ${t("leg", { from: esc(cityName(CITY[tripRoute[i - 1].id])), km: fmtNum(d), time: mode === "plane" ? t("tr_plane") : fmtTime(L1.min) })}${routeInfo.real ? "" : " (" + t("approx") + ")"}</div>`;
    }
    return `<li class="stop">
        <span class="st-n">${i + 1}</span>
        <div class="st-main"><b>${icon(c.ico)} ${esc(cityName(c))}</b>${leg}</div>
        <div class="st-nights">
          <button class="st-btn" data-step="${i},-1" ${r.nights <= 0 ? "disabled" : ""} aria-label="−">${icon("minus")}</button>
          <input type="number" min="0" inputmode="numeric" value="${r.nights}" data-nights="${i}" aria-label="${t("nights")}">
          <button class="st-btn" data-step="${i},1" aria-label="+">${icon("plus")}</button>
          <span>${t("nights")}</span>
        </div>
        <div class="st-acts">
          <button class="mv" data-move="${i},-1" ${i === 0 ? "disabled" : ""} aria-label="up">${icon("chevron-up")}</button>
          <button class="mv" data-move="${i},1" ${i === tripRoute.length - 1 ? "disabled" : ""} aria-label="down">${icon("chevron-down")}</button>
          <button class="rm" data-remove="${i}" aria-label="remove">${icon("x")}</button>
        </div>
      </li>`;
  }).join("") || `<p class="hint">${t("route_empty")}</p>`;
}

function calcBudget() {
  const people = Math.max(1, +$("#bPeople").value || 1);
  const rooms = Math.max(1, +$("#bRooms").value || 1);
  const mode = $("#bTransport").value;
  const nights = tripRoute.reduce((a, r) => a + (+r.nights || 0), 0);
  const days = tripRoute.length ? nights + 1 : 0;
  let distance = 0;
  tripRoute.forEach((r, i) => {
    if (!i) return;
    distance += mode === "plane" ? km(CITY[tripRoute[i - 1].id], CITY[r.id]) : (routeInfo.legs[i - 1]?.km || 0);
  });
  const perKm = TARIFFS.transportPerKm[mode];
  const transport = mode === "car" ? distance * perKm * Math.ceil(people / 4) : distance * perKm * people;
  return {
    nights, days, distance, people,
    items: [
      ["b_hotel", nights * rooms * TARIFFS.hotelPerNight[$("#bHotel").value], "#1fa7bd"],
      ["b_transport", transport, "#4a7bd0"],
      ["b_food", days * people * TARIFFS.foodPerDay[$("#bFood").value], "#e6b450"],
      ["b_local", days * people * TARIFFS.localPerDay, "#7b5ea7"],
      ["b_sights", days * people * TARIFFS.sightsPerDay, "#2e9e6a"],
      ["b_shopping", people * usd(+$("#bShopping").value || 0), "#c8553d"]
    ]
  };
}

let lastBudget = null;
function renderBudget() {
  if (!rendered.budget) return;
  renderRouteList();
  drawRoute();
  const b = calcBudget();
  const total = b.items.reduce((a, i) => a + i[1], 0);
  lastBudget = { ...b, total };
  const alt = currency === "UZS" ? "USD" : "UZS";
  // Итог: крупная сумма → «на человека» и «в день» плитками → дни/ночи/км → из чего складывается
  const pct = v => total ? Math.round(v / total * 100) : 0;
  const ICO = { b_hotel: "bed", b_transport: "train", b_food: "food", b_local: "taxi", b_sights: "ticket", b_shopping: "shopping" };
  $("#budgetTotal").innerHTML = `
    <div class="bt-main"><small>${t("bt_for", { n: b.people })}</small><b class="bt-sum">${money(total)}</b><span>${money(total, alt)}</span></div>
    <div class="bt-tiles">
      <div><b>${money(total / b.people)}</b><span>${t("per_person")}</span></div>
      <div><b>${b.days ? money(total / b.days) : "—"}</b><span>${t("per_day")}</span></div>
    </div>
    <div class="bt-chips"><span>${icon("calendar")} ${t("summary", { days: b.days, nights: b.nights, km: fmtNum(b.distance) })}</span></div>`;
  replay($("#budgetTotal .bt-sum"), "bump", 500);
  $("#budgetBar").innerHTML = total ? b.items.map(i => `<span style="width:${i[1] / total * 100}%;background:${i[2]}" title="${t(i[0])}"></span>`).join("") : "";
  $("#budgetBreakdown").innerHTML = b.items.map(i => `
    <li><span class="bk-ic" style="--c:${i[2]}">${icon(ICO[i[0]] || "wallet")}</span>
      <span class="bk-name">${t(i[0])}<small>${pct(i[1])}%</small></span><b>${money(i[1])}</b></li>`).join("");
  EXT.onBudget.forEach(fn => fn());
}

function tariffFields() {
  const food = { budget: "food_budget", mid: "food_mid", premium: "food_premium" };
  return [
    ...Object.keys(DEFAULT_TARIFFS.transportPerKm).map(k => [`transportPerKm.${k}`, t("rate_km", { label: t("tr_" + k) })]),
    ...Object.keys(DEFAULT_TARIFFS.hotelPerNight).map(k => [`hotelPerNight.${k}`, t("rate_hotel", { n: k })]),
    ...Object.keys(food).map(k => [`foodPerDay.${k}`, t("rate_food", { level: t(food[k]) })]),
    ["localPerDay", t("rate_local")], ["sightsPerDay", t("rate_sights")]
  ];
}
const getPath = (o, p) => p.split(".").reduce((a, k) => a[k], o);
function setPath(o, p, v) { const ks = p.split("."); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
function renderTariffEditor() {
  $("#tariffEditor").innerHTML = tariffFields().map(([p, label]) =>
    `<label>${label}<input type="number" min="0" step="any" data-tariff="${p}" value="${getPath(TARIFFS, p)}"></label>`).join("");
}

function addToRoute(id, nights = 2) {
  tripRoute.push({ id, nights });
  updateRoute();
}

// Кнопка «В поездку» на странице города — переключатель: «＋ В поездку» ↔ «✓ В поездке» (повторное нажатие убирает город)
const inTrip = id => tripRoute.some(r => r.id === id);
const tripBtn = id => `<button class="pl-act main ${inTrip(id) ? "in" : ""}" data-add-route="${id}" aria-pressed="${inTrip(id)}"><i>${icon(inTrip(id) ? "check" : "plus")}</i><span>${t(inTrip(id) ? "pl_in_trip" : "pl_to_trip")}</span></button>`;
function toggleRoute(id) {
  const was = inTrip(id);
  if (was) { tripRoute = tripRoute.filter(r => r.id !== id); updateRoute(); }
  else addToRoute(id);
  $$(`[data-add-route="${CSS.escape(id)}"]`).forEach(b => { b.outerHTML = tripBtn(id); });
  const b = $(`[data-add-route="${CSS.escape(id)}"]`);
  if (b) replay(b, "bump", 500);
  toast(t(was ? "removed_route" : "added_route"));
}

function copyBudget() {
  if (!lastBudget) return;
  const lines = [
    `HAMYOL — ${t("total")}: ${money(lastBudget.total)} (${money(lastBudget.total, currency === "UZS" ? "USD" : "UZS")})`,
    t("summary", { days: lastBudget.days, nights: lastBudget.nights, km: fmtNum(lastBudget.distance) }),
    tripRoute.map(r => `${cityName(CITY[r.id])} (${r.nights} ${t("nights")})`).join(" → "),
    ...lastBudget.items.map(i => `${t(i[0])}: ${money(i[1])}`)
  ];
  navigator.clipboard?.writeText(lines.join("\n")).then(() => toast(t("copied")), () => {});
}

// ---------- Язык, валюта, тема ----------
const RENDER = { home: renderHome, cities: renderCities, hotels: renderHotels, places: renderPlaces, budget: () => {} };

function rerenderAll() {
  applyI18n();
  fillSelects();
  renderTariffEditor();
  renderBackButtons();
  for (const k in rendered) rendered[k] = false;
  rendered[currentTab] = true;
  RENDER[currentTab]?.();
  rendered.budget = currentTab === "budget";
  if (currentTab === "budget") renderBudget();
  EXT.onLang.forEach(fn => fn());
  if (!$("#modal").classList.contains("hidden")) route();
}

function setTheme(th) {
  document.documentElement.dataset.theme = th;
  try { localStorage.setItem("safar_theme", th); } catch { /* приватный режим */ }
  $("#themeBtn").innerHTML = icon(th === "dark" ? "sun" : "moon");
  document.querySelector("meta[name=theme-color]").content = th === "dark" ? "#0a1424" : "#0b1f3a";
  document.dispatchEvent(new CustomEvent("safar:theme", { detail: th }));   // для того, что рисуется не через CSS (кнопка Google, окно Telegram)
}

// ---------- Установка на Android: APK-файл (с разрешением пользователя) или через Chrome ----------
const IS_ANDROID = /android/i.test(navigator.userAgent);
function openAndroidInstall(installEvt, used) {
  const apk = typeof SAFAR_CONFIG !== "undefined" && SAFAR_CONFIG.apk;
  const mb = apk ? (apk.size / 1048576).toFixed(1).replace(".", LANG === "en" || LANG === "zh" || LANG === "ko" ? "." : ",") : "";
  const step = (n, text) => `<li><b>${n}</b><span>${text}</span></li>`;
  openModal(`
    <div class="m-head" style="background:${CAT_BG.h};min-height:170px;padding-top:70px"><h2>${icon("android")} ${t("and_title")}</h2></div>
    <div class="m-body">
      <div class="and-options">
        ${apk ? `<a class="and-opt main" href="/download/safar.apk" download="Hamyol.apk" data-apk>
          <i>${icon("file-down")}</i><b>${t("and_apk")}</b><span>${t("and_apk_sub", { size: mb })}</span></a>` : ""}
        ${installEvt ? `<button class="and-opt" data-quick>
          <i>${icon("zap")}</i><b>${t("and_quick")}</b><span>${t("and_quick_sub")}</span></button>` : ""}
      </div>
      ${apk ? `<ol class="ios-steps">${step(1, t("and_step1"))}${step(2, t("and_step2"))}${step(3, t("and_step3"))}</ol>
        <p class="hint and-note">${icon("shield")} ${t("and_note")}</p>` : ""}
      ${!apk && !installEvt ? `<p class="ios-warn">${icon("info")} ${t("and_menu")}</p>` : ""}
    </div>`);
  $("#modalBody [data-quick]")?.addEventListener("click", async () => {
    installEvt.prompt();
    used();
    closeModal();
  });
}

// ---------- Установка на iPhone ----------
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_STANDALONE = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
// Установить можно только из Safari: Chrome, Firefox, Edge и встроенные браузеры (Telegram, Instagram) на iOS этого не умеют
const IOS_NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Telegram|Instagram|FBAN|FBAV/i.test(navigator.userAgent) || !!window.Telegram?.WebApp?.initData;
function openIosInstall() {
  const step = (n, text) => `<li><b>${n}</b><span>${text}</span></li>`;
  openModal(`
    <div class="m-head" style="background:${CAT_BG.h};min-height:170px;padding-top:70px"><h2>${icon("download")} ${t("ios_title")}</h2></div>
    <div class="m-body">
      ${IOS_NOT_SAFARI ? `<p class="ios-warn">${icon("alert")} ${t("ios_safari")}</p>` : ""}
      <ol class="ios-steps">
        ${step(1, t("ios_step1", { icon: icon("ios-share") }))}
        ${step(2, t("ios_step2", { icon: icon("square-plus") }))}
        ${step(3, t("ios_step3"))}
      </ol>
    </div>`);
  if (!IOS_NOT_SAFARI) {
    const pad = /ipad/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    document.body.insertAdjacentHTML("beforeend", `<div class="ios-pointer${pad ? " pad" : ""}"><span>${t("ios_here")}</span>${icon(pad ? "arrow-up" : "arrow-down")}</div>`);
  }
}
function showIosBanner() {
  if (document.querySelector(".ios-banner") || !$("#modal").classList.contains("hidden")) return;
  store.set("safar_ios_hint", true);
  const b = document.createElement("div");
  b.className = "ios-banner";
  b.innerHTML = `<span class="ios-banner-ico">${icon("girih")}</span><p>${t("ios_banner")}</p>
    <button class="btn gold-btn small" data-how>${t("ios_how")}</button><button class="ios-x" aria-label="close">${icon("x")}</button>`;
  document.body.appendChild(b);
  const close = () => { b.classList.add("out"); setTimeout(() => b.remove(), 400); };
  b.querySelector("[data-how]").onclick = () => { close(); openIosInstall(); };
  b.querySelector(".ios-x").onclick = close;
}

// Смена темы «заливкой»: новая тема разливается кругом от кнопки по всему экрану.
// Без View Transitions API (или при «Уменьшить движение») — плавный переход цветов.
function switchTheme(th, from) {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) {
    root.classList.add("theme-fade");
    setTheme(th);
    setTimeout(() => root.classList.remove("theme-fade"), 600);
    return;
  }
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("theme-vt");
  const vt = document.startViewTransition(() => setTheme(th));
  vt.ready.then(() => root.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: 700, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" }
  )).catch(() => {});
  vt.finished.finally(() => root.classList.remove("theme-vt"));
}

// ---------- Запуск ----------
async function init() {
  document.getElementById("seo")?.remove();   // текст для поисковиков не нужен, когда работает приложение
  applyI18n();

  $("#themeBtn").innerHTML = icon(isDark() ? "sun" : "moon");
  $("#favCount").textContent = FAVS.size || "";
  fillSelects();
  // Язык и валюта — свои выпадающие списки (js/picker.js)
  enhanceSelect($("#langSelect"), o => `<span class="pk-code">${LANG_CODE[o.value]}</span><span class="pk-name">${LANGS[o.value]}</span>`);
  enhanceSelect($("#currency"), (o, inBtn) => `<span class="pk-code">${SYMBOL[o.value].trim()}</span><span class="pk-name">${o.value}</span>`);
  renderTariffEditor();

  // Живые данные: отзывы и курсы
  Reviews.init().then(() => { for (const k of ["cities", "hotels", "places"]) rendered[k] = false; RENDER[currentTab]?.(); rendered[currentTab] = true; });
  API.rates().then(r => {
    RATES = r;
    if (rendered.home) renderRates();
    if (rendered.hotels) renderHotels();
    if (rendered.budget) renderBudget();
  });

  // Навигация
  window.addEventListener("hashchange", route);
  $("#langSelect").addEventListener("change", e => {
    LANG = e.target.value;
    try { localStorage.setItem("safar_lang", LANG); } catch { /* приватный режим */ }
    rerenderAll();
  });
  $("#currency").addEventListener("change", e => {
    currency = e.target.value;
    store.set("safar_currency", currency);
    rerenderAll();
  });
  $("#themeBtn").onclick = e => switchTheme(isDark() ? "light" : "dark", e.currentTarget);
  // Крупный текст: всё содержимое крупнее, подписи контрастнее (css: html.big)
  const bigBtn = $("#bigBtn"), root = document.documentElement;
  bigBtn.setAttribute("aria-pressed", root.classList.contains("big"));
  bigBtn.onclick = () => {
    const on = root.classList.toggle("big");
    try { localStorage.setItem("safar_big", on ? "1" : "0"); } catch { /* приватный режим */ }
    bigBtn.setAttribute("aria-pressed", on);
    replay(bigBtn, "bump", 600);
    toast(t(on ? "big_on" : "big_off"));
    setTimeout(() => [bigMap, miniMap, planMap, routeMap].forEach(m => m?.invalidateSize()), 80);
  };
  $("#favBtn").onclick = () => { location.hash = "#favs"; };

  // Главная
  $("#globalSearch").addEventListener("input", debounce(globalSearch, 120));
  $("#searchResults").addEventListener("click", e => {
    const result = e.target.closest("[data-go]");
    if (!result) return;
    e.preventDefault();
    hideAnimated($("#searchResults"));
    location.hash = result.dataset.go;
  });
  $("#globalSearch").addEventListener("keydown", e => {
    if (e.key === "Enter") $("#searchResults [data-go]")?.click();
    if (e.key === "Escape") hideAnimated($("#searchResults"));
  });
  document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) hideAnimated($("#searchResults")); });
  ["#convAmount", "#convFrom"].forEach(s => $(s).addEventListener("input", renderConverter));

  // Фильтры
  ["#citySearch", "#regionFilter", "#cityType", "#citySort"].forEach(s => $(s).addEventListener("input", debounce(renderCities, 150)));
  ["#hotelSearch", "#hotelCity", "#hotelType", "#hotelStars", "#hotelSort"].forEach(s => $(s).addEventListener("input", debounce(renderHotels, 150)));
  $("#foodFlags").addEventListener("click", e => { const b = e.target.closest("[data-flag]"); if (b) { b.classList.toggle("on"); renderPlaces(); } });
  ["#placeSearch", "#placeCity", "#placeType", "#placeSort", "#placeOpen", "#placeCuisine"].forEach(s => $(s).addEventListener("input", debounce(renderPlaces, 150)));
  $("#placeCat").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) setPlaceCat(b.dataset.cat); });
  // «Рядом со мной» — переключатель: включить — сортировка по расстоянию, нажать ещё раз — прежняя сортировка
  $$(".near-btn").forEach(b => b.addEventListener("click", async () => {
    const sel = $("#" + b.dataset.near);
    if (b.classList.contains("on")) {
      sel.value = b.dataset.prev && b.dataset.prev !== "dist" ? b.dataset.prev : sel.options[0].value;
      b.classList.remove("on");
      b.setAttribute("aria-pressed", "false");
      return sel.dispatchEvent(new Event("input"));
    }
    try {
      await locate();
      b.dataset.prev = sel.value;
      sel.value = "dist";
      b.classList.add("on");
      b.setAttribute("aria-pressed", "true");
      sel.dispatchEvent(new Event("input"));
    } catch (e) { if (e?.message !== "no consent") toast(t("geo_denied")); }
  }));
  // Сортировку сменили вручную — кнопка «Рядом» гаснет, если уже не «по расстоянию»
  $$(".near-btn").forEach(b => $("#" + b.dataset.near)?.addEventListener("input", e => {
    if (e.isTrusted && e.target.value !== "dist") { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }
  }));

  // Бюджет
  ["#bPeople", "#bRooms", "#bHotel", "#bFood", "#bTransport", "#bShopping"].forEach(s => $(s).addEventListener("input", renderBudget));
  $("#routeAddBtn").onclick = () => {
    const v = $("#routeCity").value.trim();
    if (!v) return;
    const lv = v.toLowerCase();
    const c = CITIES.find(c => cityLabel(c) === v) || CITIES.find(c => c.hay.split(" ").includes(lv)) || CITIES.find(c => c.hay.includes(lv));
    if (!c) return toast(t("nothing"));
    addToRoute(c.id, Math.max(0, +$("#routeNights").value || 0));
    $("#routeCity").value = "";
  };
  $("#routeCity").addEventListener("keydown", e => { if (e.key === "Enter") $("#routeAddBtn").click(); });
  $("#routeList").addEventListener("input", debounce(e => {
    const i = e.target.dataset.nights;
    if (i == null) return;
    tripRoute[i].nights = Math.max(0, +e.target.value || 0);
    store.set("safar_route", tripRoute);
    dataChanged("trip");
    renderBudget();
  }, 250));
  $("#routeList").addEventListener("click", e => {
    // Счётчик ночей: меняем поле и отдаём событие input — дальше как при ручном вводе
    const st = e.target.closest("[data-step]");
    if (st) {
      const [i, d] = st.dataset.step.split(",").map(Number);
      const inp = $(`[data-nights="${i}"]`, $("#routeList"));
      inp.value = Math.max(0, (+inp.value || 0) + d);
      st.parentElement.querySelector('[data-step$=",-1"]').disabled = +inp.value <= 0;
      replay(inp, "bump", 450);
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const rm = e.target.closest("[data-remove]"), mv = e.target.closest("[data-move]");
    if (rm) { tripRoute.splice(+rm.dataset.remove, 1); updateRoute(); }
    if (mv) {
      const [i, d] = mv.dataset.move.split(",").map(Number);
      [tripRoute[i], tripRoute[i + d]] = [tripRoute[i + d], tripRoute[i]];
      updateRoute();
    }
  });
  $("#tariffEditor").addEventListener("input", e => {
    const p = e.target.dataset.tariff;
    if (!p) return;
    setPath(TARIFFS, p, Math.max(0, +e.target.value || 0));
    store.set("safar_tariffs", TARIFFS);
    renderBudget();
  });
  $("#resetTariffs").onclick = () => { TARIFFS = mergeTariffs(null); store.set("safar_tariffs", null); renderTariffEditor(); renderBudget(); };
  $("#copyBudget").onclick = copyBudget;

  // Учёт переходов к партнёрам (без личных данных)
  document.addEventListener("click", e => {
    const tr = e.target.closest("[data-track]");
    if (tr && location.protocol.startsWith("http")) navigator.sendBeacon?.("/api/track", JSON.stringify({ kind: tr.dataset.track, key: tr.dataset.key }));
  }, true);

  // Общие клики: переходы, избранное, карта, маршрут, вкладки модалки, регионы
  document.addEventListener("click", e => {
    const fav = e.target.closest("[data-fav]");
    if (fav) { e.preventDefault(); e.stopPropagation(); return toggleFav(fav.dataset.fav); }
    const fly = e.target.closest("[data-fly]");
    if (fly) { e.stopPropagation(); const [la, lo, z] = fly.dataset.fly.split(",").map(Number); return flyTo(la, lo, z || 17); }
    if (e.target.closest("[data-share]")) return shareCurrent();
    const say = e.target.closest("[data-say]");
    if (say) return speak(+say.dataset.say);
    const add = e.target.closest("[data-add-route]");
    if (add) return toggleRoute(add.dataset.addRoute);
    const pane = e.target.closest(".m-tabs [data-pane]");
    if (pane) {
      const box = pane.closest(".m-body");
      $$(".m-tabs button", box).forEach(b => b.classList.toggle("active", b === pane));
      $$(".m-pane", box).forEach(p => p.classList.toggle("active", p.dataset.pane === pane.dataset.pane));
      if (pane.dataset.pane === "overview" && miniMap) setTimeout(() => miniMap.invalidateSize(), 30);
      if (pane.dataset.pane === "plan" && currentPlan && !planMap) setTimeout(drawPlanMap, 30);
      const ext = EXT.cityTabs.find(x => x.id === pane.dataset.pane);
      const extEl = ext && $(`.m-pane[data-pane="${ext.id}"]`, box);
      if (extEl && !extEl.dataset.done) { extEl.dataset.done = "1"; ext.render(currentCity, extEl); }
      return;
    }
    const region = e.target.closest("[data-region]");
    if (region) { $("#regionFilter").value = region.dataset.region; rendered.cities = false; }
    const catLink = e.target.closest("[data-cat-link]");
    if (catLink?.dataset.catLink) { setPlaceCat(catLink.dataset.catLink); rendered.places = true; }
    if (e.target.closest("a, button, input, select, textarea, label")) return;
    const go = e.target.closest("[data-go]");
    if (go) { $("#searchResults").classList.add("hidden"); location.hash = go.dataset.go; }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) closeModal();
    if (e.key === "Enter" && e.target.matches("[data-go]")) location.hash = e.target.dataset.go;
  });
  $("#modalClose").onclick = () => closeModal();
  document.addEventListener("click", e => { if (e.target.closest("[data-back]")) goBack(); });
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

  // Установка как приложение (PWA)
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("#installBtn").classList.remove("hidden"); });
  $("#installBtn").onclick = () => {
    if (IS_IOS) return openIosInstall();
    if (IS_ANDROID) return openAndroidInstall(installEvt, () => { installEvt = null; });
    if (installEvt) { installEvt.prompt(); $("#installBtn").classList.add("hidden"); }
  };
  // Android: кнопка видна всегда (скачать APK можно и без системного запроса)
  if (IS_ANDROID && !IS_STANDALONE) $("#installBtn").classList.remove("hidden");
  // iPhone и iPad: системного запроса нет — показываем кнопку с инструкцией и один раз подсказку внизу
  if (IS_IOS && !IS_STANDALONE) {
    $("#installBtn").classList.remove("hidden");
    if (!store.get("safar_ios_hint", false)) setTimeout(showIosBanner, 5000);
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

  // Первичный расчёт маршрута (оценка), реальные дороги — при открытии бюджета
  routeInfo = { legs: estimateLegs(), line: null, real: false };
  const origShow = RENDER.budget;
  RENDER.budget = () => { origShow(); updateRoute(); RENDER.budget = origShow; };

  // Данные готовы — заставка открывает приложение через арку
  EXT.onInit.forEach(fn => fn());
  if (window.Splash) Splash.ready(route);
  else { $("#app").classList.remove("hidden"); route(); }
}

document.addEventListener("DOMContentLoaded", init);
