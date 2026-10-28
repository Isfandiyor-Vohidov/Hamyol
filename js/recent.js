// «Недавно смотрели» на главной: последние открытые города и места — лентой карточек над «Популярными».
// Хранится только на этом устройстве (safar_recent), работает без интернета. Этот же список берёт
// фоновое сохранение (js/autosave.js), чтобы сохранить для офлайна города, которые человек открывал.

const RECENT_MAX = 8;
const recentList = () => store.get("safar_recent", []).filter(x => recentItem(x.k));
const recentItem = k => k?.startsWith("city:") ? CITY[k.slice(5)] : k?.startsWith("poi:") ? POI[k.slice(4)] : null;

function recentAdd(key) {
  const list = store.get("safar_recent", []).filter(x => x.k !== key);
  list.unshift({ k: key, at: Date.now() });
  store.set("safar_recent", list.slice(0, RECENT_MAX));
  renderRecent();
}

function recentCard(x) {
  const o = recentItem(x.k), city = x.k.startsWith("city:");
  const img = city ? (o.img ? commonsImg(o.img, 320) : "") : poiPhoto(o, 320);
  const bg = city ? regionBg(o.r) : CAT_BG[o.c];
  return `<a class="rc-card" href="#${city ? "city" : "place"}/${o.id}">
    <span class="rc-img" style="background:${img ? `url('${img}') center / cover no-repeat, ` : ""}${bg}">${img ? "" : icon(city ? o.ico : poiIcon(o))}</span>
    <b>${esc(city ? cityName(o) : poiName(o))}</b>
    <small>${city ? regionName(o.r) : `${typeLabel(o.s)} · ${esc(cityName(o.city))}`}</small></a>`;
}

function renderRecent() {
  const box = $("#recentBox");
  if (!box) return;
  const list = recentList();
  box.classList.toggle("hidden", !list.length);
  box.innerHTML = list.length ? `
    <div class="block-head"><h2>${icon("clock")} <span>${t("rc_title")}</span></h2>
      <button type="button" class="btn ghost small" data-recent-clear>${icon("x")} ${t("rc_clear")}</button></div>
    <div class="rc-strip">${list.map(recentCard).join("")}</div>` : "";
}

document.addEventListener("click", e => {
  if (!e.target.closest("[data-recent-clear]")) return;
  const box = $("#recentBox");
  const done = () => { store.set("safar_recent", []); renderRecent(); };
  if (box && !matchMedia("(prefers-reduced-motion: reduce)").matches) { box.classList.add("closing"); setTimeout(() => { box.classList.remove("closing"); done(); }, 220); }
  else done();
});

// Запоминаем при открытии города и места
EXT.cityOverviewBind.push(c => recentAdd(c.key));
EXT.placeExtras.push(p => { setTimeout(() => recentAdd(p.key)); return ""; });

EXT.onHome.push(() => {
  if (!$("#recentBox")) $("#popularGrid")?.closest("section")?.insertAdjacentHTML("beforebegin", `<section class="block recent hidden" id="recentBox"></section>`);
  renderRecent();
});
