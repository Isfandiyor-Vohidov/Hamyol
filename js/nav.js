// Навигация внутри приложения: маршрут от вас до места пешком или на машине, пошаговые подсказки,
// режим «Поехали» с ведением по карте, голосом и автоматическим перестроением маршрута.
// Маршруты — OSRM по данным OpenStreetMap: авто — router.project-osrm.org, пешком — routing.openstreetmap.de (FOSSGIS).
// Это демо-серверы для небольшой нагрузки; перед публичным запуском лучше поднять свой OSRM.
// Адрес экрана: #nav/p.<id места>, #nav/c.<id города> или #nav/@<широта>,<долгота>
const NAV_ROUTER = {
  walk: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
  drive: "https://router.project-osrm.org/route/v1/driving/"
};

// ---------- Подсказки на 8 языках: [uz, ru, en, tr, de, zh, ko] ----------
const NAV_TX = {
  depart: ["Yo‘lga chiqing", "Начните движение", "Head out", "Yola çıkın", "Los geht’s", "出发", "출발하세요"],
  arrive: ["Siz yetib keldingiz", "Вы на месте", "You have arrived", "Vardınız", "Sie sind angekommen", "已到达", "도착했습니다"],
  cont: ["To‘g‘riga yuring", "Продолжайте прямо", "Continue straight", "Düz devam edin", "Geradeaus weiter", "继续直行", "직진하세요"],
  turn: ["{dir} buriling", "Поверните {dir}", "Turn {dir}", "{dir} dönün", "{dir} abbiegen", "{dir}转", "{dir}으로 회전하세요"],
  keep: ["{dir} tomonda yuring", "Держитесь {dir}", "Keep {dir}", "{dir} tarafta kalın", "{dir} halten", "靠{dir}行驶", "{dir} 방향을 유지하세요"],
  uturn: ["Ortga buriling", "Развернитесь", "Make a U-turn", "U dönüşü yapın", "Wenden Sie", "掉头", "유턴하세요"],
  round: ["Aylanma yo‘lda {n}-chiqishga chiqing", "На круговом движении — {n}-й съезд", "At the roundabout, take exit {n}", "Dönel kavşakta {n}. çıkıştan çıkın", "Im Kreisverkehr die {n}. Ausfahrt nehmen", "在环岛走第{n}个出口", "회전교차로에서 {n}번째 출구로 나가세요"],
  onto: [" — {road}", " на {road}", " onto {road}", " — {road}", " auf {road}", "，进入{road}", " — {road}"],
  in: ["{d} dan keyin {x}", "Через {d} {x}", "In {d}, {x}", "{d} sonra {x}", "In {d} {x}", "{d}后{x}", "{d} 후 {x}"]
};
const NAV_DIR = {
  left: ["chapga", "налево", "left", "sola", "links", "左", "왼쪽"],
  right: ["o‘ngga", "направо", "right", "sağa", "rechts", "右", "오른쪽"],
  "slight left": ["biroz chapga", "плавно налево", "slightly left", "hafif sola", "leicht links", "稍向左", "약간 왼쪽"],
  "slight right": ["biroz o‘ngga", "плавно направо", "slightly right", "hafif sağa", "leicht rechts", "稍向右", "약간 오른쪽"],
  "sharp left": ["keskin chapga", "резко налево", "sharply left", "keskin sola", "scharf links", "向左急", "급하게 왼쪽"],
  "sharp right": ["keskin o‘ngga", "резко направо", "sharply right", "keskin sağa", "scharf rechts", "向右急", "급하게 오른쪽"]
};
const NAV_KEEP = { left: ["chap", "левее", "left", "sol", "links", "左", "왼쪽"], right: ["o‘ng", "правее", "right", "sağ", "rechts", "右", "오른쪽"] };
const navLang = () => Math.max(0, ["uz", "ru", "en", "tr", "de", "zh", "ko"].indexOf(LANG === "uzc" ? "uz" : LANG));
const navTx = (key, vars = {}) => {
  let s = NAV_TX[key][navLang()];
  for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
  return LANG === "uzc" ? toCyr(s) : s;
};
const navDir = (table, m) => { const row = table[m] || table[(m || "").replace(/^(slight|sharp) /, "")]; return row ? (LANG === "uzc" ? toCyr(row[0]) : row[navLang()]) : ""; };

// Шаг OSRM → текст и иконка
function stepText(step) {
  const m = step.maneuver, mod = m.modifier || "straight", road = step.name || step.ref || "";
  let text, ic = "arrow-up";
  if (m.type === "depart") text = navTx("depart");
  else if (m.type === "arrive") { text = navTx("arrive"); ic = "flag"; }
  else if (m.type === "roundabout" || m.type === "rotary" || m.type === "roundabout turn") { text = navTx("round", { n: m.exit || 1 }); ic = "roundabout"; }
  else if (mod === "uturn") { text = navTx("uturn"); ic = "uturn"; }
  else if (mod === "straight") text = navTx("cont");
  else if (["fork", "merge", "on ramp", "off ramp"].includes(m.type)) { text = navTx("keep", { dir: navDir(NAV_KEEP, mod.includes("left") ? "left" : "right") }); ic = mod.includes("left") ? "slight-left" : "slight-right"; }
  else {
    text = navTx("turn", { dir: navDir(NAV_DIR, mod) });
    ic = mod.includes("left") ? (mod.includes("slight") ? "slight-left" : "turn-left") : (mod.includes("slight") ? "slight-right" : "turn-right");
  }
  if (road && m.type !== "arrive" && m.type !== "depart") text += navTx("onto", { road: esc(road) });
  return { text, ic };
}
const fmtDist = m => m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} ${t("m_unit")}` : `${(m / 1000).toLocaleString(NUM_LOCALE[LANG], { maximumFractionDigits: m < 10000 ? 1 : 0 })} ${t("km_unit")}`;
const lowerFirst = s => ["zh", "ko"].includes(LANG) ? s : s.charAt(0).toLowerCase() + s.slice(1);

// ---------- Геометрия: ближайшая точка маршрута ----------
const toXY = (p, lat0) => [p[1] * 111320 * Math.cos(lat0 * Math.PI / 180), p[0] * 110540];   // метры, локально
function nearestOnRoute(route, pos) {
  let best = { d: Infinity };
  route.steps.forEach((st, si) => {
    const pts = st.coords;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = toXY(pts[i], pos[0]), [bx, by] = toXY(pts[i + 1], pos[0]), [px, py] = toXY(pos, pos[0]);
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
      const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
      if (d < best.d) best = { d, si, i, k };
    }
  });
  if (!isFinite(best.d)) return null;
  // Сколько осталось до конца текущего шага (до следующего манёвра)
  const pts = route.steps[best.si].coords;
  const segLen = (a, b) => km({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }) * 1000;
  let toNext = segLen(pts[best.i], pts[best.i + 1]) * (1 - best.k);
  for (let j = best.i + 1; j < pts.length - 1; j++) toNext += segLen(pts[j], pts[j + 1]);
  const after = route.steps.slice(best.si + 1).reduce((a, s) => a + s.distance, 0);
  return { off: best.d, step: best.si, toNext, left: toNext + after };
}

// ---------- Маршрут ----------
// points — одна точка [lat, lon] или список точек (остановки по порядку); names — названия промежуточных остановок
async function fetchRoute(from, points, mode, names = []) {
  if (typeof points[0] === "number") points = [points];
  const coords = [from, ...points].map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(";");
  const json = await getJSON(`${NAV_ROUTER[mode]}${coords}?overview=full&geometries=geojson&steps=true`, { timeout: 15000 });
  if (json.code !== "Ok" || !json.routes?.length) throw new Error(json.code || "no route");
  const r = json.routes[0];
  const steps = r.legs.flatMap((leg, li) => leg.steps.map(s => {
    // Конец промежуточного участка — не «Вы на месте», а «Остановка: …»
    const txt = s.maneuver.type === "arrive" && li < r.legs.length - 1 ? { text: t("nav_stop_at", { name: esc(names[li] || "") }), ic: "pin" } : stepText(s);
    return { ...txt, distance: s.distance, coords: s.geometry.coordinates.map(([lo, la]) => [la, lo]), at: [s.maneuver.location[1], s.maneuver.location[0]] };
  }));
  // Сначала — шаг, следующий за манёвром: подсказка «через N м» относится к концу текущего шага
  return { distance: r.distance, duration: r.duration, line: r.geometry.coordinates.map(([lo, la]) => [la, lo]), steps };
}
// Пешком OSRM считает ~5 км/ч; на машине по городу добавляем запас на светофоры
const navMinutes = (route, mode) => route.duration / 60 * (mode === "drive" ? 1.25 : 1);

// ---------- Экран навигации ----------
let NV = null;   // { dest, mode, from, route, map, layers…, watch, follow, lock, voice, spoken }

function navDest(id) {
  if (!id) return null;
  if (id.startsWith("p.") && POI[id.slice(2)]) { const p = POI[id.slice(2)]; return { lat: p.la, lon: p.lo, name: poiName(p), icon: poiIcon(p) }; }
  if (id.startsWith("c.") && CITY[id.slice(2)]) { const c = CITY[id.slice(2)]; return { lat: c.lat, lon: c.lon, name: cityName(c), icon: c.ico }; }
  if (id.startsWith("plan.") && CITY[id.slice(5)]) {
    const c = CITY[id.slice(5)], plan = dayPlan(c);
    if (!plan?.stops.length) return null;
    const stops = plan.stops.map(p => ({ lat: p.la, lon: p.lo, name: poiName(p), icon: poiIcon(p) }));
    return { ...stops[stops.length - 1], stops, title: t("nav_plan_n", { n: stops.length }) + " · " + cityName(c) };
  }
  const m = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(id);
  return m ? { lat: +m[1], lon: +m[2], name: t("nav_point"), icon: "pin" } : null;
}

function openNav(id) {
  const dest = navDest(id);
  if (!dest) { location.hash = "#home"; return; }
  navStop();
  const mode = store.get("safar_nav_mode", "walk");
  openModal(`
    <div class="nav-wrap">
      <div id="navMap"></div>
      <div class="nav-banner hidden" id="navBanner" aria-live="polite"></div>
      <div class="nav-sheet">
        <div class="nav-ends">
          <div class="nav-end"><i class="dot from"></i><span><small>${t("nav_from")}</small><b id="navFrom">${t("nav_me")}</b></span></div>
          <div class="nav-end"><i class="dot to"></i><span><small>${t("nav_to")}</small><b>${dest.stops ? `${icon("route")} ${esc(dest.title)}` : `${icon(dest.icon)} ${esc(dest.name)}`}</b></span></div>
        </div>
        <div class="seg nav-modes">
          <button type="button" data-nav-mode="walk" class="${mode === "walk" ? "active" : ""}">${icon("walk")} ${t("nav_walk")}</button>
          <button type="button" data-nav-mode="drive" class="${mode === "drive" ? "active" : ""}">${icon("car")} ${t("nav_drive")}</button>
        </div>
        <div class="nav-sum" id="navSum"><div class="skeleton"></div></div>
        <div class="nav-acts">
          <button type="button" class="btn gold-btn" id="navGo" disabled>${icon("nav-arrow")} ${t("nav_start")}</button>
          <button type="button" class="btn ghost" id="navVoice" aria-pressed="true">${icon("volume")} ${t("nav_voice")}</button>
          <a class="btn ghost" id="navTaxi" target="_blank" rel="noopener" data-track="taxi" data-key="app:taxi">${icon("taxi")} ${t("nav_taxi")}</a>
        </div>
        <details class="nav-steps"><summary>${icon("list")} ${t("nav_steps")}</summary><ol id="navSteps"></ol></details>
      </div>
    </div>`);
  const map = makeMap("navMap", { zoomControl: false }).setView([dest.lat, dest.lon], 15);
  NV = { dest, mode, map, via: [], voice: store.get("safar_nav_voice", true), spoken: new Set() };
  if (dest.stops) dest.stops.forEach((s, i) => L.marker([s.lat, s.lon], { icon: pin(`<span>${i + 1}</span>`, "num-pin") }).bindTooltip(esc(s.name)).addTo(map));
  else L.marker([dest.lat, dest.lon], { icon: destPin(dest.icon), zIndexOffset: 900 }).bindTooltip(esc(dest.name), { permanent: true, direction: "top", className: "dest-tip" }).addTo(map);
  navTaxi();
  $("#navVoice").setAttribute("aria-pressed", NV.voice);
  $("#navVoice").classList.toggle("off", !NV.voice);
  // Нет геолокации — откуда идём, выбираем нажатием на карту
  map.on("click", e => {
    if (NV.follow) return;
    NV.from = [e.latlng.lat, e.latlng.lng];
    if (dest.stops) NV.via = dest.stops.slice(0, -1);   // план дня: от выбранной точки через все места
    $("#navFrom").textContent = t("nav_point");
    navBuild();
  });
  const fromFirstStop = () => {
    const s = dest.stops;
    NV.from = [s[0].lat, s[0].lon];
    NV.via = s.slice(1, -1);
    $("#navFrom").innerHTML = `${icon(s[0].icon)} ${esc(s[0].name)}`;
    navBuild();
  };
  locate().then(p => {
    if (!NV || NV.from) return;
    if (dest.stops && km(p, dest.stops[0]) > 3) return fromFirstStop();
    NV.from = [p.lat, p.lon];
    if (dest.stops) NV.via = dest.stops.slice(0, -1);
    navBuild();
  }).catch(() => {
    if (NV && dest.stops) return fromFirstStop();
    $("#navSum").innerHTML = `<p class="nav-msg">${icon("crosshair")} ${t("nav_geo")}</p>`;
  });
}

async function navBuild() {
  if (!NV?.from) return;
  const { mode, from, dest } = NV, token = (NV.token = (NV.token || 0) + 1);
  $("#navSum").innerHTML = `<div class="skeleton"></div>`;
  $("#navGo").disabled = true;
  const straight = km({ lat: from[0], lon: from[1] }, dest);
  if (mode === "walk" && straight > 40) { $("#navSum").innerHTML = `<p class="nav-msg">${icon("info")} ${t("nav_far")}</p>`; return; }
  try {
    const route = await fetchRoute(from, [...NV.via.map(s => [s.lat, s.lon]), [dest.lat, dest.lon]], mode, NV.via.map(s => s.name));
    if (!NV || token !== NV.token) return;
    NV.route = route;
    navDraw();
    navTaxi();
    const min = navMinutes(route, mode);
    const arrive = new Date(Date.now() + min * 60e3).toLocaleTimeString(LOCALE[LANG], { hour: "2-digit", minute: "2-digit" });
    $("#navSum").innerHTML = `<b>${fmtTime(min)}</b><span>${fmtDist(route.distance)} · ${t("nav_arrive_at", { time: arrive })}</span>`;
    $("#navSteps").innerHTML = route.steps.map(s => `<li>${icon(s.ic)}<span>${s.text}</span>${s.distance ? `<small>${fmtDist(s.distance)}</small>` : ""}</li>`).join("");
    $("#navGo").disabled = false;
  } catch {
    if (NV && token === NV.token) $("#navSum").innerHTML = `<p class="nav-msg">${icon("wifi-off")} ${t("nav_fail")}</p>`;
  }
}

function navDraw() {
  const { map, route, from } = NV;
  NV.layer?.remove();
  NV.layer = L.layerGroup([
    L.polyline(route.line, { color: "#0b1f3a", weight: 9, opacity: .35 }),
    L.polyline(route.line, { color: NV.mode === "walk" ? "#1fa7bd" : "#e6b450", weight: 6, dashArray: NV.mode === "walk" ? "2 10" : null, lineCap: "round" })
  ]).addTo(map);
  navMe(from);
  if (!NV.follow) map.fitBounds(L.latLngBounds(route.line).pad(.15));
}
// Метка «я» со стрелкой направления
function navMe(pos, heading) {
  if (!NV) return;
  const html = `<div class="nav-me">${icon("nav-arrow")}</div>`;
  if (!NV.me) NV.me = L.marker(pos, { icon: L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] }), zIndexOffset: 1000 }).addTo(NV.map);
  else NV.me.setLatLng(pos);
  if (heading != null && isFinite(heading)) NV.me.getElement()?.querySelector(".i")?.style.setProperty("--hd", heading + "deg");
}

// ---------- Режим «Поехали» ----------
async function navStart() {
  if (!NV?.route) return;
  NV.follow = true;
  NV.spoken.clear();
  $(".nav-wrap").classList.add("following");
  $("#navGo").innerHTML = `${icon("x")} ${t("nav_stop")}`;
  try { NV.lock = await navigator.wakeLock?.request("screen"); } catch { /* экран может погаснуть */ }
  say(NV.route.steps[0]?.text);
  NV.watch = navigator.geolocation.watchPosition(navFix, () => toast(t("nav_geo")), { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  navBanner(NV.route.steps[1] || NV.route.steps[0], NV.route.steps[0]?.distance || 0, NV.route.distance);
}
function navStop() {
  if (!NV) return;
  if (NV.watch != null) navigator.geolocation.clearWatch(NV.watch);
  NV.lock?.release?.().catch(() => {});
  speechSynthesis?.cancel?.();
  NV.watch = NV.lock = null;
  NV.follow = false;
}
function navFinish() {
  navStop();
  $(".nav-wrap")?.classList.remove("following");
  $("#navBanner")?.classList.add("hidden");
  if ($("#navGo")) $("#navGo").innerHTML = `${icon("nav-arrow")} ${t("nav_start")}`;
}

async function navFix(p) {
  if (!NV?.route) return;
  const pos = [p.coords.latitude, p.coords.longitude];
  const heading = p.coords.heading ?? (NV.last ? bearing({ lat: NV.last[0], lon: NV.last[1] }, { lat: pos[0], lon: pos[1] }) : null);
  NV.last = pos;
  navMe(pos, heading);
  NV.map.setView(pos, NV.mode === "walk" ? 17 : 16, { animate: true });
  // У цели
  if (km({ lat: pos[0], lon: pos[1] }, NV.dest) * 1000 < 25) {
    navBanner(NV.route.steps[NV.route.steps.length - 1], 0, 0);
    say(navTx("arrive"));
    replay($("#navBanner"), "bump", 600);
    return navFinish();
  }
  if (NV.via.length && km({ lat: pos[0], lon: pos[1] }, NV.via[0]) * 1000 < 30) { NV.via.shift(); navTaxi(); }
  const near = nearestOnRoute(NV.route, pos);
  if (!near) return;
  // Сошли с маршрута: два замера подряд дальше порога — перестраиваем (не чаще раза в 15 секунд)
  if (near.off > (NV.mode === "walk" ? 35 : 60)) {
    NV.offCount = (NV.offCount || 0) + 1;
    if (NV.offCount >= 2 && Date.now() - (NV.rerouted || 0) > 15000) {
      NV.rerouted = Date.now(); NV.offCount = 0; NV.from = pos;
      $("#navBanner").innerHTML = `<div class="nb-ic">${icon("refresh")}</div><div class="nb-txt"><b>${t("nav_reroute")}</b></div>`;
      try {
        NV.route = await fetchRoute(pos, [...NV.via.map(s => [s.lat, s.lon]), [NV.dest.lat, NV.dest.lon]], NV.mode, NV.via.map(s => s.name));
        NV.spoken.clear();
        navDraw();
        navBanner(NV.route.steps[1] || NV.route.steps[0], NV.route.steps[0]?.distance || 0, NV.route.distance);
      } catch { /* попробуем при следующем замере */ }
    }
    return;
  }
  NV.offCount = 0;
  const next = NV.route.steps[near.step + 1];
  navBanner(next, near.toNext, near.left);
  // Голос: заранее и перед самым манёвром — по одному разу на шаг
  const far = NV.mode === "walk" ? 60 : 300, close = NV.mode === "walk" ? 15 : 60;
  if (next && near.toNext < far && !NV.spoken.has(near.step + ":far")) { NV.spoken.add(near.step + ":far"); say(navTx("in", { d: fmtDist(near.toNext), x: lowerFirst(next.text) })); }
  else if (next && near.toNext < close && !NV.spoken.has(near.step + ":now")) { NV.spoken.add(near.step + ":now"); say(next.text); }
}

function navBanner(step, toNext, left) {
  const el = $("#navBanner");
  if (!el || !step) return;
  const min = left / (NV.mode === "walk" ? 83 : 300);   // ~5 км/ч пешком, ~18 км/ч на машине в городе
  el.classList.remove("hidden");
  el.innerHTML = `<div class="nb-ic">${icon(step.ic)}</div>
    <div class="nb-txt"><b>${toNext > 20 ? fmtDist(toNext) : ""}</b><span>${step.text}</span></div>
    <div class="nb-left">${left ? `<b>${fmtTime(min)}</b><small>${fmtDist(left)}</small>` : ""}</div>`;
}

// Голосовые подсказки (если в системе есть синтез речи)
function say(text) {
  if (!NV?.voice || !text || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g, ""));
  u.lang = { uz: "uz-UZ", uzc: "uz-UZ", ru: "ru-RU", en: "en-US", tr: "tr-TR", de: "de-DE", zh: "zh-CN", ko: "ko-KR" }[LANG] || "ru-RU";
  const voices = speechSynthesis.getVoices();
  if (!voices.some(v => v.lang.startsWith(u.lang.slice(0, 2))) && LANG.startsWith("uz")) u.lang = "ru-RU";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ---------- Кнопки ----------
document.addEventListener("click", e => {
  if (!NV || !e.target.closest(".nav-wrap")) return;
  const mode = e.target.closest("[data-nav-mode]");
  if (mode && !NV.follow) {
    NV.mode = mode.dataset.navMode;
    store.set("safar_nav_mode", NV.mode);
    $$("[data-nav-mode]").forEach(b => b.classList.toggle("active", b === mode));
    return navBuild();
  }
  if (e.target.closest("#navGo")) return NV.follow ? navFinish() : navStart();
  const v = e.target.closest("#navVoice");
  if (v) {
    NV.voice = !NV.voice;
    store.set("safar_nav_voice", NV.voice);
    v.setAttribute("aria-pressed", NV.voice);
    v.classList.toggle("off", !NV.voice);
    v.innerHTML = `${icon(NV.voice ? "volume" : "volume-off")} ${t("nav_voice")}`;
    if (!NV.voice) speechSynthesis?.cancel?.();
  }
});

// Окно закрыли или открыли другое — останавливаем ведение и убираем карту
new MutationObserver(() => {
  if (NV && !document.getElementById("navMap")) { navStop(); NV.map?.remove(); NV = null; }
}).observe(document.getElementById("modalBody"), { childList: true });
new MutationObserver(() => {
  if (NV && $("#modal").classList.contains("hidden")) { navStop(); NV.map?.remove(); NV = null; }
}).observe(document.getElementById("modal"), { attributes: true, attributeFilter: ["class"] });

// Такси: Yandex Go с подставленными точками (откуда — где вы; куда — ближайшая остановка или цель)
function navTaxi() {
  const a = $("#navTaxi");
  if (!a || !NV) return;
  const to = NV.via[0] || NV.dest, from = NV.last || NV.from;
  a.href = "https://3.redirect.appmetrica.yandex.com/route?" + (from ? `start-lat=${from[0]}&start-lon=${from[1]}&` : "") +
    `end-lat=${to.lat}&end-lon=${to.lon}&level=econom&ref=safar&appmetrica_tracking_id=1178268795219780156`;
}

EXT.routes.nav = openNav;
// Ссылка на экран навигации до места, города или точки
const navHref = o => o.key?.startsWith("poi:") ? `#nav/p.${o.id}` : o.key?.startsWith("city:") ? `#nav/c.${o.id}` : `#nav/@${pt(o).lat.toFixed(6)},${pt(o).lon.toFixed(6)}`;
