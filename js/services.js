// Полезное: банкоматы, банки, обмен валют, аптеки, больницы, клиники, туалеты, АЗС, вокзалы, автовокзалы, аэропорты.
// Данные из OpenStreetMap (~11 тыс. объектов) лежат в data/services.js и загружаются, только когда нужны.

const SVC_ICON = {
  atm: "credit-card", bank: "bank", exchange: "exchange", pharmacy: "pill", hospital: "hospital", clinic: "clinic",
  toilets: "toilet", fuel: "fuel", rail: "train", bus: "bus", airport: "plane"
};
const SVC_GROUPS = [
  ["g_money", ["atm", "exchange", "bank"]],
  ["g_health", ["pharmacy", "hospital", "clinic"]],
  ["g_toilets", ["toilets"]],
  ["g_transport", ["rail", "bus", "airport", "fuel"]]
];
const SVC_COLOR = { g_money: "#2e9e6a", g_health: "#d64545", g_toilets: "#7b5ea7", g_transport: "#143766" };
const svcGroup = type => SVC_GROUPS.find(g => g[1].includes(type))[0];

let SERVICES = null, svcPromise = null;
function loadServices() {
  if (SERVICES) return Promise.resolve(SERVICES);
  svcPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "data/services.js";
    s.onload = () => {
      SERVICES = (window.SAFAR_SERVICES || []).filter(r => CITIES[r[3]]).map(([type, la, lo, ci, n, oh, ph]) =>
        ({ c: "u", type, la, lo, city: CITIES[ci], n: n || "", oh: oh || "", ph: ph || "" }));
      resolve(SERVICES);
    };
    s.onerror = () => { svcPromise = null; reject(new Error("services")); };
    document.head.appendChild(s);
  });
  return svcPromise;
}

const svcName = s => s.n || t("svc_" + s.type);

function svcRow(s, from) {
  const d = from ? km(from, s) : null;
  const dist = d == null ? "" : `<span class="dist">${icon("locate")} ${d < 10 ? d.toFixed(1) : fmtNum(d)} ${t("km_unit")}</span>`;
  const phone = s.ph ? `<a class="btn small ghost" href="tel:${esc(s.ph.replace(/[^\d+]/g, ""))}">${icon("phone")} ${esc(s.ph)}</a>` : "";
  return `
    <div class="svc-row">
      <i style="background:${SVC_COLOR[svcGroup(s.type)]}">${icon(SVC_ICON[s.type])}</i>
      <div>
        <b>${esc(svcName(s))}</b>
        <small>${t("svc_" + s.type)} ${dist} ${openBadge(s)}</small>
        ${s.oh ? `<small>${icon("clock")} ${esc(s.oh)}</small>` : ""}
      </div>
      <div class="svc-acts">
        ${phone}
        <a class="btn small" href="${navHref(s)}" aria-label="${t("nav_build")}">${icon("directions")}</a>
      </div>
    </div>`;
}

// Ближайшие объекты каждого типа к точке
function nearestByType(from, perType = 3, maxKm = 25) {
  const out = {};
  for (const s of SERVICES) {
    const d = km(from, s);
    if (d > maxKm) continue;
    (out[s.type] ||= []).push([d, s]);
  }
  for (const k in out) out[k] = out[k].sort((a, b) => a[0] - b[0]).slice(0, perType).map(x => x[1]);
  return out;
}

function svcSections(from, perType) {
  const near = nearestByType(from, perType);
  return SVC_GROUPS.map(([g, types]) => {
    const rows = types.flatMap(type => near[type] || []);
    if (!rows.length) return "";
    return `<h3 class="svc-h">${t(g)}</h3>
      ${g === "g_money" ? `<p class="hint">${t("bank_note")}</p>` : ""}
      <div class="svc-list">${rows.map(s => svcRow(s, from)).join("")}</div>`;
  }).join("") || `<p class="empty">${t("svc_none")}</p>`;
}

// ---------- «Рядом со мной» (#nearby или #nearby/<город>) ----------
async function openNearby(cityId) {
  const token = openModal(`
    <div class="m-head" style="background:${CAT_BG.h};min-height:170px;padding-top:70px"><h2>${icon("compass")} ${t("nearby_title")}</h2></div>
    <div class="m-body"><div id="nearbyBox"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`);
  let from = null, note = "";
  if (cityId && CITY[cityId]) {
    from = CITY[cityId];
    note = t("nearby_city", { city: esc(cityName(from)) });
  } else {
    try { from = await locate(); }
    catch {
      from = CITIES[0];
      note = t("nearby_fallback", { city: esc(cityName(from)) });
    }
  }
  try { await loadServices(); } catch { if (token === modalToken) $("#nearbyBox").innerHTML = `<p class="empty">${t("weather_na")}</p>`; return; }
  if (token !== modalToken) return;
  $("#nearbyBox").innerHTML = (note ? `<p class="hint">${note}</p>` : "") + svcSections(from, 3);
}

// ---------- Вкладка в карточке города ----------
EXT.cityTabs.push({
  id: "svc",
  label: () => `${icon("compass")} ${t("svc_layer")}`,
  async render(c, el) {
    el.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div>`;
    try { await loadServices(); } catch { el.innerHTML = ""; return; }
    const counts = {};
    SERVICES.forEach(s => { if (s.city === c) counts[s.type] = (counts[s.type] || 0) + 1; });
    el.innerHTML = `
      <div class="chips svc-counts">${Object.keys(SVC_ICON).filter(k => counts[k]).map(k => `<span class="chip">${icon(SVC_ICON[k])} ${t("svc_" + k)} <b>${counts[k]}</b></span>`).join("")}</div>
      <p class="hint">${t("nearby_city", { city: esc(cityName(c)) })}</p>
      ${svcSections(c, 3)}`;
  }
});

// ---------- Слой на карте ----------
EXT.mapLayers.push((map, on) => {
  const group = L.markerClusterGroup({
    chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 45,
    iconCreateFunction: cl => L.divIcon({
      html: `<div class="svc-cluster">${cl.getChildCount()}</div>`, className: "", iconSize: [34, 34]
    })
  });
  let filled = "";
  const fill = async () => {
    const type = $("#svcType")?.value || "";
    if (filled === type + "|") return;
    try { await loadServices(); } catch { return toast(t("weather_na")); }
    group.clearLayers();
    group.addLayers(SERVICES.filter(s => !type || s.type === type).map(s =>
      L.marker([s.la, s.lo], { icon: pin(`<span style="background:${SVC_COLOR[svcGroup(s.type)]}">${icon(SVC_ICON[s.type])}</span>${typeof farePin === "function" ? farePin(s) : ""}`, "pin pin-u") }).bindPopup(() => `
        <b>${esc(svcName(s))}</b><br><small>${t("svc_" + s.type)} · ${esc(cityName(s.city))}</small>${typeof fareOf === "function" ? fareLine(fareOf(s)) : ""}
        ${s.oh ? `<br><small>${icon("clock")} ${esc(s.oh)} ${openBadge(s)}</small>` : ""}
        ${s.ph ? `<br><small>${icon("phone")} <a href="tel:${esc(s.ph.replace(/[^\d+]/g, ""))}">${esc(s.ph)}</a></small>` : ""}
        <br><a class="btn small" style="margin-top:6px;color:var(--accent-text)" href="${gmapsDir(s)}" target="_blank" rel="noopener">${icon("directions")} ${t("directions")}</a>`)));
    filled = type + "|";
  };
  group.on("add", fill);
  layers.u = group;

  const locateBtn = $("#locateBtn");
  locateBtn.insertAdjacentHTML("beforebegin", `
    <label class="layer layer-u"><input type="checkbox" data-layer="u" ${on.u ? "checked" : ""}>${icon("compass")} <span data-i18n="svc_layer">${t("svc_layer")}</span></label>
    <select id="svcType" class="svc-type">${svcTypeOptions()}</select>`);
  $("#svcType").addEventListener("change", () => {
    if (!map.hasLayer(group)) { $('[data-layer="u"]').checked = true; group.addTo(map); on.u = true; store.set("safar_layers", on); }
    else fill();
  });
  if (on.u) group.addTo(map);
});
const svcTypeOptions = () => `<option value="">${t("all_types")}</option>` +
  Object.keys(SVC_ICON).map(k => `<option value="${k}">${t("svc_" + k)}</option>`).join("");

// ---------- Главная и маршруты ----------
EXT.homeTiles.push(() => ["#nearby", "compass", t("nearby_title"), t("nearby_sub")]);
EXT.routes.nearby = openNearby;
EXT.onLang.push(() => {
  const sel = $("#svcType");
  if (sel) { const v = sel.value; sel.innerHTML = svcTypeOptions(); sel.value = v; }
});
