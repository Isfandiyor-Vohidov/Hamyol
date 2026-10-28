// Общественный транспорт в приложении «Азербайджан»: метро и автобусы Баку (маршруты и остановки — OpenStreetMap),
// электрички и поезда ADY по расписанию. Данные — data/az-transit.js (scripts/fetch-az-transit.mjs), грузятся по требованию
// и сохраняются сервис-воркером, так что маршрут на транспорте строится и без интернета.
// Планировщик: «пешком до остановки → автобус / метро / поезд → пересадка → пешком», время и цена.
// Точного расписания автобусов и метро нет — считаем по обычным интервалам; поезда — по расписанию ADY.
// Подключается до js/az-app.js; всё из приложения (LANG, LL, icon, esc, km, fmtDist, fmtAzn, fmtUzs…) берётся при вызове.

const TRANSIT_FARE = { metro: 0.6, bus: 0.6 };      // BakıKart, за поездку (октябрь 2026)
const SUB_FARE = [0.2, 0.8];
// Экспресс H-1 (аэропорт) — 1,30 ₼, остальные автобусы и метро — 0,60 ₼
const routeFare = r => /^H-?1$/i.test(r.ref || "") ? 1.3 : TRANSIT_FARE[r.m];                          // электрички по Апшерону: 0,20–0,80 ₼ в зависимости от расстояния (тариф ADY)
const METRO_HOURS = [6 * 60, 24 * 60];                // метро Баку — 06:00–00:00
const METRO_HW = 4, BUS_HW = 12;                      // обычный интервал, мин (ждать в среднем — половину)
const SPEED = { metro: 0.95, bus: 3.2, walk: 13.3 };  // минут на км: метро ~45 км/ч с остановками, автобус ~19 км/ч, пешком ~4,5 км/ч
const STOP_MIN = { metro: 0.6, bus: 0.5 };            // остановка, мин
const WALK_MAX = 0.9, TRANSFER_MAX = 0.35;            // пешком до остановки и между остановками, км
let TRANSIT = null, transitP = null;

function loadTransit() {
  if (TRANSIT) return Promise.resolve(TRANSIT);
  transitP ||= new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "data/az-transit.js";
    s.onload = () => {
      try { const d = window.SAFAR_TRANSIT; if (!d) throw new Error("transit"); TRANSIT = transitPrepare(d); ok(TRANSIT); }
      catch (e) { transitP = null; no(e); }
    };
    s.onerror = () => { transitP = null; no(new Error("transit")); };
    document.head.appendChild(s);
  });
  return transitP;
}
// Подготовка: какие маршруты через какую остановку, соседние остановки для пересадок, станции поездов как узлы
function transitPrepare(d) {
  const nS = d.stops.length;
  const nodes = d.stops.map(s => ({ la: s[0], lo: s[1], n: s[2], nr: s[3], ne: s[4], rail: false }));
  d.rail.st.forEach(s => nodes.push({ la: s[1], lo: s[2], n: s[3] || s[0], ne: s[0], nr: "", rail: true, ok: s[1] != null }));
  const byStop = nodes.map(() => []);
  d.routes.forEach((r, ri) => r.s.forEach((s, k) => byStop[s].push([ri, k])));
  const trainsAt = nodes.map(() => []);
  d.rail.tr.forEach((tr, ti) => tr.s.forEach(([, st], k) => { if (st != null) trainsAt[nS + st].push([ti, k]); }));
  // Сетка ~1 км для поиска соседей
  const grid = new Map(), cell = n => Math.floor(n.la * 100) + ":" + Math.floor(n.lo * 80);
  nodes.forEach((n, i) => { if (n.la == null) return; const k = cell(n); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const near = (la, lo, maxKm) => {
    const out = [], cy = Math.floor(la * 100), cx = Math.floor(lo * 80);
    const ry = Math.ceil(maxKm / 1.1), rx = Math.ceil(maxKm / 1.05);   // клетка ~1,1 × 1,05 км
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) for (const i of grid.get(y + ":" + x) || []) {
      const d2 = km([la, lo], [nodes[i].la, nodes[i].lo]);
      if (d2 <= maxKm) out.push([i, d2]);
    }
    return out;
  };
  return { ...d, nS, nodes, byStop, trainsAt, near };
}
const nodeName = n => (LANG === "en" ? n.ne : n.nr) || n.n || n.ne || "—";
const routeName = r => (LANG === "en" ? r.ne : r.nr) || r.n || "";
const METRO_LINE = { "1": ["красная", "red"], "2": ["зелёная", "green"], "2B": ["зелёная, ветка", "green branch"], "3": ["фиолетовая", "purple"] };
const metroRef = r => r.ref || (r.n.match(/Line\s*(\w+)/i) || [])[1] || "";
const routeLabel = r => {
  if (r.m !== "metro") return r.ref ? (LANG === "en" ? "Bus " : "Автобус ") + r.ref : LL("Автобус", "Bus");
  const ref = metroRef(r), col = METRO_LINE[ref];
  return ref ? LL(`Метро, линия ${ref}`, `Metro line ${ref}`) + (col ? ` (${col[LANG === "en" ? 1 : 0]})` : "") : LL("Метро", "Metro");
};
// Тип дня (будни / суббота / выходной) по времени Баку
function bakuNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baku", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { min: +p.hour * 60 + +p.minute, day: p.weekday === "Sun" ? "h" : p.weekday === "Sat" ? "sa" : "w" };
}
const runsOn = (tr, day) => day === "sa" ? (tr.d.sa || tr.d.h) : tr.d[day];
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const subFare = km2 => Math.min(SUB_FARE[1], Math.max(SUB_FARE[0], Math.round(km2 * 0.025 * 10) / 10));
const trainFare = (tr, a, b) => {
  if (tr.k === "sub") return { lo: subFare(b), hi: subFare(b), est: true };
  const d = b;   // км по прямой между станциями
  return { lo: Math.max(2, Math.round(d * 0.025)), hi: Math.max(3, Math.round(d * 0.045)), est: true };
};

// Двоичная куча: [приоритет, значение]
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return top;
  }
}
// ---------- Планировщик: Дейкстра по остановкам, время прибытия + штраф за пересадку ----------
// from/to — [широта, долгота]; at — минуты от полуночи по Баку
function transitPlan(from, to, at = bakuNow().min, day = bakuNow().day) {
  const T = TRANSIT, N = T.nodes.length, best = new Float64Array(N).fill(Infinity), cost = new Float64Array(N).fill(Infinity), prev = new Array(N), done = new Uint8Array(N);
  const direct = km(from, to);
  const walkOnly = { legs: [{ k: "walk", a: from, b: to, d: direct, min: direct * SPEED.walk * 1.25 }], arr: at + direct * SPEED.walk * 1.25, dep: at, none: direct > 3 };
  const heap = new MinHeap();
  const push = (i, tArr, c, p) => { if (c < cost[i] - 0.01) { cost[i] = c; best[i] = tArr; prev[i] = p; heap.push(c, i); } };
  for (const [i, d] of T.near(from[0], from[1], WALK_MAX)) { const w = d * SPEED.walk * 1.25; push(i, at + w, at + w, { k: "walk", from: -1, d, min: w }); }
  const far = direct > 30, endMax = far ? 6 : WALK_MAX;
  if (far) for (const [i, d] of T.near(from[0], from[1], 6)) if (T.nodes[i].rail && d > WALK_MAX) { const w = d * 2.5 + 5; push(i, at + w, at + w, { k: "walk", from: -1, d, min: w, taxi: true }); }
  const ends = new Map(T.near(to[0], to[1], endMax).map(([i, d]) => [i, d]));
  let goal = null, goalCost = walkOnly.arr + 0;
  while (heap.size) {
    const [c, u] = heap.pop();
    if (done[u] || c > cost[u] + 0.01) continue;
    done[u] = 1;
    if (c > goalCost) break;
    const tU = best[u], via = prev[u];
    if (ends.has(u)) { const de = ends.get(u), w = de > WALK_MAX ? de * 2.5 + 5 : de * SPEED.walk * 1.25, cc = c + w; if (cc < goalCost) { goalCost = cc; goal = u; } }
    // Пешком к соседним остановкам (пересадка)
    if (via?.k !== "walk") for (const [v, d] of T.near(T.nodes[u].la, T.nodes[u].lo, TRANSFER_MAX)) {
      if (v === u || done[v]) continue;
      const w = d * SPEED.walk * 1.25 + 1;
      push(v, tU + w, c + w, { k: "walk", from: u, d, min: w });
    }
    // Метро и автобусы: садимся (ждём пол-интервала) и едем до любой следующей остановки маршрута
    if (u < T.nS) for (const [ri, k] of T.byStop[u]) {
      const r = T.routes[ri];
      if (via?.k === "ride" && via.r === ri) continue;
      if (r.m === "metro" && (tU < METRO_HOURS[0] || tU > METRO_HOURS[1] - 10)) continue;
      const wait = (r.hw || (r.m === "metro" ? METRO_HW : BUS_HW)) / 2, pen = via?.k === "ride" || via?.k === "train" ? 4 : 0;
      let tt = tU + wait;
      for (let j = k + 1; j < r.s.length; j++) {
        const a = T.nodes[r.s[j - 1]], b = T.nodes[r.s[j]];
        const seg = km([a.la, a.lo], [b.la, b.lo]);
        tt += (r.m === "bus" && seg > 2 ? 2 * SPEED.bus + (seg - 2) * 1.5 : seg * SPEED[r.m]) + STOP_MIN[r.m];
        const v = r.s[j];
        if (!done[v]) push(v, tt, c + (tt - tU) + pen, { k: "ride", from: u, r: ri, i: k, j, wait });
      }
    }
    // Поезда: ближайший по расписанию (сегодня), от этой станции до любой следующей
    for (const [ti, k] of T.trainsAt[u]) {
      const tr = T.rail.tr[ti];
      if (!runsOn(tr, day)) continue;
      const dep = tr.s[k][0];
      if (dep < tU + 2 || dep - tU > (tr.k === "sub" ? 180 : 960)) continue;
      const pen = via?.k === "ride" || via?.k === "train" ? 4 : 0;
      for (let j = k + 1; j < tr.s.length; j++) {
        const st = tr.s[j][1];
        if (st == null) continue;
        const v = T.nS + st, arr = tr.s[j][0];
        if (!done[v] && T.nodes[v].ok) push(v, arr, c + (arr - tU) + pen, { k: "train", from: u, t: ti, i: k, j });
      }
    }
  }
  if (goal == null) return walkOnly;
  // Собираем путь с конца
  const legs = [], wEnd = ends.get(goal), endMin = wEnd > WALK_MAX ? wEnd * 2.5 + 5 : wEnd * SPEED.walk * 1.25;
  legs.push({ k: "walk", a: [T.nodes[goal].la, T.nodes[goal].lo], b: to, d: wEnd, min: endMin, toName: "", taxi: wEnd > WALK_MAX });
  for (let v = goal; v != null && v !== -1;) {
    const p = prev[v];
    if (!p) break;
    const A = p.from === -1 ? from : [T.nodes[p.from].la, T.nodes[p.from].lo], B = [T.nodes[v].la, T.nodes[v].lo];
    if (p.k === "walk") legs.push({ k: "walk", a: A, b: B, d: p.d, min: p.min, toName: nodeName(T.nodes[v]), taxi: p.taxi });
    else if (p.k === "ride") {
      const r = T.routes[p.r];
      legs.push({ k: r.m, r, from: p.from, to: v, n: p.j - p.i, wait: p.wait, path: r.s.slice(p.i, p.j + 1).map(s => [T.nodes[s].la, T.nodes[s].lo]), min: best[v] - best[p.from], fare: routeFare(r) });
    } else {
      const tr = T.rail.tr[p.t], dkm = km(A, B);
      legs.push({ k: "train", tr, from: p.from, to: v, n: p.j - p.i, dep: tr.s[p.i][0], arr: tr.s[p.j][0], path: tr.s.slice(p.i, p.j + 1).filter(x => x[1] != null && T.nodes[T.nS + x[1]].ok).map(x => [T.nodes[T.nS + x[1]].la, T.nodes[T.nS + x[1]].lo]), min: best[v] - best[p.from], fare: trainFare(tr, A, dkm) });
    }
    v = p.from;
  }
  legs.reverse();
  // Слишком короткие пешие отрезки между пересадками — убираем
  const out = legs.filter(l => l.k !== "walk" || l.d > 0.02);
  return { legs: out, arr: best[goal] + endMin, dep: at };
}

// ---------- Текст для экрана навигатора ----------
const TRANSIT_COLOR = { walk: "#6b7587", bus: "#e07b00", metro: "#c0392b", train: "#1f3f73" };
function legText(l) {
  const T = TRANSIT;
  if (l.k === "walk" && l.taxi) return { ic: "car", t: l.toName ? LL(`Такси до «${l.toName}» — ${fmtDist(l.d)}`, `Taxi to “${l.toName}” — ${fmtDist(l.d)}`) : LL(`Такси ${fmtDist(l.d)} до места`, `Taxi ${fmtDist(l.d)} to the destination`), s: `~${Math.max(1, Math.round(l.min))} ${LL("мин", "min")}` };
  if (l.k === "walk") return { ic: "walk", t: l.toName ? LL(`Пешком до «${l.toName}» — ${fmtDist(l.d)}`, `Walk to “${l.toName}” — ${fmtDist(l.d)}`) : LL(`Пешком ${fmtDist(l.d)} до места`, `Walk ${fmtDist(l.d)} to the destination`), s: `${Math.max(1, Math.round(l.min))} ${LL("мин", "min")}` };
  if (l.k === "train") {
    const a = nodeName(T.nodes[l.from]), b = nodeName(T.nodes[l.to]);
    return { ic: "train", t: LL(`Поезд № ${l.tr.n} в ${hhmm(l.dep)}: «${a}» → «${b}»`, `Train No. ${l.tr.n} at ${hhmm(l.dep)}: “${a}” → “${b}”`),
      s: LL(`прибытие ${hhmm(l.arr)} · ${l.n} ост. · направление ${l.tr.t}`, `arrives ${hhmm(l.arr)} · ${l.n} stops · towards ${l.tr.t}`) };
  }
  const a = nodeName(T.nodes[l.from]), b = nodeName(T.nodes[l.to]), dir = l.r.to || nodeName(T.nodes[l.r.s[l.r.s.length - 1]]);
  return { ic: l.k === "metro" ? "train" : "bus", t: `${routeLabel(l.r)}: ${LL(`сядьте на «${a}»`, `board at “${a}”`)}`,
    s: LL(`выйти на «${b}» · ${l.n} ост. · ~${Math.round(l.min)} мин · в сторону ${dir}`, `get off at “${b}” · ${l.n} stops · ~${Math.round(l.min)} min · towards ${dir}`) };
}
function planFare(plan) {
  let lo = 0, hi = 0, est = false;
  for (const l of plan.legs) {
    if (l.k === "bus" || l.k === "metro") { lo += l.fare; hi += l.fare; }
    if (l.k === "train") { lo += l.fare.lo; hi += l.fare.hi; est = true; }
  }
  return { lo: Math.round(lo * 100) / 100, hi: Math.round(hi * 100) / 100, est };
}

// ---------- Экраны раздела «Автобусы»: метро, поезда, автобусы по номеру ----------
const TR_UI = {
  metro: ["Метро Баку", "Baku Metro"], metro_sub: ["Линии, станции, часы работы, цена", "Lines, stations, hours, fare"],
  metro_lead: ["Работает с 06:00 до 00:00. Поезда — каждые 2–5 минут в час пик и 5–10 минут вечером. Проезд — 0,60 ₼ по карте BakıKart.", "Open 06:00–00:00. Trains every 2–5 minutes at rush hour, 5–10 minutes in the evening. Fare 0.60 ₼ with a BakıKart card."],
  trains: ["Поезда и электрички", "Trains"], trains_sub: ["Расписание ADY: Сумгаит, Хырдалан, Газах, Габала, Тбилиси", "ADY timetable: Sumgayit, Khirdalan, Qazakh, Gabala, Tbilisi"],
  trains_lead: ["Расписание Азербайджанских железных дорог (ADY). Время — бакинское. Билеты — на ticket.ady.az, в приложении ADY или в кассе.", "Azerbaijan Railways (ADY) timetable. Baku time. Tickets — ticket.ady.az, the ADY app or at the station."],
  buses_n: ["Автобусы по номеру", "Buses by number"], buses_n_sub: ["Где ходит автобус и его остановки", "Where a bus goes and its stops"],
  from: ["Откуда", "From"], to: ["Куда", "To"], today: ["Сегодня", "Today"], all_day: ["Все поезда", "All trains"], no_trains: ["Сегодня поездов между этими станциями нет", "No trains between these stations today"],
  dur: ["в пути", "travel"], buy: ["Купить билет (ADY)", "Buy a ticket (ADY)"], fare_est: ["цена примерная", "approximate fare"],
  stations: ["Станции", "Stations"], stops: ["Остановки", "Stops"], bus_q: ["Номер автобуса или остановка", "Bus number or stop"], show_map: ["На карте", "On the map"],
  loading: ["Загружаем маршруты…", "Loading routes…"], fail: ["Не удалось загрузить данные транспорта. Проверьте интернет и попробуйте снова.", "Could not load transport data. Check the internet and try again."],
  plan: ["Маршрут на метро", "Metro route"], plan_go: ["Показать маршрут", "Show route"], wd: ["будни", "weekdays"], sa: ["суббота", "Saturday"], hol: ["выходные", "days off"],
  express: ["экспресс", "express"],
  remind: ["Напомнить", "Remind me"], remind_hint: ["Нажмите на колокольчик — поезд добавится в календарь телефона с напоминанием за 30 минут (работает и без интернета).", "Tap the bell — the train is added to your phone calendar with a reminder 30 minutes before (works offline)."],
  remind_ok: ["Откройте файл — поезд добавится в календарь", "Open the file — the train is added to your calendar"], src: ["Метро и автобусы — OpenStreetMap; поезда — ADY. Данные на {d}.", "Metro and buses — OpenStreetMap; trains — ADY. Data as of {d}."]
};
const tu = (k, v = {}) => { let s = TR_UI[k][LANG === "en" ? 1 : 0]; for (const x in v) s = s.replaceAll("{" + x + "}", v[x]); return s; };
const trLoadingHtml = () => `<p class="hint" id="trLoading">${tu("loading")}</p>`;

// Линии метро: одно направление каждой линии (самое длинное)
function metroLines() {
  const by = new Map();
  for (const r of TRANSIT.routes.filter(r => r.m === "metro")) {
    const key = r.ref || r.c || routeName(r);
    if (!by.has(key) || by.get(key).s.length < r.s.length) by.set(key, r);
  }
  return [...by.values()];
}
function transitScreen(sub) {
  if (sub === "metro") return `${head("train", tu("metro"), tu("metro_lead"))}<div id="trBody">${trLoadingHtml()}</div>`;
  if (sub === "trains") return `${head("train-fast", tu("trains"), tu("trains_lead"))}<div id="trBody">${trLoadingHtml()}</div>`;
  if (sub === "routes") return `${head("bus", tu("buses_n"))}
    <input class="az-input" id="busQ" type="search" autocomplete="off" placeholder="${esc(tu("bus_q"))}" aria-label="${esc(tu("bus_q"))}" style="width:100%;margin-bottom:12px">
    <div id="trBody">${trLoadingHtml()}</div>`;
  if (sub && sub.startsWith("r")) return `${backBtn()}<div id="trBody">${trLoadingHtml()}</div>`;
  return "";
}
async function transitStart(sub) {
  try { await loadTransit(); } catch { const b = $("#trBody"); if (b) b.innerHTML = `<div class="az-note">${icon("wifi-off")}<span>${tu("fail")}</span></div>`; return; }
  const box = $("#trBody");
  if (!box) return;
  const src = `<p class="hint">${tu("src", { d: TRANSIT.at })}</p>`;
  if (sub === "metro") {
    const lines = metroLines();
    // Станции для выбора: без безымянных и без повторов (у станции бывает по точке на каждое направление)
    const seenSt = new Set();
    const opts = lines.flatMap(r => r.s).map(s => [s, nodeName(TRANSIT.nodes[s])]).filter(([, n]) => n && n !== "—" && !seenSt.has(n) && seenSt.add(n)).sort((a, b) => a[1].localeCompare(b[1]));
    const sel = (id, v) => `<select class="az-select" id="${id}">${opts.map(([s, n]) => `<option value="${s}" ${s === v ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
    box.innerHTML = `<h2 class="az-h2">${icon("route")} ${tu("plan")}</h2>
      <div class="az-card"><label class="hint">${tu("from")}</label>${sel("mFrom", opts[0]?.[0])}<label class="hint">${tu("to")}</label>${sel("mTo", opts[1]?.[0])}
        <div class="az-btns"><button type="button" class="az-btn" data-metro-plan>${icon("directions")} ${tu("plan_go")}</button></div></div>
      ${lines.map(r => `<h2 class="az-h2"><span class="tr-dot" style="background:${esc(r.c || TRANSIT_COLOR.metro)}"></span> ${esc(routeLabel(r))}</h2>
        <div class="az-card tr-line">${r.s.filter(s => TRANSIT.nodes[s].n || TRANSIT.nodes[s].nr).map(s => `<a class="tr-st" href="${goHref(TRANSIT.nodes[s].la, TRANSIT.nodes[s].lo, nodeName(TRANSIT.nodes[s]))}"><i style="border-color:${esc(r.c || TRANSIT_COLOR.metro)}"></i>${esc(nodeName(TRANSIT.nodes[s]))}</a>`).join("")}</div>`).join("")}
      ${src}`;
    return;
  }
  if (sub === "trains") return trainsDraw(box, src);
  if (sub === "routes") {
    const draw = () => {
      const q = ($("#busQ")?.value || "").trim().toLowerCase();
      const seen = new Set(), list = [];
      TRANSIT.routes.forEach((r, i) => {
        if (r.m !== "bus") return;
        const key = r.ref + "|" + [r.fr, r.to].sort().join("|");
        if (seen.has(key)) return;
        const hay = [r.ref, r.n, r.nr, r.ne, r.fr, r.to, ...r.s.map(s => TRANSIT.nodes[s].n)].join(" ").toLowerCase();
        // Цифры — это номер автобуса (65, H-1, M5), иначе — название остановки или улицы
        const num = /^[a-zа-я]?-?\d+[a-zа-я]?$/i.test(q), ref = r.ref.toLowerCase().replace(/-/g, "");
        if (q && (num ? !(ref === q.replace(/-/g, "") || ref.startsWith(q.replace(/-/g, ""))) : !hay.includes(q))) return;
        seen.add(key); list.push([r, i]);
      });
      list.sort((a, b) => (parseInt(a[0].ref) || 999) - (parseInt(b[0].ref) || 999) || a[0].ref.localeCompare(b[0].ref));
      box.innerHTML = list.slice(0, 80).map(([r, i]) => `<a class="az-row" href="#buses/r${i}"><span class="tr-num">${esc(r.ref || "—")}</span><div><b>${esc(r.fr || nodeName(TRANSIT.nodes[r.s[0]]))} → ${esc(r.to || nodeName(TRANSIT.nodes[r.s[r.s.length - 1]]))}</b><small>${r.s.length} ${LL("остановок", "stops")} · ${fmtAzn(routeFare(r), routeFare(r))}</small></div>${icon("chevron-right", "go")}</a>`).join("") || `<p class="az-empty">${LL("Ничего не найдено", "Nothing found")}</p>`;
      box.insertAdjacentHTML("beforeend", src);
    };
    $("#busQ").oninput = draw;
    draw();
    return;
  }
  if (sub && sub.startsWith("r")) {
    const r = TRANSIT.routes[+sub.slice(1)];
    if (!r) return;
    const color = r.c || (r.m === "metro" ? TRANSIT_COLOR.metro : TRANSIT_COLOR.bus);
    box.innerHTML = `<h1 class="az-h1">${icon(r.m === "metro" ? "train" : "bus")} ${esc(routeLabel(r))}</h1>
      <p class="az-lead">${esc(r.fr || nodeName(TRANSIT.nodes[r.s[0]]))} → ${esc(r.to || nodeName(TRANSIT.nodes[r.s[r.s.length - 1]]))} · ${r.hw ? LL(`каждые ~${r.hw} мин`, `every ~${r.hw} min`) + " · " : ""}${fmtAzn(routeFare(r), routeFare(r))} (${fmtUzs(routeFare(r))})</p>
      <div id="azMap" class="az-map" style="height:300px"></div>
      <h2 class="az-h2">${tu("stops")}</h2>
      <div class="az-card tr-line">${r.s.map(s => `<a class="tr-st" href="${goHref(TRANSIT.nodes[s].la, TRANSIT.nodes[s].lo, nodeName(TRANSIT.nodes[s]))}"><i style="border-color:${esc(color)}"></i>${esc(nodeName(TRANSIT.nodes[s]))}</a>`).join("")}</div>${src}`;
    if (!(await loadLeaflet()) || !$("#azMap")) return;
    MAP.map = L.map("azMap").setView([TRANSIT.nodes[r.s[0]].la, TRANSIT.nodes[r.s[0]].lo], 13);
    azBase(MAP.map, [TRANSIT.nodes[r.s[0]].la, TRANSIT.nodes[r.s[0]].lo]);
    const pts = r.s.map(s => [TRANSIT.nodes[s].la, TRANSIT.nodes[s].lo]);
    const line = L.polyline(pts, { color, weight: 6, opacity: .85 }).addTo(MAP.map);
    pts.forEach((p, k) => L.circleMarker(p, { radius: 5, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).bindTooltip(esc(nodeName(TRANSIT.nodes[r.s[k]]))).addTo(MAP.map));
    MAP.map.fitBounds(line.getBounds().pad(0.1));
  }
}
// Поезда: откуда — куда, сегодня; ниже — все направления
function trainsDraw(box, src) {
  const T = TRANSIT, { min, day } = bakuNow();
  const used = [...new Set(T.rail.tr.flatMap(tr => tr.s.map(s => s[1])))].filter(i => i != null).map(i => [i, T.rail.st[i][0]]).sort((a, b) => a[1].localeCompare(b[1]));
  const f = store.get("az_rail_from", used.find(u => u[1] === "Baku")?.[0]), to = store.get("az_rail_to", used.find(u => u[1] === "Sumgayit")?.[0]);
  const sel = (id, v) => `<select class="az-select" id="${id}">${used.map(([i, n]) => `<option value="${i}" ${i === v ? "selected" : ""}>${esc(railName(i))}</option>`).join("")}</select>`;
  box.innerHTML = `<div class="az-card"><label class="hint">${tu("from")}</label>${sel("rFrom", f)}<label class="hint">${tu("to")}</label>${sel("rTo", to)}
      <div class="az-chips" style="margin-top:8px">${["w", "sa", "h"].map(d => `<button type="button" class="${d === (window.TR_DAY || day) ? "on" : ""}" data-rail-day="${d}">${tu(d === "w" ? "wd" : d === "sa" ? "sa" : "hol")}</button>`).join("")}</div></div>
    <div id="rList"></div>
    <div class="az-btns">${ext("https://ticket.ady.az", "ticket", tu("buy"))}</div>${src}`;
  const draw = () => {
    const a = +$("#rFrom").value, b = +$("#rTo").value, d = window.TR_DAY || day;
    store.set("az_rail_from", a); store.set("az_rail_to", b);
    const rows = [];
    for (const tr of T.rail.tr) {
      if (!runsOn(tr, d)) continue;
      const i = tr.s.findIndex(s => s[1] === a), j = tr.s.findIndex(s => s[1] === b);
      if (i < 0 || j <= i) continue;
      rows.push({ tr, dep: tr.s[i][0], arr: tr.s[j][0] });
    }
    rows.sort((x, y) => x.dep - y.dep);
    const A = T.rail.st[a], B = T.rail.st[b], dist = A[1] != null && B[1] != null ? km([A[1], A[2]], [B[1], B[2]]) : 0;
    const fare = rows[0] ? trainFare(rows[0].tr, null, dist) : null;
    $("#rList").innerHTML = rows.length ? `<table class="az-table"><thead><tr><th>№</th><th>${LL("Отправление", "Departs")}</th><th>${LL("Прибытие", "Arrives")}</th><th>${tu("dur")}</th><th aria-label="${esc(tu("remind"))}"></th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${d === day && r.dep < min ? "tr-past" : ""}"><td>${esc(r.tr.n)}${r.tr.ex ? ` <small>${tu("express")}</small>` : ""}</td><td><b>${hhmm(r.dep)}</b></td><td>${hhmm(r.arr)}</td><td>${navMin((r.arr - r.dep) * 60)}</td><td><button type="button" class="tr-bell" data-rail-ics="${esc([r.tr.n, r.dep, r.arr, railName(a), railName(b), d].join("|"))}" aria-label="${esc(tu("remind"))}">${icon("bell")}</button></td></tr>`).join("")}</tbody></table>
      <p class="hint">${icon("bell")} ${tu("remind_hint")}</p>
      ${fare ? `<div class="az-price-line">${icon("banknote")} <b>${LL("Билет", "Ticket")}: ~${fmtAzn(fare.lo, fare.hi)}</b><span class="az-uzs">${fmtUzs(fare.lo, fare.hi)}</span><small>${tu("fare_est")}</small></div>` : ""}`
      : `<p class="az-empty">${tu("no_trains")}</p>`;
  };
  $("#rFrom").onchange = $("#rTo").onchange = draw;
  draw();
}
const railName = i => { const s = TRANSIT.rail.st[i]; return LANG === "en" ? s[0] : (s[3] || s[0]); };
document.addEventListener("click", e => {
  const d = e.target.closest("[data-rail-day]");
  if (d) { window.TR_DAY = d.dataset.railDay; $$("[data-rail-day]").forEach(b => b.classList.toggle("on", b === d)); $("#rFrom")?.dispatchEvent(new Event("change")); return; }
  if (e.target.closest("[data-metro-plan]")) {
    const a = TRANSIT.nodes[+$("#mFrom").value], b = TRANSIT.nodes[+$("#mTo").value];
    store.set("az_nav_mode", "transit"); store.set("az_nav_from", [a.la, a.lo]);
    location.hash = goHref(b.la, b.lo, nodeName(b));
  }
});

// ---------- Напоминание о поезде: событие для календаря телефона (.ics) с сигналом за 30 минут ----------
// Календарь напомнит сам — даже если приложение закрыто и нет интернета. Время Баку = UTC+4 (без перехода на летнее)
function railNextDate(day, depMin) {
  const { min, day: today } = bakuNow();
  const base = new Date(Date.now() + 4 * 3600e3);   // «сейчас» по Баку в полях UTC
  for (let add = 0; add < 8; add++) {
    const dt = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + add));
    const wd = dt.getUTCDay(), type = wd === 0 ? "h" : wd === 6 ? "sa" : "w";
    if (type === day && !(add === 0 && depMin <= min)) return dt;
    if (add === 0 && day === today && depMin > min) return dt;
  }
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1));
}
function railIcs(n, dep, arr, from, to, day) {
  const date = railNextDate(day, dep), at = m => new Date(date.getTime() + m * 60e3 - 4 * 3600e3);
  const fmt = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = LL(`Поезд № ${n}: ${from} → ${to}`, `Train No. ${n}: ${from} → ${to}`);
  const esc2 = v => String(v).replace(/[,;\\]/g, m => "\\" + m);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hamyol//AZ//RU", "BEGIN:VEVENT",
    `UID:hamyol-train-${n}-${fmt(at(dep))}@hamyol`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(at(dep))}`, `DTEND:${fmt(at(arr))}`,
    `SUMMARY:${esc2(title)}`, `LOCATION:${esc2(from)}`, `DESCRIPTION:${esc2(LL("Отправление ", "Departs ") + hhmm(dep) + " · " + LL("прибытие ", "arrives ") + hhmm(arr) + " · ticket.ady.az")}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${esc2(title)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-rail-ics]");
  if (!b) return;
  const [n, dep, arr, from, to, day] = b.dataset.railIcs.split("|");
  const blob = new Blob([railIcs(n, +dep, +arr, from, to, day)], { type: "text/calendar" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `train-${n}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast(tu("remind_ok"));
});
