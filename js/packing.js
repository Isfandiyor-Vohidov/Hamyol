// Чек-лист сборов во вкладке «Поездка»: базовые пункты + пункты по сезону (по месяцу начала поездки,
// без даты — по текущему месяцу). Галочки и свои пункты хранятся только на этом устройстве (safar_packing).

const PACK_BASE = [
  ["passport", "file-text"], ["cash", "banknote"], ["card", "credit-card"], ["scarf", "dome"],
  ["shoes", "walk"], ["meds", "pill"], ["power", "zap"]
];
const PACK_SEASON = {
  summer: [["hat", "sun"], ["sunscreen", "droplets"], ["water", "glass-water"]],
  winter: [["jacket", "thermometer"]],
  mid: [["layers", "layers"]]
};
const packData = () => store.get("safar_packing", { done: {}, custom: [] });
const packSave = d => { store.set("safar_packing", d); renderPacking(); };

// Сезон по месяцу: лето — июнь–август, зима — декабрь–февраль, остальное — весна/осень
function packSeason() {
  const d = typeof tripStartDate === "function" ? tripStartDate() : null;
  const m = (d || new Date()).getMonth() + 1;
  return { season: m >= 6 && m <= 8 ? "summer" : m === 12 || m <= 2 ? "winter" : "mid", byTrip: !!d };
}
function packItems() {
  const d = packData(), { season } = packSeason();
  return [
    ...[...PACK_BASE, ...PACK_SEASON[season]].map(([id, ic]) => ({ id, ic, text: t("pk_" + id) })),
    ...d.custom.map(x => ({ id: "c_" + x.id, ic: "check", text: x.text, own: x.id }))
  ];
}

function renderPacking() {
  const box = $("#packBox");
  if (!box) return;
  const d = packData(), items = packItems(), { season, byTrip } = packSeason();
  const n = items.filter(x => d.done[x.id]).length;
  box.innerHTML = `
    <div class="block-head"><h2>${icon("briefcase")} ${t("pk_title")}</h2>
      <span class="pk-count${n === items.length ? " all" : ""}">${t("pk_progress", { n, total: items.length })}</span></div>
    <i class="pk-bar" style="--p:${items.length ? n / items.length : 0}"></i>
    <p class="hint pk-season">${icon(season === "summer" ? "sun" : season === "winter" ? "thermometer" : "leaf")}
      ${t("pk_season_" + season)} · ${t(byTrip ? "pk_by_trip" : "pk_by_now")}</p>
    <ul class="pk-list">${items.map(x => `
      <li class="${d.done[x.id] ? "done" : ""}">
        <label><input type="checkbox" data-pk="${x.id}" ${d.done[x.id] ? "checked" : ""}>
          <i>${icon(x.ic)}</i><span>${esc(x.text)}</span></label>
        ${x.own ? `<button type="button" class="pk-del" data-pk-del="${x.own}" aria-label="${t("sp_remove")}" title="${t("sp_remove")}">${icon("x")}</button>` : ""}
      </li>`).join("")}</ul>
    <form class="pk-add" id="pkForm">
      <input name="text" maxlength="60" placeholder="${t("pk_add_ph")}" autocomplete="off" required>
      <button class="btn ghost small" type="submit">${icon("plus")} ${t("pk_add")}</button>
    </form>
    <p class="pk-note">${icon("info")}<span>${t("pk_plug")}</span></p>`;
}

document.addEventListener("change", e => {
  const id = e.target.dataset?.pk;
  if (id) {
    const d = packData();
    if (e.target.checked) d.done[id] = 1; else delete d.done[id];
    packSave(d);
    $(`#packBox [data-pk="${id}"]`)?.focus();   // после перерисовки фокус остаётся на том же пункте
    return;
  }
  if (e.target.id === "tripStart") renderPacking();   // сменилась дата — сменился сезон
});
document.addEventListener("submit", e => {
  if (e.target.id !== "pkForm") return;
  e.preventDefault();
  const text = e.target.text.value.trim();
  if (!text) return;
  const d = packData();
  d.custom.push({ id: Math.random().toString(36).slice(2, 9), text });
  packSave(d);
  $("#pkForm input")?.focus();
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-pk-del]");
  if (!b) return;
  const id = b.dataset.pkDel, li = b.closest("li");
  const done = () => { const d = packData(); d.custom = d.custom.filter(x => x.id !== id); delete d.done["c_" + id]; packSave(d); };
  if (li && !matchMedia("(prefers-reduced-motion: reduce)").matches) { li.classList.add("closing"); setTimeout(done, 200); } else done();
});

// Блок — сразу после «Перед поездкой» (js/travelinfo.js), иначе перед «Делёжом расходов»
EXT.onInit.push(() => {
  const html = `<section class="panel packing" id="packBox"></section>`;
  const after = $("#tripExtras"), before = $("#splitBox");
  if (after) after.insertAdjacentHTML("afterend", html);
  else if (before) before.insertAdjacentHTML("beforebegin", html);
  else $("#tab-budget")?.insertAdjacentHTML("beforeend", html);
  renderPacking();
});
EXT.onLang.push(renderPacking);
EXT.onDataChange.push(what => { if (what === "trip") renderPacking(); });   // поездку загрузили по ссылке или из «Собрать поездку»
