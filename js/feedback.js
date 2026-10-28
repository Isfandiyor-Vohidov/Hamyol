// «Жалобы и предложения» (#feedback): написать нам про ошибку, неверные данные, идею или жалобу.
// Блок в самом низу главной и ссылка в аккаунте. После отправки — номер обращения; статус и ответ видны здесь же
// (номера и ключи хранятся на устройстве — safar_feedback). Отправка — только после согласия (js/consent.js).
const FB_KINDS = [["bug", "alert"], ["data", "pin"], ["idea", "lightbulb"], ["complaint", "flag"], ["other", "message"]];
const fbMine = () => store.get("safar_feedback", []);

function fbForm(kind = "bug") {
  return `
    <form class="fb-form" id="fbForm">
      <p class="fb-label">${t("fb_kind")}</p>
      <div class="fb-kinds" role="radiogroup">${FB_KINDS.map(([k, ic]) =>
        `<label class="fb-kind"><input type="radio" name="kind" value="${k}" ${k === kind ? "checked" : ""}><span>${icon(ic)} ${t("fb_k_" + k)}</span></label>`).join("")}</div>
      <label class="fb-field"><span>${t("fb_text")}</span>
        <textarea name="text" rows="5" minlength="10" maxlength="1000" required placeholder="${t("fb_text_ph")}"></textarea>
        <small class="fb-count">0 / 1000</small></label>
      <label class="fb-field"><span>${t("fb_contact")}</span>
        <input name="contact" maxlength="80" autocomplete="off" placeholder="${t("fb_contact_ph")}"></label>
      <p class="hint fb-note">${icon("info")} <span>${t("fb_note")}</span></p>
      <button class="btn gold-btn fb-send" type="submit">${icon("send")} ${t("fb_send")}</button>
    </form>`;
}

async function fbRenderMine() {
  const box = $("#fbMine");
  if (!box) return;
  const mine = fbMine();
  if (!mine.length) { box.innerHTML = ""; return; }
  let st = [];
  try { st = await (await fetch("/api/feedback/status?q=" + mine.map(m => `${m.id}.${m.key}`).join(","))).json(); } catch { /* без сети — покажем без статуса */ }
  const byId = Object.fromEntries((Array.isArray(st) ? st : []).map(s => [s.id, s]));
  // Отклонённые обращения не показываем — чтобы не мозолили глаза
  const rows = mine.filter(m => byId[m.id]?.status !== "rejected").slice(0, 10);
  if (!rows.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<h3>${t("fb_mine")}</h3>` + rows.map(m => {
    const s = byId[m.id], done = s?.status === "done";
    return `<div class="fb-item ${done ? "done" : ""}">
      <div class="fb-item-h"><b>#${m.id} · ${t("fb_k_" + m.kind)}</b><span class="bk-status ${done ? "approved" : "pending"}">${done ? t("fb_done") : t("fb_wait")}</span></div>
      <p>${esc(m.text)}</p>
      ${s?.reply ? `<div class="owner-reply"><b>${t("fb_reply")}</b><p>${esc(s.reply)}</p></div>` : ""}
    </div>`;
  }).join("");
}

function openFeedback(kind) {
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-f);min-height:150px;padding-top:60px"><h2>${icon("message")} ${t("fb_title")}</h2><p>${t("fb_sub")}</p></div>
    <div class="m-body">
      <div id="fbBox">${fbForm(FB_KINDS.some(([k]) => k === kind) ? kind : "bug")}</div>
      <div id="fbMine"></div>
    </div>`);
  fbRenderMine();
}

document.addEventListener("input", e => {
  if (e.target.matches("#fbForm textarea")) { const c = $("#fbForm .fb-count"); if (c) c.textContent = `${[...e.target.value].length} / 1000`; }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "fbForm") return;
  e.preventDefault();
  const f = e.target, text = f.text.value.trim();
  if ([...text].length < 10) { toast(t("fb_short")); return f.text.focus(); }
  if (!(await requireConsent())) return;
  const btn = f.querySelector(".fb-send");
  btn.disabled = true;
  const body = { kind: f.kind.value, text, contact: f.contact.value.trim(),
    meta: { page: (NAV[NAV.length - 2] || "#home").slice(0, 60), lang: LANG, ver: "web", device: /iphone|ipad/i.test(navigator.userAgent) ? "iOS" : /android/i.test(navigator.userAgent) ? "Android" : "desktop" } };
  try {
    const r = await api("/api/feedback", { method: "POST", body: JSON.stringify(body) });
    store.set("safar_feedback", [{ id: r.id, key: r.key, kind: body.kind, text: text.slice(0, 200), created: Date.now() }, ...fbMine()].slice(0, 30));
    $("#fbBox").innerHTML = `<div class="fb-ok">${icon("circle-check")}<h3>${t("fb_thanks", { n: r.id })}</h3><p>${t("fb_thanks_sub")}</p>
      <button type="button" class="btn ghost" data-fb-again>${icon("plus")} ${t("fb_again")}</button></div>`;
    fbRenderMine();
  } catch (err) {
    btn.disabled = false;
    toast(err.status === 429 ? t("fb_limit") : t("review_error"));
  }
});
document.addEventListener("click", e => {
  if (e.target.closest("[data-fb-again]")) $("#fbBox").innerHTML = fbForm();
});

EXT.routes.feedback = openFeedback;
// В самом низу главной — заметный блок «Что-то не так? Напишите нам»
EXT.onHome.push(() => {
  const foot = $("#tab-home .footer");
  if (!foot) return;
  $("#fbCta")?.remove();
  foot.insertAdjacentHTML("beforebegin", `
    <a class="fb-cta" id="fbCta" href="#feedback">
      <i>${icon("message")}</i><span><b>${t("fb_cta")}</b><small>${t("fb_cta_sub")}</small></span>${icon("arrow-right")}
    </a>`);
});
// В аккаунте — последней строкой
