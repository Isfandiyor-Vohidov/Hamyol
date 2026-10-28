// Политика конфиденциальности и пользовательское соглашение в приложении (#privacy, #terms).
// Тексты — js/legal-data.js; оператор и контакт — с сервера (/api/config), иначе — общие формулировки.
function legalFill(s) {
  const lang = legalLang(LANG);
  const cfg = typeof SAFAR_CONFIG !== "undefined" ? SAFAR_CONFIG : {};
  const operator = cfg.operator || { ru: "владелец сервиса Hamyol", uz: "Hamyol xizmati egasi", en: "the owner of the Hamyol service" }[lang];
  const c = cfg.contact;
  const contact = !c ? { ru: "через раздел «Аккаунт» в приложении", uz: "ilovadagi «Akkaunt» bo‘limi orqali", en: "via the Account section in the app" }[lang]
    : `<a href="${esc(/^https?:/.test(c) ? c : /@/.test(c) ? "mailto:" + c : "#")}" target="_blank" rel="noopener">${esc(c)}</a>`;
  return s.replaceAll("{operator}", esc(operator)).replaceAll("{contact}", contact);
}
function openLegal(kind) {
  const lang = legalLang(LANG);
  const doc = LEGAL[kind][lang];
  const uzc = LANG === "uzc" ? toCyr : s => s;
  openModal(`
    <div class="m-head" style="background:${CAT_BG.a};min-height:150px;padding-top:60px"><h2>${icon(kind === "privacy" ? "shield" : "file-text")} ${esc(uzc(doc.title))}</h2></div>
    <div class="m-body legal">
      ${lang === "en" && !["en"].includes(LANG) ? `<p class="hint legal-note">${icon("languages")} ${t("legal_en_note")}</p>` : ""}
      <p class="hint">${t("legal_updated", { date: fmtDate(new Date(LEGAL_UPDATED + "T12:00")) })}</p>
      ${doc.sections.map(([h, body]) => `<section><h3>${esc(uzc(h))}</h3>${body.startsWith("<") ? legalFill(uzc(body)) : `<p>${legalFill(uzc(body))}</p>`}</section>`).join("")}
      <p class="legal-links"><a href="#${kind === "privacy" ? "terms" : "privacy"}">${t(kind === "privacy" ? "legal_terms" : "legal_privacy")} ${icon("arrow-right")}</a></p>
    </div>`);
}
EXT.routes.privacy = () => openLegal("privacy");
EXT.routes.terms = () => openLegal("terms");

// Ссылки на документы: подвал главной и раздел аккаунта
const legalLinks = () => `<a href="#privacy">${icon("shield")} ${t("legal_privacy")}</a><a href="#terms">${icon("file-text")} ${t("legal_terms")}</a>`;
EXT.onHome.push(() => {
  let el = $("#legalFooter");
  if (!el) { $(".footer")?.insertAdjacentHTML("beforeend", `<p class="legal-foot" id="legalFooter"></p>`); el = $("#legalFooter"); }
  if (el) el.innerHTML = legalLinks();
});

// ---------- Удаление аккаунта ----------
EXT.accountSections.push(() => accSection("shield", t("acc_privacy"), `
  <div class="legal-acc">${legalLinks()}</div>
  <button type="button" class="btn ghost danger-btn" data-acc-delete>${icon("ban")} ${t("acc_delete")}</button>
  <p class="hint">${t("acc_delete_hint")}</p>`, false));
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-acc-delete]");
  if (!b) return;
  if (!confirm(t("acc_delete_q"))) return;
  b.disabled = true;
  try {
    const res = await fetch("/api/me/delete", { method: "POST", headers: { Authorization: "Bearer " + authToken() } });
    if (!res.ok) throw new Error(res.status);
    signedOut();
    renderAccount();
    toast(t("acc_deleted"));
  } catch {
    b.disabled = false;
    toast(t("acc_delete_fail"));
  }
});
