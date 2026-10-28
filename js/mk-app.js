/* ===================== Safar · Мекка и Медина — приложение =====================
   Вкладки: Главная · Святыни · Отели · SOS · Еда · Карта · Помощник. Стиль — как у узбекского Hamyol (css/style.css),
   свои детали — css/mecca.css. Данные — data/mk-*.js (OpenStreetMap, Wikidata). */
let mkTab = "home";
const MK_TABS = ["home", "holy", "hotels", "food", "map", "trip"];
const PAGE = 40;
const MK_TRIP_DEFAULTS = { stops: [], days: 1, people: 1, rooms: 1, hotel: 0, food: 0, transport: 0, extra: 0 };
let MK_TRIP = readTrip();

function readTrip() {
  const value = store.get("safar_mk_trip", {});
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const stops = Array.isArray(saved.stops)
    ? [...new Set(saved.stops.filter(id => typeof id === "string" && POI[id] && ["a", "h", "f", "s"].includes(POI[id].c)))]
    : [];
  const trip = { ...MK_TRIP_DEFAULTS, ...saved, stops };
  trip.start = typeof saved.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.start) ? saved.start : "";
  for (const key of ["days", "people", "rooms"]) {
    const max = key === "days" ? 60 : key === "rooms" ? 15 : 30;
    trip[key] = Math.max(1, Math.min(max, Math.floor(Number(trip[key]) || 1)));
  }
  for (const key of ["hotel", "food", "transport", "extra"]) {
    const amount = Number(trip[key]);
    trip[key] = Number.isFinite(amount) ? Math.max(0, Math.min(10000000, amount)) : 0;
  }
  return trip;
}

function saveTrip() {
  store.set("safar_mk_trip", MK_TRIP);
}

function addTripStop(id) {
  const place = POI[id];
  if (!place || !["a", "h", "f", "s"].includes(place.c) || MK_TRIP.stops.includes(id)) return;
  MK_TRIP.stops.push(id);
  saveTrip();
  toast(t("mka_trip_added"));
  renderTrip();
}

function tripTotal() {
  const nights = Math.max(0, MK_TRIP.days - 1);
  return nights * MK_TRIP.rooms * MK_TRIP.hotel
    + MK_TRIP.days * MK_TRIP.people * (MK_TRIP.food + MK_TRIP.transport)
    + MK_TRIP.extra;
}

function formatSAR(amount) {
  return new Intl.NumberFormat(NUM_LOCALE[LANG] || "ru-RU", {
    style: "currency", currency: "SAR", maximumFractionDigits: 0
  }).format(amount);
}

function renderTrip() {
  const list = MK_TRIP.stops.map(id => POI[id]).filter(Boolean);
  const routeStops = list.filter(place => Number.isFinite(Number(place.la)) && Number.isFinite(Number(place.lo)));
  $("#mkTripStops").innerHTML = list.length ? `<div class="list">${list.map((place, index) => `
    <div class="row mk-trip-stop">
      <div class="ico cat-${place.c}">${icon(mkIcon(place))}</div>
      <div><a href="#place/${place.id}"><h4>${index + 1}. ${esc(poiName(place))}</h4></a><div class="sub">${t("mka_trip_day", { n: Math.min(index + 1, MK_TRIP.days) })} · ${esc(cityName(place.city))}</div></div>
      <button type="button" class="icon-btn" data-mk-trip-remove="${esc(place.id)}" aria-label="${t("mka_trip_remove")}">${icon("x")}</button>
    </div>`).join("")}</div>` : `<p class="hint">${t("mka_trip_empty")}</p>`;
  $("#mkTripRoute").href = routeStops.length
    ? `https://www.google.com/maps/dir/?api=1&${routeStops.length > 1 ? `origin=${routeStops[0].la},${routeStops[0].lo}&` : ""}destination=${routeStops[routeStops.length - 1].la},${routeStops[routeStops.length - 1].lo}${routeStops.length > 2 ? `&waypoints=${routeStops.slice(1, -1).map(p => `${p.la},${p.lo}`).join("|")}` : ""}&travelmode=driving`
    : "#holy";
  $("#mkTripRoute").classList.toggle("disabled", !routeStops.length);
  $("#mkTripRoute").setAttribute("aria-disabled", String(!routeStops.length));
  $("#mkTripStart").value = MK_TRIP.start;
  for (const key of ["days", "people", "rooms", "hotel", "food", "transport", "extra"]) {
    const input = $(`#mkTrip${key[0].toUpperCase()}${key.slice(1)}`);
    if (input && document.activeElement !== input) input.value = MK_TRIP[key];
  }
  const total = tripTotal();
  $("#mkTripTotal").innerHTML = `<b>${t("mka_trip_total")}: ${formatSAR(total)}</b><span>${t("mka_trip_per_person")}: ${formatSAR(total / MK_TRIP.people)}</span>`;
}

// Главные точки отсчёта: Масджид аль-Харам и мечеть Пророка
const HARAM = POIS.find(p => /Grand Mosque of Mecca/i.test(p.n)) || { la: 21.4225, lo: 39.8262 };
const NABAWI = POIS.find(p => /^Prophet's Mosque$/i.test(p.n)) || { la: 24.4672, lo: 39.6111 };
const MECCA_C = CITIES.find(c => /^(mecca|makkah)/i.test(c.n.en)) || CITIES[0];
const MAIN_HOLY = [/Grand Mosque of Mecca/i, /^Kaaba$/i, /^Prophet's Mosque$/i, /QUBA Mosque/i, /Qiblatayn/i, /Jabal an Nur/i, /Jabal Thawr/i,
  /Summit Mount Uhud/i, /Jabal ar Rahmah/i, /^Mina$/i, /Muzdalifah/i, /Mash.ar al-Haram/i, /Al Khayf/i, /Sayeda Aisha/i, /Baqeea/i, /Clock Tower Museum/i]
  .map(re => POIS.find(p => p.c === "a" && re.test(p.n))).filter(Boolean);
const MAIN_RANK = new Map(MAIN_HOLY.map((p, i) => [p.id, i]));
const HOLY_KINDS = {
  all: null,
  mosques: ["mosque"],
  sacred: ["attraction", "peak", "cemetery", "tomb", "viewpoint"],
  museums: ["museum", "gallery"],
  history: ["ruins", "archaeological_site", "castle", "fort", "monument", "city_gate", "building"]
};
const TYPE_ICON_MK = { mosque: "minaret", peak: "mountain", cemetery: "flower", attraction: "star", museum: "sight", gallery: "gallery", viewpoint: "viewpoint",
  ruins: "ruins", archaeological_site: "pickaxe", castle: "castle", fort: "castle", monument: "monument", city_gate: "gate", tomb: "dome", building: "dome",
  theme_park: "theme-park", zoo: "zoo", hotel: "hotel", guest_house: "house", hostel: "bed", motel: "bed-single", apartment: "building",
  restaurant: "food", cafe: "coffee", marketplace: "basket", mall: "mall", department_store: "shopping", souvenir: "gift", gift: "gift", jewelry: "gem",
  spices: "flame", confectionery: "candy", tea: "teapot", carpet: "rug", art: "palette", craft: "scissors" };
const CAT_ICON_MK = { h: "hotel", a: "minaret", s: "shopping", f: "food" };
const mkIcon = p => TYPE_ICON_MK[p.s] || CAT_ICON_MK[p.c] || "pin";
const mkPhoto = (p, w) => p.im ? commonsImg(p.im, w) : "";
const dist = d => d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)} ${t("mka_m")}` : `${d < 10 ? d.toFixed(1) : Math.round(d)} ${t("mka_km")}`;
const MK_OFFLINE_CACHE = "safar-mecca-offline-v1";
const MK_OFFLINE_FILES = [
  "/mecca", "/css/style.css", "/css/mecca.css", "/icons/icon.svg",
  "/js/icons.js", "/js/i18n.js", "/js/i18n-extra.js", "/js/mk-i18n.js", "/js/mk-core.js",
  "/js/consent.js", "/js/region-switch.js", "/js/translate-data.js", "/js/translate.js", "/js/docs.js", "/js/sos.js", "/js/mecca.js", "/js/mk-app.js",
  "/data/mk-cities.js", "/data/mk-pois.js", "/data/mk-services.js"
];
async function saveMeccaOffline(btn) {
  if (!("caches" in window) || !("serviceWorker" in navigator)) return toast(t("mka_offline_error"));
  btn.disabled = true;
  const label = btn.querySelector("small");
  if (label) label.textContent = t("mka_offline_loading");
  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error("Service worker is not active");
    const responses = await Promise.all(MK_OFFLINE_FILES.map(async path => {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return [path, response];
    }));
    const cache = await caches.open(MK_OFFLINE_CACHE);
    await Promise.all(responses.map(([path, response]) => cache.put(path, response)));
    if (label) label.textContent = t("mka_offline_saved");
    toast(t("mka_offline_done"));
  } catch (error) {
    console.error("Не удалось сохранить офлайн-набор Мекки и Медины", error);
    if (label) label.textContent = t("mka_offline_sub");
    toast(t("mka_offline_error"));
  } finally {
    btn.disabled = false;
  }
}
// До Харама (Мекка) или до мечети Пророка (Медина) — то, что паломнику важнее всего у отеля
function anchorOf(p) {
  const dh = km(p, HARAM), dn = km(p, NABAWI);
  if (Math.min(dh, dn) < 0.5 && p.c === "a") return null;   // сама мечеть и то, что внутри неё
  if (dh < 25 && dh <= dn) return ["mka_to_haram", dh];
  if (dn < 25) return ["mka_to_nabawi", dn];
  return null;
}
const anchorTag = p => { const a = anchorOf(p); return a ? `<span class="mk-anchor">${icon("minaret")} ${t(a[0], { d: dist(a[1]) })}</span>` : ""; };

// ---------- Избранное (своё у Мекки) ----------
let MK_FAVS = new Set(store.get("mk_favs", []));
const mkHeart = key => `<button type="button" class="heart ${MK_FAVS.has(key) ? "on" : ""}" data-mkfav="${esc(key)}" aria-label="${t("mka_save")}">${icon("heart")}</button>`;
function toggleMkFav(key) {
  MK_FAVS.has(key) ? MK_FAVS.delete(key) : MK_FAVS.add(key);
  store.set("mk_favs", [...MK_FAVS]);
  $$(`[data-mkfav="${CSS.escape(key)}"]`).forEach(b => {
    b.classList.toggle("on", MK_FAVS.has(key));
    const s = b.querySelector("span"); if (s) s.textContent = t(MK_FAVS.has(key) ? "mka_saved" : "mka_save");
  });
  toast(t(MK_FAVS.has(key) ? "mka_saved" : "mka_save"));
}

// ---------- Строка списка (как в узбекском Safar) ----------
function mkRow(p) {
  const ph = mkPhoto(p, 160);
  const ico = ph ? `<div class="ico img" style="background-image:url('${ph}')"></div>` : `<div class="ico cat-${p.c}">${icon(mkIcon(p))}</div>`;
  const stars = p.st ? ` <span class="stars gold">${icon("star", "fill").repeat(p.st)}</span>` : "";
  const extra = [p.ad && `<span>${icon("pin")} ${esc(p.ad)}</span>`, p.oh && `<span>${icon("clock")} ${esc(p.oh)}</span>`].filter(Boolean).join("");
  return `
    <div class="row" data-go="#place/${p.id}" tabindex="0" role="link">
      ${ico}
      <div>
        <h4>${esc(poiName(p))}${stars}<span class="badge type">${typeLabel(p.s)}</span></h4>
        ${p.na && p.na !== poiName(p) ? `<div class="mk-ar" dir="rtl" lang="ar">${esc(p.na)}</div>` : ""}
        <div class="sub"><span>${icon("city")} ${esc(cityName(p.city))}</span> ${anchorTag(p)}${userPos ? ` <span class="dist">${icon("locate")} ${dist(km(userPos, p))}</span>` : ""}</div>
        ${extra ? `<div class="sub">${extra}</div>` : ""}
        <div class="acts">
          ${["a", "h", "f", "s"].includes(p.c) ? `<button type="button" class="btn small ghost" data-mk-trip-add="${esc(p.id)}">${icon("route")} ${t("mka_trip_add_stop")}</button>` : ""}
          ${p.c === "h" ? `<a class="btn small gold-btn" href="${bookingUrl(p)}" target="_blank" rel="noopener">${icon("search")} ${t("mka_booking")}</a>` : ""}
          ${p.ph ? `<a class="btn small ghost" href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${icon("phone")} ${esc(p.ph)}</a>` : ""}
          <a class="btn small ghost" href="${dirUrl(p)}" target="_blank" rel="noopener">${icon("directions")} ${t("mka_route")}</a>
        </div>
      </div>
      <div class="side">${mkHeart(p.key)}</div>
    </div>`;
}
const bookingUrl = p => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(poiName(p) + ", " + p.city.n.en)}`;
const dirUrl = p => `https://www.google.com/maps/dir/?api=1&destination=${p.la},${p.lo}&travelmode=walking`;
const gmapsUrl = p => `https://www.google.com/maps/search/?api=1&query=${p.la},${p.lo}`;
const uberUrl = p => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${p.la}&dropoff[longitude]=${p.lo}`;

// Список с «Показать ещё»
function paged(box, items, render) {
  let shown = 0;
  const more = () => {
    box.querySelector(".mk-more")?.remove();
    box.insertAdjacentHTML("beforeend", items.slice(shown, shown + PAGE).map(render).join(""));
    shown += PAGE;
    if (shown < items.length) box.insertAdjacentHTML("beforeend", `<button type="button" class="btn ghost mk-more">${icon("chevron-down")} ${t("mka_more")} (${items.length - shown})</button>`);
  };
  box.innerHTML = items.length ? "" : `<p class="hint mk-empty">${t("mka_empty")}</p>`;
  box.onclick = e => { if (e.target.closest(".mk-more")) more(); };
  if (items.length) more();
}

const cityOptions = sel => {
  const cur = sel.value;
  sel.innerHTML = `<option value="">${t("mka_all_cities")}</option>` + CITIES.filter(c => c.counts.h + c.counts.a + c.counts.f + c.counts.s > 0)
    .map(c => `<option value="${c.id}">${esc(cityName(c))} (${c.counts.h + c.counts.a + c.counts.f + c.counts.s})</option>`).join("");
  sel.value = cur;
};
const qMatch = (p, q) => !q || p.hay.includes(q);

// ---------- Святыни ----------
let holyKind = "all";
function renderHoly() {
  $("#holyKinds").innerHTML = Object.keys(HOLY_KINDS).map(k => `<button type="button" class="chip ${k === holyKind ? "on" : ""}" data-holy-kind="${k}">${t(k === "all" ? "mka_all" : "mka_f_" + k)}</button>`).join("");
  const q = $("#holyQ").value.trim().toLowerCase(), city = $("#holyCity").value, kinds = HOLY_KINDS[holyKind];
  const list = POIS.filter(p => p.c === "a" && !/^(theme_park|zoo)$/.test(p.s) && (!kinds || kinds.includes(p.s)) && (!city || p.city.id === city) && qMatch(p, q))
    .sort((a, b) => (MAIN_RANK.get(a.id) ?? 999) - (MAIN_RANK.get(b.id) ?? 999) || (b.fm || 0) - (a.fm || 0) || (b.im ? 1 : 0) - (a.im ? 1 : 0));
  $("#holyFound").textContent = t("mka_found", { n: fmtNum(list.length) });
  paged($("#holyList"), list, mkRow);
}

// ---------- Отели ----------
function renderHotels() {
  const q = $("#hotelQ").value.trim().toLowerCase(), city = $("#hotelCity").value, sort = $("#hotelSort").value;
  const list = POIS.filter(p => p.c === "h" && (!city || p.city.id === city) && qMatch(p, q));
  const near = p => anchorOf(p)?.[1] ?? 999;
  list.sort(sort === "stars" ? (a, b) => (b.st || 0) - (a.st || 0) || near(a) - near(b)
    : sort === "name" ? (a, b) => poiName(a).localeCompare(poiName(b))
    : sort === "me" && userPos ? (a, b) => km(userPos, a) - km(userPos, b)
    : (a, b) => near(a) - near(b));
  $("#hotelFound").textContent = t("mka_found", { n: fmtNum(list.length) });
  paged($("#hotelList"), list, mkRow);
}

// ---------- Еда и рынки ----------
let foodKind = "food";
function renderFood() {
  $("#foodKinds").innerHTML = ["food", "shops"].map(k => `<button type="button" class="chip ${k === foodKind ? "on" : ""}" data-food-kind="${k}">${t("mka_f_" + k)}</button>`).join("");
  const q = $("#foodQ").value.trim().toLowerCase(), city = $("#foodCity").value, cat = foodKind === "food" ? "f" : "s";
  const list = POIS.filter(p => p.c === cat && (!city || p.city.id === city) && qMatch(p, q))
    .sort((a, b) => userPos ? km(userPos, a) - km(userPos, b) : (anchorOf(a)?.[1] ?? 999) - (anchorOf(b)?.[1] ?? 999));
  $("#foodFound").textContent = t("mka_found", { n: fmtNum(list.length) });
  paged($("#foodList"), list, mkRow);
}

// ---------- Главная ----------
function renderHome() {
  const img = MECCA_C?.img ? commonsImg(MECCA_C.img, Math.min(1600, Math.round(innerWidth * (devicePixelRatio || 1)))) : "";
  if (img) $("#mkHero").style.backgroundImage = `linear-gradient(180deg, rgba(6,38,30,.35), rgba(6,38,30,.85)), url('${img}')`;
  $("#mkFacts").textContent = t("mka_stats", { c: fmtNum(CITIES.length), p: fmtNum(POIS.length) });
  const tool = (attr, ic, title, sub, cls = "") => `<${attr.startsWith("href") ? "a" : "button type=\"button\""} class="mk-tile ${cls}" ${attr}><i>${icon(ic)}</i><b>${title}</b><small>${sub}</small></${attr.startsWith("href") ? "a" : "button"}>`;
  const L = store.get("safar_lost", {});
  $("#mkTools").innerHTML = [
    tool('href="#sos"', "siren", "SOS", "911 · 997 · 999", "mk-sos"),
    tool("data-mk-lost-show", "hand-helping", t("mk_lost"), L.hotel ? esc(L.hotel) : t("mk_lost_sub"), "mk-lost"),
    tool('href="#translate"', "languages", t("tr_title"), t("mk_tr_sub"), "mk-tr"),
    tool('href="#translate/phrases"', "book", t("tr_phrases"), t("mk_phrases_sub")),
    tool('href="#trip"', "route", t("mka_nav_trip"), t("mka_trip_hint")),
    tool('href="#mecca"', "clock", t("mk_prayer"), t("mka_prayer_tile")),
    tool('href="#mecca"', "hotel", t("mk_hotel"), L.pos ? t("mk_hotel_go") : t("mk_hotel_save")),
    tool("data-mk-offline", "download", t("mka_offline_title"), t("mka_offline_sub")),
    tool('href="#docs"', "folder-lock", t("doc_short"), t("mk_docs_sub")),
    tool("data-med-show", "heart-pulse", t("med_title"), t("mk_med_sub"))
  ].join("");
  $("#mkHolyStrip").innerHTML = MAIN_HOLY.map(p => `
    <a class="mk-card" href="#place/${p.id}">
      <span class="mk-card-img" style="${mkPhoto(p, 480) ? `background-image:url('${mkPhoto(p, 480)}')` : ""}">${mkPhoto(p, 480) ? "" : icon(mkIcon(p))}</span>
      <b>${esc(poiName(p))}</b><small>${typeLabel(p.s)} · ${esc(cityName(p.city))}</small></a>`).join("");
  $("#mkCityStrip").innerHTML = CITIES.slice(0, 12).map(c => `
    <a class="mk-card" href="#city/${c.id}">
      <span class="mk-card-img" style="${c.img ? `background-image:url('${commonsImg(c.img, 480)}')` : ""}">${c.img ? "" : icon("city")}</span>
      <b>${esc(cityName(c))}</b><small>${t("mka_counts", { h: c.counts.h, a: c.counts.a, f: c.counts.f })}</small></a>`).join("");
  renderPrayerCard();
}

// Ближайший намаз — прямо на главной (расписание на месяц хранится на телефоне, js/mecca.js)
async function renderPrayerCard() {
  const box = $("#mkPrayerBox");
  if (!box || typeof mkPrayerMonth !== "function") return;
  const city = store.get("safar_mk_city", "mecca"), now = riyadhNow();
  let month = null;
  try { month = await mkPrayerMonth(city, now.getUTCFullYear(), now.getUTCMonth() + 1); } catch { /* без сети */ }
  const dd = String(now.getUTCDate()).padStart(2, "0"), today = month?.find(d => d.g.startsWith(dd + "-"));
  if (!today) { box.innerHTML = ""; return; }
  const hm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const next = PRAYERS.find(([k]) => k !== "Sunrise" && today.t[k] > hm) || PRAYERS[0];
  box.innerHTML = `
    <a class="mk-prayer" href="#mecca">
      <span class="mk-prayer-ic">${icon("clock")}</span>
      <span><small>${t("mka_next_prayer")} · ${t("mk_" + city)}</small><b>${t("nm_" + next[1])} · ${today.t[next[0]]}</b><em>${esc(today.h)} · ${t("mka_prayer_tile")}</em></span>
      ${icon("chevron-right")}
    </a>`;
}

// ---------- Поиск на главной ----------
function mkSearch() {
  const q = $("#mkSearch").value.trim().toLowerCase(), box = $("#mkResults");
  if (q.length < 2) { box.classList.add("hidden"); return; }
  const cities = CITIES.filter(c => [c.n.ru, c.n.en, c.n.uz, c.n.ar].join(" ").toLowerCase().includes(q)).slice(0, 4);
  const pois = POIS.filter(p => p.hay.includes(q)).sort((a, b) => (MAIN_RANK.get(a.id) ?? 999) - (MAIN_RANK.get(b.id) ?? 999) || (b.fm || 0) - (a.fm || 0)).slice(0, 10);
  box.innerHTML = [...cities.map(c => `<div class="sr-item" data-go="#city/${c.id}" tabindex="0"><span class="ic">${icon("city")}</span><div>${esc(cityName(c))}</div></div>`),
    ...pois.map(p => `<div class="sr-item" data-go="#place/${p.id}" tabindex="0"><span class="ic">${icon(mkIcon(p))}</span><div>${esc(poiName(p))}<small>${typeLabel(p.s)} · ${esc(cityName(p.city))}</small></div></div>`)]
    .join("") || `<div class="sr-item">${t("mka_empty")}</div>`;
  box.classList.remove("hidden");
}

// ---------- Страница места ----------
async function openPlace(p) {
  const ph = mkPhoto(p, 960), a = anchorOf(p), web = /^https?:\/\//.test(p.w || "") ? p.w : "";
  const call = p.ph ? `<a class="pl-act" href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}"><i>${icon("phone")}</i><span>${t("mka_call")}</span></a>`
    : p.c === "h" ? `<a class="pl-act" href="${bookingUrl(p)}" target="_blank" rel="noopener"><i>${icon("search")}</i><span>Booking</span></a>`
    : web ? `<a class="pl-act" href="${esc(web)}" target="_blank" rel="noopener"><i>${icon("globe")}</i><span>${t("mka_site")}</span></a>` : "";
  const facts = [
    p.ad && [t("mka_address"), esc(p.ad)], p.oh && [t("mka_hours"), esc(p.oh)], p.ph && [t("mka_phone"), `<a href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${esc(p.ph)}</a>`],
    web && [t("mka_site"), `<a href="${esc(web)}" target="_blank" rel="noopener">${esc(web.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40))}</a>`]
  ].filter(Boolean);
  openModal(`
    <div class="m-head mk-phead ${ph ? "has-photo" : ""}" style="${ph ? `background-image:linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.75)), url('${ph}')` : ""}">
      <h2>${esc(poiName(p))}</h2>
      ${p.na && p.na !== poiName(p) ? `<p class="mk-ar-head" dir="rtl" lang="ar">${esc(p.na)}</p>` : ""}
      <p>${typeLabel(p.s)} · <a href="#city/${p.city.id}" style="color:#fff">${esc(cityName(p.city))}</a>${p.st ? ` · ${"★".repeat(p.st)}` : ""}</p>
      ${ph ? `<small class="mk-credit">${t("mka_photo_src")}</small>` : ""}
    </div>
    <div class="m-body">
      ${a ? `<p class="mk-anchor-big">${icon("minaret")} ${t(a[0], { d: dist(a[1]) })}</p>` : ""}
      <div class="pl-acts" style="--n:${call ? 5 : 4}">
        <a class="pl-act main" href="${dirUrl(p)}" target="_blank" rel="noopener"><i>${icon("directions")}</i><span>${t("mka_route")}</span></a>
        <button type="button" class="pl-act ${MK_FAVS.has(p.key) ? "on" : ""}" data-mkfav="${esc(p.key)}"><i>${icon("heart")}</i><span>${t(MK_FAVS.has(p.key) ? "mka_saved" : "mka_save")}</span></button>
        ${["a", "h", "f", "s"].includes(p.c) ? `<button type="button" class="pl-act" data-mk-trip-add="${esc(p.id)}"><i>${icon("route")}</i><span>${t("mka_trip_add_stop")}</span></button>` : ""}
        ${call}
        <a class="pl-act" href="${uberUrl(p)}" target="_blank" rel="noopener"><i>${icon("taxi")}</i><span>${t("mka_taxi")}</span></a>
      </div>
      <div class="pl-more">
        <button type="button" data-mk-fly="${p.id}">${icon("map")} ${t("mka_on_map")}</button>
        <button type="button" data-mk-taxicard="${p.id}">${icon("taxi")} ${t("mka_taxi_card")}</button>
        <button type="button" data-mk-share="${p.id}">${icon("share")} ${t("mka_share")}</button>
        <a href="${gmapsUrl(p)}" target="_blank" rel="noopener">${icon("external")} Google Maps</a>
      </div>
      ${facts.length ? `<div class="facts">${facts.map(([k, v]) => `<div class="fact"><small>${k}</small><b dir="auto">${v}</b></div>`).join("")}</div>` : ""}
      <section class="mk-about" id="mkAbout"></section>
      <div id="miniMap" class="mini-map"></div>
    </div>`);
  setTimeout(() => {
    if (!$("#miniMap") || typeof L === "undefined") return;
    miniMap = makeMap("miniMap", { scrollWheelZoom: false }).setView([p.la, p.lo], 16);
    L.marker([p.la, p.lo], { icon: L.divIcon({ className: "dest-pin", html: `<span>${icon(mkIcon(p))}</span>`, iconSize: [36, 44], iconAnchor: [18, 44] }) }).addTo(miniMap);
  }, 60);
  mkWiki(p);
}

// Описание из Википедии — на языке приложения, если статья есть (иначе английская); кэш на телефоне
async function mkWiki(p) {
  const box = $("#mkAbout");
  if (!box) return;
  const lang = { uzc: "uz" }[LANG] || LANG, key = `mk_wiki_${p.id}_${lang}`, cached = store.get(key, null);
  const show = w => { if (w?.extract && $("#mkAbout") === box) box.innerHTML = `<h3 class="sec-title">${icon("book")} ${t("mka_about")}</h3><p>${esc(w.extract)}</p><small class="hint">${t("mka_wiki_src")}</small>`; };
  if (cached) return show(cached);
  if (!navigator.onLine || (!p.wd && !p.wp)) return;
  try {
    let title = null, wl = null;
    if (p.wd) {
      const j = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${p.wd}&props=sitelinks&sitefilter=${lang}wiki|enwiki&format=json&origin=*`, { signal: AbortSignal.timeout(8000) })).json();
      const sl = j.entities?.[p.wd]?.sitelinks || {};
      if (sl[lang + "wiki"]) { title = sl[lang + "wiki"].title; wl = lang; } else if (sl.enwiki) { title = sl.enwiki.title; wl = "en"; }
    }
    if (!title && p.wp) { const [l, ...r] = p.wp.split(":"); wl = l; title = r.join(":"); }
    if (!title) return;
    const s = await (await fetch(`https://${wl}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(8000) })).json();
    if (s.extract) { store.set(key, { extract: s.extract }); show(s); }
  } catch { /* без описания */ }
}

// «Показать таксисту» — по-арабски и по-английски, крупно, экран не гаснет
function mkTaxiCard(p) {
  const ar = p.na || p.n, en = p.ne || p.n, city = [p.city.n.ar || p.city.n.en, p.city.n.en];
  document.body.insertAdjacentHTML("beforeend", `
    <div id="taxiCard" class="tc" role="dialog" aria-modal="true">
      <button type="button" class="tc-x" data-mk-tc-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <p class="tc-hint">${t("mka_taxi_hint")}</p>
      <p class="tc-ask" dir="rtl" lang="ar">من فضلك، خذني إلى هنا:</p>
      <h2 dir="rtl" lang="ar">${esc(ar)}</h2>
      <p class="tc-city" dir="rtl" lang="ar">${esc(city[0])}</p>
      <p class="tc-ask">Please take me here:</p>
      <h2>${esc(en)}</h2>
      <p class="tc-city">${esc(city[1])}</p>
      ${p.ad ? `<p class="tc-addr">${esc(p.ad)}</p>` : ""}
    </div>`);
  try { navigator.wakeLock?.request("screen").then(l => ($("#taxiCard") ? ($("#taxiCard")._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function mkTaxiClose() { const el = $("#taxiCard"); if (!el) return; el._lock?.release?.(); el.classList.add("out"); setTimeout(() => el.remove(), 240); }

// ---------- Страница города ----------
function openCity(c) {
  const holy = POIS.filter(p => p.city === c && p.c === "a").sort((a, b) => (MAIN_RANK.get(a.id) ?? 999) - (MAIN_RANK.get(b.id) ?? 999) || (b.fm || 0) - (a.fm || 0)).slice(0, 8);
  const hotels = POIS.filter(p => p.city === c && p.c === "h").sort((a, b) => (anchorOf(a)?.[1] ?? km(a, c)) - (anchorOf(b)?.[1] ?? km(b, c))).slice(0, 6);
  openModal(`
    <div class="m-head mk-phead ${c.img ? "has-photo" : ""}" style="${c.img ? `background-image:linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.75)), url('${commonsImg(c.img, 960)}')` : ""}">
      <h2>${esc(cityName(c))}</h2>
      ${c.n.ar ? `<p class="mk-ar-head" dir="rtl" lang="ar">${esc(c.n.ar)}</p>` : ""}
      <p>${t("mka_counts", { h: c.counts.h, a: c.counts.a, f: c.counts.f })}</p>
    </div>
    <div class="m-body">
      ${holy.length ? `<h3 class="sec-title">${icon("minaret")} ${t("mka_city_holy")}</h3><div class="list">${holy.map(mkRow).join("")}</div>` : ""}
      ${hotels.length ? `<h3 class="sec-title">${icon("hotel")} ${t("mka_city_hotels")}</h3><div class="list">${hotels.map(mkRow).join("")}</div>` : ""}
      <div class="sos-links">
        <a class="btn ghost" href="#hotels" data-mk-city-filter="${c.id}" data-target="hotel">${icon("hotel")} ${t("mka_nav_hotels")}</a>
        <a class="btn ghost" href="#food" data-mk-city-filter="${c.id}" data-target="food">${icon("food")} ${t("mka_nav_food")}</a>
      </div>
    </div>`);
}

// ---------- Карта ----------
let mkMap = null, mkLayers = {}, mkLayerOn = store.get("mk_layers", { a: true, h: false, f: false });
function initMap() {
  if (mkMap || typeof L === "undefined") return;
  mkMap = makeMap("mkMap", { preferCanvas: true }).setView([HARAM.la, HARAM.lo], 14);
  const mk = (p, cls) => L.marker([p.la, p.lo], { icon: L.divIcon({ className: "pin pin-" + p.c + " " + cls, html: icon(mkIcon(p)), iconSize: [28, 28], iconAnchor: [14, 14] }) })
    .bindPopup(`<b>${esc(poiName(p))}</b><br><small>${typeLabel(p.s)}</small><br><a href="#place/${p.id}">${t("mka_about")} →</a>`);
  const group = cat => {
    const g = L.markerClusterGroup ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 }) : L.layerGroup();
    POIS.filter(p => p.c === cat || (cat === "f" && p.c === "s")).forEach(p => g.addLayer(mk(p, "")));
    return g;
  };
  mkLayers.a = L.layerGroup(POIS.filter(p => p.c === "a" && !/^(theme_park|zoo)$/.test(p.s)).map(p => mk(p, MAIN_RANK.has(p.id) ? "mk-main-pin" : "")));
  mkLayers.h = group("h");
  mkLayers.f = group("f");
  for (const k in mkLayers) if (mkLayerOn[k]) mkLayers[k].addTo(mkMap);
  renderLayerChips();
}
function renderLayerChips() {
  const names = { a: t("mka_nav_holy"), h: t("mka_nav_hotels"), f: t("mka_nav_food") }, ic = { a: "minaret", h: "hotel", f: "food" };
  $("#mapLayers").innerHTML = Object.keys(names).map(k => `<button type="button" class="chip ${mkLayerOn[k] ? "on" : ""}" data-layer="${k}">${icon(ic[k])} ${names[k]}</button>`).join("")
    + `<button type="button" class="chip" data-mk-locate>${icon("locate")} ${t("mka_locate")}</button>`;
}

// ---------- Аккаунт: направление, язык, тема, сохранённое ----------
function openAccount() {
  const favs = [...MK_FAVS].map(k => POI[k.replace(/^poi:/, "")]).filter(Boolean);
  openModal(`
    <div class="m-head mc-head"><h2>${icon("user")} ${t("mka_account")}</h2></div>
    <div class="m-body">
      <h3 class="sec-title">${icon("compass")} ${t("mka_direction")}</h3>
      <div class="rg-opts mk-dir">
        <div class="rg-opt rg-mecca rg-current"><span class="rg-flag">🕋</span><b>${t("mka_title")}</b><small>${t("mka_now_mecca")}</small></div>
        <button type="button" class="rg-opt rg-uz" data-pick-region="uz"><span class="rg-flag">🇺🇿</span><b>${t("mka_go_uz")}</b><small>${t("mka_go_uz_sub")}</small></button>
        <button type="button" class="rg-opt rg-az" data-pick-region="az"><span class="rg-flag">🇦🇿</span><b>${t("mka_go_az")}</b><small>${t("mka_go_az_sub")}</small></button>
      </div>
      <h3 class="sec-title">${icon("languages")} ${t("mka_language")}</h3>
      <div class="chips">${Object.entries(LANGS).map(([k, n]) => `<button type="button" class="chip ${k === LANG ? "on" : ""}" data-mk-lang="${k}">${n}</button>`).join("")}</div>
      <h3 class="sec-title">${icon("moon")} ${t("mka_theme")}</h3>
      <div class="chips"><button type="button" class="chip ${!isDark() ? "on" : ""}" data-mk-theme="light">${icon("sun")} ${t("mka_light")}</button><button type="button" class="chip ${isDark() ? "on" : ""}" data-mk-theme="dark">${icon("moon")} ${t("mka_dark")}</button></div>
      <h3 class="sec-title">${icon("download")} ${t("mka_offline_title")}</h3>
      <p class="hint">${t("mka_offline_acc")}</p>
      <button type="button" class="btn gold-btn mk-wide" data-mk-offline>${icon("download")} <span>${t("mka_offline_title")}</span> <small>${t("mka_offline_sub")}</small></button>
      <a class="btn ghost mk-wide" href="#translate">${icon("languages")} ${t("tr_dl_lang")}</a>
      <h3 class="sec-title">${icon("heart")} ${t("mka_favs")}</h3>
      ${favs.length ? `<div class="list">${favs.map(mkRow).join("")}</div>` : `<p class="hint">${t("mka_favs_empty")}</p>`}
      <p class="hint mk-src"><a href="/#privacy">${t("legal_privacy_gen") || "Privacy"}</a> · ${t("mka_data_src")}</p>
    </div>`);
}

// ---------- Язык ----------
function fillLang() {
  const s = $("#langSelect");
  s.innerHTML = Object.entries(LANGS).map(([k, n]) => `<option value="${k}">${n}</option>`).join("");
  s.value = LANG;
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem("safar_lang", l); } catch { /* приватный режим */ }
  applyI18n();
  fillLang();
  [$("#holyCity"), $("#hotelCity"), $("#foodCity")].forEach(cityOptions);
  fillHotelSort();
  renderCurrent();
  EXT.onLang.forEach(fn => fn());
  document.title = t("mka_title") + " — Hamyol";
  if (!$("#modal").classList.contains("hidden")) route();
}
function fillHotelSort() {
  const s = $("#hotelSort"), cur = s.value || "near";
  s.innerHTML = [["near", "mka_sort_near_haram"], ["stars", "mka_sort_stars"], ["name", "mka_sort_name"], ["me", "mka_near_me"]].map(([v, k]) => `<option value="${v}">${t(k)}</option>`).join("");
  s.value = cur;
}

// ---------- Маршрутизация ----------
const rendered = {};
function renderCurrent() {
  ({ home: renderHome, holy: renderHoly, hotels: renderHotels, food: renderFood, map: initMap, trip: renderTrip })[mkTab]?.();
  rendered[mkTab] = true;
}
function showTab(name) {
  mkTab = name;
  $$(".tab").forEach(s => s.classList.toggle("active", s.id === "tab-" + name));
  $$("[data-tab]").forEach(a => a.classList.toggle("active", a.dataset.tab === name));
  if (!rendered[name] || name === "home") renderCurrent();
  if (name === "map" && mkMap) setTimeout(() => mkMap.invalidateSize(), 60);
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || "home";
  const [kind, id] = h.split("/");
  $$("#bottomNav [data-tab]").forEach(a => a.classList.toggle("active", a.dataset.tab === (kind === "mecca" ? "help" : kind)));
  if (MK_TABS.includes(kind)) { closeModal(false); showTab(kind); window.scrollTo({ top: 0 }); return; }
  if (!$$(".tab.active").length) showTab("home");
  if (kind === "place" && POI[id]) return openPlace(POI[id]);
  if (kind === "city" && CITY[id]) return openCity(CITY[id]);
  if (kind === "account") return openAccount();
  if (kind === "privacy" || kind === "terms") { location.href = "/#" + kind; return; }
  if (EXT.routes[kind]) return EXT.routes[kind](id);
  closeModal(false);
  showTab("home");
}

// ---------- События ----------
document.addEventListener("click", e => {
  const go = e.target.closest("[data-go]");
  if (go && !e.target.closest("a, button")) { location.hash = go.dataset.go; return; }
  const addTrip = e.target.closest("[data-mk-trip-add]");
  if (addTrip) { e.preventDefault(); e.stopPropagation(); return addTripStop(addTrip.dataset.mkTripAdd); }
  const removeTrip = e.target.closest("[data-mk-trip-remove]");
  if (removeTrip) {
    MK_TRIP.stops = MK_TRIP.stops.filter(id => id !== removeTrip.dataset.mkTripRemove);
    saveTrip();
    toast(t("mka_trip_removed"));
    return renderTrip();
  }
  const fav = e.target.closest("[data-mkfav]");
  if (fav) { e.preventDefault(); e.stopPropagation(); return toggleMkFav(fav.dataset.mkfav); }
  const fly = e.target.closest("[data-mk-fly]");
  if (fly) { const p = POI[fly.dataset.mkFly]; location.hash = "#map"; setTimeout(() => { initMap(); mkMap?.setView([p.la, p.lo], 17); }, 150); return; }
  const tc = e.target.closest("[data-mk-taxicard]");
  if (tc) return mkTaxiCard(POI[tc.dataset.mkTaxicard]);
  const offline = e.target.closest("[data-mk-offline]");
  if (offline) { saveMeccaOffline(offline); return; }
  if (e.target.closest("[data-mk-tc-close]") || e.target.id === "taxiCard") return mkTaxiClose();
  const sh = e.target.closest("[data-mk-share]");
  if (sh) {
    const p = POI[sh.dataset.mkShare], url = `${location.origin}/mecca#place/${p.id}`;
    (navigator.share ? navigator.share({ title: poiName(p), url }) : navigator.clipboard.writeText(url).then(() => toast(t("link_copied")))).catch(() => {});
    return;
  }
  const hk = e.target.closest("[data-holy-kind]");
  if (hk) { holyKind = hk.dataset.holyKind; return renderHoly(); }
  const fk = e.target.closest("[data-food-kind]");
  if (fk) { foodKind = fk.dataset.foodKind; return renderFood(); }
  const cf = e.target.closest("[data-mk-city-filter]");
  if (cf) { const sel = $(cf.dataset.target === "hotel" ? "#hotelCity" : "#foodCity"); sel.value = cf.dataset.mkCityFilter; rendered[cf.dataset.target === "hotel" ? "hotels" : "food"] = false; return; }
  const ly = e.target.closest("[data-layer]");
  if (ly) {
    const k = ly.dataset.layer; mkLayerOn[k] = !mkLayerOn[k]; store.set("mk_layers", mkLayerOn);
    mkLayerOn[k] ? mkLayers[k].addTo(mkMap) : mkMap.removeLayer(mkLayers[k]);
    return renderLayerChips();
  }
  if (e.target.closest("[data-mk-locate]")) {
    locate().then(p => { L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "", html: '<div class="me-pin"></div>', iconSize: [18, 18] }) }).addTo(mkMap); mkMap.setView([p.lat, p.lon], 16); })
      .catch(err => { if (err?.message !== "no consent") toast(t("sos_geo_err")); });
    return;
  }
  const lg = e.target.closest("[data-mk-lang]");
  if (lg) { setLang(lg.dataset.mkLang); return; }
  const th = e.target.closest("[data-mk-theme]");
  if (th) { setTheme(th.dataset.mkTheme); $$("[data-mk-theme]").forEach(b => b.classList.toggle("on", b === th)); return; }
  if (e.target.closest("#mkAccBtn")) { location.hash = "#account"; return; }
  if (e.target.closest("#themeBtn")) return setTheme(isDark() ? "light" : "dark");
  if (e.target.closest("#modalClose")) return closeModal();
  if (!e.target.closest("#mkResults, #mkSearch")) $("#mkResults")?.classList.add("hidden");
});
document.addEventListener("input", e => {
  if (!e.target.closest("#tab-trip")) return;
  if (e.target.id === "mkTripStart") {
    MK_TRIP.start = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : "";
    saveTrip();
    return;
  }
  const key = ({
    mkTripDays: "days", mkTripPeople: "people", mkTripRooms: "rooms",
    mkTripHotel: "hotel", mkTripFood: "food", mkTripTransport: "transport", mkTripExtra: "extra"
  })[e.target.id];
  if (!key) return;
  const raw = Number(e.target.value);
  const value = Number.isFinite(raw) ? raw : 0;
  MK_TRIP[key] = ["days", "people", "rooms"].includes(key)
    ? Math.max(1, Math.min(key === "days" ? 60 : key === "rooms" ? 15 : 30, Math.floor(value)))
    : Math.max(0, Math.min(10000000, value));
  saveTrip();
  const total = tripTotal();
  $("#mkTripTotal").innerHTML = `<b>${t("mka_trip_total")}: ${formatSAR(total)}</b><span>${t("mka_trip_per_person")}: ${formatSAR(total / MK_TRIP.people)}</span>`;
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if ($("#taxiCard")) return mkTaxiClose(); if (!$("#modal").classList.contains("hidden")) closeModal(); }
  if (e.key === "Enter" && e.target.matches("[data-go]")) location.hash = e.target.dataset.go;
});

// ---------- Запуск ----------
(function init() {
  applyI18n();
  document.title = t("mka_title") + " — Hamyol";
  fillLang();
  $("#langSelect").addEventListener("change", e => setLang(e.target.value));
  [$("#holyCity"), $("#hotelCity"), $("#foodCity")].forEach(cityOptions);
  $("#mkTripDays").value = MK_TRIP.days;
  $("#mkTripPeople").value = MK_TRIP.people;
  $("#mkTripRooms").value = MK_TRIP.rooms;
  $("#mkTripHotel").value = MK_TRIP.hotel;
  $("#mkTripFood").value = MK_TRIP.food;
  $("#mkTripTransport").value = MK_TRIP.transport;
  $("#mkTripExtra").value = MK_TRIP.extra;
  $("#hotelCity").value = MECCA_C?.id || "";
  fillHotelSort();
  $("#holyQ").addEventListener("input", debounce(renderHoly, 200));
  $("#holyCity").addEventListener("change", renderHoly);
  $("#hotelQ").addEventListener("input", debounce(renderHotels, 200));
  $("#hotelCity").addEventListener("change", renderHotels);
  $("#hotelSort").addEventListener("change", () => {
    if ($("#hotelSort").value === "me" && !userPos) locate().then(renderHotels).catch(() => { $("#hotelSort").value = "near"; renderHotels(); });
    else renderHotels();
  });
  $("#foodQ").addEventListener("input", debounce(renderFood, 200));
  $("#foodCity").addEventListener("change", renderFood);
  $("#mkSearch").addEventListener("input", debounce(mkSearch, 150));
  $("#themeBtn").innerHTML = icon(isDark() ? "sun" : "moon");
  window.addEventListener("hashchange", route);
  EXT.onInit.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
  loadConfig();
  route();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("/sw.js").catch(() => {});
})();
