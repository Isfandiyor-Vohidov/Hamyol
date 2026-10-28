// Согласие на обработку данных.
// 1) При открытии приложения — плашка внизу. Если её не трогать, через 20 с она сама уезжает (согласием это не считается).
// 2) Когда человек включает то, что требует данных (геолокация, вход, уведомления, отзыв, цена), —
//    окно по центру экрана. После «Принять» действие продолжается само.
const CONSENT_KEY = "safar_consent";
const hasConsent = () => !!store.get(CONSENT_KEY, 0);
function giveConsent() {
  store.set(CONSENT_KEY, Date.now());
  hideConsentBar();
}

// Плавно убрать элемент (класс .out → анимация закрытия) и удалить
function consentRemove(el, ms = 260) {
  if (!el || el.classList.contains("out")) return;
  el.classList.add("out");
  setTimeout(() => el.remove(), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms);
}

// ---------- Плашка при открытии ----------
let consentBarT = null;
function hideConsentBar() { clearTimeout(consentBarT); consentRemove($("#consentBar")); }
function showConsentBar() {
  if (hasConsent() || $("#consentBar") || $("#consentDlg")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="consentBar" class="consent-bar" role="region" aria-label="${t("cs_title")}">
      <span class="consent-ic">${icon("shield")}</span>
      <p><b>${t("cs_title")}</b><small>${t("cs_bar")}</small></p>
      <div class="consent-acts">
        <a class="btn ghost small" href="#privacy" data-cs-more>${t("cs_more")}</a>
        <button type="button" class="btn gold-btn small" data-cs-accept>${t("cs_accept")}</button>
      </div>
      <button type="button" class="consent-x" data-cs-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <i class="consent-timer"></i>
    </div>`);
  // Не трогают — убираем сами; пока палец/мышь на плашке, таймер стоит
  const bar = $("#consentBar"), arm = () => { clearTimeout(consentBarT); consentBarT = setTimeout(hideConsentBar, 20000); };
  bar.addEventListener("pointerenter", () => { clearTimeout(consentBarT); bar.classList.add("hold"); });
  bar.addEventListener("pointerleave", () => { bar.classList.remove("hold"); arm(); });
  arm();
}

// ---------- Окно по центру, когда согласие нужно для действия ----------
let consentWait = null;
function requireConsent() {
  if (hasConsent()) return Promise.resolve(true);
  if (consentWait) return consentWait;
  hideConsentBar();
  consentWait = new Promise(resolve => {
    document.body.insertAdjacentHTML("beforeend", `
      <div id="consentDlg" class="consent-dlg" role="dialog" aria-modal="true" aria-labelledby="csTitle">
        <div class="consent-card">
          <div class="consent-hero">${icon("shield")}</div>
          <h2 id="csTitle">${t("cs_title")}</h2>
          <p>${t("cs_need")}</p>
          <ul>${["cs_li_geo", "cs_li_acc", "cs_li_rv"].map(k => `<li>${icon("circle-check")}<span>${t(k)}</span></li>`).join("")}</ul>
          <button type="button" class="btn gold-btn" data-cs-yes>${icon("check")} ${t("cs_accept_go")}</button>
          <button type="button" class="btn ghost" data-cs-no>${t("cs_later")}</button>
          <a class="consent-link" href="#privacy" data-cs-read>${t("cs_more")}</a>
        </div>
      </div>`);
    const dlg = $("#consentDlg");
    const done = ok => {
      if (ok) giveConsent();
      consentRemove(dlg);
      consentWait = null;
      resolve(ok);
    };
    dlg.addEventListener("click", e => {
      if (e.target.closest("[data-cs-yes]")) return done(true);
      if (e.target.closest("[data-cs-no]") || e.target === dlg) return done(false);
      if (e.target.closest("[data-cs-read]")) done(false);   // ушли читать политику — действие не продолжаем
    });
    dlg._esc = e => { if (e.key === "Escape" && dlg.isConnected) { document.removeEventListener("keydown", dlg._esc); done(false); } };
    document.addEventListener("keydown", dlg._esc);
    dlg.querySelector("[data-cs-yes]").focus({ preventScroll: true });
  });
  return consentWait;
}

document.addEventListener("click", e => {
  if (!e.target.closest("#consentBar")) return;
  if (e.target.closest("[data-cs-accept]")) { giveConsent(); toast(t("cs_thanks")); }
  else if (e.target.closest("[data-cs-close], [data-cs-more]")) hideConsentBar();
});

// Плашка — после заставки и после приветствия (если оно показывается), только при первых открытиях
EXT.onInit.push(() => {
  if (hasConsent()) return;
  const wait = (n = 0) => (document.getElementById("splash") || document.getElementById("onb")) && n < 400
    ? setTimeout(() => wait(n + 1), 300) : setTimeout(showConsentBar, 700);
  setTimeout(wait, 1200);   // приветствие появляется не сразу после заставки — даём ему время
});
