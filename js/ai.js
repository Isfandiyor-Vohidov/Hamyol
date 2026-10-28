// ИИ-гид (Claude): чат с потоковым ответом. Показывается, только если сервер настроен (/api/config → ai: true).

let aiBusy = false;
const aiConvId = () => store.get("safar_ai_conv", "");

// Безопасный мини-Markdown: сначала экранируем всё, потом разрешаем жирный шрифт, списки и ссылки
function aiMarkdown(src) {
  const inline = s => esc(s)
    .replace(/\[([^\]]{1,120})\]\((#(?:city|place|collection|guide)\/[\w-]+|#budget|#map|#hotels|#places|#cities)\)/g, '<a href="$2">$1</a>')
    .replace(/\[([^\]]{1,120})\]\((https:\/\/[^\s)]{1,300})\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]{1,200})\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]{1,200})\*(?!\*)/g, "$1<i>$2</i>");
  const out = [];
  let list = null;
  for (const raw of String(src).split("\n")) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (li) {
      const tag = /^\s*\d/.test(line) ? "ol" : "ul";
      if (!list || list.tag !== tag) { if (list) out.push(`</${list.tag}>`); list = { tag }; out.push(`<${tag}>`); }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    if (list) { out.push(`</${list.tag}>`); list = null; }
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    out.push(h ? `<p><b>${inline(h[1])}</b></p>` : `<p>${inline(line)}</p>`);
  }
  if (list) out.push(`</${list.tag}>`);
  return out.join("");
}

function aiBubble(role, html) {
  const box = $("#aiMessages");
  if (!box) return null;
  box.insertAdjacentHTML("beforeend", `<div class="ai-msg ${role}"><div class="ai-bubble">${html}</div></div>`);
  box.scrollTop = box.scrollHeight;
  return box.lastElementChild.querySelector(".ai-bubble");
}

function tripCardHtml(ev) {
  const stops = ev.stops.filter(s => CITY[s.id]);
  const nights = stops.reduce((a, s) => a + s.nights, 0);
  const code = encodeURIComponent(JSON.stringify({ r: stops.map(s => [s.id, s.nights]), t: ev.transport || "" }));
  return `<div class="ai-trip">
    <b>${icon("map")} ${esc(ev.title)}</b>
    <div class="col-chain">${stops.map(s => `${esc(cityName(CITY[s.id]))} (${s.nights})`).join(" → ")}</div>
    <small class="hint">${t("col_days", { n: nights + 1 })}</small>
    <button class="btn gold-btn" data-ai-trip="${code}">${icon("calendar")} ${t("ai_load_trip")}</button>
  </div>`;
}

async function aiSend(text) {
  text = String(text || "").trim();
  if (!text || aiBusy) return;
  aiBusy = true;
  $("#aiInput").value = "";
  $("#aiSuggest")?.remove();
  aiBubble("user", esc(text).replace(/\n/g, "<br>"));
  const bubble = aiBubble("bot", `<span class="ai-status">${t("ai_thinking")}</span>`);
  let answer = "", status = bubble.querySelector(".ai-status");
  const setStatus = s => { if (!status) { bubble.insertAdjacentHTML("beforeend", `<span class="ai-status"></span>`); status = bubble.querySelector(".ai-status"); } status.textContent = s; };
  const render = () => { bubble.innerHTML = aiMarkdown(answer); status = null; $("#aiMessages").scrollTop = $("#aiMessages").scrollHeight; };
  try {
    const tok = authToken();
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) },
      body: JSON.stringify({ message: text, conversationId: aiConvId(), lang: LANG, currency })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(res.status === 429 ? (j.error === "daily limit" ? "limit" : "busy") : "failed");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const line = chunk.split("\n").find(l => l.startsWith("data: "));
        if (!line) continue;
        let ev;
        try { ev = JSON.parse(line.slice(6)); } catch { continue; }
        if (ev.type === "start") store.set("safar_ai_conv", ev.conversationId);
        else if (ev.type === "text") { answer += ev.delta; render(); }
        else if (ev.type === "tool") setStatus(t("ai_tool_" + ev.name) || t("ai_thinking"));
        else if (ev.type === "trip") $("#aiMessages").insertAdjacentHTML("beforeend", `<div class="ai-msg bot"><div class="ai-bubble">${tripCardHtml(ev)}</div></div>`);
        else if (ev.type === "refusal") { answer += (answer ? "\n\n" : "") + t("ai_refusal"); render(); }
        else if (ev.type === "error") throw new Error(ev.code);
      }
    }
    if (!answer) render();
  } catch (e) {
    const code = ["busy", "config", "limit"].includes(e.message) ? e.message : "failed";
    bubble.innerHTML = `<p class="ai-error">${t("ai_err_" + code)}</p>`;
  } finally {
    aiBusy = false;
    $("#aiMessages")?.scrollTo({ top: 1e9 });
  }
}

async function openAI() {
  openModal(`
    <div class="m-head ai-head" style="background:${CAT_BG.a};min-height:140px;padding-top:56px">
      <h2>${icon("sparkles")} ${t("ai_title")}</h2><p>${t("ai_hint")}</p>
    </div>
    <div class="m-body ai-body">
      <div class="ai-messages" id="aiMessages"></div>
      <div class="chips ai-suggest" id="aiSuggest">
        ${["ai_s1", "ai_s2", "ai_s3"].map(k => `<button class="chip" data-ai-ask="${esc(t(k))}">${t(k)}</button>`).join("")}
      </div>
      <form class="ai-form" id="aiForm">
        <textarea id="aiInput" rows="1" maxlength="2000" placeholder="${t("ai_ph")}"></textarea>
        <button class="btn gold-btn" type="submit" aria-label="${t("ai_send")}">${icon("send")}</button>
      </form>
      <div class="ai-foot"><span class="hint">${t("ai_disclaimer")}</span><button class="btn small ghost" data-ai-new>${t("ai_new")}</button></div>
    </div>`);
  const input = $("#aiInput");
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aiSend(input.value); } });
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; });
  $("#aiForm").addEventListener("submit", e => { e.preventDefault(); aiSend(input.value); });
  setTimeout(() => input.focus(), 50);
  // Продолжение прошлого разговора
  if (aiConvId()) {
    try {
      const tok = authToken();
      const { messages } = await (await fetch("/api/ai/history?id=" + encodeURIComponent(aiConvId()), { headers: tok ? { Authorization: "Bearer " + tok } : {} })).json();
      if (messages.length && $("#aiMessages")) {
        $("#aiSuggest")?.remove();
        for (const m of messages) aiBubble(m.role === "user" ? "user" : "bot", m.role === "user" ? esc(m.text) : aiMarkdown(m.text));
      }
    } catch { /* начнём с чистого листа */ }
  }
}

document.addEventListener("click", e => {
  const ask = e.target.closest("[data-ai-ask]");
  if (ask) return aiSend(ask.dataset.aiAsk);
  if (e.target.closest("[data-ai-new]")) { store.set("safar_ai_conv", ""); return openAI(); }
  const trip = e.target.closest("[data-ai-trip]");
  if (trip) {
    const o = JSON.parse(decodeURIComponent(trip.dataset.aiTrip));
    applyTripState(o);
    store.set("safar_trip_updated", Date.now());
    dataChanged("trip");
    toast(t("trip_loaded"));
    location.hash = "#budget";
  }
});

EXT.routes.ai = openAI;
EXT.onConfig.push(cfg => {
  $("#aiFab").classList.toggle("hidden", !cfg.ai);
});
EXT.onInit.push(() => { $("#aiFab").onclick = () => { location.hash = "#ai"; }; });
