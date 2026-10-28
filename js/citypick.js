// Выбор города с поиском: кнопка с текущим городом → панель с полем поиска, популярными городами
// и списком (ищет по названию на любом языке и по области). Вместо длинного списка из 349 городов.
// Используется в «Ценах на месте» (cityPickHtml) и в фильтрах «Отели» / «Места» (enhanceCitySelect —
// поверх обычного <select>: только города из его списка, пункт «Все города», число мест в скобках).
function cityPickHtml(id, currentId) {
  const c = CITY[currentId];
  return `<div class="cp" id="${id}" data-city="${currentId}">
    <button type="button" class="cp-btn" aria-haspopup="listbox" aria-expanded="false">
      ${icon("city")}<span class="cp-cur"><small>${t("pr_city")}</small><b>${c ? esc(cityName(c)) : "—"}</b></span>${icon("chevron-down")}
    </button>
  </div>`;
}

const cpNorm = s => String(s || "").toLowerCase().replace(/[ʻʼ’'`‘]/g, "").replace(/ё/g, "е");
// Города, которые можно выбрать в этом окне (для фильтра — только те, что есть в его <select>)
const cpPool = box => box._sel ? [...box._sel.options].map(o => CITY[o.value]).filter(Boolean) : CITIES;
// Подпись города: в фильтре — с числом мест из <select> («Самарканд (229)»)
const cpCount = (box, c) => box._sel ? ([...box._sel.options].find(o => o.value === c.id)?.textContent.match(/\((\d+)\)\s*$/)?.[1] || "") : "";
function cpMatches(box, q) {
  const n = cpNorm(q);
  // Область — на всех языках сразу (ищут и «Хорезм», и «Xorazm»)
  const region = r => [regionName(r), ...[].concat(REGIONS[r] || [], (typeof X_REGIONS !== "undefined" && X_REGIONS[r]) || [])].map(cpNorm).join(" ");
  return cpPool(box).filter(c => Object.values(c.n).some(v => cpNorm(v).includes(n)) || region(c.r).includes(n))
    // сначала те, где название начинается с запроса, потом крупные
    .sort((a, b) => (cpNorm(cityName(b)).startsWith(n) - cpNorm(cityName(a)).startsWith(n)) || (b.pop || 0) - (a.pop || 0))
    .slice(0, 40);
}
function cpRow(box, c, cur) {
  const n = cpCount(box, c);
  return `<button type="button" class="cp-row ${c.id === cur ? "on" : ""}" role="option" data-cp-pick="${c.id}">
    ${icon(c.ico || "city")}<span><b>${esc(cityName(c))}</b><small>${esc(regionName(c.r))}</small></span>${n ? `<em class="cp-n">${n}</em>` : ""}${c.id === cur ? icon("check") : ""}</button>`;
}
function cpRenderList(box, q) {
  const cur = box.dataset.city, list = box.querySelector(".cp-list");
  if (!q.trim()) {
    const top = [...cpPool(box)].sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, 15);
    list.innerHTML = (box._sel ? `<button type="button" class="cp-row cp-all ${!cur ? "on" : ""}" role="option" data-cp-pick="">${icon("globe")}<span><b>${esc(box._sel.options[0]?.textContent || t("all_cities"))}</b></span>${!cur ? icon("check") : ""}</button>` : "")
      + `<p class="cp-h">${t("cp_big")}</p>` + top.map(c => cpRow(box, c, cur)).join("");
    return;
  }
  const found = cpMatches(box, q);
  list.innerHTML = found.length ? found.map(c => cpRow(box, c, cur)).join("") : `<p class="hint cp-empty">${t("nothing")}</p>`;
}
function cpOpen(box) {
  if (box.querySelector(".cp-panel")) return;
  const allowed = new Set(cpPool(box).map(c => c.id));
  const pop = POPULAR.map(byRu).filter(c => c && allowed.has(c.id));
  box.insertAdjacentHTML("beforeend", `
    <div class="cp-panel" role="listbox">
      <label class="cp-search">${icon("search")}<input type="search" placeholder="${t("cp_ph")}" autocomplete="off" enterkeyhint="search"></label>
      <div class="cp-pop">${pop.map(c => `<button type="button" class="chip ${c.id === box.dataset.city ? "on" : ""}" data-cp-pick="${c.id}">${esc(cityName(c))}</button>`).join("")}</div>
      <div class="cp-list"></div>
    </div>`);
  box.querySelector(".cp-btn").setAttribute("aria-expanded", "true");
  cpRenderList(box, "");
  const inp = box.querySelector(".cp-search input");
  inp.addEventListener("input", () => { box.querySelector(".cp-pop").hidden = !!inp.value.trim(); cpRenderList(box, inp.value); });
  setTimeout(() => inp.focus({ preventScroll: true }), 50);
}
function cpClose(box) {
  const panel = box?.querySelector(".cp-panel");
  if (!panel || panel.classList.contains("closing")) return;
  box.querySelector(".cp-btn").setAttribute("aria-expanded", "false");
  panel.classList.add("closing");
  setTimeout(() => panel.remove(), 170);
}

// ---------- Фильтр «Город» в «Отелях» и «Местах»: кнопка с поиском поверх <select> ----------
function enhanceCitySelect(sel) {
  if (!sel || sel._cp) return;
  sel.insertAdjacentHTML("afterend", `<div class="cp cp-filter" data-city="">
    <button type="button" class="cp-btn" aria-haspopup="listbox" aria-expanded="false">${icon("city")}<span class="cp-cur"><b></b></span>${icon("chevron-down")}</button></div>`);
  const box = sel.nextElementSibling;
  box._sel = sel; sel._cp = box;
  sel.classList.add("cp-hidden-select");
  const sync = () => {
    box.dataset.city = sel.value;
    const o = sel.selectedOptions[0];
    box.querySelector(".cp-cur b").textContent = o ? o.textContent : t("all_cities");
  };
  // Значение меняют и из кода (ссылка «Отели в Самарканде») — следим за ним, чтобы подпись не отставала
  const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(sel, "value", { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
  new MutationObserver(sync).observe(sel, { childList: true });   // список пересобран (язык, категория)
  box.addEventListener("citypick", e => {
    sel.value = e.detail;
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  sync();
}
EXT.onInit.push(() => ["#hotelCity", "#placeCity"].forEach(s => enhanceCitySelect($(s))));

document.addEventListener("click", e => {
  const box = e.target.closest(".cp");
  $$(".cp").forEach(b => b !== box && cpClose(b));
  if (!box) return;
  const pick = e.target.closest("[data-cp-pick]");
  if (pick) {
    const id = pick.dataset.cpPick, c = CITY[id];
    if (!c && !(box._sel && id === "")) return;
    box.dataset.city = id;
    if (!box._sel) box.querySelector(".cp-cur b").textContent = cityName(c);
    cpClose(box);
    box.dispatchEvent(new CustomEvent("citypick", { bubbles: false, detail: id }));
    return;
  }
  if (e.target.closest(".cp-btn")) box.querySelector(".cp-panel") ? cpClose(box) : cpOpen(box);
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const open = $(".cp .cp-panel:not(.closing)");
  if (open) { e.stopPropagation(); cpClose(open.closest(".cp")); }
}, true);
