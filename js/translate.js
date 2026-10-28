// «Переводчик» (#translate): любые слова и фразы — онлайн (сервис MyMemory, бесплатно), с голосом и озвучкой;
// без интернета — готовые фразы для паломника (js/translate-data.js) и всё, что человек уже переводил (история на устройстве).
// Для «любых слов без интернета» — кнопка «Открыть в Google Переводчике» (у него есть офлайн-языки) и подсказка, как их скачать.
const TR_LANGS = {
  uz: ["O‘zbekcha", "uz-UZ", "uz"], ru: ["Русский", "ru-RU", "ru"], en: ["English", "en-US", "en"], ar: ["العربية", "ar-SA", "ar"],
  zh: ["中文", "zh-CN", "zh-CN"], tr: ["Türkçe", "tr-TR", "tr"], de: ["Deutsch", "de-DE", "de"], ko: ["한국어", "ko-KR", "ko"], ur: ["اردو", "ur-PK", "ur"]
};
const TR_RTL = new Set(["ar", "ur"]);
const TR_MAX = 450;   // MyMemory: до 500 знаков за раз, ~5000 знаков в день с одного телефона
const trAppLang = () => ({ uzc: "uz" }[LANG] || (TR_LANGS[LANG] ? LANG : "en"));
const trState = () => ({ from: store.get("safar_tr_from", trAppLang()), to: store.get("safar_tr_to", "ar") });
const trHist = () => store.get("safar_tr_hist", []);
const trNorm = s => String(s || "").toLowerCase().replace(/[!?.,;:«»"“”'’‘()\-—…؟،]/g, " ").replace(/\s+/g, " ").trim();
const trDir = l => (TR_RTL.has(l) ? "rtl" : "ltr");
// Колонка фразы на языке интерфейса: uz, ru, en, zh; остальным — английский
const trCol = l => ({ uz: 1, ru: 2, en: 3, zh: 4 }[l] || 3);
const trSpeech = () => window.SpeechRecognition || window.webkitSpeechRecognition;

function trLangSelect(id, val) {
  return `<select id="${id}" class="tr-lang" aria-label="${t("tr_lang")}">${Object.entries(TR_LANGS).map(([k, [n]]) => `<option value="${k}" ${k === val ? "selected" : ""}>${n}</option>`).join("")}</select>`;
}

function openTranslate(sub) {
  const st = trState();
  const returnUrl = new URL(window.SAFAR_APP === "mecca" ? "/mecca" : "/", location.origin);
  returnUrl.hash = "#translate";
  const fallbackUrl = new URL(returnUrl);
  fallbackUrl.searchParams.set("safar_voice_unavailable", "1");
  const offlineVoiceUrl = /Android/i.test(navigator.userAgent) ? trOfflineUrl(returnUrl, fallbackUrl, st.from, st.to) : "";
  openModal(`
    <div class="m-head tr-head"><h2>${icon("languages")} ${t("tr_title")}</h2><p>${t("tr_sub")}</p></div>
    <div class="m-body tr">
      <div class="tr-box">
        <div class="tr-langs">
          ${trLangSelect("trFrom", st.from)}
          <button type="button" class="tr-swap" data-tr-swap aria-label="${t("tr_swap")}">${icon("exchange")}</button>
          ${trLangSelect("trTo", st.to)}
        </div>
        <div class="tr-input">
          <textarea id="trText" rows="3" maxlength="${TR_MAX}" dir="${trDir(st.from)}" placeholder="${t("tr_ph")}"></textarea>
          <div class="tr-input-bar">
            ${trSpeech() ? `<button type="button" class="tr-mic" data-tr-mic aria-label="${t("tr_mic")}">${icon("mic")}<span>${t("tr_mic")}</span></button>` : ""}
            ${offlineVoiceUrl ? `<a class="tr-mic tr-offline-voice" href="${offlineVoiceUrl}">${icon("wifi-off")}<span>${t("tr_apk_offline")}</span></a>` : ""}
            <small id="trCount">0 / ${TR_MAX}</small>
            <button type="button" class="tr-clear" data-tr-clear aria-label="${t("tr_clear")}">${icon("x")}</button>
          </div>
        </div>
        <button type="button" class="btn gold-btn tr-go" data-tr-go>${icon("languages")} ${t("tr_go")}</button>
        <div id="trOut"></div>
      </div>

      <section class="tr-sec">
        <h3 class="sec-title">${icon("book")} ${t("tr_phrases")}</h3>
        <p class="hint">${t("tr_phrases_sub")}</p>
        <div class="chips tr-groups">${Object.entries(TR_PHRASE_GROUPS).map(([k, n], i) => `<button type="button" class="chip ${i ? "" : "on"}" data-tr-group="${k}">${esc(n[Math.min(trCol(LANG) - 1, 3)])}</button>`).join("")}</div>
        <div id="trPhrases"></div>
      </section>

      <section class="tr-sec" id="trHistBox"></section>

      <section class="tr-sec tr-dl">
        <h3 class="sec-title">${icon("download")} ${t("tr_dl_lang")}</h3>
        <p class="hint">${t("tr_dl_sub")}</p>
        ${offlineVoiceUrl ? `<button type="button" class="btn gold-btn" data-tr-dl>${icon("download")} ${t("tr_dl_lang")}</button>`
          : `<p class="hint">${icon("android")} ${t("tr_dl_android")}</p><a class="btn ghost" href="/download/safar.apk" download="Hamyol.apk">${icon("android")} ${t("tr_dl_apk")}</a>`}
      </section>

      <details class="tr-sec tr-google">
        <summary>${icon("wifi-off")} <b>${t("tr_offline_title")}</b></summary>
        <ol class="sos-steps">
          <li>${t("tr_off_1")}</li><li>${t("tr_off_2")}</li><li>${t("tr_off_3")}</li>
        </ol>
        <div class="sos-links">
          <a class="btn ghost" href="https://play.google.com/store/apps/details?id=com.google.android.apps.translate" target="_blank" rel="noopener">${icon("android")} Google Play</a>
          <a class="btn ghost" href="https://apps.apple.com/app/google-translate/id414706506" target="_blank" rel="noopener">${icon("download")} App Store</a>
        </div>
      </details>
      <p class="hint tr-note">${icon("info")} <span>${t("tr_privacy")}</span></p>
    </div>`);
  trRenderPhrases("basic");
  trRenderHist();
  const params = new URLSearchParams(location.search);
  const voiceText = params.get("safar_voice_text"), voiceTranslation = params.get("safar_voice_translation");
  // Перевод из приложения (любые языки; старые версии APK присылали только арабский → русский)
  const vf = TR_LANGS[params.get("safar_voice_from")] ? params.get("safar_voice_from") : "ar";
  const vt = TR_LANGS[params.get("safar_voice_to")] ? params.get("safar_voice_to") : "ru";
  if (voiceText && voiceTranslation) {
    $("#trFrom").value = vf;
    $("#trTo").value = vt;
    $("#trText").value = voiceText.slice(0, TR_MAX);
    trCount();
    trShow(voiceText, voiceTranslation, vf, vt, true);
    store.set("safar_tr_hist", [{ f: vf, t: vt, s: voiceText, r: voiceTranslation, at: Date.now() },
      ...trHist().filter(h => !(h.f === vf && h.t === vt && trNorm(h.s) === trNorm(voiceText)))].slice(0, 100));
    trRenderHist();
  }
  if (params.has("safar_voice_text") || params.has("safar_voice_translation") || params.has("safar_voice_unavailable")) {
    params.delete("safar_voice_text");
    params.delete("safar_voice_translation");
    params.delete("safar_voice_from");
    params.delete("safar_voice_to");
    const unavailable = params.has("safar_voice_unavailable");
    params.delete("safar_voice_unavailable");
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
    if (unavailable) setTimeout(() => toast(t("tr_apk_unavailable")), 0);
  }
  if (sub === "phrases") setTimeout(() => $(".tr-groups")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
}

// Офлайн-переводчик Android-приложения (Google ML Kit): открыть с выбранной парой языков; mode=download — сразу список языков.
// Узбекского в ML Kit нет — тогда приложение откроется с последней парой
const TR_MLKIT = new Set(["ru", "en", "ar", "zh", "tr", "de", "ko", "ur"]);
function trOfflineUrl(returnUrl, fallbackUrl, from, to, mode = "") {
  const q = `return=${encodeURIComponent(returnUrl.href)}${TR_MLKIT.has(from) ? "&from=" + from : ""}${TR_MLKIT.has(to) ? "&to=" + to : ""}${mode ? "&mode=" + mode : ""}`;
  return `intent://voice-translate?${q}#Intent;scheme=safar;package=uz.safar.app;S.browser_fallback_url=${encodeURIComponent(fallbackUrl.href)};end`;
}
document.addEventListener("click", e => {
  if (!e.target.closest("[data-tr-dl]")) return;
  const ret = new URL(window.SAFAR_APP === "mecca" ? "/mecca" : "/", location.origin);
  ret.hash = "#translate";
  const fb = new URL(ret);
  fb.searchParams.set("safar_voice_unavailable", "1");
  location.href = trOfflineUrl(ret, fb, $("#trFrom")?.value, $("#trTo")?.value, "download");
});

// Язык по самому тексту — когда он явно не совпадает с выбранным (написали по-узбекски, а выбран русский)
const TR_UZ_HINT = /[oO][‘'ʻ`’]|[gG][‘'ʻ`’]|\b(men|menga|meni|sen|siz|biz|qayer\w*|rahmat|kerak|bor|yo[‘'ʻ]q|qancha|iltimos|bugun|ertaga|yaxshi|nima|qachon|mehmonxona\w*|shifokor|kasal\w*)\b/i;
function trDetect(text, picked) {
  if (/[؀-ۿ]/.test(text)) return picked === "ur" ? "ur" : "ar";
  if (/[가-힯]/.test(text)) return "ko";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[Ѐ-ӿ]/.test(text)) return /[ўқғҳЎҚҒҲ]/.test(text) ? "uz" : /[ыщэъЫЩЭЪ]/.test(text) ? "ru" : picked === "uz" ? "uz" : "ru";
  if (/[A-Za-z]/.test(text) && ["ru", "ar", "ur", "zh", "ko"].includes(picked)) return TR_UZ_HINT.test(text) ? "uz" : "en";
  if (picked === "en" && TR_UZ_HINT.test(text)) return "uz";
  return picked;
}

// ---------- Перевод ----------
async function trTranslate() {
  const text = $("#trText")?.value.trim(), to = $("#trTo").value, out = $("#trOut");
  if (!text || !out) return;
  let from = $("#trFrom").value, to2 = to;
  const guess = trDetect(text, from);
  if (guess !== from) {
    // Текст на языке «куда» — значит, переводим в обратную сторону
    if (guess === to) { to2 = from !== guess ? from : "ar"; $("#trTo").value = to2; }
    from = guess;
    $("#trFrom").value = guess;
    $("#trFrom").dispatchEvent(new Event("change", { bubbles: true }));
    toast(t("tr_detected", { lang: TR_LANGS[guess][0] }));
  }
  return trTranslateRun(text, from, to2, out);
}
async function trTranslateRun(text, from, to, out) {
  if (from === to) return toast(t("tr_same"));
  // 1) уже переводили или есть в готовых фразах — сразу и без интернета
  const known = trFind(text, from, to);
  if (known) return trShow(text, known, from, to, true);
  if (!navigator.onLine) {
    out.innerHTML = `<div class="tr-res tr-off">${icon("wifi-off")}<p>${t("tr_no_net")}</p>${trGoogleBtn(text, from, to)}</div>`;
    return;
  }
  out.innerHTML = `<div class="tr-res"><div class="skeleton"></div></div>`;
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${TR_LANGS[from][2]}|${TR_LANGS[to][2]}`, { signal: AbortSignal.timeout(12000) });
    const j = await r.json();
    const res = j.responseData?.translatedText;
    if (!r.ok || +j.responseStatus !== 200 || !res || /MYMEMORY WARNING|QUERY LENGTH/i.test(res)) throw new Error(j.responseDetails || "fail");
    const clean = res.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    store.set("safar_tr_hist", [{ f: from, t: to, s: text, r: clean, at: Date.now() }, ...trHist().filter(h => !(h.f === from && h.t === to && trNorm(h.s) === trNorm(text)))].slice(0, 100));
    trShow(text, clean, from, to, false);
    trRenderHist();
  } catch {
    out.innerHTML = `<div class="tr-res tr-off">${icon("info")}<p>${t("tr_err")}</p>${trGoogleBtn(text, from, to)}</div>`;
  }
}

// Найти без интернета: история (в обе стороны) и готовые фразы
function trFind(text, from, to) {
  const n = trNorm(text);
  for (const h of trHist()) {
    if (h.f === from && h.t === to && trNorm(h.s) === n) return h.r;
    if (h.f === to && h.t === from && trNorm(h.r) === n) return h.s;
  }
  const col = l => (l === "ar" ? 5 : { uz: 1, ru: 2, en: 3, zh: 4 }[l]);
  if (col(from) && col(to)) {
    const p = TR_PHRASES.find(x => trNorm(x[col(from)]) === n);
    if (p) return p[col(to)];
  }
  return null;
}

const trGoogleUrl = (text, from, to) => `https://translate.google.com/?sl=${TR_LANGS[from][2]}&tl=${TR_LANGS[to][2]}&text=${encodeURIComponent(text)}&op=translate`;
const trGoogleBtn = (text, from, to) => `<a class="btn ghost tr-g" href="${trGoogleUrl(text, from, to)}" target="_blank" rel="noopener">${icon("external")} ${t("tr_google")}</a>`;

function trShow(src, res, from, to, offline) {
  const out = $("#trOut");
  if (!out) return;
  out.innerHTML = `
    <div class="tr-res">
      <small class="tr-res-lang">${TR_LANGS[to][0]}${offline ? ` · ${icon("wifi-off")} ${t("tr_saved")}` : ""}</small>
      <p class="tr-res-text" dir="${trDir(to)}" lang="${TR_LANGS[to][2]}">${esc(res)}</p>
      <div class="tr-acts">
        <button type="button" class="btn gold-btn" data-tr-say="${to}">${icon("volume")} ${t("tr_say")}</button>
        <button type="button" class="btn ghost" data-tr-big>${icon("maximize")} ${t("tr_big")}</button>
        <button type="button" class="btn ghost" data-tr-copy>${icon("copy")} ${t("tr_copy")}</button>
        <button type="button" class="btn ghost" data-tr-reply>${icon("exchange")} ${t("tr_reply")}</button>
      </div>
    </div>`;
  out._last = { src, res, from, to };
}

// ---------- Озвучка и голосовой ввод ----------
function trSay(text, lang) {
  if (!("speechSynthesis" in window)) return toast(t("tr_no_voice"));
  const code = TR_LANGS[lang]?.[1] || lang;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = code;
  u.rate = lang === "ar" ? 0.85 : 0.95;   // арабский чуть медленнее — собеседнику легче понять
  const v = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith(code.slice(0, 2).toLowerCase()));
  if (v) u.voice = v;
  else if (speechSynthesis.getVoices().length) toast(t("tr_no_voice_lang", { lang: TR_LANGS[lang]?.[0] || lang }));
  speechSynthesis.speak(u);
}

let trRec = null;
function trMic(btn) {
  const SR = trSpeech();
  if (!SR) return;
  if (trRec) { trRec.stop(); return; }
  const from = $("#trFrom").value;
  trRec = new SR();
  trRec.lang = TR_LANGS[from][1];
  trRec.interimResults = true;
  trRec.maxAlternatives = 1;
  btn.classList.add("on");
  btn.querySelector("span").textContent = t("tr_listening");
  trRec.onresult = e => {
    const txt = [...e.results].map(r => r[0].transcript).join(" ");
    const ta = $("#trText");
    if (ta) { ta.value = txt.slice(0, TR_MAX); trCount(); }
    if (e.results[e.results.length - 1].isFinal) trTranslate();
  };
  const stop = () => { trRec = null; btn.classList.remove("on"); const s = btn.querySelector("span"); if (s) s.textContent = t("tr_mic"); };
  trRec.onend = stop;
  trRec.onerror = ev => { stop(); if (ev.error !== "aborted" && ev.error !== "no-speech") toast(t(navigator.onLine ? "tr_mic_err" : "tr_no_net_short")); };
  try { trRec.start(); } catch { stop(); }
}

// На весь экран — показать собеседнику: перевод крупно, исходный текст мелко
function trBig(text, lang, small) {
  document.body.insertAdjacentHTML("beforeend", `
    <div id="trBigView" class="tc tr-bigview" role="dialog" aria-modal="true">
      <button type="button" class="tc-x" data-tr-big-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <p class="tr-big-text" dir="${trDir(lang)}" lang="${TR_LANGS[lang]?.[2] || lang}">${esc(text)}</p>
      ${small ? `<p class="tr-big-small">${esc(small)}</p>` : ""}
      <button type="button" class="btn gold-btn tr-big-say" data-tr-say-text="${esc(text)}" data-tr-lang="${lang}">${icon("volume")} ${t("tr_say")}</button>
    </div>`);
  try { navigator.wakeLock?.request("screen").then(l => ($("#trBigView") ? ($("#trBigView")._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function trBigClose() {
  const el = $("#trBigView");
  if (!el || el.classList.contains("out")) return;
  el._lock?.release?.();
  el.classList.add("out");
  setTimeout(() => el.remove(), 240);
}

// ---------- Готовые фразы и история ----------
function trRenderPhrases(group) {
  const box = $("#trPhrases");
  if (!box) return;
  const c = trCol(LANG);
  box.innerHTML = TR_PHRASES.filter(p => p[0] === group).map((p, i) => `
    <div class="tr-phrase">
      <button type="button" class="tr-ph-main" data-tr-phrase="${TR_PHRASES.indexOf(p)}">
        <span class="tr-ph-mine">${esc(p[c])}</span>
        <span class="tr-ph-ar" dir="rtl" lang="ar">${esc(p[5])}</span>
        <small class="tr-ph-tr">${esc(p[6])}</small>
      </button>
      <button type="button" class="tr-ph-say" data-tr-say-text="${esc(p[5])}" data-tr-lang="ar" aria-label="${t("tr_say")}">${icon("volume")}</button>
    </div>`).join("");
}

function trRenderHist() {
  const box = $("#trHistBox");
  if (!box) return;
  const h = trHist().slice(0, 12);
  box.innerHTML = h.length ? `
    <h3 class="sec-title">${icon("clock")} ${t("tr_hist")} <button type="button" class="chip tr-hist-clear" data-tr-hist-clear>${icon("x")} ${t("tr_hist_clear")}</button></h3>
    <p class="hint">${t("tr_hist_sub")}</p>
    ${h.map((x, i) => `<button type="button" class="tr-hist" data-tr-hist="${i}">
      <small>${TR_LANGS[x.f]?.[0] || x.f} → ${TR_LANGS[x.t]?.[0] || x.t}</small>
      <span>${esc(x.s)}</span><b dir="${trDir(x.t)}">${esc(x.r)}</b></button>`).join("")}` : "";
}

function trCount() {
  const ta = $("#trText"), c = $("#trCount");
  if (ta && c) c.textContent = `${ta.value.length} / ${TR_MAX}`;
}

document.addEventListener("input", e => { if (e.target.id === "trText") trCount(); });
document.addEventListener("change", e => {
  if (e.target.id === "trFrom" || e.target.id === "trTo") {
    store.set("safar_tr_from", $("#trFrom").value);
    store.set("safar_tr_to", $("#trTo").value);
    $("#trText")?.setAttribute("dir", trDir($("#trFrom").value));
  }
});
document.addEventListener("keydown", e => {
  if (e.target.id === "trText" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); trTranslate(); }
  if (e.key === "Escape" && $("#trBigView")) trBigClose();
});
document.addEventListener("click", async e => {
  if (e.target.closest("[data-tr-go]")) return trTranslate();
  if (e.target.closest("[data-tr-swap]")) {
    const f = $("#trFrom"), to = $("#trTo"), last = $("#trOut")?._last;
    [f.value, to.value] = [to.value, f.value];
    f.dispatchEvent(new Event("change", { bubbles: true }));
    if (last) { $("#trText").value = last.res; trCount(); $("#trOut").innerHTML = ""; }
    return;
  }
  // «Ответ собеседника»: меняем языки местами, поле пустое — собеседник говорит или пишет на своём языке
  if (e.target.closest("[data-tr-reply]")) {
    const f = $("#trFrom"), to = $("#trTo");
    [f.value, to.value] = [to.value, f.value];
    f.dispatchEvent(new Event("change", { bubbles: true }));
    $("#trText").value = ""; trCount(); $("#trOut").innerHTML = "";
    toast(t("tr_reply_hint", { lang: TR_LANGS[f.value][0] }));
    const mic = $("[data-tr-mic]");
    if (mic) mic.focus(); else $("#trText").focus();
    return;
  }
  if (e.target.closest("[data-tr-clear]")) { const ta = $("#trText"); ta.value = ""; trCount(); $("#trOut").innerHTML = ""; ta.focus(); return; }
  const mic = e.target.closest("[data-tr-mic]");
  if (mic) return trMic(mic);
  const say = e.target.closest("[data-tr-say]");
  if (say) { const l = $("#trOut")?._last; if (l) trSay(l.res, l.to); return; }
  const sayText = e.target.closest("[data-tr-say-text]");
  if (sayText) return trSay(sayText.dataset.trSayText, sayText.dataset.trLang);
  if (e.target.closest("[data-tr-big]")) { const l = $("#trOut")?._last; if (l) trBig(l.res, l.to, l.src); return; }
  if (e.target.closest("[data-tr-big-close]") || e.target.id === "trBigView") return trBigClose();
  if (e.target.closest("[data-tr-copy]")) { const l = $("#trOut")?._last; if (l) navigator.clipboard?.writeText(l.res).then(() => toast(t("copied")), () => {}); return; }
  const g = e.target.closest("[data-tr-group]");
  if (g) { $$("[data-tr-group]").forEach(b => b.classList.toggle("on", b === g)); return trRenderPhrases(g.dataset.trGroup); }
  const ph = e.target.closest("[data-tr-phrase]");
  if (ph) { const p = TR_PHRASES[+ph.dataset.trPhrase]; return trBig(p[5], "ar", `${p[trCol(LANG)]} · ${p[6]}`); }
  const hi = e.target.closest("[data-tr-hist]");
  if (hi) {
    const x = trHist()[+hi.dataset.trHist];
    if (!x) return;
    $("#trFrom").value = x.f; $("#trTo").value = x.t; $("#trText").value = x.s; trCount();
    trShow(x.s, x.r, x.f, x.t, true);
    $("#trOut").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (e.target.closest("[data-tr-hist-clear]")) {
    if (!(await askConfirm({ title: t("tr_hist_clear_q"), ok: t("tr_hist_clear"), danger: true, icon: "x" }))) return;
    store.set("safar_tr_hist", []);
    trRenderHist();
  }
});
// Голоса для озвучки загружаются не сразу — просим список заранее
try { speechSynthesis?.getVoices(); speechSynthesis?.addEventListener?.("voiceschanged", () => {}); } catch { /* нет озвучки */ }

EXT.routes.translate = openTranslate;
EXT.homeTiles.push(() => ["#translate", "languages", t("tr_title"), t("tr_tile")]);
