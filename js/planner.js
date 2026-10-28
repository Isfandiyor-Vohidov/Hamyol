// Поездка по дням: даты, город и переезд каждого дня, план осмотра без повторов, погода на дату,
// экспорт в календарь (.ics), печать / PDF и ссылка на всю поездку (#trip/…).

const tripStartInput = () => $("#tripStart");
const tripStartDate = () => {
  const v = tripStartInput().value;
  return v ? new Date(v + "T12:00") : null;
};
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayLabel = d => isUz()
  ? `${weekdayShort(d)}, ${fmtDate(d)}`
  : d.toLocaleDateString(LOCALE[LANG], { weekday: "short", day: "numeric", month: "short" });

// Дни поездки из маршрута: в последнем городе — плюс день отъезда
function buildTripDays() {
  const start = tripStartDate();
  const days = [];
  const usedByCity = {};
  tripRoute.forEach((r, i) => {
    const c = CITY[r.id];
    const last = i === tripRoute.length - 1;
    const count = (+r.nights || 0) + (last ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const used = usedByCity[c.id] ||= [];
      const travel = k === 0 && i > 0;
      const departure = last && k === count - 1 && count > 1;
      const plan = dayPlan(c, travel ? { used, start: 14 * 60, max: 3, minStops: 1 }
        : departure ? { used, max: 2, minStops: 1 } : { used });
      if (plan) used.push(...plan.stops);
      const n = days.length;
      days.push({
        n: n + 1, city: c, date: start ? addDays(start, n) : null, plan, departure,
        travel: travel ? { from: CITY[tripRoute[i - 1].id], leg: routeInfo.legs[i - 1] } : null
      });
    }
  });
  return days;
}

function renderTripDays() {
  const box = $("#tripDays");
  if (!box) return;
  if (!tripRoute.length) { box.innerHTML = `<p class="hint">${t("trip_empty")}</p>`; return; }
  const days = buildTripDays();
  const mode = $("#bTransport").value;
  box.innerHTML = days.map(d => {
    let travel = "";
    if (d.travel) {
      const dist = mode === "plane" ? km(d.travel.from, d.city) : d.travel.leg?.km || km(d.travel.from, d.city) * 1.25;
      const time = mode === "plane" ? t("tr_plane") : d.travel.leg ? fmtTime(d.travel.leg.min) : "—";
      travel = `<div class="day-travel">${icon(TR_ICON[mode] || "route")} <span>${t("tr_" + mode)} · ${t("trip_travel", {
        from: esc(cityName(d.travel.from)), to: esc(cityName(d.city)), km: fmtNum(dist), time })}</span></div>`;
    }
    const stops = d.plan ? d.plan.stops : [];
    const chips = stops.slice(0, 4).map(p => `<span class="day-poi">${icon(poiIcon(p))} ${esc(poiName(p))}</span>`).join("") +
      (stops.length > 4 ? `<span class="day-poi more">+${stops.length - 4}</span>` : "");
    return `
      <article class="day-card">
        <div class="day-side">
          <small>${t("trip_day_word")}</small><b>${d.n}</b>
          ${d.date ? `<span>${dayLabel(d.date)}</span>` : ""}
        </div>
        <div class="day-main">
          <header>
            <a class="day-city" href="#city/${d.city.id}">${icon(d.city.ico)} ${esc(cityName(d.city))}</a>
            ${d.departure ? `<span class="badge">${t("trip_depart")}</span>` : ""}
            <span class="day-w" data-city="${d.city.id}" data-date="${d.date ? isoDate(d.date) : ""}"></span>
          </header>
          ${travel}
          ${d.plan ? `<div class="day-pois">${chips}</div>
            <details class="day-plan"><summary>${icon("clock")} ${t("day_plan")}</summary>${planTimeline(d.plan)}</details>`
            : `<p class="hint day-free">${icon("sun")} ${t("trip_free")}</p>`}
        </div>
      </article>`;
  }).join("");
  fillTripWeather();
}

// Погода: прогноз Open-Meteo на 16 дней; для более далёких дат — климат (см. пункт «Когда ехать»)
async function forecast16(c) {
  const key = `f16:${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
  const cached = Cache.get(key, 3 * HOUR);
  if (cached) return cached;
  return orStale(key, async () => {
    const json = await getJSON(`https://api.open-meteo.com/v1/forecast?timezone=Asia%2FTashkent&forecast_days=16` +
      `&latitude=${c.lat.toFixed(3)}&longitude=${c.lon.toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min`);
    Cache.set(key, json.daily);
    return json.daily;
  });
}

async function fillTripWeather() {
  const cells = $$("#tripDays .day-w[data-date]").filter(el => el.dataset.date);
  const byCity = {};
  cells.forEach(el => (byCity[el.dataset.city] ||= []).push(el));
  for (const id in byCity) {
    let daily = null;
    try { daily = await forecast16(CITY[id]); } catch { /* без прогноза */ }
    for (const el of byCity[id]) {
      if (!el.isConnected) continue;
      const i = daily ? daily.time.indexOf(el.dataset.date) : -1;
      if (i >= 0) {
        const w = wmo(daily.weather_code[i]);
        el.innerHTML = `${w.icon} ${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°`;
        el.title = w.text;
      } else if (typeof climateFor === "function") {
        el.innerHTML = climateFor(CITY[id], new Date(el.dataset.date + "T12:00").getMonth()) || "";
      }
    }
  }
}

// ---------- Экспорт в календарь ----------
function icsEscape(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
function icsFold(line) {
  const out = [];
  while (line.length > 70) { out.push(line.slice(0, 70)); line = " " + line.slice(70); }
  out.push(line);
  return out.join("\r\n");
}
function exportIcs() {
  if (!tripStartDate()) { tripStartInput().focus(); return toast(t("trip_need_date")); }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ymd = d => isoDate(d).replace(/-/g, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hamyol//Trip//RU", "CALSCALE:GREGORIAN"];
  buildTripDays().forEach(d => {
    const desc = [
      d.travel ? `${cityName(d.travel.from)} → ${cityName(d.city)}` : "",
      ...(d.plan ? d.plan.steps.filter(s => !s.move).map(s => `${fmtClock(s.at)} ${s.lunch ? t("plan_lunch") + (s.p ? " — " + poiName(s.p) : "") : poiName(s.p)}`) : [t("trip_free")])
    ].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:safar-${stamp}-${d.n}@safar`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(d.date, 1))}`,
      icsFold(`SUMMARY:${icsEscape(`Hamyol · ${t("trip_day", { n: d.n })}: ${cityName(d.city)}`)}`),
      icsFold(`LOCATION:${icsEscape(cityName(d.city) + ", Uzbekistan")}`),
      icsFold(`DESCRIPTION:${icsEscape(desc)}`), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "safar-trip.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Состояние поездки (для синхронизации) ----------
function tripState() {
  return {
    r: tripRoute.map(x => [x.id, +x.nights || 0]), d: tripStartInput().value || "",
    p: +$("#bPeople").value || 2, m: +$("#bRooms").value || 1, h: $("#bHotel").value, f: $("#bFood").value, t: $("#bTransport").value
  };
}
function applyTripState(o) {
  if (!o || !Array.isArray(o.r)) return;
  tripRoute = o.r.filter(([id]) => CITY[id]).map(([id, nights]) => ({ id, nights }));
  store.set("safar_route", tripRoute);
  if (o.d != null) { tripStartInput().value = o.d; store.set("safar_trip_start", o.d); }
  const set = (sel, v) => { if (v != null && v !== "") $(sel).value = v; };
  set("#bPeople", o.p); set("#bRooms", o.m); set("#bHotel", o.h); set("#bFood", o.f); set("#bTransport", o.t);
  routeInfo = { legs: estimateLegs(), line: null, real: false };
  if (rendered.budget) updateRoute();
}

// ---------- Ссылка на поездку ----------
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
function tripCode() {
  return b64url(JSON.stringify({
    r: tripRoute.map(x => [x.id, +x.nights || 0]), d: tripStartInput().value || "",
    p: +$("#bPeople").value || 2, m: +$("#bRooms").value || 1, h: $("#bHotel").value, f: $("#bFood").value, t: $("#bTransport").value
  }));
}
async function shareTrip() {
  const url = `${location.origin}${location.pathname}#trip/${tripCode()}`;
  try {
    if (navigator.share) await navigator.share({ title: "Hamyol — " + t("trip_days"), text: t("trip_link_hint"), url });
    else { await navigator.clipboard.writeText(url); toast(t("link_copied")); }
  } catch { /* окно «Поделиться» закрыто */ }
}
function loadTrip(code) {
  try {
    const o = JSON.parse(unb64url(code));
    tripRoute = (o.r || []).filter(([id]) => CITY[id]).map(([id, nights]) => ({ id, nights }));
    if (o.d) tripStartInput().value = o.d;
    const set = (sel, v) => { if (v != null && v !== "") $(sel).value = v; };
    set("#bPeople", o.p); set("#bRooms", o.m); set("#bHotel", o.h); set("#bFood", o.f); set("#bTransport", o.t);
    store.set("safar_trip_start", tripStartInput().value);
    toast(t("trip_loaded"));
  } catch { /* битая ссылка — просто открываем планировщик */ }
  navGo("#budget");
  closeModal(false);
  showTab("budget");
  updateRoute();
}

// ---------- Подключение ----------
EXT.onBudget.push(renderTripDays);
EXT.routes.trip = loadTrip;
EXT.onInit.push(() => {
  const saved = store.get("safar_trip_start", "");
  tripStartInput().value = saved && saved >= isoDate(new Date()) ? saved : "";
  tripStartInput().min = isoDate(new Date());
  tripStartInput().addEventListener("change", () => { store.set("safar_trip_start", tripStartInput().value); renderTripDays(); dataChanged("trip"); });
  $("#tripIcs").onclick = exportIcs;
  $("#tripPrint").onclick = () => { $$("#tripDays details").forEach(d => d.open = true); window.print(); };
  $("#tripShare").onclick = shareTrip;
});

// ---------- Готовые маршруты ----------
const colStops = col => col.stops.map(([ru, n]) => [byRu(ru), n]).filter(x => x[0]);

// Примерная стоимость на человека: 2 путешественника, отель 3★, среднее питание
function estimateCollection(col) {
  const stops = colStops(col), people = 2;
  const nights = stops.reduce((a, s) => a + s[1], 0), days = nights + 1;
  let dist = 0;
  for (let i = 1; i < stops.length; i++) dist += km(stops[i - 1][0], stops[i][0]) * 1.25;
  const perKm = TARIFFS.transportPerKm[col.tr];
  const transport = col.tr === "car" ? dist * perKm : dist * perKm * people;
  // Те же статьи, что в калькуляторе бюджета (включая шопинг из настроек), чтобы цифры совпадали
  const shopping = people * usd(+$("#bShopping").value || 0);
  const total = nights * TARIFFS.hotelPerNight[3] + transport + shopping +
    days * people * (TARIFFS.foodPerDay.mid + TARIFFS.localPerDay + TARIFFS.sightsPerDay);
  return { perPerson: total / people, days };
}

// Месяцы, удачные для большинства городов маршрута
function collectionMonths(col) {
  if (typeof bestMonths !== "function") return "";
  const stops = colStops(col).map(s => climateOf(s[0])).filter(Boolean);
  const votes = Array(12).fill(0);
  stops.forEach(cl => bestMonths(cl).forEach(m => votes[m]++));
  const need = Math.ceil(stops.length / 2);
  return monthRanges(votes.map((v, i) => v >= need ? i : -1).filter(i => i >= 0));
}

function collectionCard(col) {
  const stops = colStops(col);
  const heroCity = byRu(col.hero);
  const hero = heroCity?.img ? heroCity : stops.map(s => s[0]).find(c => c.img && c.n.ru !== "Ташкент") || stops.map(s => s[0]).find(c => c.img);
  const est = estimateCollection(col);
  const months = collectionMonths(col);
  return `
    <div class="card col-card" data-go="#collection/${col.id}" tabindex="0" role="link">
      <div class="card-img ${hero ? "has-img" : ""}" style="${hero ? `background-image:url('${commonsImg(hero.img, 480)}')` : `background:${CAT_BG.a}`}">
        <span class="col-icon">${icon(col.icon)}</span>
        <span class="tag">${t("col_days", { n: est.days })}</span>
      </div>
      <div class="card-body">
        <h3>${L3(col.t, X_COLS[col.id]?.[0])}</h3>
        <div class="story">${L3(col.d, X_COLS[col.id]?.[1])}</div>
        <div class="col-chain">${stops.map(([c]) => esc(cityName(c))).join(" → ")}</div>
        <div class="meta"><span>${icon("wallet")} ${t("col_price", { p: money(est.perPerson) })}</span>${months ? `<span>${icon("sparkles")} ${t("col_best", { m: months })}</span>` : ""}</div>
      </div>
    </div>`;
}

function loadCollection(id) {
  const col = COLLECTIONS.find(c => c.id === id);
  if (col) {
    tripRoute = colStops(col).map(([c, nights]) => ({ id: c.id, nights }));
    $("#bTransport").value = col.tr;
    toast(t("trip_loaded"));
  }
  navGo("#budget");
  closeModal(false);
  showTab("budget");
  updateRoute();
  window.scrollTo({ top: 0 });
}

EXT.routes.collection = loadCollection;
EXT.onHome.push(() => { $("#collectionsGrid").innerHTML = COLLECTIONS.map(collectionCard).join(""); });
