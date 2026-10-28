// Настройки отображения (кнопка «Aa» в шапке): размер текста, шрифт, жирность, межстрочный интервал,
// тема, «меньше движения» и жесты. Хранится в safar_display; применяется ещё до отрисовки (скрипт в index.html).
const DISP_DEF = { size: 100, font: "montserrat", bold: false, spacing: false, calm: false, swipe: true };
const DISP_SIZES = [90, 100, 115, 130, 145];
const DISP_FONTS = {
  montserrat: { name: "Montserrat", css: null },
  nunito: { name: "Nunito", css: "Nunito:wght@400;600;700;800" },
  atkinson: { name: "Atkinson Hyperlegible", css: "Atkinson+Hyperlegible:wght@400;700" },
  system: { name: null, css: null }
};

function dispGet() {
  let d = store.get("safar_display", null);
  // Старый переключатель «Крупный текст»
  if (!d) { try { d = localStorage.getItem("safar_big") === "1" ? { size: 115 } : {}; } catch { d = {}; } }
  return { ...DISP_DEF, ...d };
}
function dispLoadFont(font) {
  const f = DISP_FONTS[font];
  if (!f?.css || document.getElementById("font-" + font)) return;
  document.head.insertAdjacentHTML("beforeend",
    `<link id="font-${font}" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${f.css}&display=swap">`);
}
function dispApply(d = dispGet()) {
  const root = document.documentElement;
  root.style.setProperty("--uz", d.size / 100);
  root.classList.add("fs-text");
  root.classList.toggle("big", d.size >= 115);
  root.dataset.font = d.font;
  root.classList.toggle("bold-text", !!d.bold);
  root.classList.toggle("airy", !!d.spacing);
  root.classList.toggle("calm", !!d.calm);
  dispLoadFont(d.font);
  $("#bigBtn")?.setAttribute("aria-pressed", d.size !== 100 || d.font !== "montserrat" || d.bold || d.spacing);
  setTimeout(() => { try { [bigMap, miniMap, planMap, routeMap].forEach(m => m?.invalidateSize()); } catch { /* карт ещё нет */ } }, 80);
}
function dispSet(patch) {
  const d = { ...dispGet(), ...patch };
  store.set("safar_display", d);
  try { localStorage.setItem("safar_big", d.size >= 115 ? "1" : "0"); } catch { /* приватный режим */ }
  dispApply(d);
  renderDisp();
}

// ---------- Панель ----------
function dispPanelHtml() {
  const d = dispGet();
  const seg = (key, opts) => `<div class="ds-seg ds-seg-${key}" role="radiogroup">${opts.map(([v, label, style = ""]) =>
    `<button type="button" role="radio" aria-checked="${d[key] === v}" class="${d[key] === v ? "on" : ""}" data-ds="${key}" data-v="${v}" style="${style}">${label}</button>`).join("")}</div>`;
  const sw = (key, ic, title, sub) => `
    <button type="button" class="ds-switch ${d[key] ? "on" : ""}" data-ds-toggle="${key}" aria-pressed="${!!d[key]}">
      <i>${icon(ic)}</i><span><b>${t(title)}</b>${sub ? `<small>${t(sub)}</small>` : ""}</span><em></em>
    </button>`;
  const fam = f => DISP_FONTS[f].name ? `font-family:'${DISP_FONTS[f].name}',system-ui,sans-serif` : "font-family:system-ui,sans-serif";
  return `
    <div class="ds-card">
      <div class="ds-head"><h2>${icon("text-size")} ${t("ds_title")}</h2>
        <button type="button" class="ds-x" data-ds-close aria-label="${t("cs_close")}">${icon("x")}</button></div>
      <div class="ds-preview" id="dsPreview"><small>${t("ds_preview_lbl")}</small><p>${t("ds_preview")}</p></div>
      <h3>${t("ds_size")} <span class="ds-val" id="dsSizeVal">${d.size}%</span></h3>
      ${seg("size", DISP_SIZES.map(s => [s, `<span style="font-size:${11 + (s - 90) / 4}px">A</span>`]))}
      <h3>${t("ds_font")}</h3>
      ${seg("font", Object.keys(DISP_FONTS).map(f => [f, `<span style="${fam(f)}">${f === "system" ? t("ds_font_system") : DISP_FONTS[f].name.split(" ")[0]}</span>`]))}
      <h3>${t("ds_theme")}</h3>
      <div class="ds-seg">${[["light", "sun", "ds_light"], ["dark", "moon", "ds_dark"]].map(([v, ic, k]) =>
        `<button type="button" class="${isDark() === (v === "dark") ? "on" : ""}" data-ds-theme="${v}">${icon(ic)} ${t(k)}</button>`).join("")}</div>
      <div class="ds-switches">
        ${sw("bold", "edit", "ds_bold")}
        ${sw("spacing", "list", "ds_spacing")}
        ${sw("calm", "leaf", "ds_calm", "ds_calm_sub")}
        ${sw("swipe", "arrow-left", "ds_swipe", "ds_swipe_sub")}
      </div>
      <div class="ds-foot">
        <button type="button" class="btn ghost" data-ds-reset>${icon("reset")} ${t("ds_reset")}</button>
        <button type="button" class="btn gold-btn" data-ds-close>${icon("check")} ${t("ds_done")}</button>
      </div>
    </div>`;
}
// Панель не пересобираем при каждом выборе (иначе она мигает и прыгает наверх) — только обновляем отметки и пример
function dispSync(box) {
  const d = dispGet();
  box.querySelectorAll("[data-ds]").forEach(b => { const on = String(d[b.dataset.ds]) === b.dataset.v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  box.querySelectorAll("[data-ds-toggle]").forEach(b => { const on = !!d[b.dataset.dsToggle]; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  box.querySelectorAll("[data-ds-theme]").forEach(b => b.classList.toggle("on", isDark() === (b.dataset.dsTheme === "dark")));
  const sv = box.querySelector("#dsSizeVal");
  if (sv) sv.textContent = d.size + "%";
  // Пример текста — сразу в выбранном размере, шрифте, жирности и интервале
  const p = box.querySelector("#dsPreview p"), f = DISP_FONTS[d.font];
  if (p) Object.assign(p.style, {
    fontSize: (15 * d.size / 100).toFixed(1) + "px",
    fontFamily: f?.name ? `'${f.name}', system-ui, sans-serif` : "system-ui, sans-serif",
    fontWeight: d.bold ? "700" : "500",
    lineHeight: d.spacing ? "1.8" : "1.45"
  });
}
function renderDisp(full) {
  const box = $("#dispSheet");
  if (!box) return;
  if (full || !box.firstElementChild) {
    const scroll = box.firstElementChild?.scrollTop || 0;
    box.innerHTML = dispPanelHtml();
    box.firstElementChild.classList.toggle("ds-static", !!full);   // смена языка — без повторной анимации появления
    box.firstElementChild.scrollTop = scroll;
  }
  dispSync(box);
}
function openDisp() {
  if ($("#dispSheet")) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="dispSheet" class="ds-sheet" role="dialog" aria-modal="true"></div>`);
  document.documentElement.classList.add("ds-lock");   // пока панель открыта, страница под ней не прокручивается
  renderDisp();
}
function closeDisp() {
  const box = $("#dispSheet");
  if (!box || box.classList.contains("out")) return;
  box.classList.add("out");
  document.documentElement.classList.remove("ds-lock");
  setTimeout(() => box.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
}

document.addEventListener("click", e => {
  const sheet = e.target.closest("#dispSheet");
  if (!sheet) return;
  if (e.target === sheet || e.target.closest("[data-ds-close]")) return closeDisp();
  const opt = e.target.closest("[data-ds]");
  if (opt) { const k = opt.dataset.ds; return dispSet({ [k]: k === "size" ? +opt.dataset.v : opt.dataset.v }); }
  const tg = e.target.closest("[data-ds-toggle]");
  if (tg) { const k = tg.dataset.dsToggle; return dispSet({ [k]: !dispGet()[k] }); }
  const th = e.target.closest("[data-ds-theme]");
  if (th) { if (isDark() !== (th.dataset.dsTheme === "dark")) switchTheme(th.dataset.dsTheme, th); return setTimeout(() => renderDisp(), 450); }
  if (e.target.closest("[data-ds-reset]")) { store.set("safar_display", DISP_DEF); dispSet({}); toast(t("ds_reset_done")); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#dispSheet")) closeDisp(); });

EXT.onInit.push(() => {
  dispApply();
  // «Aa» теперь открывает панель настроек (раньше — только крупный текст)
  const btn = $("#bigBtn");
  if (btn) { btn.onclick = () => { replay(btn, "bump", 600); openDisp(); }; btn.title = t("ds_title"); }
});
EXT.onLang.push(() => { renderDisp(true); const b = $("#bigBtn"); if (b) b.title = t("ds_title"); });

// iPhone: палец на затемнённом фоне или у края списка не должен прокручивать страницу под панелью
document.addEventListener("touchmove", e => {
  if (!$("#dispSheet")) return;
  const card = e.target.closest(".ds-card");
  if (!card || card.scrollHeight <= card.clientHeight) e.preventDefault();
}, { passive: false });
