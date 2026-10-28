// «Паспорт путешественника» (#passport): штампы городов, где человек отметился, и медали.
// Отметка — кнопкой «Я здесь» на странице города: проверяем геопозицию (с согласием), что вы в пределах 20 км.
// Всё хранится только на этом устройстве (safar_visits, safar_seen).
const VISIT_KM = 20;
const visits = () => store.get("safar_visits", {});
const seenCount = () => store.get("safar_seen", []).length;
const visitedIds = () => Object.keys(visits()).filter(id => CITY[id]);

const MEDALS = [
  { id: "first", ic: "flag", need: () => visitedIds().length >= 1 },
  { id: "capital", ic: "city", need: () => !!visits()[byRu("Ташкент")?.id] },
  { id: "silk", ic: "route", need: () => ["Самарканд", "Бухара", "Хива"].every(n => visits()[byRu(n)?.id]) },
  { id: "five", ic: "compass", need: () => visitedIds().length >= 5 },
  { id: "ten", ic: "crown", need: () => visitedIds().length >= 10 },
  { id: "curious", ic: "eye", need: () => seenCount() >= 30 },
  { id: "explorer", ic: "award", need: () => seenCount() >= 100 },
  // Задания (как в Duolingo): маленькие цели, ради которых хочется открыть Safar ещё раз
  { id: "week3", ic: "zap", need: () => streakCities(7) >= 3 },
  { id: "silk10", ic: "gem", need: () => silkWithin(10) },
  { id: "bazaar5", ic: "basket", need: () => seenOf(p => p.s === "marketplace") >= 5 },
  { id: "food10", ic: "food", need: () => seenOf(p => p.c === "f") >= 10 },
  { id: "helper", ic: "badge-check", need: () => store.get("safar_fixed", 0) >= 1 }
];
// Подтверждённые правки — с сервера (после входа); число хранится на устройстве для медали
EXT.onAccountRender.push(u => { if (u) api("/api/reports/mine").then(r => { store.set("safar_fixed", +r.fixed || 0); medalCheck(); }).catch(() => {}); });
// Сколько городов отмечено в пределах N дней подряд (лучшее окно)
function streakCities(days) {
  const ts = Object.values(visits()).sort((a, b) => a - b);
  let best = 0;
  for (let i = 0; i < ts.length; i++) best = Math.max(best, ts.filter(x => x >= ts[i] && x - ts[i] <= days * 864e5).length);
  return best;
}
// Самарканд, Бухара и Хива — все три за N дней
function silkWithin(days) {
  const v = visits(), ts = ["Самарканд", "Бухара", "Хива"].map(n => v[byRu(n)?.id]);
  return ts.every(Boolean) && Math.max(...ts) - Math.min(...ts) <= days * 864e5;
}
const seenOf = fn => store.get("safar_seen", []).map(id => POI[id]).filter(p => p && fn(p)).length;

// Сколько мест человек открыл (для медалей «Любопытный» и «Исследователь»)
EXT.placeExtras.push(p => {
  setTimeout(() => {
    const s = store.get("safar_seen", []);
    if (!s.includes(p.id)) { s.push(p.id); store.set("safar_seen", s.slice(-500)); medalCheck(); }
  });
  return "";
});

// Кнопка «Я здесь» на странице города
EXT.cityOverviewBind.push((c, body) => {
  const host = body?.querySelector('.m-pane[data-pane="overview"]');
  if (!host || host.querySelector("[data-checkin]")) return;
  const done = visits()[c.id];
  host.insertAdjacentHTML("afterbegin", `<button type="button" class="btn ${done ? "ghost" : "gold-btn"} checkin-btn" data-checkin="${c.id}" ${done ? "disabled" : ""}>
    ${icon(done ? "badge-check" : "pin")} ${done ? t("pp_was", { d: new Date(done).toLocaleDateString(LOCALE[LANG]) }) : t("pp_here")}</button>`);
});

let medalsKnown = null;
function medalCheck() {
  const now = MEDALS.filter(m => m.need()).map(m => m.id);
  if (medalsKnown === null) medalsKnown = store.get("safar_medals", now);
  const fresh = now.filter(id => !medalsKnown.includes(id));
  if (fresh.length) { toast(`${t("pp_new")}: ${t("pp_m_" + fresh[0])}`); }
  medalsKnown = now;
  store.set("safar_medals", now);
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-checkin]");
  if (!b) return;
  const c = CITY[b.dataset.checkin];
  b.disabled = true;
  try {
    const me = await locate();
    const d = km(me, c);
    if (d > VISIT_KM) { b.disabled = false; return toast(t("pp_far", { km: Math.round(d) })); }
    store.set("safar_visits", { ...visits(), [c.id]: Date.now() });
    navigator.vibrate?.(15);
    b.className = "btn ghost checkin-btn";
    b.innerHTML = `${icon("badge-check")} ${t("pp_stamp", { city: esc(cityName(c)) })}`;
    replay(b, "bump", 600);
    medalCheck();
  } catch (err) {
    b.disabled = false;
    if (err?.message !== "no consent") toast(t("geo_denied"));
  }
});

function openPassport() {
  const v = visits(), ids = visitedIds().sort((a, b) => v[a] - v[b]);
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-c);min-height:160px;padding-top:62px"><h2>${icon("award")} ${t("pp_title")}</h2><p>${t("pp_sub")}</p></div>
    <div class="m-body">
      <h3>${t("pp_medals")} <span class="badge">${MEDALS.filter(m => m.need()).length} / ${MEDALS.length}</span></h3>
      <div class="pp-medals">${MEDALS.map((m, i) => { const on = m.need(); return `
        <div class="pp-medal ${on ? "on" : ""}" style="--n:${i}"><i>${icon(on ? m.ic : "lock")}</i><b>${t("pp_m_" + m.id)}</b><small>${t("pp_m_" + m.id + "_sub")}</small></div>`; }).join("")}</div>
      <h3>${t("pp_stamps")} <span class="badge">${ids.length}</span></h3>
      ${ids.length ? `<div class="pp-stamps">${ids.map((id, i) => `
        <a class="pp-stamp" href="#city/${id}" style="--n:${i};--r:${(i * 37) % 11 - 5}deg"><b>${esc(cityName(CITY[id]))}</b><small>${new Date(v[id]).toLocaleDateString(LOCALE[LANG])}</small></a>`).join("")}</div>`
        : `<p class="hint">${t("pp_empty")}</p>`}
      <p class="hint">${icon("shield")} ${t("pp_private")}</p>
    </div>`);
}
EXT.routes.passport = openPassport;
EXT.homeTiles.push(() => ["#passport", "award", t("pp_title"), t("pp_tile", { n: visitedIds().length })]);
EXT.onInit.push(() => { medalsKnown = store.get("safar_medals", MEDALS.filter(m => m.need()).map(m => m.id)); });
