// «Мекка и Медина» (#mecca): инструменты паломника, используемые в приложении /mecca.
// Что внутри: переводчик (js/translate.js), «Я потерялся» — экран на арабском с отелем и телефоном руководителя группы,
// «Запомнить мой отель» (точка GPS) и маршрут к нему, время намаза (Умм аль-Кура, на месяц вперёд — работает без интернета),
// арабские цифры для номеров ворот, SOS с номерами Саудовской Аравии, документы и медкарточка.
// Всё личное хранится только на телефоне (safar_lost). Обряды умры и хаджа по шагам добавим после проверки специалистами.
const MECCA = { mecca: { lat: 21.4225, lon: 39.8262 }, medina: { lat: 24.4672, lon: 39.6111 } };
const PRAYERS = [["Fajr", "fajr"], ["Sunrise", "sunrise"], ["Dhuhr", "dhuhr"], ["Asr", "asr"], ["Maghrib", "maghrib"], ["Isha", "isha"]];
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const lostData = () => store.get("safar_lost", {});
const toArDigits = s => String(s).replace(/\d/g, d => AR_DIGITS[d]);
const fromArDigits = s => String(s).replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

// ---------- Главный экран «Мекка и Медина» ----------
function openMecca(sub) {
  if (sub === "lost") return openLostForm();
  const L = lostData();
  openModal(`
    <div class="m-head mc-head"><h2>🕋 ${t("mk_title")}</h2><p>${t("mk_sub")}</p></div>
    <div class="m-body mk">
      <div class="mk-grid">
        <a class="mk-tile mk-tr" href="#translate"><i>${icon("languages")}</i><b>${t("tr_title")}</b><small>${t("mk_tr_sub")}</small></a>
        <button type="button" class="mk-tile mk-lost" data-mk-lost-show><i>${icon("hand-helping")}</i><b>${t("mk_lost")}</b><small>${L.hotel ? esc(L.hotel) : t("mk_lost_sub")}</small></button>
        <a class="mk-tile mk-sos" href="#sos"><i>${icon("siren")}</i><b>SOS</b><small>911 · 997 · 999</small></a>
        <a class="mk-tile" href="#translate/phrases"><i>${icon("book")}</i><b>${t("tr_phrases")}</b><small>${t("mk_phrases_sub")}</small></a>
        <a class="mk-tile" href="#docs"><i>${icon("folder-lock")}</i><b>${t("doc_short")}</b><small>${t("mk_docs_sub")}</small></a>
        <button type="button" class="mk-tile" data-med-show><i>${icon("heart-pulse")}</i><b>${t("med_title")}</b><small>${t("mk_med_sub")}</small></button>
      </div>

      <section class="mk-sec" id="mkHotel"></section>
      <section class="mk-sec" id="mkPrayer"></section>

      <section class="mk-sec">
        <h3 class="sec-title">${icon("door-open")} ${t("mk_digits")}</h3>
        <p class="hint">${t("mk_digits_sub")}</p>
        <div class="mk-digits">${[...Array(10)].map((_, d) => `<span><b>${AR_DIGITS[d]}</b><small>${d}</small></span>`).join("")}</div>
        <label class="mk-conv"><span>${t("mk_conv")}</span><input id="mkNum" inputmode="numeric" maxlength="8" placeholder="79 / ٧٩" autocomplete="off"><output id="mkNumOut" aria-live="polite"></output></label>
      </section>

      <section class="mk-sec">
        <h3 class="sec-title">${icon("map")} ${t("mk_maps")}</h3>
        <div class="sos-links">
          <a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=Masjid%20al-Haram%20Mecca" target="_blank" rel="noopener">${icon("pin")} ${t("mk_haram")}</a>
          <a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=Al-Masjid%20an-Nabawi%20Medina" target="_blank" rel="noopener">${icon("pin")} ${t("mk_nabawi")}</a>
          <a class="btn ghost" href="https://www.nusuk.sa" target="_blank" rel="noopener">${icon("external")} Nusuk</a>
        </div>
        <p class="hint">${t("mk_nusuk")}</p>
      </section>

    </div>`);
  mkRenderHotel();
  mkRenderPrayer(store.get("safar_mk_city", "mecca"));
}

// ---------- «Мой отель»: запомнить точку и вернуться ----------
function mkRenderHotel() {
  const box = $("#mkHotel");
  if (!box) return;
  const L = lostData(), p = L.pos;
  box.innerHTML = `
    <h3 class="sec-title">${icon("hotel")} ${t("mk_hotel")}</h3>
    ${p ? `<p class="mk-hotel-on">${icon("circle-check")} <span><b>${L.hotel ? esc(L.hotel) : t("tk_saved")}</b><small>${t("mk_hotel_saved", { d: new Date(p.at).toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "short" }) })}${p.acc ? ` · ± ${p.acc} ${t("sos_m")}` : ""}</small></span></p>
      <div class="sos-links">
        <a class="btn gold-btn" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking" target="_blank" rel="noopener">${icon("directions")} ${t("mk_hotel_go")}</a>
        <button type="button" class="btn ghost" data-mk-hotel-save>${icon("map-pinned")} ${t("mk_hotel_again")}</button>
      </div>`
    : `<p class="hint">${t("mk_hotel_hint")}</p>
      <button type="button" class="btn gold-btn mk-wide" data-mk-hotel-save>${icon("map-pinned")} ${t("mk_hotel_save")}</button>`}
    <button type="button" class="btn ghost mk-wide" data-mk-lost-edit>${icon("edit")} ${t("mk_lost_fill")}</button>`;
}

async function mkSaveHotel(btn) {
  if (typeof sosPrecise !== "function") return;
  btn.disabled = true;
  const label = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span> ${t("sos_finding")}`;
  try {
    const p = await sosPrecise(cur => { btn.innerHTML = `<span class="spinner"></span> ± ${cur.acc} ${t("sos_m")}`; });
    store.set("safar_lost", { ...lostData(), pos: { lat: p.lat, lon: p.lon, acc: p.acc, at: Date.now() } });
    toast(t("mk_hotel_ok", { m: p.acc }));
    mkRenderHotel();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = label;
    if (e?.message !== "no consent") toast(t("sos_geo_err"));
  }
}

// ---------- Время намаза: месяц целиком, кэш на телефоне ----------
async function mkPrayerMonth(city, y, m) {
  const key = `safar_pt_${city}_${y}_${m}`, cached = store.get(key, null);
  if (cached) return cached;
  if (!navigator.onLine) return null;
  const c = MECCA[city];
  const r = await fetch(`https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${c.lat}&longitude=${c.lon}&method=4`, { signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  if (!Array.isArray(j.data)) return null;
  const days = j.data.map(d => ({ g: d.date.gregorian.date, h: `${d.date.hijri.day} ${d.date.hijri.month.ar} ${d.date.hijri.year}`, t: Object.fromEntries(PRAYERS.map(([k]) => [k, String(d.timings[k] || "").slice(0, 5)])) }));
  store.set(key, days);
  return days;
}
// Сейчас по времени Мекки (UTC+3, без перехода на летнее время)
const riyadhNow = () => new Date(Date.now() + 3 * 3600e3);
async function mkRenderPrayer(city) {
  const box = $("#mkPrayer");
  if (!box) return;
  const now = riyadhNow(), y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, dd = String(now.getUTCDate()).padStart(2, "0");
  box.innerHTML = `<h3 class="sec-title">${icon("clock")} ${t("mk_prayer")}</h3><div class="skeleton"></div>`;
  let month = null;
  try { month = await mkPrayerMonth(city, y, m); } catch { /* без сети */ }
  // Следующий месяц — заранее, чтобы не остаться без расписания в конце месяца
  try { if (navigator.onLine) mkPrayerMonth(city, m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1); } catch { /* не страшно */ }
  if (!box.isConnected) return;
  const today = month?.find(d => d.g.startsWith(dd + "-"));
  const hm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const next = today && PRAYERS.find(([k]) => k !== "Sunrise" && today.t[k] > hm);
  box.innerHTML = `
    <h3 class="sec-title">${icon("clock")} ${t("mk_prayer")}</h3>
    <div class="chips mk-cities">${["mecca", "medina"].map(c => `<button type="button" class="chip ${c === city ? "on" : ""}" data-mk-city="${c}">${t("mk_" + c)}</button>`).join("")}</div>
    ${today ? `
      <p class="hint mk-date">${esc(today.h)} · ${t("mk_local_time")}</p>
      <div class="mk-times">${PRAYERS.map(([k, key]) => `<div class="mk-time ${next?.[0] === k ? "next" : ""} ${k === "Sunrise" ? "sun" : ""}"><small>${t("nm_" + key)}</small><b>${today.t[k]}</b>${next?.[0] === k ? `<em>${t("mk_next")}</em>` : ""}</div>`).join("")}</div>
      <p class="hint">${icon("wifi-off")} ${t("mk_prayer_off")}</p>`
    : `<p class="hint">${t(navigator.onLine ? "mk_prayer_err" : "mk_prayer_need_net")}</p>`}`;
}

// ---------- «Я потерялся»: данные и экран на арабском ----------
function openLostForm() {
  const L = lostData();
  const f = (name, ph = "", type = "text") => `<label><span>${t("mk_f_" + name)}</span><input name="${name}" type="${type}" maxlength="120" value="${esc(L[name] || "")}" placeholder="${ph}" ${type === "tel" ? 'inputmode="tel"' : ""}></label>`;
  openModal(`
    <div class="m-head mc-head"><h2>${icon("hand-helping")} ${t("mk_lost")}</h2><p>${t("mk_lost_form_sub")}</p></div>
    <div class="m-body">
      <form class="tk-edit mk-form" data-mk-lost-form>
        ${f("name")}
        ${f("hotel", t("mk_f_hotel_ph"))}
        ${f("hotel_ar", "فندق …")}
        ${f("area", t("mk_f_area_ph"))}
        ${f("gate", "79")}
        <div class="tk-edit-row">${f("leader")}${f("leader_phone", "+966 / +998", "tel")}</div>
        ${f("group", t("mk_f_group_ph"))}
        <div class="tk-edit-acts"><button class="btn gold-btn" type="submit">${icon("check")} ${t("tk_save")}</button></div>
      </form>
      <p class="hint doc-private">${icon("lock")} <span>${t("doc_private")}</span></p>
    </div>`);
}
function showLost() {
  const L = lostData();
  if (!L.hotel && !L.leader_phone) return (location.hash = "#mecca/lost");
  const row = (label, val, cls = "") => val ? `<div class="mc-row ${cls}"><small>${label}</small><b>${val}</b></div>` : "";
  const tel = L.leader_phone ? `<a href="tel:${esc(L.leader_phone.replace(/[^\d+]/g, ""))}">${esc(L.leader_phone)}</a>` : "";
  document.body.insertAdjacentHTML("beforeend", `
    <div id="lostCard" class="tc mc lost-card" role="dialog" aria-modal="true">
      <button type="button" class="tc-x" data-lost-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <p class="lost-big" dir="rtl" lang="ar">أنا تائه، من فضلك ساعدني</p>
      <p class="lost-en">I am lost, please help me · Men adashib qoldim</p>
      ${row("الاسم · Name", esc(L.name || ""))}
      ${row("أنا من أوزبكستان · From", "Uzbekistan · أوزبكستان")}
      ${row("فندقي · My hotel", [L.hotel_ar && `<span dir="rtl" lang="ar">${esc(L.hotel_ar)}</span>`, esc(L.hotel || "")].filter(Boolean).join("<br>"), "big")}
      ${row("المنطقة · Area", esc(L.area || ""))}
      ${row("أقرب باب · Nearest gate", L.gate ? `${esc(fromArDigits(L.gate))} · <span lang="ar">${toArDigits(fromArDigits(L.gate))}</span>` : "")}
      ${row("اتصل بمسؤول مجموعتي · Call my group leader", [esc(L.leader || ""), tel].filter(Boolean).join(" · "), "big")}
      ${row("المجموعة · Group", esc(L.group || ""))}
      ${L.pos ? `<a class="btn gold-btn lost-map" href="https://www.google.com/maps/dir/?api=1&destination=${L.pos.lat},${L.pos.lon}&travelmode=walking" target="_blank" rel="noopener">${icon("directions")} ${t("mk_hotel_go")}</a>` : ""}
    </div>`);
  try { navigator.wakeLock?.request("screen").then(l => ($("#lostCard") ? ($("#lostCard")._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function closeLost() {
  const el = $("#lostCard");
  if (!el || el.classList.contains("out")) return;
  el._lock?.release?.();
  el.classList.add("out");
  setTimeout(() => el.remove(), 240);
}

document.addEventListener("submit", e => {
  const f = e.target.closest("[data-mk-lost-form]");
  if (!f) return;
  e.preventDefault();
  const data = Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, String(v).trim().slice(0, 120)]));
  store.set("safar_lost", { ...lostData(), ...data });
  toast(t("tk_saved"));
  location.hash = "#mecca";
});
document.addEventListener("input", e => {
  if (e.target.id !== "mkNum") return;
  const v = e.target.value.trim(), out = $("#mkNumOut");
  if (!out) return;
  if (!v) { out.textContent = ""; return; }
  out.innerHTML = /[٠-٩۰-۹]/.test(v) ? `= <b>${esc(fromArDigits(v))}</b>` : `= <b lang="ar">${esc(toArDigits(v))}</b>`;
});
document.addEventListener("click", e => {
  if (e.target.closest("[data-mk-lost-show]")) return showLost();
  if (e.target.closest("[data-mk-lost-edit]")) { location.hash = "#mecca/lost"; return; }
  if (e.target.closest("[data-lost-close]") || e.target.id === "lostCard") return closeLost();
  const save = e.target.closest("[data-mk-hotel-save]");
  if (save) return mkSaveHotel(save);
  const c = e.target.closest("[data-mk-city]");
  if (c) { store.set("safar_mk_city", c.dataset.mkCity); return mkRenderPrayer(c.dataset.mkCity); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#lostCard")) closeLost(); });

if (IS_MK_APP) {
  EXT.routes.mecca = openMecca;
  EXT.routes.lost = () => { location.replace("#mecca"); setTimeout(showLost, 400); };
}
