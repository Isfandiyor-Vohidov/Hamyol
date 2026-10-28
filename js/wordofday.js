// «Слово дня» по-узбекски на главной (как в Duolingo — маленький повод открыть Safar каждый день):
// одна фраза из разговорника на день, перевод на языке интерфейса и кнопка «Послушать».
const wodIndex = () => Math.floor((Date.now() + 5 * 3600e3) / 864e5) % PHRASES.length;   // день по Ташкенту

function wodTranslation(i) {
  const ph = PHRASES[i], xi = ["tr", "de", "zh", "ko"].indexOf(LANG);
  return isUz() ? `${ph[2]} · ${ph[3]}` : LANG === "ru" ? ph[2] : LANG === "en" ? ph[3] : (X_PHRASES?.[i]?.[xi] || ph[3]);
}

function renderWordOfDay() {
  const anchor = $("#guideTiles")?.closest("section");
  if (!anchor || !PHRASES?.length) return;
  $("#wodBox")?.remove();
  const i = wodIndex(), ph = PHRASES[i];
  anchor.insertAdjacentHTML("beforebegin", `
    <section class="block wod" id="wodBox">
      <div class="wod-card">
        <small>${icon("languages")} ${t("wod_title")}</small>
        <b>${esc(uzText(ph[0]))}</b>
        <span>${esc(wodTranslation(i))}${LANG === "ru" ? ` <em>[${esc(ph[1])}]</em>` : ""}</span>
        <div class="wod-acts">
          ${"speechSynthesis" in window ? `<button type="button" class="btn gold-btn small" data-say="${i}">${icon("volume")} ${t("listen")}</button>` : ""}
          <a class="btn ghost small" href="#guide/phrases">${icon("book")} ${t("wod_all")}</a>
        </div>
      </div>
    </section>`);
}
EXT.onHome.push(renderWordOfDay);
EXT.onLang.push(renderWordOfDay);
