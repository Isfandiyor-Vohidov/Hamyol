/* ===================== Safar · Мекка и Медина — ядро =====================
   Отдельное приложение на странице /mecca. Узбекское приложение (index.html + js/app.js) оно не загружает и не меняет.
   Здесь — те же базовые функции, что и в узбекском ядре ($, store, openModal, toast, askConfirm, locate…),
   чтобы общие готовые блоки (переводчик, SOS, документы, медкарточка, «Я потерялся») работали и здесь без правок. */
window.SAFAR_APP = "mecca";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } }
};
const EXT = { routes: {}, homeTiles: [], onInit: [], onLang: [], onAccountRender: [], placeExtras: [], accountSections: [], cityOverviewBind: [], cityTabs: [], onDataChange: [] };
const debounce = (fn, ms) => { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_STANDALONE = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
let SAFAR_CONFIG = { telegramBot: null, sosLive: false, publicUrl: null };

// В этом приложении направление всегда «Мекка» (для SOS — саудовские номера)
store.set("safar_region", "mecca");

// ---------- Данные (data/mk-*.js — собираются scripts/fetch-mecca.mjs) ----------
const DB = window.SAFAR_CITIES || { cities: [], updated: "" };
const CITIES = DB.cities.map(c => ({ ...c, key: "city:" + c.id, counts: { h: 0, a: 0, s: 0, f: 0 } }));
const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));
const POIS = (window.SAFAR_POIS || []).filter(p => CITIES[p.ci]).map(p => {
  const city = CITIES[p.ci];
  city.counts[p.c]++;
  return { ...p, city, key: "poi:" + p.id, hay: [p.n, p.na, p.nr, p.ne, p.nu].filter(Boolean).join(" ").toLowerCase() };
});
const POI = Object.fromEntries(POIS.map(p => [p.id, p]));

const cityName = c => (LANG === "ru" ? c.n.ru : isUz() ? c.n.uz : c.n[LANG]) || c.n.en || c.n.ru;
const poiName = p => (LANG === "ru" ? p.nr : isUz() ? p.nu : p.ne) || p.n;
const pt = o => o.la != null ? { lat: o.la, lon: o.lo } : o;
function km(a, b) {
  a = pt(a); b = pt(b);
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const commonsImg = (file, width = 640) =>
  file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file).replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())}?width=${width}` : "";
const fmtNum = n => Number(n).toLocaleString(NUM_LOCALE[LANG] || "ru-RU");

// «Полезное» (банкоматы, аптеки, больницы…) — грузится по требованию, как в узбекском приложении
let SERVICES = null, svcPromise = null;
function loadServices() {
  if (SERVICES) return Promise.resolve(SERVICES);
  svcPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "data/mk-services.js";
    s.onload = () => {
      SERVICES = (window.SAFAR_SERVICES || []).filter(r => CITIES[r[3]]).map(([type, la, lo, ci, n, oh, ph]) => ({ c: "u", type, la, lo, city: CITIES[ci], n: n || "", oh: oh || "", ph: ph || "" }));
      resolve(SERVICES);
    };
    s.onerror = () => { svcPromise = null; reject(new Error("services")); };
    document.head.appendChild(s);
  });
  return svcPromise;
}
const svcName = s => s.n || t("svc_" + s.type);

// ---------- Окна, подсказки, подтверждения ----------
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}
let modalToken = 0, miniMap = null;
function openModal(html) {
  if (miniMap) { miniMap.remove(); miniMap = null; }
  modalToken++;
  $("#modalBody").innerHTML = html;
  $("#modal").classList.remove("hidden", "closing");
  $("#modal").scrollTop = 0;
  document.body.style.overflow = "hidden";
  document.documentElement.classList.add("modal-open");
  return modalToken;
}
function closeModal(updateHash = true) {
  const m = $("#modal");
  if (m.classList.contains("hidden") || m.classList.contains("closing")) return;
  if (updateHash) history.pushState(null, "", "#" + mkTab);
  document.body.style.overflow = "";
  document.documentElement.classList.remove("modal-open");
  const token = modalToken;
  m.classList.add("closing");
  setTimeout(() => {
    if (token !== modalToken || !m.classList.contains("closing")) return;
    m.classList.remove("closing");
    m.classList.add("hidden");
    if (miniMap) { miniMap.remove(); miniMap = null; }
  }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
}
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

// ---------- Геолокация ----------
let userPos = null;
async function locate() {
  if (!userPos && !(await requireConsent())) throw new Error("no consent");
  return new Promise((resolve, reject) => {
    if (userPos) return resolve(userPos);
    if (!navigator.geolocation) return reject(new Error("no geo"));
    navigator.geolocation.getCurrentPosition(
      p => { userPos = { lat: p.coords.latitude, lon: p.coords.longitude }; resolve(userPos); },
      e => reject(e), { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true });
  });
}

// ---------- Карта ----------
const MAP_TILES = { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 };
function makeMap(el, opts = {}) {
  const map = L.map(el, { zoomControl: true, ...opts });
  L.tileLayer(MAP_TILES.url, { maxZoom: MAP_TILES.maxZoom, attribution: MAP_TILES.attribution }).addTo(map);
  return map;
}

// ---------- Тема ----------
const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
function setTheme(th) {
  document.documentElement.dataset.theme = th;
  try { localStorage.setItem("safar_theme", th); } catch { /* приватный режим */ }
  const b = $("#themeBtn"); if (b) b.innerHTML = icon(th === "dark" ? "sun" : "moon");
  document.querySelector("meta[name=theme-color]").content = th === "dark" ? "#06261e" : "#0a3a2e";
  document.dispatchEvent(new CustomEvent("safar:theme", { detail: th }));
}

// ---------- Настройки сервера (для SOS: тест или настоящие звонки) ----------
async function loadConfig() {
  try { const r = await fetch("/api/config", { cache: "no-store" }); if (r.ok) SAFAR_CONFIG = { ...SAFAR_CONFIG, ...(await r.json()) }; } catch { /* без сети */ }
}
