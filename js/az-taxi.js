// Карточка для таксиста в приложении «Азербайджан»: куда ехать — крупно по-азербайджански (показать водителю),
// примерная цена поездки (чтобы не переплатить), нужные фразы с озвучкой и кнопки Bolt / Uber.
// Работает без интернета (кроме самих приложений такси). Адрес экрана: #taxi/<широта>,<долгота>,<название>
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const TAXI_TX = {
  title: ["Такси", "Taxi"], show: ["Показать водителю", "Show the driver"], driver: ["Zəhmət olmasa, məni bu ünvana aparın:", "Zəhmət olmasa, məni bu ünvana aparın:"],
  price: ["Примерная цена", "Approximate fare"], price_note: ["по счётчику / в приложении такси; ночью и в час пик — дороже. Договаривайтесь о цене до поездки.", "by meter / in a taxi app; more at night and at rush hour. Agree on the price before the ride."],
  no_pos: ["Чтобы посчитать цену, разрешите геолокацию (или откройте карточку снова на месте).", "Allow location to estimate the fare (or open this card again when you're there)."],
  dist: ["~{d} по дороге", "~{d} by road"], phrases: ["Фразы для водителя", "Phrases for the driver"],
  apps: ["Вызвать через приложение (нужен интернет)", "Book in an app (needs internet)"], tip: ["Совет: в Баку удобнее и дешевле заказывать такси в приложении Bolt или Uber — цена известна заранее.", "Tip: in Baku a taxi booked in Bolt or Uber is easier and cheaper — the price is known in advance."]
};
const tx2 = (k, v = {}) => { let s = TAXI_TX[k][LANG === "en" ? 1 : 0]; for (const x in v) s = s.replaceAll("{" + x + "}", v[x]); return s; };
// Фразы: [по-русски, по-английски, по-азербайджански]
const TAXI_PHRASES = [
  ["Сколько стоит до этого места?", "How much to this place?", "Bu ünvana neçəyə aparırsınız?"],
  ["Включите, пожалуйста, счётчик", "Please turn on the meter", "Zəhmət olmasa, sayğacı yandırın"],
  ["Остановите здесь, пожалуйста", "Please stop here", "Zəhmət olmasa, burada saxlayın"],
  ["Подождите меня 5 минут", "Please wait for me 5 minutes", "Məni 5 dəqiqə gözləyin"],
  ["Дорого. Можно дешевле?", "Too expensive. Can it be cheaper?", "Bahadır. Bir az ucuz olar?"],
  ["Дайте сдачу, пожалуйста", "My change, please", "Qalığı verin, zəhmət olmasa"]
];
// Цена: в Баку ~1,5 ₼ посадка + 0,6–0,9 ₼/км (Bolt/Uber, октябрь 2026); в регионах дешевле. Дорога ~ прямая × 1,35
function taxiFare(d, city) {
  const k = city === BAKU || !city ? 1 : 0.8, road = d * 1.35;
  const lo = Math.max(3, Math.round((1.5 + road * 0.6) * k)), hi = Math.max(lo + 1, Math.round((2 + road * 0.9) * k));
  return { lo, hi, road };
}
const taxiParse = id => { const [la, lo, ...n] = (id || "").split(","); return isFinite(+la) && isFinite(+lo) && la && lo ? { la: +la, lo: +lo, n: decodeURIComponent(n.join(",")) } : null; };
const taxiHref = (la, lo, n) => `#taxi/${(+la).toFixed(5)},${(+lo).toFixed(5)},${encodeURIComponent(n || "")}`;
// Название по-азербайджански (так понятнее водителю) и адрес — из данных, если это известное место
function taxiDest(d) {
  const p = POIS.find(x => Math.abs(x.la - d.la) < 0.00002 && Math.abs(x.lo - d.lo) < 0.00002);
  return { az: p?.n || d.n, ad: p?.ad || "", other: p && poiName(p) !== p.n ? poiName(p) : "", city: p?.city || null };
}
function taxiScreen(id) {
  const d = taxiParse(id);
  if (!d) return SCREENS.home();
  const dest = taxiDest(d);
  const uber = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.la}&dropoff[longitude]=${d.lo}&dropoff[nickname]=${encodeURIComponent(dest.az)}`;
  const bolt = `https://bolt.eu/en/ride/?destination_lat=${d.la}&destination_lng=${d.lo}`;
  setTimeout(() => taxiPrice(d, dest), 50);
  return `${head("car", tx2("title"))}
    <div class="taxi-card" id="taxiCard">
      <small>${tx2("driver")}</small>
      <b lang="az">${esc(dest.az)}</b>
      ${dest.ad ? `<p lang="az">${esc(dest.ad)}</p>` : ""}
      ${dest.other ? `<small>${esc(dest.other)}</small>` : ""}
    </div>
    <div class="az-btns two"><button type="button" class="az-btn" data-big="${esc(dest.az + (dest.ad ? " — " + dest.ad : ""))}">${icon("maximize")} ${tx2("show")}</button>
      <button type="button" class="az-btn ghost" data-say="${esc(TAXI_PHRASES[0][2].replace("Bu ünvana", dest.az + ","))}" data-lang="az">${icon("volume")} ${t("tr_say")}</button></div>
    <h2 class="az-h2">${icon("banknote")} ${tx2("price")}</h2>
    <div class="az-card" id="taxiPrice"><p class="hint" style="margin:0">…</p></div>
    <h2 class="az-h2">${icon("message")} ${tx2("phrases")}</h2>
    <div class="list">${TAXI_PHRASES.map(p => `<button type="button" class="az-row taxi-ph" data-say="${esc(p[2])}" data-lang="az"><span class="az-pin big" style="background:#c98f22">${icon("volume")}</span><div><b lang="az">${esc(p[2])}</b><small>${esc(LANG === "en" ? p[1] : p[0])}</small></div></button>`).join("")}</div>
    <h2 class="az-h2">${icon("smartphone")} ${tx2("apps")}</h2>
    <div class="az-btns two">${ext(bolt, "car", "Bolt")}${ext(uber, "car", "Uber", "ghost")}</div>
    <div class="az-note">${icon("info")}<span>${tx2("tip")}</span></div>`;
}
function taxiPrice(d, dest) {
  const box = $("#taxiPrice");
  if (!box) return;
  const draw = pos => {
    const f = taxiFare(km(pos, [d.la, d.lo]), dest.city);
    box.innerHTML = `<div class="az-price-line" style="margin:0">${icon("car")} <b style="font-size:1.4rem">~${fmtAzn(f.lo, f.hi)}</b><span class="az-uzs">${fmtUzs(f.lo, f.hi)}</span>
      <small>${tx2("dist", { d: fmtDist(f.road) })} · ${tx2("price_note")}</small></div>`;
  };
  if (USER_POS) return draw(USER_POS);
  box.innerHTML = `<p class="hint" style="margin:0">${tx2("no_pos")}</p>`;
  navigator.geolocation?.getCurrentPosition(p => { USER_POS = [p.coords.latitude, p.coords.longitude]; if ($("#taxiPrice")) draw(USER_POS); }, () => {}, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
}
