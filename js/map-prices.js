// Цены прямо на карте: подпись под значком (вход, средний чек, ночь в отеле, проезд) и строка во всплывающей карточке.
// Известные места — цена входа для иностранца по открытым источникам (октябрь 2026); остальное — обычная вилка
// из справочника «Цены на месте» (js/prices-data.js) с поправкой на город. Оценки помечены «примерно».
const MAP_PRICE_CHECKED = ["2026-yil oktabr", "окт. 2026", "Oct 2026"];

Object.assign(DICT, {
  mp_free: ["bepul", "бесплатно", "free"],
  mp_ticket: ["Kirish", "Вход", "Entry"],
  mp_person: ["O‘rtacha chek", "Средний чек", "Per person"],
  mp_night: ["Bir kecha", "Ночь", "Night"],
  mp_est: ["taxminan, aniqrog‘i — joyida", "примерно, точнее — на месте", "approximate, check on site"],
  mp_checked: ["tekshirildi: {d}", "проверено {d}", "checked {d}"],
  mp_k: ["ming", "тыс.", "k"],
  fare_metro_tash: ["Metro / avtobus: 2 500 so‘m kartada, 3 000 so‘m naqd", "Метро / автобус: 2 500 сум по карте, 3 000 сум наличными", "Metro / bus: 2,500 so‘m by card, 3,000 so‘m cash"],
  fare_bus_uz: ["Shaharlararo avtobus: ~30–150 ming so‘m", "Межгородний автобус: ~30–150 тыс. сум", "Intercity bus: ~30–150k so‘m"],
  fare_bus_city: ["Shahar avtobusi: ~2 000–3 000 so‘m", "Городской автобус: ~2 000–3 000 сум", "City bus: ~2,000–3,000 so‘m"],
  fare_train_uz: ["Poyezd: Afrosiyob Toshkent–Samarqand ~300 ming so‘mdan, oddiy poyezdlar arzonroq", "Поезд: «Афросиаб» Ташкент–Самарканд от ~300 тыс. сум, обычные поезда дешевле", "Train: Afrosiyob Tashkent–Samarkand from ~300k so‘m, regular trains cheaper"],
  fare_air_uz: ["Markazgacha taksi: {p}", "Такси до центра: {p}", "Taxi to the centre: {p}"]
});
if (typeof X_UI !== "undefined") Object.assign(X_UI, {
  mp_free: ["ücretsiz", "kostenlos", "免费", "무료"],
  mp_ticket: ["Giriş", "Eintritt", "门票", "입장료"],
  mp_person: ["Kişi başı", "Pro Person", "人均", "1인당"],
  mp_night: ["Gece", "Nacht", "每晚", "1박"],
  mp_est: ["yaklaşık, yerinde kontrol edin", "ungefähr, vor Ort prüfen", "约，以现场为准", "대략, 현장에서 확인"],
  mp_checked: ["kontrol: {d}", "geprüft {d}", "核实于 {d}", "확인 {d}"],
  fare_metro_tash: ["Metro / otobüs: kartla 2.500, nakit 3.000 som", "Metro / Bus: 2.500 Som mit Karte, 3.000 bar", "地铁/公交：刷卡2500苏姆，现金3000", "지하철/버스: 카드 2,500숨, 현금 3,000숨"],
  fare_bus_uz: ["Şehirlerarası otobüs: ~30–150 bin som", "Fernbus: ~30–150 Tsd. Som", "长途汽车：约3万–15万苏姆", "시외버스: 약 3만–15만 숨"],
  fare_bus_city: ["Şehir otobüsü: ~2.000–3.000 som", "Stadtbus: ~2.000–3.000 Som", "市内公交：约2000–3000苏姆", "시내버스: 약 2,000–3,000숨"],
  fare_train_uz: ["Tren: Afrosiyob Taşkent–Semerkant ~300 bin somdan", "Zug: Afrosiyob Taschkent–Samarkand ab ~300 Tsd. Som", "火车：Afrosiyob 塔什干–撒马尔罕 约30万苏姆起", "기차: 아프로시욥 타슈켄트–사마르칸트 약 30만 숨부터"],
  fare_air_uz: ["Merkeze taksi: {p}", "Taxi ins Zentrum: {p}", "打车到市中心：{p}", "시내까지 택시: {p}"]
});

// [название (uz/ru/en), [мин, макс] в сумах, город (id) или null, точная цена?]
const UZ_FEES = [
  [/registon|регистан|registan/i, [100000], "samarkand", true],
  [/go[‘'ʻ`]?ri? ?amir|гур[- ]?э?эмир|gur[- ]e[- ]amir/i, [75000], "samarkand", true],
  [/shohi ?zinda|шахи[- ]?зинда|shah[- ]i[- ]zinda/i, [40000, 60000], "samarkand"],
  [/bibi ?xonim|биби[- ]?ханым|bibi[- ]khanym/i, [25000, 50000], "samarkand"],
  [/ulug[‘'ʻ`]?bek rasadxona|обсерватория улугбека|ulugh ?beg observatory/i, [40000, 60000], "samarkand"],
  [/^(ark|арк)\b|ark (qal|fortress|citadel)|крепость арк/i, [50000, 70000], "bukhara"],
  [/poi ?kalon|пои[- ]?калян|po[- ]i[- ]kalyan/i, [25000, 50000], "bukhara"],
  [/chor ?minor|чор[- ]?минор|chor[- ]minor/i, [25000, 35000], "bukhara"],
  [/somoniy|саманид|samanid/i, [25000, 50000], "bukhara"],
  [/ichan ?qal|ичан[- ]?кала|itchan ?kala|ichan ?kala/i, [150000, 250000], "khiva"],
  [/tosh ?hovli|таш[- ]?хаули|tash[- ]?hauli/i, [35000, 60000], "khiva"],
  [/oqsaroy|ак[- ]?сарай|ak[- ]?saray/i, [35000, 60000], "shahrisabz"],
  [/savitsk|савицк/i, [60000, 120000], null],
  [/teleminora|телебашн|tv tower/i, [120000, 180000], "tashkent"],
  [/temuriylar tarixi|музей (истории )?темуридов|amir timur museum|timurid/i, [35000, 60000], "tashkent"],
  [/hazrati? ?imom|хаст[- ]?имам|hast[- ]?imam|khast[- ]?imam/i, [25000, 60000], "tashkent"],
  [/labi ?hovuz|ляби[- ]?хауз|lyabi[- ]?hauz|mizdahkan|миздахкан/i, [0], null]
];
const UZ_FREE = new Set(["monument", "viewpoint", "city_gate", "building", "ruins", "archaeological_site", "minaret"]);
const UZ_KIND = { museum: "museum", gallery: "museum", castle: "museum", fort: "museum", tomb: "museum", restaurant: "lunch" };
const UZ_RANGE = { theme_park: [30000, 100000], zoo: [20000, 40000], cafe: [25000, 60000] };
const roundSum = v => v >= 20000 ? Math.round(v / 5000) * 5000 : v >= 5000 ? Math.round(v / 1000) * 1000 : Math.round(v / 500) * 500;
const PRICE_ITEM = id => PRICE_ITEMS.find(i => i.id === id);

// Цена места: { lo, hi (сумы), est, unit } или { text } для отеля (своя оценка в app.js)
function poiPrice(p) {
  if (p.c === "h") {
    if (p.priceFrom != null) return { hotel: hotelPrice(p), chip: money(usd(p.priceFrom)), est: false, unit: "night" };
    return p.usd ? { hotel: hotelPrice(p), chip: "~" + money(usd(p.usd)), est: true, unit: "night" } : null;
  }
  if (p.c === "a") {
    const names = [p.n, p.nr, p.ne, p.nu].filter(Boolean).join(" | ");
    const fee = UZ_FEES.find(([re, , city]) => re.test(names) && (!city || p.city?.id === city));
    if (fee) return { lo: fee[1][0], hi: fee[1][1] ?? fee[1][0], est: !fee[3], unit: "ticket" };
    if (UZ_FREE.has(p.s)) return { lo: 0, hi: 0, est: true, unit: "ticket" };
  }
  const item = UZ_KIND[p.s] && PRICE_ITEM(UZ_KIND[p.s]);
  const range = item ? priceRange(item, p.city?.id) : UZ_RANGE[p.s] && UZ_RANGE[p.s].map(v => roundSum(v * priceTier(p.city?.id)));
  if (!range) return null;
  return { lo: range[0], hi: range[1], est: true, unit: p.c === "f" ? "person" : "ticket" };
}
// Коротко для подписи на карте: «~30–60 тыс.»
const kSum = v => v >= 1000 ? fmtNum(Math.round(v / 1000)) : fmtNum(v);
function priceChip(pr) {
  if (!pr) return "";
  if (pr.chip) return pr.chip;
  if (!pr.lo && !pr.hi) return t("mp_free");
  const k = pr.hi >= 1000 ? " " + t("mp_k") : "";
  return (pr.est ? "~" : "") + (pr.lo === pr.hi ? kSum(pr.lo) : `${kSum(pr.lo)}–${kSum(pr.hi)}`) + k;
}
// Полная строка для всплывающей карточки (в сумах и, если выбрана, в своей валюте)
function priceLine(pr) {
  if (!pr) return "";
  let val = pr.hotel;
  if (!val) {
    if (!pr.lo && !pr.hi) val = t("mp_free");
    else {
      const cur = fmtCur(pr.lo) && (pr.lo === pr.hi ? fmtCur(pr.lo) : `${fmtCur(pr.lo)}–${fmtCur(pr.hi)}`);
      val = (pr.lo === pr.hi ? fmtSum(pr.lo) : `${fmtNum(pr.lo)}–${fmtSum(pr.hi)}`) + (cur ? ` (${cur})` : "");
    }
    val = `${t("mp_" + pr.unit)}: ${val}`;
  }
  return `<div class="map-price-line">${icon("banknote")} <b>${val}</b><small>${pr.est ? t("mp_est") : t("mp_checked", { d: L3(MAP_PRICE_CHECKED) })}</small></div>`;
}
const pinPrice = (txt, exact) => txt ? `<em class="pin-price${exact ? " exact" : ""}">${esc(txt)}</em>` : "";
const poiPricePin = p => { const pr = poiPrice(p); return pinPrice(priceChip(pr), pr && !pr.est); };

// Проезд у вокзалов, автовокзалов и аэропортов (слой «Сервисы»)
function fareOf(s) {
  const tash = s.city?.id === "tashkent";
  if (s.type === "rail") return tash ? { text: t("fare_metro_tash"), chip: "2 500", est: false } : { text: t("fare_train_uz"), chip: "~300 " + t("mp_k"), est: true };
  if (s.type === "bus") return tash ? { text: t("fare_metro_tash"), chip: "2 500", est: false } : { text: t("fare_bus_uz") + " · " + t("fare_bus_city"), chip: "", est: true };
  if (s.type === "airport") {
    const [lo, hi] = priceRange(PRICE_ITEM("taxi_airport"), s.city?.id);
    return { text: t("fare_air_uz", { p: `${fmtNum(lo)}–${fmtSum(hi)}` }), chip: `~${kSum(lo)}–${kSum(hi)} ${t("mp_k")}`, est: true };
  }
  return null;
}
const fareLine = f => f ? `<div class="map-price-line">${icon("ticket")} <b>${esc(f.text)}</b><small>${f.est ? t("mp_est") : t("mp_checked", { d: L3(MAP_PRICE_CHECKED) })}</small></div>` : "";
const farePin = s => { const f = fareOf(s); return f ? pinPrice(f.chip, !f.est) : ""; };

// Подписи не налезают друг на друга: оставляем первую, остальные прячем до приближения
function declutterMapPrices(root) {
  const taken = [];
  root.querySelectorAll(".pin-price").forEach(el => {
    el.classList.remove("hide");
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    if (taken.some(o => r.left < o.right + 4 && r.right > o.left - 4 && r.top < o.bottom + 2 && r.bottom > o.top - 2)) return el.classList.add("hide");
    taken.push(r);
  });
}
