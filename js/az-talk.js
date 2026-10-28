// Разговор голосом в переводчике «Азербайджан»: две большие кнопки-микрофона.
// «Говорите» — вы (русский, узбекский или английский) → сразу перевод на азербайджанский, крупно и вслух.
// «Danışın» — азербайджанец → перевод на ваш язык. Пока микрофон слушает, кнопка горит и пульсирует,
// а слышимые слова появляются на экране сразу — видно, что микрофон вас слышит.
// Распознавание речи — браузера (Web Speech API, нужен интернет); перевод — trTranslate из js/az-app.js
// (с интернетом — онлайн, без — скачанная модель Mozilla для русского и английского).
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const TALK = { rec: null, side: null, heard: "", draftAt: 0, draftText: "", busy: false };
const TALK_MINE = { ru: ["Русский", "Rusca", "ru-RU"], uz: ["Oʻzbekcha", "Özbəkcə", "uz-UZ"], en: ["English", "İngiliscə", "en-US"] };
const TALK_TX = {
  title: ["Разговор голосом", "Voice conversation"],
  lead: ["Нажмите на микрофон и говорите — перевод появится сразу и прозвучит вслух. Собеседник нажимает свою кнопку.", "Tap the microphone and speak — the translation appears at once and is read aloud. The other person taps their own button."],
  mine: ["Ваш язык", "Your language"], me: ["Говорите", "Speak"], them: ["Danışın", "Danışın"],
  listen: ["Слушаю — говорите…", "Listening — speak…"], hear: ["Слышу вас…", "I can hear you…"], them_listen: ["Dinləyirəm — danışın…", "Dinləyirəm — danışın…"],
  them_hear: ["Eşidirəm…", "Eşidirəm…"], stop: ["Нажмите ещё раз, чтобы остановить", "Tap again to stop"],
  no_speech: ["Не расслышал. Нажмите и скажите ещё раз — громче и ближе к телефону.", "I didn't catch that. Tap and say it again, louder and closer to the phone."],
  no_perm: ["Нет доступа к микрофону. Разрешите микрофон для этого сайта в настройках браузера.", "No microphone access. Allow the microphone for this site in the browser settings."],
  no_lang: ["Этот телефон не распознаёт речь на этом языке. Напишите текст ниже.", "This phone cannot recognise speech in this language. Type the text below."],
  no_net: ["Для распознавания голоса нужен интернет. Без сети — напишите текст ниже.", "Voice recognition needs the internet. Offline — type the text below."],
  translating: ["перевожу…", "translating…"], again: ["Сказать ещё", "Say more"]
};
const tt = k => TALK_TX[k][LANG === "en" ? 1 : 0];
const talkMine = () => { const m = store.get("az_talk_mine", LANG === "en" ? "en" : "ru"); return TALK_MINE[m] ? m : "ru"; };

function talkHtml() {
  const m = talkMine();
  return `<div class="az-card az-talk" id="azTalk">
    <h2 class="az-h2" style="margin-top:0">${icon("mic")} ${tt("title")}</h2>
    <p class="hint" style="margin:0 0 10px">${tt("lead")}</p>
    <label class="talk-lang">${tt("mine")}: <select class="az-select" id="talkMine">${Object.entries(TALK_MINE).map(([k, v]) => `<option value="${k}" ${k === m ? "selected" : ""}>${v[0]}</option>`).join("")}</select></label>
    <div class="talk-btns">
      <button type="button" class="talk-mic me" data-talk="me" aria-pressed="false"><span class="talk-ico">${icon("mic")}</span><b>${tt("me")}</b><small id="talkMeSub">${TALK_MINE[m][0]} → Azərbaycanca</small></button>
      <button type="button" class="talk-mic them" data-talk="them" aria-pressed="false"><span class="talk-ico">${icon("mic")}</span><b>${tt("them")}</b><small id="talkThemSub">Azərbaycanca → ${TALK_MINE[m][1]}</small></button>
    </div>
    <div class="talk-live" id="talkLive" hidden aria-live="polite"><span class="talk-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><b id="talkState"></b><p id="talkHeard"></p><p class="talk-draft" id="talkDraft"></p><small>${tt("stop")}</small></div>
    <div id="talkOut"></div>
  </div>`;
}

function talkStart(side) {
  if (TALK.rec) { const same = TALK.side === side; talkStop(); if (same) return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast(t("tr_no_mic"));
  if (!navigator.onLine) return toast(tt("no_net"));
  const mine = talkMine(), from = side === "me" ? mine : "az", to = side === "me" ? "az" : mine;
  const rec = new SR();
  rec.lang = side === "me" ? TALK_MINE[mine][2] : "az-AZ";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  Object.assign(TALK, { rec, side, from, to, heard: "", draftText: "", draftAt: 0 });
  try { speechSynthesis.cancel(); } catch { /* нет голоса */ }
  const btn = $(`[data-talk="${side}"]`), live = $("#talkLive");
  btn?.classList.add("on"); btn?.setAttribute("aria-pressed", "true");
  if (live) { live.hidden = false; live.className = "talk-live " + side; }
  $("#talkState").textContent = side === "me" ? tt("listen") : tt("them_listen");
  $("#talkHeard").textContent = ""; $("#talkDraft").textContent = "";
  // Услышал звук / речь — полоски «танцуют», значит микрофон вас слышит
  rec.onsoundstart = rec.onspeechstart = () => { $("#talkLive")?.classList.add("hearing"); $("#talkState").textContent = side === "me" ? tt("hear") : tt("them_hear"); };
  rec.onsoundend = () => $("#talkLive")?.classList.remove("hearing");
  rec.onresult = ev => {
    let text = "", final = false;
    for (const r of ev.results) { text += r[0].transcript; if (r.isFinal) final = true; }
    TALK.heard = text.trim();
    $("#talkHeard").textContent = TALK.heard;
    if (final) return;
    // Перевод «на лету», пока человек ещё говорит (не чаще раза в 0,8 с)
    if (TALK.heard.length > 3 && Date.now() - TALK.draftAt > 800 && TALK.heard !== TALK.draftText) {
      TALK.draftAt = Date.now(); TALK.draftText = TALK.heard;
      const ask = TALK.heard;
      trTranslate(ask, from, to, false).then(r => { if (r && TALK.rec === rec && TALK.heard.startsWith(ask.slice(0, 3))) $("#talkDraft").textContent = r; }).catch(() => {});
    }
  };
  rec.onerror = e => {
    const msg = e.error === "no-speech" ? "no_speech" : e.error === "not-allowed" || e.error === "service-not-allowed" ? "no_perm" : e.error === "language-not-supported" ? "no_lang" : e.error === "network" ? "no_net" : "";
    if (msg) toast(tt(msg));
  };
  rec.onend = () => {
    const heard = TALK.heard;
    talkReset();
    if (heard) talkFinish(heard, from, to, side);
  };
  try { rec.start(); } catch { talkReset(); }
}
function talkReset() {
  $$(".talk-mic").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); });
  const live = $("#talkLive");
  if (live) { live.hidden = true; live.classList.remove("hearing"); }
  TALK.rec = null; TALK.side = null;
}
function talkStop() { try { TALK.rec?.stop(); } catch { /* уже остановлен */ } }
function talkAbort() { if (TALK.rec) { TALK.rec.onend = null; try { TALK.rec.abort(); } catch { /* уже */ } talkReset(); } }
// Готовая фраза: крупно перевод, мелко — что сказали; сразу звучит вслух; в историю
async function talkFinish(heard, from, to, side) {
  const out = $("#talkOut");
  if (!out) return;
  const card = document.createElement("div");
  card.className = "talk-res " + side;
  card.innerHTML = `<small>${esc(heard)}</small><p lang="${to}">${tt("translating")}</p>`;
  out.prepend(card);
  while (out.children.length > 6) out.lastChild.remove();
  const res = await trTranslate(heard, from, to, true).catch(() => null);
  if (!res) { card.querySelector("p").textContent = t("tr_fail"); return; }
  card.querySelector("p").textContent = res;
  card.insertAdjacentHTML("beforeend", `<div class="az-btns two"><button type="button" class="az-btn ghost" data-say="${esc(res)}" data-lang="${to}">${icon("volume")} ${t("tr_say")}</button><button type="button" class="az-btn ghost" data-big="${esc(res)}">${icon("maximize")} ${t("tr_show")}</button></div>`);
  trSay(res, to);
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-talk]");
  if (b) talkStart(b.dataset.talk);
});
document.addEventListener("change", e => {
  if (e.target.id !== "talkMine") return;
  store.set("az_talk_mine", e.target.value);
  const m = TALK_MINE[e.target.value];
  $("#talkMeSub").textContent = `${m[0]} → Azərbaycanca`;
  $("#talkThemSub").textContent = `Azərbaycanca → ${m[1]}`;
});
