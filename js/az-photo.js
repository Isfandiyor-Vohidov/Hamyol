// Перевод по фото в приложении «Азербайджан»: сфотографировали меню, вывеску, табличку — текст распознаётся прямо
// на телефоне (Tesseract.js, словари азербайджанского и русского) и переводится (trTranslate из js/az-app.js).
// Всё нужное (~12 МБ) скачивается один раз в кэш safar-az-ocr — дальше работает без интернета
// (перевод без сети — с русским и английским через скачанную модель Mozilla).
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const OCR_CACHE = "safar-az-ocr";
const OCR_FILES = ["/az-ocr/tesseract.min.js", "/az-ocr/worker.min.js", "/az-ocr/tesseract-core-simd-lstm.wasm.js", "/az-ocr/tesseract-core-lstm.wasm.js", "/az-ocr/lang/aze.traineddata.gz", "/az-ocr/lang/rus.traineddata.gz"];
const PH_TX = {
  title: ["Перевод по фото", "Photo translation"],
  lead: ["Сфотографируйте меню, вывеску или табличку — текст распознается и переведётся. Работает и без интернета.", "Take a photo of a menu, sign or notice — the text is recognised and translated. Works offline too."],
  on_photo: ["Текст на фото", "Text in the photo"], shoot: ["Сфотографировать", "Take a photo"], pick: ["Из галереи", "From gallery"],
  dl: ["Скачать для работы без интернета (~12 МБ)", "Download for offline use (~12 MB)"], dl_busy: ["Скачиваем распознавание… {p}%", "Downloading recognition… {p}%"],
  ready: ["Готово — работает без интернета", "Ready — works offline"], need_net: ["Первый раз нужен интернет: скачаем распознавание текста (~12 МБ).", "The first time needs the internet: we will download text recognition (~12 MB)."],
  reading: ["Читаю текст на фото… {p}%", "Reading the text… {p}%"], none: ["Текст не нашёлся. Сфотографируйте ближе и ровнее, при хорошем свете.", "No text found. Take the photo closer and straighter, in good light."],
  no_tr: ["(перевод появится с интернетом)", "(translation will appear online)"], fail: ["Не удалось распознать фото. Попробуйте ещё раз.", "Could not read the photo. Try again."]
};
const ph = (k, v = {}) => { let s = PH_TX[k][LANG === "en" ? 1 : 0]; for (const x in v) s = s.replaceAll("{" + x + "}", v[x]); return s; };
let phReady = null, phWorker = null, phBusy = false;
async function photoReadyCheck() {
  try { const c = await caches.open(OCR_CACHE); phReady = (await Promise.all(OCR_FILES.map(u => c.match(u)))).every(Boolean); } catch { phReady = false; }
  return phReady;
}
async function photoDownload(onP) {
  const c = await caches.open(OCR_CACHE);
  let i = 0;
  for (const u of OCR_FILES) {
    i++;
    if (await c.match(u)) continue;
    onP?.(Math.round((i - 1) / OCR_FILES.length * 100));
    const r = await fetch(u + "?dl=1", { cache: "no-store" });
    if (!r.ok) throw new Error("http " + r.status);
    await c.put(u, new Response(await r.blob(), { headers: { "Content-Type": u.endsWith(".js") ? "text/javascript" : "application/octet-stream" } }));
  }
  onP?.(100);
  phReady = true;
}
function photoHtml() {
  const from = store.get("az_ph_from", "az");
  setTimeout(photoFill);
  return `<div class="az-card az-photo" id="azPhoto">
    <h2 class="az-h2" style="margin-top:0">${icon("camera")} ${ph("title")}</h2>
    <p class="hint" style="margin:0 0 10px">${ph("lead")}</p>
    <div class="az-chips" style="margin-bottom:10px"><span class="hint">${ph("on_photo")}:</span>${[["az", "Azərbaycanca"], ["ru", "Русский"]].map(([k, n]) => `<button type="button" class="${k === from ? "on" : ""}" data-ph-from="${k}">${n}</button>`).join("")}</div>
    <div class="az-btns two">
      <label class="az-btn">${icon("camera")} ${ph("shoot")}<input type="file" accept="image/*" capture="environment" data-ph-file hidden></label>
      <label class="az-btn ghost">${icon("image")} ${ph("pick")}<input type="file" accept="image/*" data-ph-file hidden></label>
    </div>
    <p class="hint" id="phState" style="margin:8px 0 0"></p>
    <div id="phOut"></div>
  </div>`;
}
async function photoFill() {
  const st = $("#phState");
  if (!st) return;
  if (await photoReadyCheck()) st.innerHTML = `${icon("check")} ${ph("ready")}`;
  else st.innerHTML = navigator.onLine ? `<button type="button" class="az-btn ghost" data-ph-dl style="width:100%">${icon("download")} ${ph("dl")}</button>` : ph("need_net");
}
// Фото уменьшаем до ~1800 px по длинной стороне — распознаётся быстрее и не хуже
async function photoShrink(file) {
  const img = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}
function loadTess() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement("script"); s.src = "/az-ocr/tesseract.min.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
}
async function photoRun(file) {
  if (phBusy || !file) return;
  phBusy = true;
  const st = $("#phState"), out = $("#phOut"), from = store.get("az_ph_from", "az"), to = from === "az" ? talkMine() : "az";
  const say = h => { if (st) st.innerHTML = h; };
  try {
    if (!(await photoReadyCheck())) {
      if (!navigator.onLine) { say(ph("need_net")); return; }
      await photoDownload(p => say(ph("dl_busy", { p })));
    }
    const canvas = await photoShrink(file);
    out.innerHTML = `<img class="ph-prev" src="${canvas.toDataURL("image/jpeg", 0.7)}" alt="">`;
    say(ph("reading", { p: 0 }));
    await loadTess();
    // Один «распознаватель» на оба языка — создаётся один раз
    if (!phWorker) phWorker = await Tesseract.createWorker(["aze", "rus"], 1, {
      workerPath: "/az-ocr/worker.min.js", corePath: "/az-ocr", langPath: "/az-ocr/lang", gzip: true, workerBlobURL: false,
      logger: m => { if (m.status === "recognizing text") say(ph("reading", { p: Math.round(m.progress * 100) })); }
    });
    const { data } = await phWorker.recognize(canvas);
    // Абзацы (а у меню — строки): короткий мусор отбрасываем
    const parts = (data.text || "").split(/\n\s*\n|\n/).map(s => s.replace(/\s+/g, " ").trim()).filter(s => (s.match(/\p{L}/gu) || []).length >= 3);
    if (!parts.length) { say(ph("none")); return; }
    say(`${icon("check")} ${ph("ready")}`);
    out.insertAdjacentHTML("beforeend", `<div class="ph-list">${parts.map((s, i) => `<div class="ph-item" id="phI${i}"><small>${esc(s)}</small><p>…</p></div>`).join("")}</div>`);
    for (let i = 0; i < parts.length; i++) {
      const res = await trTranslate(parts[i], from, to, false).catch(() => null);
      const el = $("#phI" + i + " p");
      if (el) { el.textContent = res || ph("no_tr"); el.lang = to; el.classList.toggle("hint", !res); }
    }
  } catch { say(ph("fail")); }
  finally { phBusy = false; }
}
document.addEventListener("change", e => {
  const f = e.target.closest?.("[data-ph-file]");
  if (f && f.files?.[0]) { photoRun(f.files[0]); f.value = ""; }
});
document.addEventListener("click", e => {
  const fr = e.target.closest("[data-ph-from]");
  if (fr) { store.set("az_ph_from", fr.dataset.phFrom); $$("[data-ph-from]").forEach(b => b.classList.toggle("on", b === fr)); return; }
  if (e.target.closest("[data-ph-dl]")) {
    const st = $("#phState");
    photoDownload(p => { if (st) st.textContent = ph("dl_busy", { p }); }).then(photoFill).catch(() => { if (st) st.textContent = ph("fail"); });
  }
});
