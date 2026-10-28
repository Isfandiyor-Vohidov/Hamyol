// Главная в «туристическом» стиле: большое фото, поиск и одна главная кнопка «Собрать поездку»,
// дальше крупные карточки с фото; погода, курсы и регионы — компактно в одном раскрывающемся блоке.
function renderHeroExtras() {
  const inner = $("#hero .hero-inner");
  if (!inner) return;
  let box = $("#heroExtras");
  if (!box) { inner.insertAdjacentHTML("beforeend", `<div class="hero-extras" id="heroExtras"></div>`); box = $("#heroExtras"); }
  box.innerHTML = `
    <div class="hero-cta">
      <button type="button" class="btn gold-btn" data-hero-go="trip">${icon("sparkles")} ${t("qt_title")}</button>
      <a class="btn hero-ghost" href="#map">${icon("map")} ${t("nav_map")}</a>
    </div>
    <p class="hero-facts">${t("hero_facts", { c: fmtNum(CITIES.length), p: fmtNum(POIS.length) })}</p>`;
  const sum = $("#homeMore > summary .hm-t");
  if (sum) sum.textContent = t("hm_title");
}
EXT.onHome.push(renderHeroExtras);
EXT.onLang.push(renderHeroExtras);

document.addEventListener("click", e => {
  if (!e.target.closest("[data-hero-go='trip']")) return;
  const qt = $("#quickTrip");
  if (!qt) return;
  qt.scrollIntoView({ behavior: "smooth", block: "start" });
  replay(qt.querySelector(".qt-box"), "qt-flash", 1200);
});

// Фото на первом экране: размер под экран (на телефоне ~200 КБ вместо 750 КБ), сначала загружаем, потом плавно
// показываем; не загрузилось — пробуем версию поменьше, а после возврата интернета — ещё раз
function heroPhoto(file) {
  const hero = $("#hero");
  if (!hero || hero.dataset.heroImg === file) return;
  const want = Math.min(1600, Math.ceil(Math.min(innerWidth, 1200) * Math.min(devicePixelRatio || 1, 2) / 320) * 320);
  const sizes = [...new Set([want, 640])];
  const tryLoad = i => {
    if (i >= sizes.length) { hero.dataset.heroImg = ""; return; }
    const url = commonsImg(file, sizes[i]), img = new Image();
    img.onload = () => { hero.style.backgroundImage = `url('${url}')`; hero.classList.add("photo-in"); hero.dataset.heroImg = file; };
    img.onerror = () => tryLoad(i + 1);
    img.src = url;
  };
  hero.dataset.heroImg = file;   // не запускаем повторно, пока грузится
  tryLoad(0);
}
addEventListener("online", () => { const sam = byRu("Самарканд"), hero = $("#hero"); if (sam?.img && hero && !hero.classList.contains("photo-in")) { hero.dataset.heroImg = ""; heroPhoto(sam.img); } });

// Кнопка «План на день» на странице города — открывает вкладку «План» и прокручивает к ней
document.addEventListener("click", e => {
  const go = e.target.closest("[data-pane-go]");
  if (!go) return;
  const tab = $(`#modalBody .m-tabs [data-pane="${go.dataset.paneGo}"]`);
  if (!tab) return;
  tab.click();
  tab.scrollIntoView({ behavior: "smooth", block: "start" });
});
