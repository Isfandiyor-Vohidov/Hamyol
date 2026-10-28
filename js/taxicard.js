// «Показать таксисту»: крупно название и адрес места на узбекском и русском — показать экран водителю.
EXT.placeExtras.push(p => `<button type="button" class="btn ghost taxi-card-btn" data-taxi-card="${esc(p.id)}">${icon("taxi")} ${t("tc_btn")}</button>`);

function openTaxiCard(p) {
  const uz = p.nu || p.n, ru = p.nr || p.n, city = p.city ? [p.city.n.uz || p.city.n.ru, p.city.n.ru] : ["", ""];
  document.body.insertAdjacentHTML("beforeend", `
    <div id="taxiCard" class="tc" role="dialog" aria-modal="true">
      <button type="button" class="tc-x" data-tc-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <p class="tc-hint">${t("tc_hint")}</p>
      <p class="tc-ask">Iltimos, meni shu yerga olib boring:</p>
      <h2>${esc(uz)}</h2>
      ${city[0] ? `<p class="tc-city">${esc(city[0])}</p>` : ""}
      <p class="tc-ask">Пожалуйста, отвезите меня сюда:</p>
      <h2>${esc(ru)}</h2>
      ${city[1] ? `<p class="tc-city">${esc(city[1])}</p>` : ""}
      ${p.ad ? `<p class="tc-addr">${esc(p.ad)}</p>` : ""}
    </div>`);
  try { navigator.wakeLock?.request("screen").then(l => ($("#taxiCard") ? ($("#taxiCard")._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function closeTaxiCard() {
  const el = $("#taxiCard");
  if (!el || el.classList.contains("out")) return;
  el._lock?.release?.();
  el.classList.add("out");
  setTimeout(() => el.remove(), 240);
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-taxi-card]");
  if (b && POI[b.dataset.taxiCard]) return openTaxiCard(POI[b.dataset.taxiCard]);
  if (e.target.closest("#taxiCard")) closeTaxiCard();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#taxiCard")) closeTaxiCard(); });

