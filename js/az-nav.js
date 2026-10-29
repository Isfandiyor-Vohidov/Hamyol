// Навигатор внутри приложения «Азербайджан» — вместо перехода в Google Карты.
// С интернетом — маршрут пешком или на машине по OpenStreetMap (OSRM): линия на карте, шаги, голос, ведение
// и перестроение, если свернули. Проложенный маршрут сохраняется на телефоне и работает без сети.
// Без сети и без сохранённого маршрута — стрелка-компас, направление и расстояние по прямой.
// Подключается до js/az-app.js; всё, что нужно из приложения (LANG, LL, icon, esc, store, loadLeaflet, km…), берётся при вызове.
// Адрес экрана: #go/<широта>,<долгота>,<название>
const AZNAV_ROUTER = {
  walk: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
  drive: "https://router.project-osrm.org/route/v1/driving/"
};
const AZNAV = { map: null, dest: null, mode: "walk", route: null, saved: false, line: null, me: null, watch: null, pos: null, heading: null,
  follow: false, step: 0, spoken: -1, building: false, lastBuild: 0, wake: null, compass: null };
const AZNAV_TX = {
  walk: ["Пешком", "On foot"], drive: ["На машине", "By car"], transit: ["Транспорт", "Transit"], transit_g: ["Автобус и метро", "Bus and metro"],
  tr_sum: ["{n} пересадк.", "{n} transfers"], tr_none: ["Без пересадок", "No transfers"], tr_walk_only: ["Ближе всего пешком — транспорт не нужен", "Walking is quickest — no transit needed"],
  tr_fare: ["Проезд", "Fare"], tr_est: ["время примерное: у автобусов и метро нет точного расписания, поезда — по расписанию ADY", "times are approximate: buses and metro have no exact timetable; trains follow the ADY timetable"],
  tr_now: ["Шаг ", "Step "], tr_loading: ["Загружаем маршруты транспорта…", "Loading transit routes…"],
  go: ["Поехали", "Start"], stop: ["Стоп", "Stop"], me_wait: ["Ищем, где вы… Разрешите доступ к местоположению.", "Finding where you are… Allow location access."],
  no_geo: ["Не удалось узнать, где вы. Включите геолокацию в настройках телефона.", "Could not get your location. Turn on location in phone settings."],
  building: ["Прокладываем маршрут…", "Building the route…"], saved: ["Маршрут сохранён на телефоне — работает без интернета", "Route saved on the phone — works offline"],
  offline_saved: ["Нет интернета — ведём по сохранённому маршруту", "No internet — following the saved route"],
  straight: ["Нет интернета — показываем направление по прямой. Дорогу проложим, когда появится сеть.", "No internet — showing the straight-line direction. The road route will appear when you are online."],
  straight_go: ["Идите в сторону стрелки", "Walk towards the arrow"], left_dist: ["Осталось {d}", "{d} left"], arrive_at: ["на месте в {t}", "arrive at {t}"],
  depart: ["Начните движение", "Head out"], arrive: ["Вы на месте", "You have arrived"], cont: ["Продолжайте прямо", "Continue straight"],
  turn: ["Поверните {dir}", "Turn {dir}"], keep: ["Держитесь {dir}", "Keep {dir}"], uturn: ["Развернитесь", "Make a U-turn"],
  round: ["На круговом движении — {n}-й съезд", "At the roundabout, take exit {n}"], onto: [" на {road}", " onto {road}"], along: [" по {road}", " along {road}"],
  in: ["Через {d} — {x}", "In {d}, {x}"], reroute: ["Перестраиваем маршрут", "Rerouting"], google: ["Открыть в Google Картах", "Open in Google Maps"],
  voice_on: ["Голос включён", "Voice on"], voice_off: ["Голос выключен", "Voice off"], center: ["Ко мне", "Center"]
};
const AZNAV_DIR = {
  left: ["налево", "left"], right: ["направо", "right"], "slight left": ["плавно налево", "slightly left"], "slight right": ["плавно направо", "slightly right"],
  "sharp left": ["резко налево", "sharply left"], "sharp right": ["резко направо", "sharply right"]
};
const AZNAV_KEEP = { left: ["левее", "left"], right: ["правее", "right"] };
const AZNAV_SIDE = [["на север", "north"], ["на северо-восток", "north-east"], ["на восток", "east"], ["на юго-восток", "south-east"], ["на юг", "south"], ["на юго-запад", "south-west"], ["на запад", "west"], ["на северо-запад", "north-west"]];
const nt = (key, vars = {}) => { let s = AZNAV_TX[key][LANG === "en" ? 1 : 0]; for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]); return s; };
const ndir = (table, m) => { const row = table[m] || table[(m || "").replace(/^(slight|sharp) /, "")]; return row ? row[LANG === "en" ? 1 : 0] : ""; };

// Шаг OSRM → текст и значок
function navStepText(step) {
  const m = step.maneuver || {}, road = step.name || "", mod = m.modifier || "";
  if (m.type === "depart") return [nt("depart") + (road ? nt("along", { road }) : ""), "nav-arrow"];
  if (m.type === "arrive") return [nt("arrive"), "flag"];
  if (/roundabout|rotary/.test(m.type)) return [nt("round", { n: m.exit || 1 }) + (road ? nt("onto", { road }) : ""), "refresh"];
  if (mod === "uturn") return [nt("uturn"), "uturn"];
  if (!mod || mod === "straight" || m.type === "new name" || m.type === "continue" && !/left|right/.test(mod)) return [nt("cont") + (road ? nt("along", { road }) : ""), "arrow-up"];
  const left = mod.includes("left");
  const text = /^slight/.test(mod) && m.type !== "turn" ? nt("keep", { dir: ndir(AZNAV_KEEP, mod) }) : nt("turn", { dir: ndir(AZNAV_DIR, mod) });
  return [text + (road ? nt("onto", { road }) : ""), left ? "turn-left" : "turn-right"];
}
const navMin = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? `${m} ${LANG === "en" ? "min" : "мин"}` : `${Math.floor(m / 60)} ${LANG === "en" ? "h" : "ч"} ${m % 60} ${LANG === "en" ? "min" : "мин"}`; };
const navClock = s => new Date(Date.now() + s * 1000).toLocaleTimeString(LANG === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
function navBearing(a, b) {
  const r = Math.PI / 180, y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
  const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

// ---------- Сохранённые маршруты (последние 15) — для работы без интернета ----------
const navKey = () => `${AZNAV.dest.la.toFixed(4)},${AZNAV.dest.lo.toFixed(4)}|${AZNAV.mode}`;
function navSave(route, from) {
  const all = store.get("az_nav_routes", []).filter(r => r.key !== navKey());
  all.unshift({ key: navKey(), from, at: Date.now(), route: { distance: route.distance, duration: route.duration, geometry: route.geometry, legs: route.legs } });
  try { store.set("az_nav_routes", all.slice(0, 15)); } catch { store.set("az_nav_routes", all.slice(0, 5)); }
}
const navSaved = () => store.get("az_nav_routes", []).find(r => r.key === navKey());

// ---------- Экран ----------
function navParse(id) {
  const [la, lo, ...rest] = (id || "").split(",");
  return isFinite(+la) && isFinite(+lo) && la && lo ? { la: +la, lo: +lo, name: rest.join(",") || "" } : null;
}
function navScreen(id) {
  const d = navParse(id);
  if (!d) return SCREENS.map();
  const name = d.name || `${d.la.toFixed(4)}, ${d.lo.toFixed(4)}`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${d.la},${d.lo}&travelmode=transit`;
  return `${head("directions", esc(name))}
    <div class="az-chips" id="navModes">${["walk", "transit", "drive"].map(m => `<button type="button" class="${m === store.get("az_nav_mode", "walk") ? "on" : ""}" data-nav-mode="${m}">${icon(m === "walk" ? "walk" : m === "transit" ? "bus" : "car")} ${nt(m)}</button>`).join("")}</div>
    ${isSimple() ? `<button type="button" class="sm-other" data-nav-other>${icon("route")} ${sm("other_way")}</button>` : ""}
    <div class="nav-wrap"><div id="navMap" class="az-map nav-map"></div>
      <div class="nav-banner" id="navBanner" hidden></div>
      <div class="nav-compass" id="navCompass" hidden><span class="nav-arrow">${icon("arrow-up")}</span><b id="navCompassD"></b><small id="navCompassS"></small></div>
      <button type="button" class="nav-center" data-nav-center aria-label="${nt("center")}">${icon("locate")}</button></div>
    <div class="az-card nav-sum" id="navSum"><p class="hint" style="margin:0">${nt("me_wait")}</p></div>
    <div class="az-btns two"><button type="button" class="az-btn" data-nav-go>${icon("nav-arrow")} ${nt("go")}</button>
      <button type="button" class="az-btn ghost" data-nav-voice>${icon(store.get("az_nav_voice", true) ? "volume" : "volume-off")} ${nt(store.get("az_nav_voice", true) ? "voice_on" : "voice_off")}</button></div>
    <div class="az-btns two"><a class="az-btn ghost" href="${taxiHref(d.la, d.lo, name)}">${icon("car")} ${LL("Такси сюда", "Taxi here")}</a><a class="az-btn ghost" href="${google}" target="_blank" rel="noopener">${icon("bus")} Google</a></div>`;
}

async function navStart(id) {
  const d = navParse(id);
  if (!d) return;
  // «Откуда» может быть задано заранее (маршрут метро от выбранной станции) — тогда без GPS
  const fixed = store.get("az_nav_from", null);
  store.set("az_nav_from", null);
  Object.assign(AZNAV, { dest: d, mode: isSimple() ? "auto" : store.get("az_nav_mode", "walk"), route: null, plan: null, saved: false, straight: false, follow: false, step: 0, spoken: -1, pos: fixed || USER_POS || null, from: fixed });
  if (!(await loadLeaflet()) || !curHash.startsWith("#go/")) { $("#navMap")?.remove(); return navNoMap(); }
  AZNAV.map = L.map("navMap", { zoomControl: true }).setView([d.la, d.lo], 15);
  // Сдвинули или приблизили карту рукой — смотрите спокойно (конец пути и т. п.), к синей точке не возвращаем,
  // пока не нажмут кнопку «Ко мне»
  AZNAV.free = false;
  const letGo = () => { if (AZNAV.free) return; AZNAV.free = true; $(".nav-center")?.classList.add("on"); };
  AZNAV.map.on("dragstart", letGo);
  const box = AZNAV.map.getContainer();
  box.addEventListener("wheel", letGo, { passive: true });
  box.addEventListener("touchstart", e => { if (e.touches.length > 1) letGo(); }, { passive: true });
  box.addEventListener("dblclick", letGo);
  box.querySelectorAll(".leaflet-control-zoom a").forEach(a => a.addEventListener("click", letGo));
  azBase(AZNAV.map, [d.la, d.lo]);
  L.marker([d.la, d.lo], { icon: L.divIcon({ className: "", html: `<span class="az-pin nav-dest">${icon("flag")}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(AZNAV.map);
  if (AZNAV.from) return navFix(AZNAV.from, null);
  if (!navigator.geolocation) return navSum(`<p class="az-note">${icon("info")} ${nt("no_geo")}</p>`);
  AZNAV.watch = navigator.geolocation.watchPosition(p => navFix([p.coords.latitude, p.coords.longitude], p.coords.heading),
    () => { if (!AZNAV.pos) navSum(`<div class="az-note">${icon("info")}<span>${nt("no_geo")}</span></div>`); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  if (AZNAV.pos) navFix(AZNAV.pos, null);
  navCompassListen();
}
function navStop() {
  if (AZNAV.watch != null) navigator.geolocation.clearWatch(AZNAV.watch);
  if (AZNAV.compass) removeEventListener(AZNAV.compass[0], AZNAV.compass[1]);
  AZNAV.map?.remove();
  try { speechSynthesis.cancel(); } catch { /* нет голоса */ }
  AZNAV.wake?.release?.().catch(() => {});
  Object.assign(AZNAV, { map: null, line: null, me: null, watch: null, follow: false, wake: null, compass: null });
}
const navSum = html => { const el = $("#navSum"); if (el) el.innerHTML = html; };
// Без карты (не загрузилась библиотека): только расстояние и направление
function navNoMap() {
  if (!navigator.geolocation) return navSum(`<p>${nt("no_geo")}</p>`);
  AZNAV.watch = navigator.geolocation.watchPosition(p => { AZNAV.pos = [p.coords.latitude, p.coords.longitude]; navStraight(); }, () => navSum(`<p>${nt("no_geo")}</p>`), { enableHighAccuracy: true, timeout: 30000 });
}

// Новое место: метка «я», маршрут при первом определении, ведение в режиме «Поехали»
function navFix(pos, heading) {
  AZNAV.pos = pos; USER_POS = pos;
  // Простой режим: ближе 1,5 км — пешком, дальше — на транспорте (метро, автобус); меняется кнопкой «Другой способ»
  if (AZNAV.mode === "auto") {
    AZNAV.mode = km(pos, [AZNAV.dest.la, AZNAV.dest.lo]) < 1.5 ? "walk" : "transit";
    $$("[data-nav-mode]").forEach(b => b.classList.toggle("on", b.dataset.navMode === AZNAV.mode));
  }
  if (heading != null && !isNaN(heading)) AZNAV.heading = heading;
  if (!AZNAV.map) return;
  if (!AZNAV.me) AZNAV.me = L.marker(pos, { zIndexOffset: 2000, icon: L.divIcon({ className: "", html: `<span class="nav-me"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(AZNAV.map);
  else AZNAV.me.setLatLng(pos);
  if (AZNAV.mode === "transit") { if (!AZNAV.plan && !AZNAV.building) return navBuild(); if (AZNAV.follow) navTransitGuide(); return; }
  if (!AZNAV.route && !AZNAV.building && !AZNAV.straight) return navBuild();
  if (AZNAV.straight) { navStraight(); if (navigator.onLine && Date.now() - AZNAV.lastBuild > 20000) navBuild(); return; }
  if (AZNAV.follow) navGuide();
}

async function navBuild() {
  if (!AZNAV.pos || !AZNAV.dest || AZNAV.building) return;
  if (AZNAV.mode === "transit") return navTransitBuild();
  AZNAV.building = true; AZNAV.lastBuild = Date.now();
  if (!AZNAV.route) navSum(`<p class="hint" style="margin:0">${nt("building")}</p>`);
  const { pos, dest, mode } = AZNAV;
  let route = null, saved = false;
  if (navigator.onLine) {
    try {
      const url = `${AZNAV_ROUTER[mode]}${pos[1]},${pos[0]};${dest.lo},${dest.la}?overview=full&geometries=geojson&steps=true`;
      const j = await (await fetch(url, { signal: AbortSignal.timeout(12000) })).json();
      if (j.code === "Ok" && j.routes?.[0]) { route = j.routes[0]; navSave(route, pos); }
    } catch { /* сервер не ответил — пробуем сохранённый */ }
  }
  if (!route) { const s = navSaved(); if (s) { route = s.route; saved = true; } }
  AZNAV.building = false;
  if (!curHash.startsWith("#go/") || !AZNAV.map) return;
  if (!route) { AZNAV.straight = true; return navStraight(); }
  AZNAV.straight = false; $("#navCompass").hidden = true;
  Object.assign(AZNAV, { route, saved, step: 0, spoken: -1 });
  AZNAV.line?.remove();
  AZNAV.line = L.polyline(route.geometry.coordinates.map(([lo, la]) => [la, lo]), { color: "#1a73e8", weight: 7, opacity: .85 }).addTo(AZNAV.map);
  if (!AZNAV.follow) AZNAV.map.fitBounds(AZNAV.line.getBounds().pad(0.15));
  navSummary();
  if (AZNAV.follow) navGuide();
}
function navSummary() {
  const r = AZNAV.route;
  navSum(`<div class="nav-total"><b>${navMin(r.duration)}</b><span>${fmtDist(r.distance / 1000)} · ${nt("arrive_at", { t: navClock(r.duration) })}</span></div>
    <p class="hint" style="margin:6px 0 0">${icon(AZNAV.saved ? "wifi-off" : "check")} ${AZNAV.saved ? nt("offline_saved") : nt("saved")}</p>`);
}
// Шаги маршрута списком не показываем — следующая подсказка крупно сверху на карте
const navSteps = () => (AZNAV.route?.legs || []).flatMap(l => l.steps || []);

// Ведение: ближайшая точка маршрута, следующий манёвр, голос, перестроение, прибытие
function navGuide() {
  const steps = navSteps(), pos = AZNAV.pos;
  if (!steps.length || !pos) return;
  if (km(pos, [AZNAV.dest.la, AZNAV.dest.lo]) < 0.025) return navArrive();
  // Сошли с маршрута — перестраиваем (не чаще раза в 15 секунд, только с интернетом)
  const off = navOffRoute(pos);
  if (off > (AZNAV.mode === "walk" ? 0.05 : 0.08) && navigator.onLine && Date.now() - AZNAV.lastBuild > 15000) { navSay(nt("reroute")); AZNAV.route = null; return navBuild(); }
  // Следующий манёвр: дошли до точки поворота — переходим к следующему шагу
  while (AZNAV.step < steps.length - 1) {
    const nx = steps[AZNAV.step + 1].maneuver.location;
    if (km(pos, [nx[1], nx[0]]) < 0.02) AZNAV.step++; else break;
  }
  const next = steps[Math.min(AZNAV.step + 1, steps.length - 1)], loc = next.maneuver.location, d = km(pos, [loc[1], loc[0]]);
  const [txt, ic] = navStepText(next);
  const banner = $("#navBanner");
  if (banner) { banner.hidden = false; banner.innerHTML = `${icon(ic)}<div><b>${fmtDist(d)}</b><span>${esc(txt)}</span></div>`; }
  const near = AZNAV.mode === "walk" ? 0.06 : 0.25;
  if (d < near && AZNAV.spoken !== AZNAV.step + 1) { AZNAV.spoken = AZNAV.step + 1; navSay(nt("in", { d: fmtDist(d), x: txt.charAt(0).toLowerCase() + txt.slice(1) })); }
  if (!AZNAV.free) AZNAV.map.setView(pos, Math.max(AZNAV.map.getZoom(), 17), { animate: true });
  const left = AZNAV.route.distance * navLeftShare(pos);
  const sum = $("#navSum .nav-total span");
  if (sum) sum.textContent = `${nt("left_dist", { d: fmtDist(left / 1000) })}`;
}
// Расстояние до линии маршрута (км) — по ближайшей вершине, этого хватает для решения «свернули или нет»
function navOffRoute(pos) {
  let best = Infinity;
  for (const [lo, la] of AZNAV.route.geometry.coordinates) { const d = km(pos, [la, lo]); if (d < best) best = d; }
  return best;
}
function navLeftShare(pos) {
  const c = AZNAV.route.geometry.coordinates;
  let bi = 0, best = Infinity;
  c.forEach(([lo, la], i) => { const d = km(pos, [la, lo]); if (d < best) { best = d; bi = i; } });
  return c.length > 1 ? 1 - bi / (c.length - 1) : 0;
}
function navArrive() {
  navSay(nt("arrive"));
  const banner = $("#navBanner");
  if (banner) { banner.hidden = false; banner.innerHTML = `${icon("flag")}<div><b>${nt("arrive")}</b></div>`; }
  navFollow(false);
}
// Без маршрута: стрелка на цель с учётом компаса, расстояние, сторона света
function navStraight() {
  const { pos, dest } = AZNAV;
  if (!pos) return;
  const to = [dest.la, dest.lo], d = km(pos, to), b = navBearing(pos, to);
  if (d < 0.025) return navArrive();
  navSum(`<div class="az-note">${icon("wifi-off")}<span>${nt("straight")}</span></div>
    <div class="nav-total"><b>${fmtDist(d)}</b><span>${AZNAV_SIDE[Math.round(b / 45) % 8][LANG === "en" ? 1 : 0]} · ${nt("straight_go")}</span></div>`);
  if (AZNAV.map) {
    AZNAV.line?.remove();
    AZNAV.line = L.polyline([pos, to], { color: "#1a73e8", weight: 5, dashArray: "8 10" }).addTo(AZNAV.map);
    if (!AZNAV.follow) AZNAV.map.fitBounds(AZNAV.line.getBounds().pad(0.3));
    else if (!AZNAV.free) AZNAV.map.setView(pos, Math.max(AZNAV.map.getZoom(), 16));
  }
  const box = $("#navCompass");
  if (box) {
    box.hidden = false;
    $("#navCompassD").textContent = fmtDist(d);
    $("#navCompassS").textContent = AZNAV_SIDE[Math.round(b / 45) % 8][LANG === "en" ? 1 : 0];
    box.querySelector(".nav-arrow").style.transform = `rotate(${b - (AZNAV.heading || 0)}deg)`;
  }
}
// Компас телефона (если есть) — стрелка показывает на цель, куда бы ни смотрел телефон
function navCompassListen() {
  const type = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  const fn = e => {
    const h = e.webkitCompassHeading ?? (e.absolute || type === "deviceorientationabsolute" ? (360 - (e.alpha || 0)) % 360 : null);
    if (h == null) return;
    AZNAV.heading = h;
    if (AZNAV.straight && AZNAV.pos) { const a = $("#navCompass .nav-arrow"); if (a) a.style.transform = `rotate(${navBearing(AZNAV.pos, [AZNAV.dest.la, AZNAV.dest.lo]) - h}deg)`; }
  };
  addEventListener(type, fn);
  AZNAV.compass = [type, fn];
}
// Голос: русский или английский — как язык приложения
function navSay(text) {
  if (!store.get("az_nav_voice", true) || !("speechSynthesis" in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = LANG === "en" ? "en-US" : "ru-RU"; u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* нет голоса */ }
}
async function navFollow(on) {
  AZNAV.follow = on;
  if (on) { AZNAV.free = false; $(".nav-center")?.classList.remove("on"); }
  const btn = $("[data-nav-go]");
  if (btn) btn.innerHTML = on ? `${icon("square")} ${nt("stop")}` : `${icon("nav-arrow")} ${nt("go")}`;
  document.querySelector(".nav-wrap")?.classList.toggle("following", on);
  if (on) {
    try { AZNAV.wake = await navigator.wakeLock?.request("screen"); } catch { /* экран может погаснуть */ }
    if (AZNAV.mode === "transit") { if (AZNAV.plan) navTransitGuide(); }
    else if (AZNAV.route) { const [txt] = navStepText(navSteps()[0] || {}); navSay(txt); navGuide(); } else navStraight();
    $(".nav-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    AZNAV.wake?.release?.().catch(() => {}); AZNAV.wake = null;
    if (AZNAV.route || AZNAV.plan) $("#navBanner").hidden = true;
  }
}
document.addEventListener("click", e => {
  const m = e.target.closest("[data-nav-mode]");
  if (m) {
    store.set("az_nav_mode", m.dataset.navMode);
    $$("[data-nav-mode]").forEach(b => b.classList.toggle("on", b === m));
    Object.assign(AZNAV, { mode: m.dataset.navMode, route: null, plan: null, straight: false, lastBuild: 0 });
    AZNAV.line?.remove();
    $("#navCompass").hidden = true;
    return navBuild();
  }
  if (e.target.closest("[data-nav-go]")) return navFollow(!AZNAV.follow);
  if (e.target.closest("[data-nav-center]")) {
    AZNAV.free = false;
    $(".nav-center")?.classList.remove("on");
    if (AZNAV.pos && AZNAV.map) AZNAV.map.setView(AZNAV.pos, 17);
    return;
  }
  const v = e.target.closest("[data-nav-voice]");
  if (v) {
    const on = !store.get("az_nav_voice", true);
    store.set("az_nav_voice", on);
    v.innerHTML = `${icon(on ? "volume" : "volume-off")} ${nt(on ? "voice_on" : "voice_off")}`;
    if (!on) try { speechSynthesis.cancel(); } catch { /* нет голоса */ }
  }
});
// Интернет появился — прокладываем настоящий маршрут вместо прямой
addEventListener("online", () => { if (AZNAV.map && (AZNAV.straight || AZNAV.saved)) { AZNAV.lastBuild = 0; AZNAV.route = null; navBuild(); } });

// ---------- На транспорте (js/az-transit.js): данные в телефоне — работает и без интернета ----------
async function navTransitBuild() {
  AZNAV.building = true;
  navSum(`<p class="hint" style="margin:0">${nt("tr_loading")}</p>`);
  try { await loadTransit(); } catch { AZNAV.building = false; navSum(`<div class="az-note">${icon("wifi-off")}<span>${tu("fail")}</span></div>`); return; }
  const plan = transitPlan(AZNAV.pos, [AZNAV.dest.la, AZNAV.dest.lo]);
  AZNAV.building = false;
  if (!curHash.startsWith("#go/") || !AZNAV.map || AZNAV.mode !== "transit") return;
  Object.assign(AZNAV, { plan, lastBuild: Date.now(), spokenKey: "" });
  $("#navCompass").hidden = true;
  AZNAV.line?.remove();
  AZNAV.line = L.featureGroup(plan.legs.map(l => L.polyline(l.path || [l.a, l.b], { color: l.r?.c || TRANSIT_COLOR[l.k], weight: l.k === "walk" ? 5 : 7, opacity: .9, dashArray: l.k === "walk" ? "6 9" : null }))).addTo(AZNAV.map);
  plan.legs.forEach(l => { if (l.k !== "walk") L.circleMarker(l.path[0], { radius: 7, color: "#fff", weight: 3, fillColor: l.r?.c || TRANSIT_COLOR[l.k], fillOpacity: 1 }).addTo(AZNAV.line); });
  AZNAV.map.fitBounds(AZNAV.line.getBounds().pad(0.15));
  const rides = plan.legs.filter(l => l.k !== "walk"), fare = planFare(plan), dur = plan.arr - plan.dep;
  navSum(rides.length ? `<div class="nav-total"><b>${navMin(dur * 60)}</b><span>${nt("arrive_at", { t: navClock(dur * 60) })} · ${rides.length > 1 ? nt("tr_sum", { n: rides.length - 1 }) : nt("tr_none")}</span></div>
    <div class="az-price-line">${icon("banknote")} <b>${nt("tr_fare")}: ${fare.est ? "~" : ""}${fmtAzn(fare.lo, fare.hi)}</b><span class="az-uzs">${fmtUzs(fare.lo, fare.hi)}</span></div>
    <p class="hint" style="margin:4px 0 0">${nt("tr_est")}</p>`
    : `<div class="nav-total"><b>${navMin(dur * 60)}</b><span>${nt("tr_walk_only")}</span></div>`);
  if (AZNAV.follow) navTransitGuide();
}
// Ведение: на каком отрезке пути человек сейчас (ближайшая точка), подсказка сверху, голос при смене отрезка
function navTransitGuide() {
  const plan = AZNAV.plan, pos = AZNAV.pos;
  if (!plan || !pos) return;
  if (km(pos, [AZNAV.dest.la, AZNAV.dest.lo]) < 0.03) return navArrive();
  let best = Infinity, li = 0, pi = 0;
  plan.legs.forEach((l, i) => (l.path || [l.a, l.b]).forEach((p, k) => { const d = km(pos, p); if (d < best) { best = d; li = i; pi = k; } }));
  // Далеко от всех отрезков — строим заново (и без интернета тоже)
  if (best > 0.4 && Date.now() - AZNAV.lastBuild > 20000 && !AZNAV.from) { navSay(nt("reroute")); AZNAV.plan = null; return navTransitBuild(); }
  const l = plan.legs[li], x = legText(l);
  let line = x.t;
  if (l.k !== "walk" && l.path && pi > 0) {
    const left = l.path.length - 1 - pi, stop = nodeName(TRANSIT.nodes[l.to]);
    line = left > 0 ? LL(`Выйти через ${left} ост. — «${stop}»`, `Get off in ${left} stops — “${stop}”`) : LL(`Выходите: «${stop}»`, `Get off now: “${stop}”`);
  }
  const banner = $("#navBanner");
  if (banner) { banner.hidden = false; banner.innerHTML = `${icon(x.ic)}<div><b>${nt("tr_now")}${li + 1}/${plan.legs.length}</b><span>${esc(line)}</span></div>`; }
  const key = li + ":" + (l.k !== "walk" && l.path ? Math.min(l.path.length - 1 - pi, 2) : 0);
  if (AZNAV.spokenKey !== key) { AZNAV.spokenKey = key; navSay(line); }
  if (!AZNAV.free) AZNAV.map.setView(pos, Math.max(AZNAV.map.getZoom(), 16), { animate: true });
}
