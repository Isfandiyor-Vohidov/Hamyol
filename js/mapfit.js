// Вкладка «Карта»: карта ровно по видимой части экрана — между шапкой и нижним меню.
// Раньше карта была выше экрана: прокрутив страницу вниз, обратно подняться было нельзя — палец двигал карту.
function fitBigMap() {
  // На вкладке «Карта» сама страница не прокручивается — двигается только карта
  document.documentElement.classList.toggle("map-tab", currentTab === "map" && $("#modal").classList.contains("hidden"));
  const map = $("#bigMap");
  if (!map || currentTab !== "map") return;
  const vh = window.visualViewport?.height || innerHeight;
  const nav = $(".bottom-nav"), navH = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
  const top = map.getBoundingClientRect().top + scrollY;   // где начинается карта при прокрутке в самый верх
  const h = Math.max(280, Math.floor(vh - top - navH - 12));
  if (Math.abs(map.offsetHeight - h) > 2) {
    map.style.height = h + "px";
    try { bigMap?.invalidateSize(); } catch { /* карта ещё не создана */ }
  }
  if (scrollY) window.scrollTo(0, 0);
}
const fitBigMapSoon = () => { clearTimeout(fitBigMap._t); fitBigMap._t = setTimeout(fitBigMap, 60); };
addEventListener("resize", fitBigMapSoon);
window.visualViewport?.addEventListener("resize", fitBigMapSoon);
addEventListener("hashchange", fitBigMapSoon);
EXT.onInit.push(() => {
  // Раздел открывают и нижним меню, и свайпом, и по ссылке — следим за самим разделом «Карта»
  const tab = $("#tab-map");
  if (tab) new MutationObserver(fitBigMapSoon).observe(tab, { attributes: true, attributeFilter: ["class"] });
  const modal = $("#modal");
  if (modal) new MutationObserver(fitBigMapSoon).observe(modal, { attributes: true, attributeFilter: ["class"] });
  fitBigMapSoon();
});
// Слои карты (кнопки над картой) могут перестроиться в две строки — пересчитываем высоту
EXT.onLang.push(fitBigMapSoon);
document.addEventListener("click", e => { if (e.target.closest("#mapLayers, [data-tab='map']")) fitBigMapSoon(); });
