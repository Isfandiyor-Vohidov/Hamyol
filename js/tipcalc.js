// Чаевые и деление счёта — внизу «Цен на месте». В ресторанах Узбекистана в счёт часто уже включено
// обслуживание 10–15%; тогда чаевые не обязательны. Считаем в валюте, выбранной в приложении.
const TIP_STEPS = [0, 5, 10, 15];
let tipState = { tip: 0, service: true };

function tipCalcHtml() {
  return `
    <section class="tipcalc" id="tipCalc">
      <h3>${icon("receipt")} ${t("tip_title")}</h3>
      <p class="hint">${t("tip_sub")}</p>
      <div class="tip-grid">
        <label><span>${t("tip_bill")}, ${currency}</span><input id="tipBill" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
        <label><span>${t("tip_people")}</span><input id="tipPeople" type="number" inputmode="numeric" min="1" max="50" value="2"></label>
      </div>
      <button type="button" class="ds-switch ${tipState.service ? "on" : ""}" id="tipService" aria-pressed="${tipState.service}">
        <i>${icon("receipt")}</i><span><b>${t("tip_service")}</b><small>${t("tip_service_sub")}</small></span><em></em>
      </button>
      <div class="tip-steps" role="radiogroup" aria-label="${t("tip_tip")}">${TIP_STEPS.map(v =>
        `<button type="button" class="chip ${tipState.tip === v ? "on" : ""}" data-tip="${v}" role="radio" aria-checked="${tipState.tip === v}">${v ? v + "%" : t("tip_none")}</button>`).join("")}</div>
      <div class="tip-out" id="tipOut" aria-live="polite"></div>
    </section>`;
}
function tipRender() {
  const out = $("#tipOut");
  if (!out) return;
  const bill = Math.max(0, +$("#tipBill").value || 0), people = Math.min(50, Math.max(1, Math.round(+$("#tipPeople").value || 1)));
  if (!bill) { out.innerHTML = `<p class="hint">${t("tip_enter")}</p>`; return; }
  // Обслуживание, если оно есть, уже внутри суммы счёта — сверху добавляем только чаевые
  const tip = bill * tipState.tip / 100, total = bill + tip;
  const n = v => (currency === "UZS" ? fmtNum(v) : (Math.round(v * 100) / 100).toLocaleString(NUM_LOCALE[LANG])) + " " + currency;
  out.innerHTML = `
    <div><span>${t("tip_tip")}</span><b>${n(tip)}</b></div>
    <div><span>${t("tip_total")}</span><b>${n(total)}</b></div>
    <div class="tip-each"><span>${t("tip_each", { n: people })}</span><b>${n(total / people)}</b></div>
    ${tipState.service && tipState.tip >= 10 ? `<p class="hint">${icon("info")} ${t("tip_double")}</p>` : ""}`;
}

// Подставляем блок после списка цен (renderPrices перерисовывает #prBox — блок живёт рядом, а не внутри)
new MutationObserver(() => {
  const box = $("#prBox");
  if (box && !$("#tipCalc")) { box.insertAdjacentHTML("afterend", tipCalcHtml()); tipRender(); }
}).observe(document.getElementById("modalBody"), { childList: true });

document.addEventListener("input", e => { if (e.target.closest("#tipCalc")) tipRender(); });
document.addEventListener("click", e => {
  if (!e.target.closest("#tipCalc")) return;
  const step = e.target.closest("[data-tip]");
  if (step) {
    tipState.tip = +step.dataset.tip;
    $$("#tipCalc [data-tip]").forEach(b => { const on = b === step; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    return tipRender();
  }
  const sv = e.target.closest("#tipService");
  if (sv) {
    tipState.service = !tipState.service;
    sv.classList.toggle("on", tipState.service); sv.setAttribute("aria-pressed", tipState.service);
    // Обслуживание не включено — по местному обычаю оставляют около 10%
    if (!tipState.service && !tipState.tip) $("#tipCalc [data-tip='10']")?.click();
    tipRender();
  }
});
