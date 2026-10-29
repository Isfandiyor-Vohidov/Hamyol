// План поездки по городу в приложении «Азербайджан»: человек пишет дни, деньги и сколько вас — всё остальное
// подбирается само: отель по бюджету, места по дням (рядом друг с другом), где поесть, как добираться.
// Каждая трата расписана: что, где, сколько × на кого, почему именно так и откуда цена (проверено / примерно).
// Цены — те же, что на карте (poiPrice, такси taxiFare, транспорт — планировщик js/az-transit.js для Баку).
// Подключается до js/az-app.js; всё из приложения берётся при вызове. Адрес: #plan/<id города>
const PLAN_TX = {
  title: ["План поездки", "Trip plan"], lead: ["Напишите три вещи — остальное приложение подберёт и посчитает само.", "Enter three things — the app picks and calculates everything else."],
  days: ["Сколько дней", "How many days"], money: ["Сколько денег на всё", "Total budget"], people: ["Сколько вас человек", "How many people"],
  build: ["Построить план", "Build the plan"], building: ["Подбираем отель, места и транспорт…", "Picking a hotel, places and transport…"],
  btn: ["Построить план поездки", "Build a trip plan"], btn_sub: ["Дни, деньги и сколько вас — остальное само", "Days, money and people — the rest is automatic"],
  total: ["Всего нужно", "Total needed"], budget: ["Ваш бюджет", "Your budget"], left: ["Останется", "Left over"], short: ["Не хватает", "Short by"],
  fits: ["Бюджета хватает", "The budget is enough"], fits_tight: ["Может хватить впритык", "It may just about fit"],
  eco1: ["Чтобы уложиться, план упрощён: ужины в кафе (а не в ресторанах), из аэропорта и по городу — на метро и автобусах, а не на такси.", "To fit the budget, the plan is simpler: dinners in cafés (not restaurants), metro and buses instead of taxis."],
  eco2: ["Чтобы уложиться, план сильно упрощён: жильё дешевле (хостел или гестхаус), еда в кафе, только транспорт, по одному платному месту в день — остальные места бесплатные.", "To fit the budget, the plan is much simpler: cheaper stay (hostel or guest house), café food, public transport only, one paid sight a day — the rest are free."], fits_not: ["Бюджета не хватает", "The budget is not enough"],
  by_cat: ["Куда уходят деньги", "Where the money goes"], by_day: ["План по дням", "Day by day"], all: ["Все траты подробно", "Every expense in detail"],
  day: ["День {n}", "Day {n}"], why: ["Почему", "Why"], how: ["Как посчитано", "How it's calculated"],
  c_hotel: ["Жильё", "Accommodation"], c_food: ["Еда", "Food"], c_tickets: ["Входные билеты", "Entry tickets"], c_transport: ["Транспорт", "Transport"], c_other: ["Прочее и запас", "Other and reserve"],
  est: ["примерная цена", "approximate price"], checked: ["цена проверена ({d})", "price checked ({d})"],
  again: ["Изменить и пересчитать", "Change and recalculate"], save_note: ["План сохранён на телефоне — открывается и без интернета.", "The plan is saved on the phone — it opens offline too."],
  route_day: ["Маршрут на этот день", "Route for this day"], tips_over: ["Как уложиться в бюджет", "How to fit the budget"], tips_left: ["Что можно добавить", "What you could add"],
  need: ["Заполните дни, деньги и количество человек", "Fill in days, money and number of people"]
};
const pl = (k, v = {}) => { let s = PLAN_TX[k][LANG === "en" ? 1 : 0]; for (const x in v) s = s.replaceAll("{" + x + "}", v[x]); return s; };
const mid = pr => pr ? (pr.lo + pr.hi) / 2 : 0;
const r2 = v => Math.round(v * 100) / 100;
// Курс: сколько единиц валюты за 1 манат (как на главной)
const planRate = cur => cur === "AZN" ? 1 : store.get("az_rates", null)?.rates?.[cur] || { UZS: 6900, USD: 0.588, RUB: 47, EUR: 0.54 }[cur] || 1;
const SIGHT_MIN = { museum: 90, gallery: 60, castle: 60, fort: 60, theme_park: 150, zoo: 120, viewpoint: 25, monument: 20, city_gate: 15, building: 30, tomb: 30, ruins: 45, archaeological_site: 60, minaret: 20, attraction: 60 };

function planScreen(id) {
  const c = CITY[id] || BAKU;
  const last = store.get("az_plan_" + c.id, null);
  setTimeout(() => { if (last) planShow(c, last); }, 30);
  const f = last?.input || { days: 3, money: 600, cur: "AZN", people: 2 };
  return `${head("route", `${pl("title")}: ${esc(cityName(c))}`, pl("lead"))}
    <form class="az-card plan-form" id="planForm" data-city="${c.id}">
      <label>${icon("calendar")} <span>${pl("days")}</span><input class="az-input" name="days" type="number" inputmode="numeric" min="1" max="14" value="${f.days}" required></label>
      <label>${icon("wallet")} <span>${pl("money")}</span><span class="plan-money"><input class="az-input" name="money" type="number" inputmode="decimal" min="1" value="${f.money}" required>
        <select class="az-select" name="cur">${["AZN", "UZS", "USD", "RUB", "EUR"].map(k => `<option value="${k}" ${k === f.cur ? "selected" : ""}>${k === "AZN" ? "₼ манат" : k === "UZS" ? "сум" : k}</option>`).join("")}</select></span></label>
      <label>${icon("users")} <span>${pl("people")}</span><input class="az-input" name="people" type="number" inputmode="numeric" min="1" max="12" value="${f.people}" required></label>
      <button class="az-btn" type="submit">${icon("sparkles")} ${pl("build")}</button>
    </form>
    <div id="planOut"></div>`;
}
document.addEventListener("submit", async e => {
  if (e.target.id !== "planForm") return;
  e.preventDefault();
  const fd = new FormData(e.target), c = CITY[e.target.dataset.city] || BAKU;
  const input = { days: Math.min(14, Math.max(1, Math.round(+fd.get("days")))), money: +fd.get("money"), cur: fd.get("cur"), people: Math.min(12, Math.max(1, Math.round(+fd.get("people")))) };
  if (!input.days || !input.money || !input.people) return toast(pl("need"));
  $("#planOut").innerHTML = `<p class="hint">${pl("building")}</p>`;
  // Подбираем под бюджет: не хватает — упрощаем по шагам (что именно — пишем в плане)
  // От самого удобного к самому экономному: [уровень, доля бюджета на жильё] — берём первый, что влезает
  let plan;
  for (const [lvl, share] of [[0, 0.5], [0, 0.42], [0, 0.35], [1, 0.35], [1, 0.28], [2, 0.24], [2, 0.18]]) {
    plan = await planBuild(c, input, lvl, share);
    const sum = plan.lines.reduce((s2, l) => s2 + (l.lo + l.hi) / 2, 0);
    if (sum <= plan.budget) break;
  }
  store.set("az_plan_" + c.id, plan);
  planShow(c, plan);
  $("#planOut")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---------- Подбор ----------
async function planBuild(c, input, lvl = 0, shareSet = 0) {
  const { days, people } = input, budget = input.money / planRate(input.cur);   // всё считаем в манатах
  const nights = Math.max(1, days - 1), rooms = Math.ceil(people / 2), cars = Math.ceil(people / 4), baku = c === BAKU;
  if (baku) await loadTransit().catch(() => null);
  const lines = [];   // { cat, day, title, where, lo, hi, est, how, why }
  const add = l => { lines.push({ est: true, day: 0, ...l, place: l.place?.id || l.place || null }); return l; };   // место — по id (план хранится на телефоне)
  const perDay = budget / days / people;   // ₼ на человека в день — от этого зависит уровень отеля и еды
  // 1. Места: самые известные в городе, по дням — рядом друг с другом
  const sights = POIS.filter(p => p.city === c && p.c === "a").sort((a, b) => fame(b) - fame(a)).slice(0, Math.max(12, days * 6));
  const center = sights.length ? [sights.slice(0, 8).reduce((s, p) => s + p.la, 0) / Math.min(8, sights.length), sights.slice(0, 8).reduce((s, p) => s + p.lo, 0) / Math.min(8, sights.length)] : [c.lat, c.lon];
  // 2. Отель: на жильё — до ~40% бюджета (меньше, если денег мало — чтобы хватило на еду и билеты)
  const share = shareSet || (lvl >= 2 ? 0.26 : (perDay < 40 ? 0.32 : perDay < 80 ? 0.4 : 0.45) * (lvl ? 0.85 : 1));
  const nightCap = budget * share / nights / rooms;
  const hotels = POIS.filter(p => p.city === c && p.c === "h").map(p => ({ p, pr: poiPrice(p), d: km(center, [p.la, p.lo]) })).filter(h => h.pr);
  const fit = hotels.filter(h => mid(h.pr) <= nightCap).sort((a, b) => (b.p.st || 0) - (a.p.st || 0) || mid(b.pr) - mid(a.pr) || a.d - b.d);
  const near = fit.filter(h => h.d < 2.5);
  const hotel = (near[0] || fit[0] || hotels.sort((a, b) => mid(a.pr) - mid(b.pr) || a.d - b.d)[0]) || null;
  const hpos = hotel ? [hotel.p.la, hotel.p.lo] : center;
  if (hotel) add({ cat: "hotel", title: LL(`Жильё: ${poiName(hotel.p)}`, `Stay: ${poiName(hotel.p)}`), where: `${typeLabel(hotel.p.s)}${hotel.p.st ? " " + "★".repeat(hotel.p.st) : ""} · ${fmtDist(hotel.d)} ${LL("от центра маршрута", "from the route centre")}`,
    lo: hotel.pr.lo * nights * rooms, hi: hotel.pr.hi * nights * rooms, est: hotel.pr.est, place: hotel.p,
    how: LL(`${fmtAzn(hotel.pr.lo, hotel.pr.hi)} за номер в ночь × ${rooms} ${rooms === 1 ? "номер" : "номера"} (вас ${people}, по 2 в номере) × ${nights} ${nights === 1 ? "ночь" : nights < 5 ? "ночи" : "ночей"}`, `${fmtAzn(hotel.pr.lo, hotel.pr.hi)} per room per night × ${rooms} room(s) (${people} people, 2 per room) × ${nights} night(s)`),
    why: mid(hotel.pr) <= nightCap ? LL(`На жильё отложено ~${Math.round(share * 100)}% бюджета — это до ${fmtAzn(Math.round(nightCap), Math.round(nightCap))} за номер в ночь. Из подходящих по цене выбран ${hotel.p.st ? "отель с самым высоким классом" : "вариант"} ближе всего к местам маршрута — меньше тратить на дорогу.`, `About ${Math.round(share * 100)}% of the budget is set aside for accommodation — up to ${fmtAzn(Math.round(nightCap), Math.round(nightCap))} per room per night. Among those that fit, the ${hotel.p.st ? "highest-rated" : "best"} option closest to the route was chosen — less spent on travel.`)
      : LL("Даже самое дешёвое жильё в городе дороже, чем позволяет бюджет, — выбрано самое недорогое и близкое к местам.", "Even the cheapest place in the city costs more than the budget allows — the cheapest and closest option was chosen.") });
  // 3. Дорога из аэропорта и обратно (Баку) + карта BakıKart
  if (baku) {
    const taxi = !lvl && perDay >= 70;
    add({ cat: "transport", day: 1, title: LL("Аэропорт → отель", "Airport → hotel"), where: LL(taxi ? "такси" : "автобус-экспресс H1 до метро «28 Мая», дальше метро", taxi ? "taxi" : "express bus H1 to «28 May» metro, then metro"),
      lo: taxi ? 30 * cars : (1.3 + 0.6) * people, hi: taxi ? 35 * cars : (1.3 + 0.6) * people, est: !taxi,
      how: taxi ? LL(`30–35 ₼ за машину × ${cars} ${cars === 1 ? "машина" : "машины"} (до 4 человек в машине)`, `30–35 ₼ per car × ${cars} car(s) (up to 4 people per car)`) : LL(`(1,30 ₼ автобус + 0,60 ₼ метро) × ${people} чел.`, `(1.30 ₼ bus + 0.60 ₼ metro) × ${people} people`),
      why: taxi ? LL("Бюджет позволяет — такси быстрее (≈30 мин) и с чемоданами удобнее.", "The budget allows it — a taxi is faster (≈30 min) and easier with luggage.") : LL("Экспресс H1 ходит круглосуточно каждые 20–30 минут и в 15 раз дешевле такси.", "Express bus H1 runs 24/7 every 20–30 minutes and is 15× cheaper than a taxi.") });
    add({ cat: "transport", day: days, title: LL("Отель → аэропорт", "Hotel → airport"), where: LL(taxi ? "такси" : "метро и автобус H1", taxi ? "taxi" : "metro and bus H1"),
      lo: taxi ? 30 * cars : (1.3 + 0.6) * people, hi: taxi ? 35 * cars : (1.3 + 0.6) * people, est: !taxi, how: LL("так же, как в первый день", "same as on day 1"), why: LL("Обратная дорога.", "The way back.") });
    add({ cat: "transport", day: 1, title: LL("Карта BakıKart", "BakıKart card"), where: LL("в автомате на любой станции метро", "from a machine at any metro station"), lo: 3 * people, hi: 3 * people, est: false,
      how: LL(`3 ₼ за карту × ${people} чел. (одна карта — один человек: по одной карте проходит один раз за поездку)`, `3 ₼ per card × ${people} people`),
      why: LL("Без неё нельзя проехать в метро и автобусе — наличными там не платят.", "You can't ride the metro or buses without it — cash is not accepted.") });
  }
  // 4. Дни: места рядом друг с другом, обед и ужин рядом с маршрутом, дорога между точками
  const food = POIS.filter(p => p.city === c && p.c === "f");
  const pickFood = (pos, kind) => food.filter(p => kind ? p.s === kind : true).map(p => [p, km(pos, [p.la, p.lo])]).filter(([, d]) => d < 1.5).sort((a, b) => fame(b[0]) - fame(a[0]) + (a[1] - b[1]) * 4)[0]?.[0] || null;
  const pool = sights.slice();
  const dayPlans = [];
  for (let d = 1; d <= days; d++) {
    let pos = hpos, time = 9.5 * 60;
    const items = [];
    const end = d === days ? 15 * 60 : 18.5 * 60;   // в последний день — пораньше, чтобы успеть в аэропорт
    let lunch = false, paid = 0;
    const paidMax = [3, 2, 1][lvl];
    while (pool.length && time < end) {
      pool.sort((a, b) => km(pos, [a.la, a.lo]) - km(pos, [b.la, b.lo]));
      // платных мест в день — не больше лимита (бесплатные — Старый город, бульвар, парки — без ограничения)
      const k = pool.findIndex(x => paid < paidMax || !(poiPrice(x)?.hi > 0));
      if (k < 0) break;
      const p = pool.splice(k, 1)[0], dist = km(pos, [p.la, p.lo]);
      if (poiPrice(p)?.hi > 0) paid++;
      const leg = await planLeg(pos, [p.la, p.lo], dist, people, cars, c, lvl ? 0 : perDay);
      time += leg.min;
      if (leg.cost.hi > 0) add({ cat: "transport", day: d, title: leg.title, where: leg.where, lo: leg.cost.lo, hi: leg.cost.hi, est: leg.cost.est, how: leg.how, why: leg.why });
      const pr = poiPrice(p), stay = SIGHT_MIN[p.s] || 45;
      items.push({ at: time, p, stay, leg });
      if (pr && pr.hi > 0) add({ cat: "tickets", day: d, title: LL(`Вход: ${poiName(p)}`, `Entry: ${poiName(p)}`), where: typeLabel(p.s), place: p, lo: pr.lo * people, hi: pr.hi * people, est: pr.est,
        how: `${fmtAzn(pr.lo, pr.hi)} × ${people} ${LL("чел.", "people")}`,
        why: pr.est ? LL(`Обычная цена входа в ${typeLabel(p.s).toLowerCase()} в этом городе; точную — уточните в кассе.`, `Usual entry price for this kind of place here; check at the ticket office.`)
          : LL(`Билет для иностранца — одно из главных мест города (в плане, потому что его чаще всего смотрят).`, `Ticket for foreigners — one of the city's top sights (included because it's the most visited).`) });
      time += stay;
      pos = [p.la, p.lo];
      if (!lunch && time >= 12.75 * 60) { lunch = true; items.push({ at: time, meal: "lunch", f: planMeal(add, d, "lunch", pos, people, perDay, pickFood, lvl) }); time += 60; }
      if (items.filter(i => i.p).length >= 4) break;
    }
    if (!lunch) { items.push({ at: Math.max(time, 13 * 60), meal: "lunch", f: planMeal(add, d, "lunch", pos, people, perDay, pickFood, lvl) }); time = Math.max(time, 13 * 60) + 60; }
    items.push({ at: Math.max(time, 19 * 60), meal: "dinner", f: planMeal(add, d, "dinner", pos, people, perDay, pickFood, lvl) });
    dayPlans.push({ day: d, items });
  }
  // Завтрак: в хорошем отеле часто включён; иначе — кафе рядом
  const breakfastIn = hotel && (hotel.p.st || 0) >= 3;
  add({ cat: "food", title: LL("Завтраки", "Breakfasts"), where: breakfastIn ? LL("в отеле", "at the hotel") : LL("кафе рядом с отелем", "café near the hotel"),
    lo: breakfastIn ? 0 : 4 * people * days, hi: breakfastIn ? 0 : 8 * people * days, est: true,
    how: breakfastIn ? LL("обычно входит в цену номера", "usually included in the room price") : LL(`4–8 ₼ на человека × ${people} чел. × ${days} дн.`, `4–8 ₼ per person × ${people} × ${days} days`),
    why: breakfastIn ? LL("В отелях от 3 звёзд в Баку завтрак чаще всего уже включён — уточните при бронировании.", "Hotels from 3 stars in Baku usually include breakfast — check when booking.") : LL("Чай, выпечка, яичница в обычном кафе — недорого и сытно.", "Tea, pastry and eggs at a regular café — cheap and filling.") });
  // 5. Прочее: вода и мелочи, связь, запас 10%
  add({ cat: "other", title: LL("Вода, перекусы, мелочи", "Water, snacks, small things"), where: LL("магазины и киоски", "shops and kiosks"), lo: 2 * people * days, hi: 5 * people * days, est: true,
    how: LL(`2–5 ₼ на человека в день × ${people} × ${days}`, `2–5 ₼ per person per day × ${people} × ${days}`), why: LL("Вода (0,50–1 ₼), чай, мороженое, сувенир-мелочь — набегает каждый день.", "Water (0.50–1 ₼), tea, ice cream, small souvenirs — adds up daily.") });
  add({ cat: "other", title: LL("Мобильный интернет", "Mobile internet"), where: LL("SIM-карта Azercell / Bakcell (в аэропорту или салоне связи, нужен паспорт)", "Azercell / Bakcell SIM (airport or shop, passport needed)"), lo: 8, hi: 15 * Math.ceil(people / 2), est: true,
    how: LL("туристический пакет 8–15 ₼, можно одну на двоих и раздавать интернет", "tourist pack 8–15 ₼, one can be shared via hotspot"), why: LL("Нужен для карт, такси и онлайн-перевода; переводчик и карты Hamyol работают и без него.", "For maps, taxis and online translation; Hamyol's translator and maps also work offline.") });
  const sub = lines.reduce((s, l) => [s[0] + l.lo, s[1] + l.hi], [0, 0]);
  add({ cat: "other", title: LL("Запас на непредвиденное (10%)", "Reserve for the unexpected (10%)"), where: "—", lo: sub[0] * 0.1, hi: sub[1] * 0.1, est: true,
    how: LL("10% от всех трат выше", "10% of all costs above"), why: LL("Цены в поездке почти всегда немного выше ожиданий: такси в час пик, лишний музей, аптека.", "Trip costs are almost always a bit higher: rush-hour taxis, an extra museum, a pharmacy.") });
  lines.forEach(l => { l.lo = r2(l.lo); l.hi = r2(l.hi); });
  return { at: Date.now(), lvl, input, budget: r2(budget), nights, rooms, hotel: hotel ? hotel.p.id : null, days: dayPlans.map(d => ({ day: d.day, items: d.items.map(i => ({ at: i.at, pid: i.p?.id, stay: i.stay, meal: i.meal, f: i.f, leg: i.leg ? { title: i.leg.title, min: Math.round(i.leg.min) } : null })) })), lines };
}
// Дорога между точками: пешком (до 1,2 км), в Баку — метро/автобус по планировщику, иначе — такси
async function planLeg(from, to, dist, people, cars, c, perDay) {
  if (dist < 1.2) return { min: dist * 16 + 3, cost: { lo: 0, hi: 0 }, title: LL("Пешком", "Walk"), where: fmtDist(dist) };
  const taxi = taxiFare(dist, c);
  if (c === BAKU && TRANSIT && perDay < 90) {
    const p = transitPlan(from, to);
    const rides = p.legs.filter(l => l.k !== "walk");
    if (rides.length) {
      const f = planFare(p), names = rides.map(l => l.k === "metro" ? LL("метро", "metro") : l.k === "bus" ? LL(`автобус ${l.r?.ref || ""}`, `bus ${l.r?.ref || ""}`) : LL("поезд", "train")).join(" + ");
      return { min: Math.round(p.arr - p.dep), cost: { lo: f.lo * people, hi: f.hi * people, est: f.est }, title: LL(`Проезд: ${names}`, `Ride: ${names}`), where: fmtDist(dist),
        how: `${fmtAzn(f.lo, f.hi)} × ${people} ${LL("чел.", "people")} (${rides.length} ${LL(rides.length === 1 ? "поездка" : "поездки", "ride(s)")} × 0,60 ₼)`,
        why: LL(`Дальше 1,2 км пешком тяжело; на транспорте ~${Math.round(p.arr - p.dep)} мин, а такси стоило бы ~${fmtAzn(taxi.lo * cars, taxi.hi * cars)}.`, `Over 1.2 km is a long walk; transit takes ~${Math.round(p.arr - p.dep)} min, a taxi would cost ~${fmtAzn(taxi.lo * cars, taxi.hi * cars)}.`) };
    }
  }
  return { min: dist * 3 + 8, cost: { lo: taxi.lo * cars, hi: taxi.hi * cars, est: true }, title: LL("Такси", "Taxi"), where: fmtDist(dist),
    how: `${fmtAzn(taxi.lo, taxi.hi)} × ${cars} ${LL(cars === 1 ? "машина" : "машины", "car(s)")}`,
    why: c === BAKU ? LL("Бюджет позволяет — такси быстрее и без пересадок.", "The budget allows it — a taxi is faster with no transfers.") : LL("Удобного общественного транспорта по этому пути нет — такси по счётчику или через Bolt.", "No convenient public transport for this route — metered taxi or Bolt.") };
}
// Обед / ужин рядом с маршрутом: при скромном бюджете — кафе, иначе ужин в ресторане
function planMeal(add, day, kind, pos, people, perDay, pickFood, lvl = 0) {
  const wantRest = kind === "dinner" && perDay >= 45 && !lvl;
  const f = pickFood(pos, wantRest ? "restaurant" : "cafe") || pickFood(pos, null);
  const pr = f ? poiPrice(f) : null, lo = pr ? pr.lo : wantRest ? 15 : 6, hi = pr ? pr.hi : wantRest ? 35 : 12;
  add({ cat: "food", day, title: `${kind === "lunch" ? LL("Обед", "Lunch") : LL("Ужин", "Dinner")}: ${f ? poiName(f) : LL("кафе рядом", "a café nearby")}`, place: f, where: f ? `${typeLabel(f.s)} · ${fmtDist(km(pos, [f.la, f.lo]))} ${LL("от последнего места", "from the last stop")}` : "—",
    lo: lo * people, hi: hi * people, est: true, how: `${fmtAzn(lo, hi)} ${LL("на человека", "per person")} × ${people} ${LL("чел.", "people")}`,
    why: wantRest ? LL("Ужин — главная еда дня, бюджет позволяет ресторан с местной кухней (кебаб, плов, долма).", "Dinner is the main meal; the budget allows a restaurant with local food (kebab, plov, dolma).")
      : LL("Недорогое кафе рядом с маршрутом — не тратить время на дорогу; средний чек кафе в этом городе.", "A cheap café near the route — no time lost travelling; the usual café bill in this city.") });
  return f ? f.id : null;
}

// ---------- Показ ----------
const PLAN_CATS = ["hotel", "food", "tickets", "transport", "other"];
const hhm = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
function planShow(c, plan) {
  const box = $("#planOut");
  if (!box) return;
  const { lines, budget, input } = plan, sum = lines.reduce((s, l) => [s[0] + l.lo, s[1] + l.hi], [0, 0]), avg = (sum[0] + sum[1]) / 2;
  const ok = avg <= budget, maybe = !ok && sum[0] <= budget, diff = budget - avg, rate = planRate(input.cur);
  const inCur = v => input.cur === "AZN" ? "" : ` (≈ ${fmtNum(Math.round(v * rate))} ${input.cur === "UZS" ? LL("сум", "so‘m") : input.cur})`;
  const byCat = PLAN_CATS.map(k => [k, lines.filter(l => l.cat === k).reduce((s, l) => s + (l.lo + l.hi) / 2, 0)]).filter(([, v]) => v > 0);
  const priceTag = l => l.est ? pl("est") : pl("checked", { d: LL(...PRICE_CHECKED) });
  const line = l => `<details class="plan-line"><summary><span>${esc(l.title)}<small>${esc(l.where || "")}</small></span><b>${l.hi > 0 ? fmtAzn(l.lo, l.hi) : t("pr_free")}</b></summary>
      <div class="plan-why"><p><b>${pl("how")}:</b> ${esc(l.how || "")}${l.hi > 0 ? ` = <b>${fmtAzn(l.lo, l.hi)}</b> <span class="az-uzs">${fmtUzs(l.lo, l.hi)}</span>` : ""}</p>
        <p><b>${pl("why")}:</b> ${esc(l.why || "")}</p><small>${icon(l.est ? "info" : "check")} ${priceTag(l)}</small>
        ${POI[l.place] ? `<div class="az-btns two"><a class="az-btn ghost" href="#place/${l.place}">${icon("info")} ${t("details")}</a><a class="az-btn ghost" href="${goHref(POI[l.place].la, POI[l.place].lo, poiName(POI[l.place]))}">${icon("directions")} ${t("route_short")}</a></div>` : ""}</div></details>`;
  const dayHtml = d => {
    const dl = lines.filter(l => l.day === d.day), dsum = dl.reduce((s, l) => [s[0] + l.lo, s[1] + l.hi], [0, 0]);
    const first = d.items.find(i => i.pid);
    return `<div class="az-card plan-day"><h3>${icon("calendar")} ${pl("day", { n: d.day })} <small>${fmtAzn(r2(dsum[0]), r2(dsum[1]))}</small></h3>
      <ol class="plan-timeline">${d.items.map(i => {
        if (i.meal) { const f = POI[i.f]; return `<li class="meal"><time>${hhm(i.at)}</time><span>${icon("food")} ${i.meal === "lunch" ? LL("Обед", "Lunch") : LL("Ужин", "Dinner")}${f ? `: <a href="#place/${f.id}">${esc(poiName(f))}</a>` : ""}</span></li>`; }
        const p = POI[i.pid];
        return p ? `<li><time>${hhm(i.at)}</time><span>${i.leg ? `<small>${icon(i.leg.title.startsWith(LL("Пешком", "Walk")) ? "walk" : "bus")} ${esc(i.leg.title)} · ~${i.leg.min} ${LL("мин", "min")}</small>` : ""}<a href="#place/${p.id}"><b>${esc(poiName(p))}</b></a><small>${typeLabel(p.s)} · ~${i.stay} ${LL("мин", "min")}</small></span></li>` : "";
      }).join("")}</ol>
      ${first ? `<div class="az-btns"><a class="az-btn ghost" href="${goHref(POI[first.pid].la, POI[first.pid].lo, poiName(POI[first.pid]))}">${icon("directions")} ${pl("route_day")}</a></div>` : ""}
      ${dl.map(line).join("")}</div>`;
  };
  const tips = ok ? [LL("Вечер на Приморском бульваре и подъём на фуникулёре к Нагорному парку (бесплатно / 1 ₼).", "An evening on the Seaside Boulevard and the funicular to Highland Park (free / 1 ₼)."), LL("Поездка за город: Гобустан и грязевые вулканы (~40–60 ₼ на машину с водителем).", "A day trip: Gobustan and mud volcanoes (~40–60 ₼ per car with a driver)."), LL("Отель классом выше или ужин в ресторане каждый день.", "A better hotel or a restaurant dinner every day.")]
    : [LL("Выберите хостел или гестхаус — жильё дешевле в 2–3 раза.", "Pick a hostel or guest house — 2–3× cheaper."), LL("Ешьте в кафе, а не в ресторанах (6–12 ₼ вместо 15–35 ₼).", "Eat in cafés, not restaurants (6–12 ₼ instead of 15–35 ₼)."), LL("Ездите на метро и автобусах (0,60 ₼), без такси.", "Use the metro and buses (0.60 ₼), no taxis."), LL("Меньше платных музеев — Старый город, бульвар и парки бесплатны.", "Fewer paid museums — the Old City, boulevard and parks are free.")];
  box.innerHTML = `
    <div class="az-card plan-sum ${ok ? "ok" : maybe ? "maybe" : "bad"}">
      <p class="plan-verdict">${icon(ok ? "circle-check" : "info")} <b>${ok ? pl("fits") : maybe ? pl("fits_tight") : pl("fits_not")}</b></p>
      ${plan.lvl ? `<p class="plan-eco">${icon("lightbulb")} ${pl(plan.lvl === 1 ? "eco1" : "eco2")}</p>` : ""}
      <div class="plan-nums">
        <div><small>${pl("total")}</small><b>${fmtAzn(Math.round(sum[0]), Math.round(sum[1]))}</b><span class="az-uzs">${fmtUzs(sum[0], sum[1])}</span></div>
        <div><small>${pl("budget")}</small><b>${fmtAzn(Math.round(budget), Math.round(budget))}</b><span class="az-uzs">${input.cur === "AZN" ? fmtUzs(budget) : esc(fmtNum(input.money) + " " + (input.cur === "UZS" ? LL("сум", "so‘m") : input.cur))}</span></div>
        <div><small>${diff >= 0 ? pl("left") : pl("short")}</small><b>${fmtAzn(Math.abs(Math.round(diff)), Math.abs(Math.round(diff)))}</b><span class="az-uzs">${inCur(Math.abs(diff))}</span></div>
      </div>
      <p class="hint" style="margin:8px 0 0">${input.days} ${LL("дн.", "days")} · ${input.people} ${LL("чел.", "people")} · ${plan.nights} ${LL("ноч.", "nights")} · ${plan.rooms} ${LL("номер(а)", "room(s)")}</p>
    </div>
    <h2 class="az-h2">${icon("wallet")} ${pl("by_cat")}</h2>
    <div class="az-card">${byCat.map(([k, v]) => `<div class="plan-bar"><span>${pl("c_" + k)}</span><b>${fmtAzn(Math.round(v), Math.round(v))} · ${Math.round(v / avg * 100)}%</b><i style="width:${Math.max(3, v / avg * 100)}%"></i></div>`).join("")}</div>
    <h2 class="az-h2">${icon("lightbulb")} ${ok ? pl("tips_left") : pl("tips_over")}</h2>
    <div class="az-card"><ul class="az-list">${tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <h2 class="az-h2">${icon("hotel")} ${pl("c_hotel")}</h2>
    <div class="az-card">${lines.filter(l => l.cat === "hotel").map(line).join("")}</div>
    <h2 class="az-h2">${icon("route")} ${pl("by_day")}</h2>
    ${plan.days.map(dayHtml).join("")}
    <h2 class="az-h2">${icon("list")} ${pl("all")}</h2>
    <div class="az-card">${lines.filter(l => !l.day && l.cat !== "hotel").map(line).join("")}</div>
    <p class="hint">${icon("check")} ${pl("save_note")}</p>
    <div class="az-btns"><button type="button" class="az-btn ghost" data-plan-top>${icon("edit")} ${pl("again")}</button></div>`;
}
document.addEventListener("click", e => { if (e.target.closest("[data-plan-top]")) $("#planForm")?.scrollIntoView({ behavior: "smooth" }); });
