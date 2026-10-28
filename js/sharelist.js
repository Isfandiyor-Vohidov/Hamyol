// Общие списки избранного (как в Airbnb): «Поделиться списком» в «Избранном» → ссылка #list/<код>.
// Друг открывает её и видит города и места; может сохранить всё себе или добавить города в поездку.
// Список целиком в ссылке — сервер и аккаунт не нужны.
const listCode = () => b64url(JSON.stringify({
  n: window.SAFAR_USER?.name || "",
  k: [...FAVS].map(k => k.replace(/^city:/, "c").replace(/^poi:/, "p")).slice(0, 120)
}));
const listKeys = code => {
  const o = JSON.parse(unb64url(code));
  return { name: String(o.n || "").slice(0, 40), keys: (o.k || []).map(k => k[0] === "c" ? "city:" + k.slice(1) : "poi:" + k.slice(1))
    .filter(k => k.startsWith("city:") ? CITY[k.slice(5)] : POI[k.slice(4)]) };
};

async function shareFavList() {
  if (!FAVS.size) return toast(t("fav_empty"));
  const url = `${location.origin}${location.pathname}#list/${listCode()}`;
  try {
    if (navigator.share) await navigator.share({ title: "Hamyol — " + t("favorites"), text: t("sl_text"), url });
    else { await navigator.clipboard.writeText(url); toast(t("link_copied")); }
  } catch { /* окно «Поделиться» закрыто */ }
}

function openSharedList(code) {
  let data;
  try { data = listKeys(code); } catch { data = { name: "", keys: [] }; }
  const cities = data.keys.filter(k => k.startsWith("city:")).map(k => CITY[k.slice(5)]);
  const pois = data.keys.filter(k => k.startsWith("poi:")).map(k => POI[k.slice(4)]);
  const newOnes = data.keys.filter(k => !FAVS.has(k)).length;
  openModal(`
    <div class="m-head" style="background:${CAT_BG.f};min-height:160px;padding-top:60px"><h2>${icon("heart")} ${data.name ? t("sl_from", { name: esc(data.name) }) : t("sl_title")}</h2>
      <p>${t("sl_count", { n: data.keys.length })}</p></div>
    <div class="m-body">
      ${data.keys.length ? `<div class="sl-acts">
        <button type="button" class="btn gold-btn" data-sl-save="${esc(code)}" ${newOnes ? "" : "disabled"}>${icon("heart")} ${newOnes ? t("sl_save", { n: newOnes }) : t("sl_saved")}</button>
        ${cities.length ? `<button type="button" class="btn ghost" data-sl-trip="${esc(code)}">${icon("plus")} ${t("sl_trip", { n: cities.length })}</button>` : ""}
      </div>` : `<p class="empty">${t("sl_broken")}</p>`}
      ${cities.length ? `<div class="grid">${cities.map(cityCard).join("")}</div>` : ""}
      ${pois.length ? `<div class="list" style="margin-top:16px">${pois.map(poiRow).join("")}</div>` : ""}
    </div>`);
}

document.addEventListener("click", e => {
  if (e.target.closest("[data-sl-share]")) return shareFavList();
  const save = e.target.closest("[data-sl-save]");
  if (save) {
    const { keys } = listKeys(save.dataset.slSave);
    keys.filter(k => !FAVS.has(k)).forEach(k => toggleFav(k));
    save.disabled = true; save.innerHTML = `${icon("heart")} ${t("sl_saved")}`;
    return toast(t("sl_saved"));
  }
  const trip = e.target.closest("[data-sl-trip]");
  if (trip) {
    const ids = listKeys(trip.dataset.slTrip).keys.filter(k => k.startsWith("city:")).map(k => k.slice(5)).filter(id => !tripRoute.some(r => r.id === id));
    ids.forEach(id => tripRoute.push({ id, nights: 2 }));
    updateRoute();
    toast(t("trip_loaded"));
    location.hash = "#budget";
  }
});

EXT.routes.list = openSharedList;
// Кнопка в «Избранном»
EXT.favsExtras.push(() => FAVS.size ? `<button type="button" class="btn ghost sl-share" data-sl-share>${icon("share")} ${t("sl_share")}</button>` : "");
