// «Собрать поездку» на главной: дни, люди и бюджет → готовый маршрут с уровнем отеля и еды.
// Работает без ИИ: берёт готовые маршруты (COLLECTIONS), подгоняет ночи под число дней
// и выбирает лучший уровень жилья и еды, который укладывается в бюджет.
const QT_DAYS = [2, 3, 4, 5, 7, 10, 14];
// «Откуда начинаете»: город (или группа рядом стоящих городов) → маршруты, которые оттуда стартуют
const QT_FROM = {
  tashkent: ["Ташкент"], samarkand: ["Самарканд"], bukhara: ["Бухара"], khiva: ["Хива", "Ургенч"],
  valley: ["Фергана", "Андижан", "Наманган", "Коканд", "Маргилан"], nukus: ["Нукус"], termez: ["Термез"]
};
const qtFromLabel = k => k === "valley" ? t("qt_valley") : QT_FROM[k].map(ru => byRu(ru)).filter(Boolean).map(cityName).join(" / ");

function qtFitNights(stops, total) {
  const s = stops.map(([c, n]) => [c, n]);
  let sum = () => s.reduce((a, x) => a + x[1], 0);
  // Лишние ночи — по очереди городам, где ночуют (а не все в один)
  const stay = s.filter(x => x[1] > 0).length ? s.filter(x => x[1] > 0) : s;
  while (sum() < total) { const low = stay.reduce((m, x) => x[1] < m[1] ? x : m, stay[0]); low[1]++; }
  while (sum() > total) {
    const big = s.reduce((m, x) => x[1] > m[1] ? x : m, s[0]);
    if (big[1] > 1) big[1]--;
    else if (s.length > 1) s.pop();
    else break;
  }
  return s;
}

// Цена на человека (в сумах) — те же тарифы, что в калькуляторе бюджета
function qtCost(stops, tr, people, hotel, food) {
  const nights = stops.reduce((a, x) => a + x[1], 0), days = nights + 1, rooms = Math.ceil(people / 2);
  let dist = 0;
  for (let i = 1; i < stops.length; i++) dist += km(stops[i - 1][0], stops[i][0]) * 1.25;
  const perKm = TARIFFS.transportPerKm[tr];
  const transport = tr === "car" ? dist * perKm / people : dist * perKm;
  return nights * rooms * TARIFFS.hotelPerNight[hotel] / people + transport +
    days * (TARIFFS.foodPerDay[food] + TARIFFS.localPerDay + TARIFFS.sightsPerDay);
}

// Все подходящие маршруты, лучший — первым. Раньше брался один «самый близкий по ночам»,
// и на одни и те же дни всегда выходил один и тот же маршрут (обычно Ташкент → Самарканд).
function qtBuild(days, people, budgetUsd, from = "") {
  const want = usd(budgetUsd), nights = Math.max(1, days - 1);
  const opts = [];
  for (const col of COLLECTIONS) {
    const stops = colStops(col);
    if (!stops.length || (QT_FROM[from] && !QT_FROM[from].includes(stops[0][0].n.ru))) continue;
    const diff = Math.abs(stops.reduce((a, s) => a + s[1], 0) - nights);
    const fit = qtFitNights(stops, nights);
    // Растягивать короткий маршрут больше чем вдвое (2 ночи → 9) или резать длинный до пары городов — не годится
    if (!from && diff > Math.max(3, nights / 2)) continue;   // город выбран — лучше подогнать его маршрут, чем ничего
    // От дорогого к дешёвому — первый уровень отеля и еды, который влезает в бюджет; не влез ни один — самый дешёвый
    let best = null;
    for (const hotel of ["5", "4", "3", "2"]) for (const food of ["premium", "mid", "budget"]) {
      const cost = qtCost(fit, col.tr, people, hotel, food);
      if (cost <= want ? !best || !best.fits || cost > best.cost : !best || (!best.fits && cost < best.cost))
        best = { col, stops: fit, hotel, food, cost, fits: cost <= want };
    }
    opts.push({ ...best, diff, days, people });
  }
  // Сначала — в бюджете, потом — ближе по числу ночей к выбранным дням; одинаковые после подгонки — один раз
  const seen = new Set();
  const list = opts.sort((a, b) => b.fits - a.fits || a.diff - b.diff)
    .filter(o => { const k = o.stops.map(([c, n]) => c.id + n).join(">"); return !seen.has(k) && seen.add(k); });
  // Город старта не выбран — чередуем: следующий вариант по возможности начинается в другом городе,
  // а не Ташкент, Ташкент, Самарканд…
  const out = [];
  while (list.length) {
    const prev = out[out.length - 1]?.stops[0][0].id;
    const i = Math.max(0, list.findIndex(o => o.fits === list[0].fits && o.stops[0][0].id !== prev));
    out.push(list.splice(i, 1)[0]);
  }
  return out;
}

let qtLast = null, qtOpts = [], qtIdx = 0, qtKey = "", qtFrom = store.get("safar_qt_from", "");
function renderQuickTrip() {
  const res = $("#qtResult");
  if (!res || !qtLast) return;
  const r = qtLast, foodTxt = $(`#bFood option[value="${r.food}"]`)?.textContent || r.food;
  res.innerHTML = `
    <div class="qt-card">
      <div class="qt-chain">${r.stops.map(([c, n]) => `<span><b>${esc(cityName(c))}</b><small>${t("qt_nights", { n })}</small></span>`).join(icon("arrow-right"))}</div>
      <div class="qt-meta">
        <span>${icon("calendar-range")} ${t("col_days", { n: r.days })}</span>
        <span>${icon("bed")} ${"★".repeat(+r.hotel)}</span>
        <span>${icon("soup")} ${esc(foodTxt)}</span>
      </div>
      <p class="qt-sum ${r.fits ? "ok" : "over"}">${icon(r.fits ? "circle-check" : "info")}
        <span>${t(r.fits ? "qt_fits" : "qt_over", { p: money(r.cost) })}</span></p>
      <div class="qt-acts">
        <button type="button" class="btn gold-btn" data-qt-open>${icon("route")} ${t("qt_open")}</button>
        ${qtOpts.length > 1 ? `<button type="button" class="btn ghost" data-qt-next>${icon("refresh")} ${t("qt_other")} <small>${qtIdx + 1} / ${qtOpts.length}</small></button>` : ""}
      </div>
    </div>`;
}

function quickTripHtml() {
  return `
    <section class="block qt" id="quickTrip">
      <div class="qt-box">
        <h2>${icon("sparkles")} <span>${t("qt_title")}</span></h2>
        <p class="hint">${t("qt_sub")}</p>
        <form class="qt-form" id="qtForm">
          <label><span>${t("qt_days")}</span><select name="days">${QT_DAYS.map(d => `<option value="${d}" ${d === 5 ? "selected" : ""}>${d}</option>`).join("")}</select></label>
          <label><span>${t("qt_people")}</span><select name="people">${[1, 2, 3, 4, 5, 6].map(p => `<option ${p === 2 ? "selected" : ""}>${p}</option>`).join("")}</select></label>
          <label><span>${t("qt_budget")}</span><input name="budget" type="number" inputmode="numeric" min="50" step="50" value="600"></label>
          <label class="qt-from"><span>${t("qt_from")}</span><select name="from"><option value="">${t("qt_any")}</option>${Object.keys(QT_FROM).map(k => `<option value="${k}" ${k === qtFrom ? "selected" : ""}>${esc(qtFromLabel(k))}</option>`).join("")}</select></label>
          <button class="btn gold-btn" type="submit">${icon("compass")} ${t("qt_go")}</button>
        </form>
        <div id="qtResult"></div>
      </div>
    </section>`;
}

EXT.onHome.push(() => {
  const anchor = $("#collectionsGrid")?.closest("section");
  if (!anchor) return;
  $("#quickTrip")?.remove();
  anchor.insertAdjacentHTML("beforebegin", quickTripHtml());
  renderQuickTrip();
});

document.addEventListener("submit", e => {
  if (e.target.id !== "qtForm") return;
  e.preventDefault();
  const f = e.target, days = +f.days.value, people = +f.people.value, budget = Math.max(50, +f.budget.value || 600);
  qtFrom = f.from.value;
  store.set("safar_qt_from", qtFrom);
  // «Собрать заново» с теми же днями, людьми, бюджетом и городом — следующий маршрут, а не тот же самый
  const key = [days, people, budget, qtFrom].join("|");
  if (key === qtKey && qtOpts.length) qtIdx = (qtIdx + 1) % qtOpts.length;
  else { qtOpts = qtBuild(days, people, budget, qtFrom); qtIdx = 0; qtKey = key; }
  qtLast = qtOpts[qtIdx];
  if (!qtLast) return toast(t("nothing"));
  renderQuickTrip();
  // Результат должен быть заметен: прокручиваем к нему и коротко подсвечиваем
  const card = $("#qtResult .qt-card");
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    replay(card, "qt-flash", 1200);
  }
  const go = f.querySelector("button[type=submit]");
  if (go) go.innerHTML = `${icon("reset")} ${t("qt_again")}`;
});

document.addEventListener("click", e => {
  if (!e.target.closest("[data-qt-next]") || qtOpts.length < 2) return;
  qtIdx = (qtIdx + 1) % qtOpts.length;
  qtLast = qtOpts[qtIdx];
  renderQuickTrip();
  replay($("#qtResult .qt-card"), "qt-flash", 1200);
});

document.addEventListener("click", e => {
  if (!e.target.closest("[data-qt-open]") || !qtLast) return;
  const r = qtLast;
  tripRoute = r.stops.map(([c, nights]) => ({ id: c.id, nights }));
  store.set("safar_route", tripRoute);
  $("#bPeople").value = r.people;
  $("#bRooms").value = Math.ceil(r.people / 2);
  $("#bHotel").value = r.hotel;
  $("#bFood").value = r.food;
  $("#bTransport").value = r.col.tr;
  toast(t("trip_loaded"));
  navGo("#budget");
  showTab("budget");
  updateRoute();
  window.scrollTo({ top: 0 });
});
