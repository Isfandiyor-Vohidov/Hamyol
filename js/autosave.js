// «Умное» фоновое сохранение для офлайна: приложение тихо, по одному городу и с паузами, сохраняет
// офлайн-наборы (js/offline.js) только тех городов, которые нужны этому человеку:
//   — города, которые он открывал сам (и города мест, которые он открывал) — из «Недавно смотрели»;
//   — города его поездки (вкладка «Поездка»), если маршрут он менял сам;
//   — ближайший к нему город — только если геолокация уже разрешена и есть согласие (сами не спрашиваем).
// Wi-Fi — с миниатюрами фото; мобильный интернет (cellular, 2g/3g) — только тексты и прогноз;
// «Экономия трафика» — ничего. Подложку карты массово не качаем (правила OpenStreetMap).
// Ещё модуль один раз после обновления докачивает библиотеки карты и шрифты (оболочку кэширует sw.js).

const AUTO_LIMIT = 12;           // не больше стольких городов за всё время автосохранения
const AUTO_PAUSE = 4000;         // пауза между городами, мс
const autoState = () => store.get("safar_autosave", { on: true, lib: "" });
const autoSet = patch => store.set("safar_autosave", { ...autoState(), ...patch });
let autoRunning = false;
let autoNow = null;              // { id, p } — город, который сохраняется прямо сейчас
let autoNear = null;             // ближайший город (если позиция известна)
const autoFailed = new Set();    // не сохранились в этот запуск — до перезапуска не повторяем

// Маршрут поездки, который человек задал сам (стандартный «Ташкент — Самарканд — Бухара — Хива» не считается)
function autoTripCities() {
  if (typeof tripRoute === "undefined") return [];
  const same = typeof defaultRoute !== "undefined" && tripRoute.length === defaultRoute.length &&
    tripRoute.every((r, i) => r.id === defaultRoute[i].id && r.nights === defaultRoute[i].nights);
  return same ? [] : tripRoute.map(r => CITY[r.id]).filter(Boolean);
}
// Открытые города и города открытых мест — из «Недавно смотрели» (js/recent.js), новые первыми
function autoSeenCities() {
  return store.get("safar_recent", []).map(x => x.k?.startsWith("city:") ? CITY[x.k.slice(5)] : x.k?.startsWith("poi:") ? POI[x.k.slice(4)]?.city : null)
    .filter(Boolean);
}
function autoCities() {
  const list = [...autoSeenCities(), ...autoTripCities(), autoNear].filter(Boolean);
  return [...new Set(list)].slice(0, AUTO_LIMIT);
}

// Ближайший город: только при уже данном согласии и уже разрешённой геолокации — без запроса разрешения
async function autoFindNear() {
  if (autoNear || !hasConsent()) return;
  if (!userPos) {
    const st = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
    if (st?.state !== "granted") return;
  }
  try {
    const me = await locate();
    const near = CITIES.reduce((best, c) => !best || km(me, c) < km(me, best) ? c : best, null);
    if (near && km(me, near) < 60) autoNear = near;   // дальше 60 км — человек ещё не в Узбекистане
  } catch { /* позиция недоступна */ }
}

// "full" — с миниатюрами, "lite" — без фото, "off" — включена экономия трафика
function autoMode() {
  const cn = navigator.connection;
  if (cn?.saveData) return "off";
  if (cn && (cn.type === "cellular" || /^(slow-2g|2g|3g)$/.test(cn.effectiveType || ""))) return "lite";
  return "full";
}

// Город уже сохранён? Набор без фото на Wi-Fi дополняем миниатюрами
function autoNeeds(c, mode) {
  const pack = offlinePacks()[c.id];
  return !pack || (pack.level === "none" && mode === "full");
}
const autoQueue = () => autoCities().filter(c => autoNeeds(c, autoMode()) && !autoFailed.has(c.id));

const autoIdle = () => new Promise(r => (window.requestIdleCallback || (f => setTimeout(f, 300)))(() => r(), { timeout: 5000 }));
const autoSleep = ms => new Promise(r => setTimeout(r, ms));

// Библиотеки карты и шрифты: запрашиваем ещё раз уже через сервис-воркер — он их сохранит.
// При самом первом запуске страница грузила их до установки воркера, и в кэш они не попали
async function autoLibs() {
  if (!navigator.serviceWorker?.controller) return;
  const ver = (await caches.keys()).find(k => /^safar-v\d+$/.test(k)) || "";
  if (!ver || autoState().lib === ver) return;
  const urls = [...new Set(performance.getEntriesByType("resource").map(e => e.name)
    .filter(u => /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)))];
  await Promise.allSettled(urls.map(u => fetch(u, { mode: "no-cors" })));
  autoSet({ lib: ver });
}

async function autoSave() {
  if (autoRunning || !("caches" in window) || !location.protocol.startsWith("http")) return;
  if (!autoState().on || !NET.online) return;
  autoRunning = true;
  try {
    await autoLibs().catch(() => {});
    await autoFindNear();
    // По одному городу: после каждого заново смотрим очередь (человек мог открыть новый город или выключить автосохранение)
    for (;;) {
      const mode = autoMode();
      if (mode === "off" || !NET.online || !autoState().on) break;
      const c = autoQueue().find(x => !offlineBusy.has(x.id) && !autoFailed.has(x.id));
      if (!c) break;
      await autoIdle();
      autoNow = { id: c.id, p: 0 };
      offlineBusy.add(c.id);
      offlineRefresh(c);
      renderAutoStatus();
      try {
        await downloadCity(c, p => { autoNow.p = p; offlineProgress(c, p); renderAutoBar(); },
          { photos: mode === "full" ? "thumbs" : "none" });
      } catch { autoFailed.add(c.id); /* попробуем при следующем запуске */ }
      offlineBusy.delete(c.id);
      autoNow = null;
      offlineRefresh(c);
      renderAutoStatus();
      if (typeof renderOfflineMenu === "function") renderOfflineMenu();
      await autoSleep(AUTO_PAUSE);
    }
  } finally {
    autoRunning = false;
    autoNow = null;
  }
  renderAutoStatus();
}
// Человек открыл город или место — через полминуты (когда фото и описание уже загружены) сохраняем и его
const autoSoon = debounce(() => autoIdle().then(autoSave), 30000);

// ---------- Индикатор: что сохраняется сейчас ----------
function autoStatusHtml() {
  if (!("caches" in window) || !location.protocol.startsWith("http")) return "";
  const st = autoState(), mode = autoMode(), left = autoQueue().length;
  const now = autoNow && CITY[autoNow.id];
  const title = !st.on ? t("auto_paused") : now ? t("auto_now", { city: esc(cityName(now)) })
    : left ? (mode === "off" ? t("auto_savedata") : !NET.online ? t("auto_wait_net") : t("auto_queue", { n: left })) : t("auto_all");
  const note = st.on && mode === "lite" ? t("auto_lite") : "";
  return `<div class="auto-status${now ? " running" : ""}" style="--p:${now ? autoNow.p : left ? 0 : 1}">
    <div class="auto-head">${icon(now ? "download" : left && st.on ? "hourglass" : "circle-check")}<b>${title}</b></div>
    ${now ? `<i class="auto-bar"></i>` : ""}
    ${note ? `<p class="hint">${note}</p>` : ""}
  </div>`;
}
function renderAutoStatus() {
  $$(".auto-slot").forEach(el => { el.innerHTML = autoStatusHtml(); });
  $$(".auto-switch").forEach(el => el.classList.toggle("on", autoState().on));
}
// Во время загрузки двигаем только полоску, не перерисовывая блок
function renderAutoBar() {
  $$(".auto-slot .auto-status").forEach(el => el.style.setProperty("--p", autoNow ? autoNow.p : 0));
}

document.addEventListener("click", e => {
  if (!e.target.closest("[data-auto-toggle]")) return;
  const on = !autoState().on;
  autoSet({ on });
  renderAutoStatus();
  toast(t(on ? "auto_on_toast" : "auto_off_toast"));
  if (on) autoSave();
});

// Старт — через 10 секунд после запуска, когда браузер свободен; после возврата сети — продолжить
EXT.onInit.push(() => setTimeout(() => autoIdle().then(autoSave), 10000));
EXT.onOnline ||= [];
EXT.onOnline.push(() => setTimeout(autoSave, 3000));
EXT.onLang.push(renderAutoStatus);
EXT.onDataChange.push(what => { if (what === "trip") autoSoon(); });
window.addEventListener("hashchange", () => { if (/^#(city|place)\//.test(location.hash)) autoSoon(); });
