// Простой режим приложения «Азербайджан» (включён по умолчанию): на виду только 4 главных дела —
// поговорить (переводчик), куда ехать (маршрут), такси и помощь (SOS). Всё остальное — в «Ещё».
// Внизу 5 кнопок вместо 7, без лишних сообщений; в переводчике — вкладки, в навигаторе способ выбирается сам.
// Полный режим — в «Ещё» и в аккаунте. Класс .simple на <html> ставится ещё в az.html (до отрисовки).
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const isSimple = () => store.get("az_simple", true) !== false;
const SM_TX = {
  hello: ["Чем помочь?", "How can we help?"], hello_sub: ["Нажмите на большую кнопку", "Tap a big button"],
  talk: ["Поговорить", "Talk"], talk_sub: ["Переводчик голосом", "Voice translator"],
  where: ["Куда ехать", "Where to go"], where_sub: ["Маршрут на карте", "Route on the map"],
  taxi: ["Такси", "Taxi"], taxi_sub: ["Показать водителю", "Show the driver"],
  sos: ["Помощь", "Help"], sos_sub: ["Скорая, полиция", "Ambulance, police"],
  back_hotel: ["Вернуться в отель", "Back to the hotel"], more: ["Ещё", "More"], more_all: ["Все возможности", "All features"],
  ready: ["Всё готово для поездки без интернета", "Ready for the trip without internet"],
  getting: ["Готовим всё для поездки без интернета…", "Getting ready for the trip without internet…"],
  where_title: ["Куда вы хотите поехать?", "Where do you want to go?"], taxi_title: ["Куда вас отвезти?", "Where should the taxi take you?"],
  search: ["Напишите место, улицу или город", "Type a place, street or city"], mine: ["Мои места", "My places"], popular: ["Часто ищут", "Popular"], found: ["Нашлось", "Found"],
  nothing: ["Ничего не нашлось. Попробуйте написать иначе.", "Nothing found. Try another spelling."],
  full: ["Полный режим (все функции)", "Full mode (all features)"], full_sub: ["Больше разделов и настроек — для тех, кому нужно всё", "More sections and settings — for those who want everything"],
  simple: ["Простой режим", "Simple mode"], simple_sub: ["Только главное: поговорить, куда ехать, такси, помощь", "Just the essentials: talk, where to go, taxi, help"],
  voice: ["Голос", "Voice"], photo: ["Фото", "Photo"], text: ["Текст", "Text"], phrases: ["Фразы", "Phrases"], other_way: ["Другой способ", "Another way"],
  m_map: ["Карта", "Map"], m_cities: ["Города", "Cities"], m_places: ["Места и цены", "Places and prices"], m_buses: ["Метро, автобусы, поезда", "Metro, buses, trains"],
  m_chat: ["Чат", "Chat"], m_pay: ["Как платить за проезд", "How to pay for transport"], m_trips: ["Куда съездить", "Day trips"], m_off: ["Без интернета", "Offline"],
  m_acc: ["Аккаунт и настройки", "Account and settings"]
};
const sm = k => SM_TX[k][LANG === "en" ? 1 : 0];
function setSimple(on) {
  store.set("az_simple", on);
  document.documentElement.classList.toggle("simple", on);
  location.hash = "#home";
  route();
}

// ---------- Главная ----------
function simpleHome() {
  const home = placesHome();
  const big = (href, ic, k, cls) => `<a class="sm-tile ${cls}" href="${href}"><i>${icon(ic)}</i><b>${sm(k)}</b><small>${sm(k + "_sub")}</small></a>`;
  setTimeout(simpleStatus, 50);
  return `<div class="sm-home">
    <h1 class="sm-hello">${sm("hello")}</h1>
    <div class="sm-tiles">
      ${big("#translate", "mic", "talk", "t-talk")}${big("#where", "directions", "where", "t-where")}
      ${big("#where/taxi", "car", "taxi", "t-taxi")}${big("#sos", "siren", "sos", "t-sos")}
    </div>
    ${home ? `<a class="sm-hotel" href="${goHref(home.la, home.lo, home.n)}">${icon("home")}<span><b>${sm("back_hotel")}</b><small>${esc(home.n)}</small></span>${icon("chevron-right", "go")}</a>` : ""}
    ${(c => c ? planRow(c.id, true) : "")(planCities()[0])}
    <p class="sm-status" id="smStatus"></p>
    <a class="sm-more" href="#more">${icon("grid")} ${sm("more_all")}</a>
  </div>`;
}
// Готово ли всё для работы без интернета: город, перевод по фото, переводчик
async function simpleStatus() {
  const el = $("#smStatus");
  if (!el) return;
  const city = Object.keys(offPacks()).some(id => mapPacks()[id]);
  const have = await mtDownloaded().catch(() => new Set()), mt = mtPairs().every(p => have.has(p)), ocr = await photoReadyCheck().catch(() => false);
  if (!$("#smStatus")) return;
  el.innerHTML = city && mt && ocr ? `${icon("check")} ${sm("ready")}` : navigator.onLine && autoOn() ? `${icon("download")} ${sm("getting")}` : "";
  el.classList.toggle("ok", city && mt && ocr);
  if (!(city && mt && ocr) && curHash === "#home") setTimeout(simpleStatus, 8000);
}

// ---------- «Куда ехать» и «Такси»: выбрать место (мои места, поиск, популярное) ----------
function whereScreen(sub) {
  const taxi = sub === "taxi";
  setTimeout(() => { whereList(""); $("#whereQ")?.focus({ preventScroll: true }); }, 30);
  return `${head(taxi ? "car" : "directions", sm(taxi ? "taxi_title" : "where_title"))}
    <input class="az-input sm-search" id="whereQ" type="search" autocomplete="off" placeholder="${esc(sm("search"))}" aria-label="${esc(sm("search"))}" data-where="${taxi ? "taxi" : ""}">
    <div id="whereList" class="list"></div>`;
}
function whereList(q) {
  const box = $("#whereList");
  if (!box) return;
  const taxi = $("#whereQ")?.dataset.where === "taxi";
  const href = (la, lo, n) => taxi ? taxiHref(la, lo, n) : goHref(la, lo, n);
  const row = (la, lo, n, sub, ic, color) => `<a class="az-row sm-row" href="${href(la, lo, n)}"><span class="az-pin big" style="background:${color}">${icon(ic)}</span><div><b>${esc(n)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>${icon("chevron-right", "go")}</a>`;
  const s = q.trim().toLowerCase();
  let html = "";
  const mine = placesAll().filter(p => !s || p.n.toLowerCase().includes(s));
  if (mine.length) html += `<h2 class="az-h2">${icon("star")} ${sm("mine")}</h2>` + mine.map(p => row(p.la, p.lo, p.n, p.k === "home" ? sm("back_hotel") : "", p.k === "home" ? "home" : "star", p.k === "home" ? "#1898ad" : "#c98f22")).join("");
  const near = USER_POS ? p => km(USER_POS, [p.la, p.lo]) : () => 0;
  const pois = s.length >= 2 ? smartFind(POIS, s, 25, (a, b) => fame(b) - fame(a) || near(a) - near(b))
    : POIS.filter(p => p.c === "a" && (!USER_POS || near(p) < 30)).sort((a, b) => fame(b) - fame(a)).slice(0, 12);
  const cities = s.length >= 2 ? smartFind(CITIES, s, 5, byPop) : [];
  if (cities.length || pois.length) html += `<h2 class="az-h2">${icon(s ? "search" : "star")} ${s ? sm("found") : sm("popular")}</h2>`;
  html += cities.map(c => row(c.lat, c.lon, cityName(c), LL("город", "city"), "city", "#24508f") + planRow(c.id, true)).join("");
  html += pois.map(p => row(p.la, p.lo, poiName(p), `${typeLabel(p.s)} · ${cityName(p.city)}${USER_POS ? " · " + fmtDist(near(p)) : ""}`, poiIcon(p), CAT_COLOR[p.c])).join("");
  box.innerHTML = html || `<p class="az-empty">${sm("nothing")}</p>`;
}
document.addEventListener("input", e => { if (e.target.id === "whereQ") whereList(e.target.value); });

// ---------- «Ещё»: всё остальное крупными строками ----------
function moreScreen() {
  const r = (href, ic, k) => row(href, ic, sm(k), "");
  return `${head("grid", sm("more"))}
    ${planCities().slice(0, 3).map(c => planRow(c.id, true)).join("")}
    ${row("#plan", "sparkles", pl("btn"), pl("btn_sub"))}
    ${r("#map", "map", "m_map")}${r("#places", "dome", "m_places")}${r("#cities", "city", "m_cities")}${r("#buses", "bus", "m_buses")}
    ${row("#mine", "star", sm("mine"), "")}${r("#chat", "message", "m_chat")}${r("#pay", "credit-card", "m_pay")}${r("#trips", "route", "m_trips")}
    ${r("#offline", "download", "m_off")}${r("#account", "user", "m_acc")}
    <button type="button" class="az-row sm-mode" data-simple-off>${icon("layers")}<div><b>${sm("full")}</b><small>${sm("full_sub")}</small></div>${icon("chevron-right", "go")}</button>`;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-simple-off]")) return setSimple(false);
  if (e.target.closest("[data-simple-on]")) return setSimple(true);
  // Переводчик в простом режиме: вкладки «Голос | Фото | Текст | Фразы»
  const tab = e.target.closest("[data-trsec-tab]");
  if (tab) {
    store.set("az_tr_tab", tab.dataset.trsecTab);
    $$("[data-trsec-tab]").forEach(b => { b.classList.toggle("on", b === tab); b.setAttribute("aria-selected", b === tab); });
    $$("[data-trsec]").forEach(s => s.classList.toggle("sm-show", s.dataset.trsec === tab.dataset.trsecTab));
    return;
  }
  // Навигатор: показать выбор способа (пешком / транспорт / машина)
  if (e.target.closest("[data-nav-other]")) { $("#navModes")?.classList.add("sm-open"); e.target.closest("[data-nav-other]").remove(); }
});
// Вкладки для экрана переводчика (в полном режиме их нет — всё на одном экране)
function trTabsHtml() {
  if (!isSimple()) return "";
  const cur = store.get("az_tr_tab", "voice");
  return `<div class="az-chips sm-trtabs" role="tablist">${[["voice", "mic"], ["photo", "camera"], ["text", "edit"], ["phrases", "message"]].map(([k, ic]) =>
    `<button type="button" role="tab" class="${k === cur ? "on" : ""}" aria-selected="${k === cur}" data-trsec-tab="${k}">${icon(ic)} ${sm(k)}</button>`).join("")}</div>`;
}
const trSecCls = k => isSimple() && store.get("az_tr_tab", "voice") === k ? "sm-show" : "";
