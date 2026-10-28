// Офлайн-наборы городов: кнопка «Скачать для офлайна» в карточке города и меню «Офлайн» (#offline).
// Сохраняет описание города и главных мест (Википедия), фото, прогноз погоды, полезные места
// (банкоматы, аптеки, вокзалы); план дня, разговорник и сами данные приложения работают без сети и так.
// Подложку карты заранее не скачиваем: правила серверов OpenStreetMap запрещают массовую загрузку тайлов.
// Без сети карта показывает места и вашу позицию на схеме, а районы, которые вы уже смотрели, — с подложкой.
const OFFLINE_CACHE = "safar-offline";
const offlinePacks = () => store.get("safar_offline", {});
const offlineSave = packs => store.set("safar_offline", packs);
const offlineBusy = new Set();

// Что входит в набор: главные места города по категориям
function offlinePlaces(c) {
  const pois = POIS.filter(p => p.city === c);
  const pick = (cat, n) => pois.filter(p => p.c === cat).sort((a, b) => infoScore(b) - infoScore(a)).slice(0, n);
  return { sights: pick("a", 25), others: [...pick("s", 8), ...pick("h", 10), ...pick("f", 10)] };
}

// Картинка в постоянный кэш. Сначала с CORS (настоящий ответ), если нельзя — «непрозрачный» ответ
// Возвращает размер в байтах (у «непрозрачного» ответа размер браузер не показывает — 0)
const offlineSize = async res => res.type === "opaque" ? 0 : (await res.clone().blob().catch(() => null))?.size || 0;
async function offlineCacheUrl(cache, url) {
  if (!url) return 0;
  const hit = await cache.match(url);
  if (hit) return offlineSize(hit);
  let res;
  try { res = await fetch(await directImageUrl(url), { mode: "cors" }); if (!res.ok) throw 0; }
  catch { res = await fetch(url, { mode: "no-cors" }); }
  const size = await offlineSize(res);
  await cache.put(url, res);   // храним под тем адресом, который запрашивает приложение
  return size;
}
// Ссылка Special:FilePath переадресует без заголовка CORS — такие ответы браузер хранит «непрозрачными»
// и считает каждый как несколько мегабайт. Узнаём прямой адрес миниатюры (с CORS) через API Commons.
async function directImageUrl(url) {
  const m = url.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?]+)\?width=(\d+)/);
  if (!m) return url;
  const file = decodeURIComponent(m[1]);
  const json = await getJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=${m[2]}&titles=${encodeURIComponent("File:" + file)}`);
  const page = Object.values(json.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.thumburl || url;
}

// photos: "all" — фото и миниатюры (кнопка в карточке города), "thumbs" — только миниатюры,
// "none" — без фото (фоновое сохранение js/autosave.js на мобильном интернете)
async function downloadCity(c, onProgress, { photos = "all" } = {}) {
  if (!("caches" in window)) throw new Error("no cache");
  navigator.storage?.persist?.().catch(() => {});   // просим браузер не удалять сохранённое при нехватке места
  const cache = await caches.open(OFFLINE_CACHE);
  const { sights, others } = offlinePlaces(c);
  const urls = new Set();
  if (photos !== "none") {
    const big = photos === "all";
    urls.add(commonsImg(c.img, 480));
    if (big) urls.add(commonsImg(c.img, 1280));
    sights.forEach(p => { urls.add(poiPhoto(p, 160)); if (big) urls.add(poiPhoto(p, 1280)); });
    others.forEach(p => urls.add(poiPhoto(p, 160)));
  }
  urls.delete("");

  let bytes = 0;
  const tasks = [
    () => offlineCacheUrl(cache, "data/services.js"),
    () => typeof loadServices === "function" ? loadServices() : null,
    () => c.wiki ? API.wikiFor(c.wiki) : null,
    () => API.weather([c], true),
    () => typeof forecast16 === "function" ? forecast16(c) : null,
    () => typeof loadPriceStats === "function" ? loadPriceStats(c.id) : null,
    ...sights.filter(p => p.wd || p.wp).map(p => async () => {
      let titles = {};
      if (p.wp) { const [l, ...r] = p.wp.split(":"); if (["ru", "uz", "en"].includes(l)) titles[l] = r.join(":"); }
      if (p.wd) titles = { ...(await API.wikiTitles(p.wd).catch(() => ({}))), ...titles };
      await API.wikiFor(titles);
    }),
    ...[...urls].map(u => async () => { bytes += await offlineCacheUrl(cache, u); })
  ];

  // По 4 загрузки одновременно; ошибки отдельных частей набор не ломают
  let done = 0, failed = 0, next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      try { await task(); } catch { failed++; }
      onProgress?.(++done / tasks.length);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (failed > tasks.length / 2) throw new Error("too many failures");

  const packs = offlinePacks();
  packs[c.id] = { at: Date.now(), places: sights.length + others.length, urls: [...urls], level: photos, bytes };
  offlineSave(packs);
}

async function removeCity(c) {
  const packs = offlinePacks();
  const pack = packs[c.id];
  if (!pack) return;
  // Фото, которые нужны другим скачанным городам, не трогаем
  const keep = new Set(Object.entries(packs).filter(([id]) => id !== c.id).flatMap(([, p]) => p.urls || []));
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    await Promise.all((pack.urls || []).filter(u => !keep.has(u)).map(u => cache.delete(u)));
  } catch { /* кэш недоступен */ }
  delete packs[c.id];
  offlineSave(packs);
}

// ---------- Кнопка «Скачать для офлайна» (в карточке города и в меню «Офлайн») ----------
// small — короткая кнопка для списка в меню «Офлайн»
function offlineButton(c, small) {
  const pack = offlinePacks()[c.id], sm = small ? " small" : "", data = `data-offline="${c.id}"${small ? " data-off-small=\"1\"" : ""}`;
  if (offlineBusy.has(c.id)) return `<button class="btn ghost off-btn busy${sm}" ${data} disabled>${icon("download")} <span>${t("off_loading", { p: 0 })}</span><i class="off-bar"></i></button>`;
  return pack
    ? `<button class="btn ghost off-btn ready${sm}" ${data} title="${t("off_remove")}">${icon("circle-check")} <span>${t("off_ready")}</span></button>`
    : `<button class="btn ghost off-btn${sm}" ${data}>${icon("download")} <span>${t(small ? "off_dl_short" : "off_dl")}</span></button>`;
}
// Перерисовать все кнопки этого города и показать ход загрузки
const offlineRefresh = c => $$(`[data-offline="${c.id}"]`).forEach(x => { x.outerHTML = offlineButton(c, x.dataset.offSmall); });
const offlineProgress = (c, p) => $$(`[data-offline="${c.id}"]`).forEach(x => {
  const s = x.querySelector("span");
  if (s) s.textContent = t("off_loading", { p: Math.round(p * 100) });
  x.style.setProperty("--p", p);
});
EXT.cityOverviewBind.push((c, root) => {
  root.querySelector(".m-actions")?.insertAdjacentHTML("beforeend", offlineButton(c));
});

// Скачать один город вручную (кнопка в карточке или в меню «Офлайн»)
async function offlineDownload(c) {
  if (!navigator.onLine) return toast(t("off_need_net"));
  offlineBusy.add(c.id);
  offlineRefresh(c);
  try {
    await downloadCity(c, p => offlineProgress(c, p));
    toast(t("off_done", { city: cityName(c) }));
  } catch {
    toast(t("off_failed"));
  }
  offlineBusy.delete(c.id);
  offlineRefresh(c);
  renderOfflineMenu();
}
async function offlineRemove(c) {
  if (!confirm(t("off_remove_q", { city: cityName(c) }))) return false;
  await removeCity(c);
  offlineRefresh(c);
  toast(t("off_removed"));
  return true;
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-offline]");
  if (!b || b.disabled) return;
  const c = CITY[b.dataset.offline];
  if (!c) return;
  if (offlinePacks()[c.id]) { if (await offlineRemove(c)) renderOfflineMenu(); }
  else offlineDownload(c);
});

// ---------- Меню «Офлайн» (#offline) ----------
// Сохранённые города (размер, дата, «Удалить»), ход фонового сохранения, переключатель автосохранения
// и поиск по всем городам с кнопкой «Скачать»
const offlineIds = () => Object.keys(offlinePacks()).filter(id => CITY[id]);
const offlineMb = b => b >= 1e6 ? (b / 1e6).toFixed(1) + " " + t("mb_unit") : Math.max(1, Math.round(b / 1e3)) + " " + t("kb_unit");
const offlineOk = () => "caches" in window && location.protocol.startsWith("http");
let offlineQuery = "";

function offlineSavedHtml() {
  const packs = offlinePacks();
  const ids = offlineIds().sort((a, b) => packs[b].at - packs[a].at);
  if (!ids.length) return `<p class="empty off-empty">${icon("download")} ${t("off_none")}</p>`;
  return `<ul class="off-list">${ids.map(id => {
    const c = CITY[id], p = packs[id];
    const meta = [p.bytes ? "≈ " + offlineMb(p.bytes) : "", t("off_places", { n: p.places || 0 }), p.level === "none" ? t("off_no_photo") : "", fmtDate(new Date(p.at))].filter(Boolean).join(" · ");
    return `<li data-off-row="${id}">
      <a href="#city/${id}">${icon("circle-check")}<span><b>${esc(cityName(c))}</b><small>${meta}</small></span></a>
      <button type="button" class="btn ghost small off-del" data-off-del="${id}">${icon("x")} ${t("off_del")}</button></li>`;
  }).join("")}</ul>`;
}
// Поиск: по названию на любом языке; без запроса — главные города, которых ещё нет
function offlineResultsHtml() {
  const q = offlineQuery.trim().toLowerCase();
  const list = q ? CITIES.filter(c => c.hay.includes(q)).sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, 20)
    : CITIES.filter(c => c.t === "city" && !offlinePacks()[c.id]).sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, 8);
  if (!list.length) return `<p class="empty">${t("nothing")}</p>`;
  return `<ul class="off-list off-found">${list.map(c => `<li>
      <a href="#city/${c.id}">${icon(c.t === "city" ? "city" : "house")}<span><b>${esc(cityName(c))}</b><small>${regionName(c.r)}</small></span></a>
      ${offlineButton(c, true)}</li>`).join("")}</ul>`;
}

function openOfflineMenu() {
  const n = offlineIds().length;
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-c);min-height:150px;padding-top:60px">
      <h2>${icon("wifi-off")} ${t("off_menu")}</h2><p>${t("off_menu_sub")}</p></div>
    <div class="m-body off-menu">
      ${offlineOk() ? `
      <button type="button" class="ds-switch auto-switch${autoState().on ? " on" : ""}" data-auto-toggle>
        <i>${icon("refresh")}</i><span><b>${t("auto_switch")}</b><small>${t("auto_switch_sub")}</small></span><em></em></button>
      <div class="auto-slot">${autoStatusHtml()}</div>` : `<p class="empty">${icon("info")} ${t("off_unavailable")}</p>`}
      <h3 class="sec-title">${icon("circle-check")} ${t("off_list")} <b class="off-count" id="offCount">${n || ""}</b></h3>
      <div id="offSaved">${offlineSavedHtml()}</div>
      <p class="hint">${t("off_note")}</p>
      <h3 class="sec-title">${icon("search")} ${t("off_find")}</h3>
      <input type="search" class="off-search" id="offSearch" placeholder="${t("off_find_ph")}" autocomplete="off" value="${esc(offlineQuery)}">
      <div id="offResults">${offlineResultsHtml()}</div>
      <p class="hint">${icon("map")} ${t("off_map_note")}</p>
    </div>`);
}
function renderOfflineMenu() {
  if (!$("#offSaved")) return;
  $("#offSaved").innerHTML = offlineSavedHtml();
  $("#offCount").textContent = offlineIds().length || "";
  $("#offResults").innerHTML = offlineResultsHtml();
}
document.addEventListener("input", debounce(e => {
  if (e.target.id !== "offSearch") return;
  offlineQuery = e.target.value;
  $("#offResults").innerHTML = offlineResultsHtml();
}, 150));
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-off-del]");
  if (!b) return;
  const c = CITY[b.dataset.offDel];
  if (!c || !(await offlineRemove(c))) return;
  const li = b.closest("li");
  const done = () => renderOfflineMenu();
  if (li && !matchMedia("(prefers-reduced-motion: reduce)").matches) { li.classList.add("closing"); setTimeout(done, 220); } else done();
});

EXT.routes.offline = openOfflineMenu;
// В «Избранном» — одна кнопка «Офлайн-города» с числом сохранённых
EXT.favsExtras.push(() => `<a class="off-link" href="#offline">${icon("wifi-off")}<span><b>${t("off_menu")}</b><small>${t("off_link_sub")}</small></span>
  <em>${offlineIds().length}</em>${icon("chevron-right")}</a>`);
EXT.homeTiles.push(() => ["#offline", "wifi-off", t("off_menu"), offlineIds().length ? t("off_tile_n", { n: offlineIds().length }) : t("off_tile")]);
EXT.accountSections.push(() => offlineOk() ? accSection("wifi-off", t("off_menu"), `<div class="auto-slot">${autoStatusHtml()}</div>
  <a class="btn ghost" href="#offline">${icon("download")} ${t("off_open")} <b>${offlineIds().length}</b></a>`, false) : "");

// ---------- Нет интернета ----------
function renderNetBanner() {
  let el = $("#netBanner");
  const online = typeof NET !== "undefined" ? NET.online : navigator.onLine;
  if (online) { el?.classList.add("out"); setTimeout(() => el?.remove(), 400); return; }
  if (el) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="netBanner" class="net-banner" role="status">${icon("wifi-off")} <span>${t("off_banner")}</span></div>`);
}
EXT.onInit.push(renderNetBanner);
EXT.onLang.push(() => { $("#netBanner")?.remove(); renderNetBanner(); });

// ---------- Расстояние и направление до места (работает и без интернета — по GPS) ----------
const COMPASS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
function bearing(a, b) {
  const rad = Math.PI / 180, y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
async function fillYouDist() {
  const el = $("#youDist");
  if (!el) return;
  // Геолокацию не запрашиваем сами — только если она уже разрешена или позиция известна
  if (!userPos) {
    if (!hasConsent()) return;
    const st = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
    if (st?.state !== "granted") return;
  }
  const p = { lat: +el.dataset.lat, lon: +el.dataset.lon };
  locate().then(me => {
    if (!el.isConnected) return;
    const d = km(me, p), deg = bearing(me, p);
    el.innerHTML = `<small>${t("dist_you")}</small>
      <span class="you-dist">${icon("arrow-up", "you-arrow")}<b>${d < 1 ? Math.round(d * 1000) + " " + t("m_unit") : (d < 10 ? d.toFixed(1) : fmtNum(d)) + " " + t("km_unit")}</b>
      ${t("dir_" + COMPASS[Math.round(deg / 45) % 8])}</span>`;
    el.querySelector(".you-arrow").style.transform = `rotate(${deg}deg)`;
    el.classList.remove("hidden");
  }).catch(() => {});
}
EXT.placeExtras.push(p => { setTimeout(fillYouDist); return `<div class="fact you-fact hidden" id="youDist" data-lat="${p.la}" data-lon="${p.lo}"></div>`; });
