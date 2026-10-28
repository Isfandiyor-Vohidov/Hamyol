// «Сообщить об ошибке» на странице места: неверные часы работы, закрыто навсегда, неверный телефон или адрес,
// другое (+ комментарий до 300 символов). Перед отправкой — согласие на обработку данных (js/consent.js).
// Сервер: server/reports.js, администратор видит сообщения во вкладке «Ошибки» в админке.

const RP_REASONS = [["hours", "clock"], ["closed", "ban"], ["contact", "phone"], ["other", "message"]];
const RP_MAX = 300;

function openReport(id) {
  const p = POI[id];
  if (!p || $("#rpSheet")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="rpSheet" class="ds-sheet rp-sheet" role="dialog" aria-modal="true" aria-labelledby="rpTitle">
      <form class="ds-card rp-card" id="rpForm" data-poi="${p.id}">
        <div class="ds-head"><h2 id="rpTitle">${icon("alert")} ${t("rp_title")}</h2>
          <button type="button" class="ds-x" data-rp-close aria-label="${t("cs_close")}">${icon("x")}</button></div>
        <p class="hint">${esc(poiName(p))} · ${esc(cityName(p.city))}</p>
        <div class="rp-reasons">${RP_REASONS.map(([k, ic], i) => `
          <label class="rp-reason"><input type="radio" name="reason" value="${k}" ${i ? "" : "checked"}>
            <i>${icon(ic)}</i><span>${t("rp_r_" + k)}</span></label>`).join("")}</div>
        <label class="rp-comment"><span>${t("rp_comment")}</span>
          <textarea name="comment" rows="3" maxlength="${RP_MAX}" placeholder="${t("rp_comment_ph")}"></textarea>
          <small class="rp-left" id="rpLeft">0 / ${RP_MAX}</small></label>
        <button class="btn gold-btn rp-send" type="submit">${icon("send")} ${t("rp_send")}</button>
        <p class="hint rp-privacy">${icon("shield")} ${t("rp_privacy")}</p>
      </form>
    </div>`);
  $("#rpSheet input:checked")?.focus();
}
function closeReport() {
  const box = $("#rpSheet");
  if (!box || box.classList.contains("out")) return;
  box.classList.add("out");
  setTimeout(() => box.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-report]");
  if (b) {
    // Согласие спрашиваем до открытия формы — чтобы не набирать текст впустую
    if (!(await requireConsent())) return;
    return openReport(b.dataset.report);
  }
  const sheet = e.target.closest("#rpSheet");
  if (sheet && (e.target === sheet || e.target.closest("[data-rp-close]"))) closeReport();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#rpSheet")) closeReport(); });
document.addEventListener("input", e => {
  if (!e.target.closest("#rpForm textarea")) return;
  $("#rpLeft").textContent = `${e.target.value.length} / ${RP_MAX}`;
});

document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id !== "rpForm") return;
  e.preventDefault();
  const reason = f.reason.value, comment = f.comment.value.trim().slice(0, RP_MAX);
  if (reason === "other" && !comment) { toast(t("rp_need_comment")); return f.comment.focus(); }
  if (!(await requireConsent())) return;
  if (typeof NET !== "undefined" && !NET.online) return toast(t("off_need_net"));
  const btn = f.querySelector(".rp-send");
  btn.disabled = true;
  try {
    await api("/api/reports", { method: "POST", body: JSON.stringify({ poi: f.dataset.poi, reason, comment }) });
    closeReport();
    toast(t("rp_thanks"));
  } catch (err) {
    btn.disabled = false;
    toast(t(err.status === 429 ? "rp_too_many" : "rp_failed"));
  }
});

// Кнопка — внизу страницы места, перед отзывами
EXT.placeExtras.push(p => `<button type="button" class="btn ghost small rp-open" data-report="${p.id}">${icon("alert")} ${t("rp_open")}</button>`);
