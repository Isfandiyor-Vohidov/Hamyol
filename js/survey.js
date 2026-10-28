// Опрос «Как вам Safar?» (server/stats.js → /api/survey): на третий день пользования, через 25 секунд,
// одна плашка внизу — оценка 1–5 и, по желанию, «что улучшить». «Не сейчас» — спросим через неделю, не больше двух раз.
// После 4–5 звёзд — предложение рассказать друзьям. Звёзды уходят без личных данных; текст — только после согласия.
const SV_DAYS = 3;
const svDays = () => store.get("safar_days", []);

function svShouldAsk() {
  if (!location.protocol.startsWith("http") || store.get("safar_survey_done", 0)) return false;
  if (svDays().length < SV_DAYS || store.get("safar_survey_skips", 0) >= 2) return false;
  if (Date.now() < store.get("safar_survey_next", 0)) return false;
  return !$("#consentBar") && !$("#svBar") && !$("#onb") && $("#modal")?.classList.contains("hidden");
}

function svShow() {
  if (!svShouldAsk()) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="svBar" class="consent-bar sv-bar" role="dialog" aria-label="${t("sv_title")}">
      <span class="consent-ic">${icon("star")}</span>
      <p><b>${t("sv_title")}</b><small>${t("sv_sub")}</small></p>
      <div class="sv-stars" role="radiogroup" aria-label="${t("sv_title")}">${[1, 2, 3, 4, 5].map(n =>
        `<button type="button" role="radio" aria-checked="false" aria-label="${n} / 5" data-sv-star="${n}">${icon("star")}</button>`).join("")}</div>
      <form class="sv-more hidden" data-sv-form>
        <textarea name="text" rows="2" maxlength="600" placeholder="${t("sv_ph")}"></textarea>
        <div class="consent-acts"><button type="submit" class="btn gold-btn small">${t("sv_send")}</button></div>
      </form>
      <div class="consent-acts sv-later"><button type="button" class="btn ghost small" data-sv-later>${t("sv_later")}</button></div>
      <button type="button" class="consent-x" data-sv-later aria-label="${t("sv_later")}">${icon("x")}</button>
    </div>`);
}

function svClose() {
  const bar = $("#svBar");
  if (!bar) return;
  bar.classList.add("out");
  setTimeout(() => bar.remove(), 280);
}

async function svSend(stars, text) {
  if (text && !(await requireConsent())) text = "";
  try { await api("/api/survey", { method: "POST", body: JSON.stringify({ stars, text, lang: LANG }) }); } catch { /* без сети — не страшно */ }
  store.set("safar_survey_done", 1);
}

// После хорошей оценки — «расскажите друзьям»
function svThanks(stars) {
  const bar = $("#svBar");
  if (!bar) return;
  bar.querySelectorAll(".sv-stars, .sv-more, .sv-later").forEach(el => el.remove());
  bar.querySelector("p").innerHTML = `<b>${t("sv_thanks")}</b>${stars >= 4 ? `<small>${t("sv_share_sub")}</small>` : ""}`;
  if (stars >= 4) bar.insertAdjacentHTML("beforeend", `<div class="consent-acts"><button type="button" class="btn gold-btn small" data-sv-share>${icon("share")} ${t("sv_share")}</button></div>`);
  else setTimeout(svClose, 2500);
}

document.addEventListener("click", async e => {
  const star = e.target.closest("[data-sv-star]");
  if (star) {
    const n = +star.dataset.svStar, bar = $("#svBar");
    bar.dataset.stars = n;
    bar.querySelectorAll("[data-sv-star]").forEach(b => { const on = +b.dataset.svStar <= n; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(+b.dataset.svStar === n)); });
    bar.querySelector(".sv-more").classList.remove("hidden");
    bar.querySelector(".sv-later")?.remove();
    bar.querySelector("textarea").placeholder = t(n >= 4 ? "sv_ph_good" : "sv_ph");
    return;
  }
  if (e.target.closest("[data-sv-later]")) {
    const bar = $("#svBar");
    if (bar?.dataset.stars) { svSend(+bar.dataset.stars, ""); svClose(); return; }   // оценку поставили — сохраняем её
    store.set("safar_survey_skips", store.get("safar_survey_skips", 0) + 1);
    store.set("safar_survey_next", Date.now() + 7 * 864e5);
    return svClose();
  }
  if (e.target.closest("[data-sv-share]")) {
    const url = (SAFAR_CONFIG?.publicUrl || location.origin).replace(/\/+$/, "") + "/?from=friend";
    try {
      if (navigator.share) await navigator.share({ title: "Hamyol", text: t("sv_share_text"), url });
      else { await navigator.clipboard.writeText(url); toast(t("link_copied")); }
    } catch { /* окно закрыто */ }
    svClose();
  }
});

document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-sv-form]");
  if (!f) return;
  e.preventDefault();
  const bar = $("#svBar"), stars = +bar.dataset.stars;
  if (!stars) return;
  f.querySelector("button").disabled = true;
  await svSend(stars, f.text.value.trim());
  svThanks(stars);
});

EXT.onInit.push(() => {
  const day = new Date().toISOString().slice(0, 10), days = svDays();
  if (!days.includes(day)) store.set("safar_days", [...days, day].slice(-30));
  setTimeout(svShow, 25000);
});
