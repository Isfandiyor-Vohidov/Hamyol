// «Мои места» в приложении «Азербайджан»: мой отель / дом и избранные места.
// Хранятся на телефоне (az_places), работают без интернета; «Маршрут туда» — свой навигатор (#go/…).
// Сохранить можно из карточки места, со всплывающей карточки на карте или «где я сейчас» (GPS).
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const PL_TX = {
  title: ["Мои места", "My places"], sub: ["Отель и избранное", "Hotel and favourites"],
  lead: ["Сохраните отель и любимые места — дорога к ним строится в один нажим, и без интернета тоже.", "Save your hotel and favourite places — the route there is one tap away, offline too."],
  home: ["Мой отель / дом", "My hotel / home"], home_none: ["Отель ещё не выбран. Встаньте у отеля и нажмите кнопку ниже — или нажмите «Это мой отель» в карточке отеля.", "No hotel yet. Stand at your hotel and tap the button below — or tap “This is my hotel” on a hotel's page."],
  home_here: ["Я сейчас у своего отеля", "I'm at my hotel now"], back: ["Вернуться в отель", "Back to the hotel"],
  favs: ["Избранное", "Favourites"], favs_none: ["Пока пусто. Нажмите ☆ «В мои места» у любого места — оно появится здесь.", "Empty for now. Tap ☆ “Save” on any place — it will appear here."],
  here: ["Сохранить, где я сейчас", "Save where I am now"], here_name: ["Место {d}", "Place {d}"],
  save: ["В мои места", "Save"], saved: ["В моих местах", "Saved"], is_home: ["Это мой отель", "This is my hotel"],
  added: ["Сохранено в «Мои места»", "Saved to My places"], removed: ["Убрано из «Моих мест»", "Removed from My places"],
  home_set: ["Отель сохранён — «Вернуться в отель» теперь на главной", "Hotel saved — “Back to the hotel” is now on the home screen"],
  rename: ["Название", "Name"], del: ["Убрать", "Remove"], route: ["Маршрут", "Route"], no_geo: ["Не удалось определить, где вы. Включите геолокацию.", "Could not get your location. Turn on location."]
};
const pt = (k, v = {}) => { let s = PL_TX[k][LANG === "en" ? 1 : 0]; for (const x in v) s = s.replaceAll("{" + x + "}", v[x]); return s; };
const placesAll = () => store.get("az_places", []);
const placesHome = () => placesAll().find(p => p.k === "home") || null;
const plKey = (la, lo) => `${(+la).toFixed(4)},${(+lo).toFixed(4)}`;
const placeSaved = (la, lo) => placesAll().find(p => p.k === "fav" && plKey(p.la, p.lo) === plKey(la, lo)) || null;
function placesSet(list) { store.set("az_places", list); }
function placeToggle(la, lo, n, pid = "") {
  const list = placesAll(), hit = placeSaved(la, lo);
  if (hit) { placesSet(list.filter(p => p !== hit && !(p.k === "fav" && plKey(p.la, p.lo) === plKey(la, lo)))); toast(pt("removed")); return false; }
  list.push({ id: Date.now().toString(36), k: "fav", n: n || pt("here_name", { d: new Date().toLocaleDateString() }), la: +la, lo: +lo, pid, at: Date.now() });
  placesSet(list); toast(pt("added")); return true;
}
function placeSetHome(la, lo, n, pid = "") {
  placesSet([...placesAll().filter(p => p.k !== "home"), { id: "home", k: "home", n: n || pt("home"), la: +la, lo: +lo, pid, at: Date.now() }]);
  toast(pt("home_set"));
}
// Кнопки для карточки места и всплывающей карточки на карте
const placeSaveBtn = (la, lo, n, pid = "", cls = "az-btn ghost") => {
  const on = !!placeSaved(la, lo);
  return `<button type="button" class="${cls} pl-save${on ? " on" : ""}" data-pl-save="${(+la).toFixed(6)},${(+lo).toFixed(6)}" data-pl-n="${esc(n)}" data-pl-pid="${esc(pid)}" onclick="plSaveClick(this)">${icon("star", on ? "fill" : "")} ${on ? pt("saved") : pt("save")}</button>`;
};
// Нажатие — прямо на кнопке: во всплывающих карточках карты Leaflet не пускает клик дальше
function plSaveClick(s) {
  const [la, lo] = s.dataset.plSave.split(",").map(Number), on = placeToggle(la, lo, s.dataset.plN, s.dataset.plPid);
  s.classList.toggle("on", on);
  s.innerHTML = `${icon("star", on ? "fill" : "")} ${on ? pt("saved") : pt("save")}`;
}
const placeHomeBtn = (la, lo, n, pid = "") => `<button type="button" class="az-btn ghost" data-pl-home="${(+la).toFixed(6)},${(+lo).toFixed(6)}" data-pl-n="${esc(n)}" data-pl-pid="${esc(pid)}">${icon("home")} ${pt("is_home")}</button>`;

function placesScreen() {
  const home = placesHome(), favs = placesAll().filter(p => p.k === "fav").sort((a, b) => b.at - a.at);
  const dist = p => USER_POS ? ` · ${fmtDist(km(USER_POS, [p.la, p.lo]))} ${LANG === "en" ? "away" : "от вас"}` : "";
  const row = p => `<div class="az-row pl-row">
      <span class="az-pin big" style="background:${p.k === "home" ? "#1898ad" : "#c98f22"}">${icon(p.k === "home" ? "home" : "star")}</span>
      <div><b>${esc(p.n)}</b><small>${p.pid && POI[p.pid] ? esc(typeLabel(POI[p.pid].s)) + " · " + esc(cityName(POI[p.pid].city)) : esc(p.k === "home" ? pt("home") : pt("favs"))}${dist(p)}</small>
        <div class="az-btns two" style="margin-top:8px"><a class="az-btn" href="${goHref(p.la, p.lo, p.n)}">${icon("directions")} ${pt("route")}</a>
        <a class="az-btn ghost" href="${taxiHref(p.la, p.lo, p.n)}">${icon("car")} ${LL("Такси", "Taxi")}</a></div>
        <button type="button" class="pl-del" data-pl-del="${esc(p.id)}">${icon("x")} ${pt("del")}</button></div></div>`;
  return `${head("star", pt("title"), pt("lead"))}
    <h2 class="az-h2">${icon("home")} ${pt("home")}</h2>
    ${home ? `<div class="list">${row(home)}</div>` : `<div class="az-card"><p style="margin-top:0">${pt("home_none")}</p></div>`}
    <div class="az-btns"><button type="button" class="az-btn ${home ? "ghost" : ""}" data-pl-here="home">${icon("locate")} ${pt("home_here")}</button></div>
    <h2 class="az-h2">${icon("star")} ${pt("favs")}</h2>
    ${favs.length ? `<div class="list">${favs.map(row).join("")}</div>` : `<div class="az-card"><p style="margin:0">${pt("favs_none")}</p></div>`}
    <div class="az-btns"><button type="button" class="az-btn ghost" data-pl-here="fav">${icon("locate")} ${pt("here")}</button></div>`;
}
const placesRedraw = () => { if (curHash === "#mine") $("#azMain").innerHTML = placesScreen(); };
document.addEventListener("click", e => {
  const h = e.target.closest("[data-pl-home]");
  if (h) { const [la, lo] = h.dataset.plHome.split(",").map(Number); placeSetHome(la, lo, h.dataset.plN, h.dataset.plPid); return; }
  const d = e.target.closest("[data-pl-del]");
  if (d) { placesSet(placesAll().filter(p => p.id !== d.dataset.plDel)); toast(pt("removed")); return placesRedraw(); }
  const g = e.target.closest("[data-pl-here]");
  if (g) {
    if (!navigator.geolocation) return toast(pt("no_geo"));
    navigator.geolocation.getCurrentPosition(p => {
      const la = p.coords.latitude, lo = p.coords.longitude;
      USER_POS = [la, lo];
      if (g.dataset.plHere === "home") placeSetHome(la, lo, pt("home"));
      else placeToggle(la, lo, pt("here_name", { d: new Date().toLocaleString(LANG === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }));
      placesRedraw();
    }, () => toast(pt("no_geo")), { enableHighAccuracy: true, timeout: 20000 });
  }
});
// Мои места на карте страны — всегда видны (звёздочки и домик), поверх остальных значков
function placesLayer(map) {
  return L.layerGroup(placesAll().map(p => L.marker([p.la, p.lo], { zIndexOffset: 3000, icon: L.divIcon({ className: "", html: `<span class="az-pin pl-pin ${p.k}">${icon(p.k === "home" ? "home" : "star")}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] }) })
    .bindPopup(`<b>${esc(p.n)}</b><br>${p.k === "home" ? pt("home") : pt("favs")}<br><a href="${goHref(p.la, p.lo, p.n)}">${icon("directions")} ${pt("route")} →</a>`))).addTo(map);
}
