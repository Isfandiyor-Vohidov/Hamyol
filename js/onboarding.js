// Приветствие при первом запуске: язык и крупный текст, что умеет Safar, зачем геолокация.
// Показывается один раз (safar_onboarded) и только на главной — открытая по ссылке страница не перекрывается.
function onbSlides() {
  const big = document.documentElement.classList.contains("big");
  return [
    `<div class="onb-hero">${icon("girih")}</div>
     <h2>${t("onb_hi")}</h2><p>${t("onb_hi_sub")}</p>
     <div class="onb-langs">${Object.entries(LANGS).map(([k, v]) => `<button type="button" class="chip ${k === LANG ? "on" : ""}" data-onb-lang="${k}"><b>${LANG_CODE[k]}</b> ${v}</button>`).join("")}</div>
     <button type="button" class="onb-big ${big ? "on" : ""}" data-onb-big aria-pressed="${big}">${icon("text-size")}<span><b>${t("big_text")}</b><small>${t("onb_big_sub")}</small></span><i class="onb-switch"></i></button>`,
    `<h2>${t("onb_who")}</h2>
     <div class="onb-roles">${ONB_ROLES.map(([r, ic]) => `<button type="button" class="onb-role ${store.get("safar_role", "") === r ? "on" : ""}" data-onb-role="${r}"><i>${icon(ic)}</i><span>${t("onb_r_" + r)}</span></button>`).join("")}</div>
     <h3 class="onb-can-h">${t("onb_can")}</h3>
     <div class="onb-feats">
       ${[["directions", "onb_f_nav"], ["coins", "onb_f_prices"], ["download", "onb_f_off"], ["calendar-range", "onb_f_trip"]].map(([ic, k], i) =>
         `<div class="onb-feat" style="--n:${i}"><i>${icon(ic)}</i><span><b>${t(k)}</b><small>${t(k + "_sub")}</small></span></div>`).join("")}
     </div>`,
    `<div class="onb-hero geo">${icon("locate")}</div>
     <h2>${t("onb_geo")}</h2><p>${t("onb_geo_sub")}</p>
     <button type="button" class="btn gold-btn onb-geo-btn" data-onb-geo>${icon("locate")} ${t("onb_geo_allow")}</button>
     <p class="hint onb-geo-note">${icon("shield")} ${t("onb_geo_note")}</p>`
  ];
}

// Кто человек — от этого зависит, что открыть после приветствия
const ONB_ROLES = [["tourist", "compass"], ["local", "home"], ["guide", "flag"], ["business", "store"]];
let onbStep = 0;
function renderOnb() {
  const box = $("#onb");
  if (!box) return;
  const slides = onbSlides(), last = onbStep === slides.length - 1;
  box.querySelector(".onb-slide").innerHTML = slides[onbStep];
  box.querySelector(".onb-slide").style.animation = "none";
  void box.offsetWidth;
  box.querySelector(".onb-slide").style.animation = "";
  box.querySelector(".onb-dots").innerHTML = slides.map((_, i) => `<i class="${i === onbStep ? "on" : ""}"></i>`).join("");
  box.querySelector("[data-onb-next]").innerHTML = last ? `${icon("compass")} ${t("onb_start")}` : `${t("onb_next")} ${icon("arrow-right")}`;
  box.querySelector("[data-onb-prev]").classList.toggle("hidden", onbStep === 0);
  box.querySelector("[data-onb-skip]").textContent = t("onb_skip");
}
function closeOnb() {
  store.set("safar_onboarded", 1);
  // Гиду — аккаунт (там кабинет гида), бизнесу — страница «Для бизнеса»
  const role = store.get("safar_role", "");
  if (role === "guide") setTimeout(() => { location.hash = "#account"; }, 450);
  if (role === "business") setTimeout(() => { location.hash = "#partners"; }, 450);
  const box = $("#onb");
  if (!box) return;
  box.classList.add("out");
  setTimeout(() => box.remove(), 400);
}
function openOnb() {
  if ($("#onb")) return;
  onbStep = 0;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="onb" class="onb" role="dialog" aria-modal="true">
      <div class="onb-card">
        <button type="button" class="onb-skip" data-onb-skip></button>
        <div class="onb-slide"></div>
        <div class="onb-foot">
          <button type="button" class="btn ghost" data-onb-prev>${icon("arrow-left")}</button>
          <div class="onb-dots"></div>
          <button type="button" class="btn gold-btn" data-onb-next></button>
        </div>
      </div>
    </div>`);
  renderOnb();
}

document.addEventListener("click", async e => {
  if (!e.target.closest("#onb")) return;
  if (e.target.closest("[data-onb-skip]")) return closeOnb();
  if (e.target.closest("[data-onb-prev]")) { onbStep = Math.max(0, onbStep - 1); return renderOnb(); }
  if (e.target.closest("[data-onb-next]")) { if (onbStep >= 2) return closeOnb(); onbStep++; return renderOnb(); }
  const lang = e.target.closest("[data-onb-lang]");
  if (lang) {
    const sel = $("#langSelect");
    sel.value = lang.dataset.onbLang;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    syncPickers();
    return renderOnb();
  }
  const role = e.target.closest("[data-onb-role]");
  if (role) {
    store.set("safar_role", role.dataset.onbRole);
    // Живущим в Узбекистане — цены сразу в сумах
    if (role.dataset.onbRole === "local" && currency !== "UZS") { const c = $("#currency"); c.value = "UZS"; c.dispatchEvent(new Event("change", { bubbles: true })); syncPickers?.(); }
    $$("#onb [data-onb-role]").forEach(b => b.classList.toggle("on", b === role));
    return;
  }
  if (e.target.closest("[data-onb-big]")) { dispSet({ size: document.documentElement.classList.contains("big") ? 100 : 115 }); return renderOnb(); }
  const geo = e.target.closest("[data-onb-geo]");
  if (geo) {
    geo.disabled = true;
    try { await locate(); geo.innerHTML = `${icon("circle-check")} ${t("onb_geo_ok")}`; geo.classList.add("done"); }
    catch (err) { geo.disabled = false; if (err?.message !== "no consent") toast(t("geo_denied")); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#onb")) closeOnb(); });

// Первый запуск: ждём, пока уйдёт заставка, и показываем, если человек на главной
EXT.onInit.push(() => {
  if (store.get("safar_onboarded", 0)) return;
  const kind = (location.hash.slice(1) || "home").split("/")[0];
  if (kind !== "home") return store.set("safar_onboarded", 1);
  const wait = (n = 0) => document.getElementById("splash") && n < 60 ? setTimeout(() => wait(n + 1), 150) : setTimeout(openOnb, 350);
  wait();
});
