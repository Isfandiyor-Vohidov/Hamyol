// Вопросы и ответы у мест (как в TripAdvisor) — блок на странице места перед отзывами.
// Спросить и ответить можно после согласия на обработку данных (js/consent.js); ответ владельца и гида — с отметкой.
EXT.placeExtras.push(p => {
  if (!location.protocol.startsWith("http")) return "";
  setTimeout(() => renderQa(p.key));
  return `<section class="qa" id="qaBox" data-qa-key="${esc(p.key)}">
    <h3 class="sec-title">${icon("help")} ${t("qa_title")}</h3><div class="qa-list"><div class="skeleton"></div></div>
  </section>`;
});

const qaNameField = () => window.SAFAR_USER ? "" : `<input name="name" maxlength="40" placeholder="${t("your_name")}" required>`;
const qaRole = r => r === "owner" ? `<span class="qa-role owner">${icon("store")} ${t("qa_owner")}</span>` : r === "guide" ? `<span class="qa-role guide">${icon("flag")} ${t("qa_guide")}</span>` : "";

async function renderQa(key) {
  const box = $("#qaBox");
  if (!box || box.dataset.qaKey !== key) return;
  let list = [];
  try { list = await getJSON("/api/qa?key=" + encodeURIComponent(key)); } catch { /* без сети — пусто */ }
  if (!box.isConnected) return;
  box.querySelector(".qa-list").innerHTML = `
    ${list.length ? list.map(q => `
      <div class="qa-q">
        <p class="qa-text"><b>${icon("help")}</b> ${esc(q.text)}</p>
        <small class="hint">${esc(q.name)} · ${fmtDate(new Date(q.date))}</small>
        ${q.answers.map(a => `<div class="qa-a"><p>${esc(a.text)}</p><small class="hint">${esc(a.name)} ${qaRole(a.role)}</small></div>`).join("")}
        <details class="qa-reply"><summary>${icon("message")} ${t("qa_answer")}</summary>
          <form class="qa-form" data-qa-answer="${q.id}">${qaNameField()}<textarea name="text" rows="2" maxlength="500" required placeholder="${t("qa_answer_ph")}"></textarea>
          <button class="btn small gold-btn" type="submit">${t("qa_send")}</button></form></details>
      </div>`).join("") : `<p class="hint">${t("qa_empty")}</p>`}
    <details class="qa-ask"><summary class="btn ghost">${icon("plus")} ${t("qa_ask")}</summary>
      <form class="qa-form" data-qa-ask="${esc(key)}">${qaNameField()}<textarea name="text" rows="2" minlength="8" maxlength="300" required placeholder="${t("qa_ask_ph")}"></textarea>
      <button class="btn small gold-btn" type="submit">${t("qa_send")}</button></form></details>`;
}

document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-qa-ask], [data-qa-answer]");
  if (!f) return;
  e.preventDefault();
  if (!(await requireConsent())) return;
  const body = { text: f.text.value.trim(), ...(f.name ? { name: f.name.value.trim() } : {}) };
  const btn = f.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    if (f.dataset.qaAsk) await api("/api/qa", { method: "POST", body: JSON.stringify({ ...body, key: f.dataset.qaAsk }) });
    else await api(`/api/qa/${f.dataset.qaAnswer}/answer`, { method: "POST", body: JSON.stringify(body) });
    toast(t("qa_thanks"));
    renderQa($("#qaBox")?.dataset.qaKey);
  } catch (err) {
    btn.disabled = false;
    toast(err.status === 429 ? t("fb_limit") : err.status === 400 ? t("qa_short") : t("review_error"));
  }
});
