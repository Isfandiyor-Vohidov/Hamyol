// Порядок во вкладке «Поездка»: понятные шаги вместо длинной простыни.
//  • пустая поездка — подсказка «Куда поедем?» с тремя способами начать (без тестового маршрута);
//  • шаги 1 Маршрут → 2 Бюджет → 3 По дням → 4 В дорогу;
//  • параметры бюджета свёрнуты в одну строку-итог; «Перед поездкой», «Что взять» и «Делёж» — вкладками.
const TRIP_QUICK = ["Ташкент", "Самарканд", "Бухара", "Хива"];

function tripEmptyHtml() {
  const chips = TRIP_QUICK.map(byRu).filter(Boolean)
    .map(c => `<button type="button" class="chip" data-trip-add="${c.id}">${icon("plus")} ${esc(cityName(c))}</button>`).join("");
  return `
    <div class="te-hero">${icon("compass")}</div>
    <h2>${t("te_title")}</h2>
    <p>${t("te_sub")}</p>
    <div class="te-ways">
      <button type="button" class="te-way" data-trip-way="budget"><i>${icon("sparkles")}</i><b>${t("te_budget")}</b><small>${t("te_budget_sub")}</small></button>
      <button type="button" class="te-way" data-trip-way="ready"><i>${icon("route")}</i><b>${t("te_ready")}</b><small>${t("te_ready_sub")}</small></button>
      <button type="button" class="te-way" data-trip-way="own"><i>${icon("plus")}</i><b>${t("te_own")}</b><small>${t("te_own_sub")}</small></button>
    </div>
    <p class="te-or">${t("te_quick")}</p>
    <div class="te-chips">${chips}</div>`;
}

function tripSettingsSummary() {
  const opt = sel => $(sel)?.selectedOptions?.[0]?.textContent?.trim() || "";
  return `${icon("users")} ${+$("#bPeople").value || 1} · ${$("#bHotel").value}★ · ${esc(opt("#bFood"))} · ${esc(opt("#bTransport"))}`;
}

function tripLayoutSync() {
  const tab = $("#tab-budget");
  if (!tab) return;
  const empty = !tripRoute.length;
  tab.classList.toggle("trip-is-empty", empty);
  const hero = $("#tripEmpty");
  if (hero && empty && !hero.childElementCount) hero.innerHTML = tripEmptyHtml();
  const sum = $("#tripSettingsSum");
  if (sum) sum.innerHTML = tripSettingsSummary();
}

function tripLayoutBuild() {
  const tab = $("#tab-budget");
  if (!tab || tab.dataset.layout) return;
  tab.dataset.layout = "1";
  const routePanel = tab.querySelector(".budget > .panel"), result = tab.querySelector(".panel.result"), days = tab.querySelector(".trip-days");

  // Подсказка для пустой поездки — в самом начале
  tab.insertAdjacentHTML("afterbegin", `<div class="trip-empty" id="tripEmpty"></div>`);

  // Номера шагов
  const step = (el, n) => el?.insertAdjacentHTML("afterbegin", `<span class="step-n">${n}</span>`);
  step(routePanel?.querySelector("h3"), 1);
  step(result?.querySelector("h3"), 2);
  step(days?.querySelector("h2"), 3);

  // Параметры бюджета — в свёрнутый блок внутри «Бюджета», с короткой строкой-итогом
  const grid = routePanel?.querySelector(".form-grid"), rates = routePanel?.querySelector("details.rates");
  if (grid && result) {
    grid.previousElementSibling?.matches("h3") && grid.previousElementSibling.remove();
    const det = document.createElement("details");
    det.className = "trip-settings";
    det.innerHTML = `<summary><span class="ts-t">${icon("filter")} <b>${t("ts_title")}</b></span><span class="ts-sum" id="tripSettingsSum"></span></summary>`;
    det.append(grid);
    if (rates) det.append(rates);
    result.insertBefore(det, result.querySelector("#copyBudget"));
  }

  // «В дорогу»: перед поездкой / что взять / делёж расходов — вкладками
  const panes = [["#ticketsBox", "ticket", "tk_tab"], ["#tripExtras", "plane", "pt_title"], ["#packBox", "briefcase", "tm_pack"], ["#splitBox", "coins", "tm_split"]]
    .map(([sel, ic, k]) => [$(sel), ic, k]).filter(([el]) => el);
  if (panes.length) {
    tab.insertAdjacentHTML("beforeend", `
      <section class="panel trip-more" id="tripMore">
        <h2><span class="step-n">4</span>${icon("briefcase")} <span>${t("tm_title")}</span></h2>
        <div class="m-tabs tm-tabs">${panes.map(([, ic, k], i) => `<button type="button" class="${i ? "" : "active"}" data-tm="${i}">${icon(ic)} ${t(k)}</button>`).join("")}</div>
        <div class="tm-panes"></div>
      </section>`);
    const box = $("#tripMore .tm-panes");
    panes.forEach(([el], i) => { el.classList.add("tm-pane"); el.classList.toggle("active", !i); box.append(el); });
  }
  tripLayoutSync();
}

// Старый тестовый маршрут (Ташкент — Самарканд — Бухара — Хива без даты) один раз убираем — поездка начинается пустой
EXT.onInit.push(() => {
  if (!store.get("safar_route_clean", 0)) {
    store.set("safar_route_clean", 1);
    const OLD = [["Ташкент", 2], ["Самарканд", 2], ["Бухара", 2], ["Хива", 1]].map(([n, k]) => [byRu(n)?.id, k]);
    const same = tripRoute.length === OLD.length && tripRoute.every((r, i) => r.id === OLD[i][0] && +r.nights === OLD[i][1]);
    if (same && !store.get("safar_trip_start", "")) { tripRoute = []; store.set("safar_route", []); if (rendered.budget) updateRoute(); }
  }
  tripLayoutBuild();
});
EXT.onBudget.push(tripLayoutSync);
EXT.onLang.push(() => {
  const hero = $("#tripEmpty");
  if (hero) hero.innerHTML = "";
  const tt = $(".trip-settings .ts-t b"); if (tt) tt.textContent = t("ts_title");
  const mt = $("#tripMore h2 span:last-child"); if (mt) mt.textContent = t("tm_title");
  $$("#tripMore [data-tm]").forEach((b, i) => { const k = ($("#ticketsBox") ? ["tk_tab", "pt_title", "tm_pack", "tm_split"] : ["pt_title", "tm_pack", "tm_split"])[i]; b.lastChild.textContent = " " + t(k); });
  tripLayoutSync();
});
document.addEventListener("change", e => { if (e.target.closest(".trip-settings")) tripLayoutSync(); });

document.addEventListener("click", e => {
  const tm = e.target.closest("[data-tm]");
  if (tm) {
    $$("#tripMore [data-tm]").forEach(b => b.classList.toggle("active", b === tm));
    $$("#tripMore .tm-pane").forEach((p, i) => p.classList.toggle("active", i === +tm.dataset.tm));
    return;
  }
  const add = e.target.closest("[data-trip-add]");
  if (add && CITY[add.dataset.tripAdd]) {
    tripRoute.push({ id: add.dataset.tripAdd, nights: 2 });
    return updateRoute();
  }
  const way = e.target.closest("[data-trip-way]");
  if (!way) return;
  const w = way.dataset.tripWay;
  if (w === "own") { const i = $("#routeCity"); i?.scrollIntoView({ behavior: "smooth", block: "center" }); return setTimeout(() => i?.focus(), 350); }
  // «По бюджету» и «Готовые маршруты» живут на главной — переходим и прокручиваем к блоку
  goTab("home");
  setTimeout(() => $(w === "budget" ? "#quickTrip" : "#collectionsGrid")?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
});
