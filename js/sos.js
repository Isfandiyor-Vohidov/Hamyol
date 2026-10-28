// «Экстренная помощь» (#sos): позвонить 103 / 102 / 101, «Где я» — что сказать оператору,
// «Отправить мою точку» другу, гиду, отелю, страховой; ближайшие больницы, аптеки, АЗС; «Машина сломалась».
// Приложение не вызывает службы само (такой связи со службами нет) — оно помогает быстро позвонить и объяснить, где вы.
// ТЕСТОВЫЙ РЕЖИМ (по умолчанию): всё работает, кроме самого звонка — вместо набора номера «ТЕСТ: звонок не совершён».
// Настоящие звонки включаются строкой SOS_LIVE=1 в .env (server/config.js → sosLive).
// Номера по стране: Узбекистан — 103 / 102 / 101; Саудовская Аравия (раздел «Мекка и Медина») — 911 единый, 997 скорая, 999 полиция, 998 гражданская оборона
const SOS_UZ = [["103", "ambulance", "heart-pulse"], ["102", "police", "shield"], ["101", "fire", "flame"]];
const SOS_SA = [["911", "unified", "siren"], ["997", "ambulance", "heart-pulse"], ["999", "police", "shield"], ["998", "civil", "flame"]];
const sosSaudi = () => window.SAFAR_APP === "mecca";
const sosNums = () => (sosSaudi() ? SOS_SA : SOS_UZ);
const sosNumsLine = () => (sosSaudi() ? "🆘 911 · 🚑 997 · 👮 999 · 🚒 998" : "🚑 103 · 👮 102 · 🚒 101");
const SOS_TEST_POINT = { lat: 39.65484, lon: 66.97563 };   // Регистан, Самарканд — для проверки без геолокации
let sosPos = null;
const sosLive = () => !!(typeof SAFAR_CONFIG !== "undefined" && SAFAR_CONFIG.sosLive);
const sosFix = n => n.toFixed(5);
const sosMaps = p => ({
  google: `https://maps.google.com/?q=${sosFix(p.lat)},${sosFix(p.lon)}`,
  yandex: `https://yandex.uz/maps/?pt=${sosFix(p.lon)},${sosFix(p.lat)}&z=17&l=map`
});

function openSos() {
  openModal(`
    <div class="m-head sos-head"><h2>${icon("siren")} ${t("sos_title")}</h2><p>${t("em_sub")}</p></div>
    <div class="m-body em-page">
      ${sosLive() ? `<div class="sos-live" role="alert"><i>${icon("siren")}</i><div><b>${t("sos_live_title")}</b><span>${t("sos_live_text")}</span></div></div>`
        : `<p class="sos-test">${icon("info")} <span>${t("sos_test")}</span></p>`}
      <div class="sos-calls n${sosNums().length}">${sosNums().map(([n, k, ic]) => `
        <button type="button" class="sos-call sos-${k}" data-sos-call="${n}" data-sos-kind="${k}">
          <i>${icon(ic)}</i><b>${n}</b><span>${t("sos_" + k)}</span></button>`).join("")}</div>
      <p class="hint em-note">${t(sosSaudi() ? "em_note_sa" : "em_note")}</p>

      <section class="sos-where" id="sosWhere">
        <h3 class="sec-title">${icon("locate")} ${t("sos_where")}</h3>
        <p class="hint">${t("sos_where_sub")}</p>
        <div class="sos-where-acts">
          <button type="button" class="btn gold-btn" data-sos-locate>${icon("locate")} ${t("sos_locate")}</button>
          ${sosLive() ? "" : `<button type="button" class="btn ghost" data-sos-testpoint>${icon("pin")} ${t("sos_testpoint")}</button>`}
        </div>
        <div id="sosPlace"></div>
      </section>

      <section id="sosNear"></section>

      <section class="sos-car">
        <h3 class="sec-title">${icon("car")} ${t("sos_car")}</h3>
        <ol class="sos-steps">
          <li>${t("sos_car_1")}</li><li>${t("sos_car_2")}</li><li>${t("sos_car_3")}</li><li>${t("sos_car_4")}</li>
        </ol>
        <div id="sosCarCalls"></div>
      </section>

      <div class="sos-links">
        <a class="btn ghost" href="#docs">${icon("folder-lock")} ${t("doc_title")}</a>
        <button type="button" class="btn ghost" data-med-show>${icon("heart-pulse")} ${t("med_show")}</button>
      </div>
    </div>`);
  sosCarCalls();
  if (sosPos) sosShowPlace(sosPos);
}

// Страховая — из медицинской карточки (js/docs.js), если человек её заполнил
async function sosCarCalls() {
  const box = $("#sosCarCalls");
  if (!box) return;
  const m = typeof medGet === "function" ? await medGet() : null;
  box.innerHTML = m?.ins_phone ? `<button type="button" class="btn ghost sos-ins" data-sos-call="${esc(m.ins_phone)}" data-sos-kind="insurance">${icon("shield-plus")} ${t("sos_insurance")}: ${esc(m.ins_phone)}</button>`
    : `<p class="hint">${t("sos_ins_hint")}</p>`;
}

// ---------- Звонок: с подтверждением (случайное касание в кармане не должно вызвать скорую) ----------
async function sosCall(num, kind) {
  const name = kind === "insurance" ? t("sos_insurance") : t("sos_" + kind);
  // Настоящий режим: в окне подтверждения крупно сказано, что это НАСТОЯЩИЙ звонок в службу
  const live = sosLive() && kind !== "insurance";
  const ok = await askConfirm({
    title: live ? t("sos_live_q", { what: name, n: num }) : t("sos_call_q", { what: name, n: num }),
    text: (live ? `<b class="sos-live-warn">${t("sos_live_confirm")}</b><br>` : "") + (sosPos ? t("sos_call_tip") : t("sos_call_tip_nopos")),
    ok: live ? t("sos_live_ok", { n: num }) : `${t("sos_call")} ${num}`, danger: true, icon: live ? "siren" : "phone"
  });
  if (!ok) return;
  if (!sosLive()) return toast(t("sos_test_done", { n: num }));
  location.href = "tel:" + num.replace(/[^\d+]/g, "");
}

// ---------- «Где я»: точное место ----------
// Для вызова помощи нужна самая точная точка, а не «примерно»: включаем GPS (enableHighAccuracy),
// не берём сохранённые раньше точки (maximumAge: 0) и до 20 секунд слушаем телефон, оставляя самое точное измерение.
// Хватит точности 15 м — останавливаемся раньше. Точность показываем человеку: «± 8 м».
const SOS_GOOD_M = 15, SOS_WAIT_MS = 20000;
let sosWatch = null;
function sosStopWatch() { if (sosWatch != null) { navigator.geolocation?.clearWatch(sosWatch); sosWatch = null; } }
async function sosPrecise(onUpdate) {
  if (!(await requireConsent())) throw new Error("no consent");
  if (!navigator.geolocation) throw new Error("no geo");
  sosStopWatch();
  return new Promise((resolve, reject) => {
    let best = null, finished = false;
    const finish = err => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sosStopWatch();
      best ? resolve(best) : reject(err || new Error("timeout"));
    };
    const timer = setTimeout(() => finish(), SOS_WAIT_MS);
    sosWatch = navigator.geolocation.watchPosition(pos => {
      const c = pos.coords, cur = { lat: c.latitude, lon: c.longitude, acc: Math.max(1, Math.round(c.accuracy || 9999)), at: pos.timestamp || Date.now() };
      if (!best || cur.acc < best.acc) { best = cur; onUpdate?.(best); }
      if (best.acc <= SOS_GOOD_M) finish();
    }, err => { if (!best) finish(err); }, { enableHighAccuracy: true, maximumAge: 0, timeout: SOS_WAIT_MS });
  });
}

async function sosLocate(test) {
  const box = $("#sosPlace");
  if (!box) return;
  if (test) { sosPos = { ...SOS_TEST_POINT, acc: 6, at: Date.now(), test: true }; return sosShowPlace(sosPos); }
  box.innerHTML = `<div class="sos-finding"><span class="spinner"></span><span><b>${t("sos_finding")}</b><small id="sosAccLive">${t("sos_finding_sub")}</small></span></div>`;
  try {
    sosPos = await sosPrecise(p => { const el = $("#sosAccLive"); if (el) el.textContent = t("sos_acc_now", { m: p.acc }); });
    userPos = { lat: sosPos.lat, lon: sosPos.lon };   // заодно точнее «Рядом со мной» и расстояния
  } catch (e) {
    box.innerHTML = e?.message === "no consent" ? "" : `<p class="hint sos-err">${icon("info")} ${t("sos_geo_err")}</p>`;
    return;
  }
  sosShowPlace(sosPos);
}

// Plus Code (Open Location Code, Google): 11 знаков = квадрат примерно 3 × 3 м. Google Карты понимают его в поиске
const OLC = "23456789CFGHJMPQRVWX";
function plusCode(lat, lon) {
  lat = Math.min(Math.max(lat, -90), 90 - 1e-10);
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  let latVal = Math.floor(Math.round((lat + 90) * 25e6 * 1e6) / 1e6), lngVal = Math.floor(Math.round((lon + 180) * 8192e3 * 1e6) / 1e6), code = "";
  for (let i = 0; i < 5; i++) { code = OLC[(latVal % 5) * 4 + (lngVal % 4)] + code; latVal = Math.floor(latVal / 5); lngVal = Math.floor(lngVal / 4); }
  for (let i = 0; i < 5; i++) { code = OLC[lngVal % 20] + code; code = OLC[latVal % 20] + code; latVal = Math.floor(latVal / 20); lngVal = Math.floor(lngVal / 20); }
  return (code.slice(0, 8) + "+" + code.slice(8)).slice(0, 12);
}
const sosAccClass = m => m <= 20 ? "good" : m <= 60 ? "mid" : "bad";
const sosTime = at => new Date(at || Date.now()).toLocaleTimeString(LOCALE[LANG], { hour: "2-digit", minute: "2-digit" });

async function sosShowPlace(p) {
  const box = $("#sosPlace");
  if (!box) return;
  // Ближайший город и ориентир — из базы Safar, работает без интернета
  const city0 = CITIES.reduce((b, c) => (km(p, c) < km(p, b) ? c : b), CITIES[0]);
  const abroad = km(p, city0) > 150, city = abroad ? null : city0;
  const mark = abroad ? null : POIS.filter(x => x.c === "a" || x.c === "s").map(x => [x, km(p, x)]).filter(([, d]) => d < 1.5).sort((a, b) => a[1] - b[1])[0];
  const pc = plusCode(p.lat, p.lon), acc = p.acc || 0;
  box.innerHTML = `
    <div class="sos-place">
      ${p.test ? `<p class="sos-test small">${t("sos_testpoint_on")}</p>` : ""}
      <div class="sos-acc ${sosAccClass(acc)}">${icon(acc <= 60 ? "circle-check" : "info")}
        <span><b>${t("sos_acc", { m: acc })}</b><small>${acc <= 20 ? t("sos_acc_good") : acc <= 60 ? t("sos_acc_mid") : t("sos_acc_bad")} · ${t("sos_at", { t: sosTime(p.at) })}</small></span>
        ${p.test ? "" : `<button type="button" class="btn small ghost" data-sos-locate>${icon("refresh")} ${t("sos_refine")}</button>`}</div>
      <div class="sos-line" id="sosAddr"><small>${t("sos_addr")}</small><b class="hint">${navigator.onLine ? t("sos_addr_wait") : t("sos_addr_off")}</b></div>
      ${mark ? `<div class="sos-line"><small>${t("sos_near")}</small><b>${esc(poiName(mark[0]))}</b><span>${Math.round(mark[1] * 1000)} ${t("sos_m")}</span></div>` : ""}
      ${city ? `<div class="sos-line"><small>${t("sos_city")}</small><b>${esc(cityName(city))}</b>${km(p, city) > 3 ? `<span>${t("sos_km_from", { km: Math.round(km(p, city)) })}</span>` : ""}</div>` : ""}
      <div class="sos-line"><small>${t("sos_coords")}</small><b class="sos-coords">${sosFix(p.lat)}, ${sosFix(p.lon)}</b></div>
      <div class="sos-line"><small>Plus Code · ${t("sos_pc_hint")}</small><b class="sos-coords">${pc}</b></div>
      <div class="sos-place-acts">
        <button type="button" class="btn gold-btn" data-sos-share>${icon("share")} ${t("sos_share")}</button>
        <button type="button" class="btn ghost" data-sos-show>${icon("maximize")} ${t("sos_show")}</button>
      </div>
      <div class="sos-send" id="sosSend"></div>
    </div>`;
  box._ctx = { p, city, mark: mark?.[0], pc };
  sosSendLinks();
  sosAddress(p);
  sosNearby(p);
}

// Ссылки «отправить» пересобираем, когда пришёл адрес — чтобы в сообщении был и он
function sosSendLinks() {
  const ctx = $("#sosPlace")?._ctx, box = $("#sosSend");
  if (!ctx || !box) return;
  const msg = sosMessage(ctx);
  box.innerHTML = `
    <a class="btn ghost small" href="https://t.me/share/url?url=${encodeURIComponent(sosMaps(ctx.p).google)}&text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${icon("tg")} Telegram</a>
    <a class="btn ghost small" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${icon("message")} WhatsApp</a>
    <a class="btn ghost small" href="sms:?&body=${encodeURIComponent(msg)}">${icon("message")} SMS</a>`;
}

// Адрес по координатам (OpenStreetMap Nominatim): дом, улица, махалля, район, город — по-узбекски и по-русски.
// Плюс название здания, если оно есть, и расстояние до найденного адреса: если он дальше 40 м — честно пишем «около».
async function sosAddress(p) {
  if (!navigator.onLine) return;
  const get = async lang => {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&namedetails=1&lat=${p.lat}&lon=${p.lon}&accept-language=${lang}`, { signal: AbortSignal.timeout(9000) });
    const j = await r.json();
    const a = j.address || {};
    const street = a.road || a.pedestrian || a.footway || a.path;
    const parts = [
      j.name && j.name !== street && j.name !== a.house_number ? j.name : "",
      street && [street, a.house_number].filter(Boolean).join(", "),
      !street && a.house_number ? a.house_number : "",
      a.neighbourhood || a.quarter || a.residential,
      a.suburb || a.city_district || a.district,
      a.city || a.town || a.village || a.municipality || a.county,
      a.state
    ].filter(Boolean);
    return { text: [...new Set(parts)].join(", ") || j.display_name || "", house: !!a.house_number, at: j.lat ? { lat: +j.lat, lon: +j.lon } : null };
  };
  try {
    const [uz, ru] = await Promise.all([get("uz"), get("ru")]);
    const el = $("#sosAddr b"), box = $("#sosPlace");
    if (!el || !box?._ctx) return;
    const off = uz.at ? Math.round(km(p, uz.at) * 1000) : 0;
    el.classList.remove("hint");
    el.innerHTML = (uz.text === ru.text ? esc(uz.text) : `${esc(uz.text)}<br><span>${esc(ru.text)}</span>`)
      + (off > 40 ? `<em class="sos-about">${t("sos_addr_about", { m: off })}</em>` : "");
    box._ctx.addr = { uz: uz.text, ru: ru.text, about: off > 40 ? off : 0 };
    sosSendLinks();
  } catch {
    const el = $("#sosAddr b");
    if (el) el.textContent = t("sos_addr_off");
  }
}

// Текст «Мне нужна помощь»: адрес, ориентир, координаты с точностью, Plus Code, время и ссылки на карты
function sosMessage(ctx) {
  const { p, city, mark, addr, pc } = ctx, maps = sosMaps(p);
  return [
    t("sos_msg_need"),
    addr ? (addr.about ? "≈ " : "") + (addr.ru || addr.uz) : city ? cityName(city) : "",
    mark && `${t("sos_near")}: ${poiName(mark)}`,
    `GPS: ${sosFix(p.lat)}, ${sosFix(p.lon)}${p.acc ? ` (± ${p.acc} ${t("sos_m")})` : ""}`,
    `Plus Code: ${pc}`,
    `${t("sos_at", { t: sosTime(p.at) })}`,
    maps.google, maps.yandex
  ].filter(Boolean).join("\n");
}

async function sosShare() {
  const ctx = $("#sosPlace")?._ctx;
  if (!ctx) return;
  const text = sosMessage(ctx);
  try {
    if (navigator.share) await navigator.share({ title: t("sos_title"), text });
    else { await navigator.clipboard.writeText(text); toast(t("link_copied")); }
  } catch { /* окно закрыто */ }
}

// На весь экран — показать оператору, прохожему, таксисту: крупно на узбекском и русском
function sosShowBig() {
  const ctx = $("#sosPlace")?._ctx;
  if (!ctx) return;
  const { p, city, mark, addr, pc } = ctx;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="sosBig" class="tc mc" role="dialog" aria-modal="true">
      <button type="button" class="tc-x" data-sos-big-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <p class="mc-title">${icon("siren")} YORDAM KERAK · НУЖНА ПОМОЩЬ · I NEED HELP</p>
      ${addr ? `<div class="mc-row big"><small>Manzil · Адрес · Address${addr.about ? ` (≈ ${addr.about} m)` : ""}</small><b>${esc(addr.uz)}${addr.ru && addr.ru !== addr.uz ? `<br>${esc(addr.ru)}` : ""}</b></div>` : ""}
      ${mark ? `<div class="mc-row"><small>Yonida · Рядом · Near</small><b>${esc(mark.nu || mark.n)}${mark.nr && mark.nr !== (mark.nu || mark.n) ? ` / ${esc(mark.nr)}` : ""}</b></div>` : ""}
      ${city ? `<div class="mc-row"><small>Shahar · Город · City</small><b>${esc(city.n.uz || city.n.ru)}${city.n.uz && city.n.uz !== city.n.ru ? ` / ${esc(city.n.ru)}` : ""}</b></div>` : ""}
      <div class="mc-row big"><small>Koordinatalar · Координаты · GPS${p.acc ? ` (± ${p.acc} m)` : ""}</small><b class="sos-coords">${sosFix(p.lat)}, ${sosFix(p.lon)}</b></div>
      <div class="mc-row"><small>Plus Code</small><b class="sos-coords">${pc}</b></div>
      <p class="mc-sos">${sosNumsLine()}</p>
    </div>`);
  try { navigator.wakeLock?.request("screen").then(l => ($("#sosBig") ? ($("#sosBig")._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function sosCloseBig() {
  const el = $("#sosBig");
  if (!el || el.classList.contains("out")) return;
  el._lock?.release?.();
  el.classList.add("out");
  setTimeout(() => el.remove(), 240);
}

// ---------- Ближайшая помощь: больницы, клиники, аптеки, АЗС ----------
const SOS_NEAR = [["hospital", "heart-pulse"], ["clinic", "stethoscope"], ["pharmacy", "pill"], ["fuel", "fuel"]];
async function sosNearby(p) {
  const box = $("#sosNear");
  if (!box || typeof loadServices !== "function") return;
  let all;
  try { all = await loadServices(); } catch { return; }
  if (!box.isConnected) return;
  const groups = SOS_NEAR.map(([type, ic]) => [type, ic, all.filter(s => s.type === type).map(s => [s, km(p, s)]).filter(([, d]) => d < 30).sort((a, b) => a[1] - b[1]).slice(0, 3)]).filter(g => g[2].length);
  box.innerHTML = groups.length ? `<h3 class="sec-title">${icon("compass")} ${t("sos_nearby")}</h3>` + groups.map(([type, ic, list]) => `
    <div class="sos-group"><h4>${icon(ic)} ${t("svc_" + type)}</h4>
      ${list.map(([s, d]) => `<div class="sos-near">
        <span><b>${esc(svcName(s))}</b><small>${d < 1 ? Math.round(d * 1000) + " " + t("sos_m") : d.toFixed(1) + " " + t("sos_km")}${s.oh ? " · " + esc(s.oh) : ""}</small></span>
        ${s.ph ? `<a class="btn small ghost" href="tel:${esc(s.ph.split(/[;,]/)[0].replace(/[^\d+]/g, ""))}" aria-label="${t("sos_call")}">${icon("phone")}</a>` : ""}
        <a class="btn small gold-btn" href="#nav/@${s.la},${s.lo}" aria-label="${t("sos_route")}">${icon("directions")}</a>
      </div>`).join("")}</div>`).join("") : "";
}

document.addEventListener("click", e => {
  const call = e.target.closest("[data-sos-call]");
  if (call) return sosCall(call.dataset.sosCall, call.dataset.sosKind);
  if (e.target.closest("[data-sos-locate]")) return sosLocate(false);
  if (e.target.closest("[data-sos-testpoint]")) return sosLocate(true);
  if (e.target.closest("[data-sos-share]")) return sosShare();
  if (e.target.closest("[data-sos-show]")) return sosShowBig();
  if (e.target.closest("[data-sos-big-close]") || e.target.id === "sosBig") return sosCloseBig();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#sosBig")) sosCloseBig(); });

EXT.routes.sos = openSos;
EXT.homeTiles.push(() => ["#sos", "siren", t("sos_title"), t("sos_tile")]);
