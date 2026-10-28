// Гиды и экскурсии: каталог, бронирование, кабинет гида, мои бронирования. Работает с сервером (server/market.js).

let TOUR_COUNTS = null;   // { cityId: число экскурсий } — пока null, сервер недоступен
const GUIDE_LANGS = ["uz", "ru", "en", "tr", "de", "zh", "ko", "fr", "es", "it", "ja", "ar"];
const LANG_NAME = { uz: "O‘zbek", ru: "Русский", en: "English", tr: "Türkçe", de: "Deutsch", zh: "中文", ko: "한국어", fr: "Français", es: "Español", it: "Italiano", ja: "日本語", ar: "العربية" };
const STATUS_ICON = { new: "clock", confirmed: "circle-check", declined: "circle-x", cancelled: "ban", pending: "hourglass", approved: "circle-check", rejected: "circle-x", blocked: "ban" };
const statusLabel = s => `${icon(STATUS_ICON[s] || "info")} ${t("st_" + s)}`;
const isoToday = () => new Date().toISOString().slice(0, 10);

function tourCard(tour) {
  return `
    <div class="tour-card" data-tour="${tour.id}">
      <div class="tour-top">
        <div><h4>${esc(tour.title)}</h4>
          <small>${icon("city")} ${esc(CITY[tour.city] ? cityName(CITY[tour.city]) : tour.cityName)} · ${icon("user")} ${esc(tour.guide.name)} · ${icon("languages")} ${tour.guide.languages.map(l => l.toUpperCase()).join(", ")}</small>
        </div>
        <div class="tour-price">${money(usd(tour.price_usd))}<small>${t("tour_per_group")}</small></div>
      </div>
      <p>${esc(tour.description)}</p>
      <div class="meta"><span>${icon("clock")} ${tour.duration_h} ${t("hours_short")}</span><span>${icon("users")} ≤ ${tour.max_people}</span></div>
      <button class="btn gold-btn" data-book="${tour.id}" data-max="${tour.max_people}">${icon("send")} ${t("tour_book")}</button>
      <div class="book-box"></div>
    </div>`;
}

function bookingForm(id, max) {
  if (!window.SAFAR_USER) return `<p class="hint">${t("tour_login")}</p><a class="btn tg-btn" href="#account">${icon("tg")} ${t("acc_login")}</a>`;
  return `
    <form class="book-form" data-tour-id="${id}">
      <label>${t("tour_date")}<input type="date" name="date" min="${isoToday()}" required></label>
      <label>${t("travelers")}<input type="number" name="people" min="1" max="${max}" value="2" required></label>
      <label>${t("tour_contact")}<input name="contact" maxlength="60" placeholder="+998 … / @telegram" required></label>
      <label class="wide">${t("tour_message")}<textarea name="message" rows="2" maxlength="500"></textarea></label>
      <button class="btn gold-btn" type="submit">${t("tour_send")}</button>
      <p class="hint wide">${t("tour_pay_note")}</p>
    </form>`;
}

async function loadTours(el, cityId) {
  el.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div>`;
  try {
    const tours = await api(`/api/tours?lang=${LANG}${cityId ? "&city=" + encodeURIComponent(cityId) : ""}`);
    el.innerHTML = tours.length ? tours.map(tourCard).join("")
      : `<div class="empty">${t("tour_none")}<br><a class="btn ghost" href="#account" style="margin-top:10px">${icon("flag")} ${t("guide_become")}</a></div>`;
  } catch { el.innerHTML = `<p class="hint">${t("weather_na")}</p>`; }
}

// ---------- Каталог (#tours) ----------
function openTours() {
  const cities = Object.keys(TOUR_COUNTS || {}).filter(id => CITY[id]);
  openModal(`
    <div class="m-head" style="background:${CAT_BG.s};min-height:150px;padding-top:60px"><h2>${icon("flag")} ${t("tours_title")}</h2><p>${t("tours_sub")}</p></div>
    <div class="m-body">
      <div class="filters"><select id="tourCity"><option value="">${t("all_cities")}</option>
        ${cities.map(id => `<option value="${id}">${esc(cityName(CITY[id]))} (${TOUR_COUNTS[id]})</option>`).join("")}</select></div>
      <div id="tourList" class="tour-list"></div>
    </div>`);
  $("#tourCity").addEventListener("change", e => loadTours($("#tourList"), e.target.value));
  loadTours($("#tourList"), "");
}

// ---------- Аккаунт: мои бронирования и кабинет гида ----------
EXT.accountSections.push(() =>
  accSection("send", t("my_bookings"), `<div id="accBookings"><div class="skeleton"></div></div>`) +
  accSection("flag", t("guide_cabinet"), `<div id="accGuide"><div class="skeleton"></div></div>`));

async function renderMyBookings() {
  const box = $("#accBookings");
  if (!box) return;
  try {
    // Отменённые и отклонённые — не показываем, чтобы не мозолили глаза
    const rows = (await api("/api/bookings/me")).filter(b => !["declined", "cancelled"].includes(b.status));
    box.innerHTML = rows.length ? rows.map(b => `
      <div class="bk-row">
        <div><b>${esc(b.title)}</b><small>${icon("calendar")} ${b.date} · ${icon("users")} ${b.people} · ${icon("user")} ${esc(b.guide_name)}</small></div>
        <span class="bk-status ${b.status}">${statusLabel(b.status)}</span>
        ${["new", "confirmed"].includes(b.status) ? `<button class="btn small ghost" data-bk="${b.id}" data-st="cancelled">${t("bk_cancel")}</button>` : ""}
      </div>`).join("") : `<p class="hint">${t("bk_none")} <a href="#tours">${t("tours_title")} ${icon("arrow-right")}</a></p>`;
  } catch { box.innerHTML = ""; }
}

async function renderGuideCabinet() {
  const box = $("#accGuide");
  if (!box) return;
  let data;
  try { data = await api("/api/guides/me"); } catch { box.innerHTML = ""; return; }
  const admin = data.isAdmin ? `<a class="btn ghost" href="#admin">${icon("shield")} ${t("admin_title")}</a>` : "";
  const g = data.guide;
  if (!g) {
    box.innerHTML = `<p class="hint">${t("guide_pitch")}</p>
      <details class="acc-form"><summary class="btn gold-btn">${icon("flag")} ${t("guide_become")}</summary>${guideForm(null)}</details>${admin}`;
    return;
  }
  if (g.status === "rejected") {
    box.innerHTML = `<p class="hint">${t("guide_again")}</p>
      <details class="acc-form"><summary class="btn gold-btn">${icon("flag")} ${t("guide_become")}</summary>${guideForm(g)}</details>${admin}`;
    return;
  }
  if (g.status !== "approved") {
    box.innerHTML = `<p><span class="bk-status ${g.status}">${statusLabel(g.status)}</span></p>
      <p class="hint">${t("guide_wait_" + (g.status === "pending" ? "pending" : "other"))}</p>${g.status === "pending" ? guideForm(g) : ""}${admin}`;
    return;
  }
  const incoming = data.bookings.filter(b => !["declined", "cancelled"].includes(b.status)).map(b => `
    <div class="bk-row">
      <div><b>${esc(b.title)}</b><small>${icon("calendar")} ${b.date} · ${icon("users")} ${b.people} · ${icon("user")} ${esc(b.tourist)} · ${icon("phone")} ${esc(b.contact)}${b.message ? ` · ${icon("message")} ${esc(b.message)}` : ""}</small></div>
      <span class="bk-status ${b.status}">${statusLabel(b.status)}</span>
      ${b.status === "new" ? `<button class="btn small gold-btn" data-bk="${b.id}" data-st="confirmed">${t("bk_confirm")}</button>
        <button class="btn small ghost" data-bk="${b.id}" data-st="declined">${t("bk_decline")}</button>` : ""}
    </div>`).join("");
  box.innerHTML = `
    <p><span class="bk-status approved">${statusLabel("approved")}</span> ${esc(g.name)}</p>
    <h4>${t("guide_requests")}</h4>${incoming || `<p class="hint">${t("bk_none")}</p>`}
    <h4>${t("guide_tours")}</h4>
    ${data.tours.map(tr => `<div class="bk-row"><div><b>${esc(tr.title)}</b><small>${icon("city")} ${esc(CITY[tr.city] ? cityName(CITY[tr.city]) : tr.city)} · ${money(usd(tr.price_usd))} · ${icon("clock")} ${tr.duration_h} ${t("hours_short")}</small></div>
      <span class="bk-status ${tr.status === "active" ? "approved" : "cancelled"}">${tr.status === "active" ? t("tour_active") : t("tour_hidden")}</span>
      <button class="btn small ghost" data-tour-toggle="${tr.id}" data-st="${tr.status === "active" ? "hidden" : "active"}">${tr.status === "active" ? t("tour_hide") : t("tour_show")}</button></div>`).join("") || `<p class="hint">${t("tour_none_own")}</p>`}
    <details class="tour-new"><summary>${icon("plus")} ${t("tour_add")}</summary>${tourForm(g)}</details>
    <details><summary>${icon("edit")} ${t("guide_edit")}</summary>${guideForm(g)}</details>
    ${admin}`;
}

function guideForm(g) {
  const u = window.SAFAR_USER;
  const cities = g ? g.cities : [];
  return `
    <form class="guide-form" id="guideForm">
      <label>${t("guide_name")}<input name="name" maxlength="60" value="${esc(g ? g.name : u?.name || "")}" required></label>
      <label>${t("phone")}<input name="phone" maxlength="30" placeholder="+998 …" value="${esc(g?.phone || "")}" required></label>
      <label class="wide">${t("guide_bio")}<textarea name="bio" rows="3" minlength="20" maxlength="1500" required>${esc(g ? g.bio : "")}</textarea></label>
      <fieldset class="wide"><legend>${t("guide_langs")}</legend>
        ${GUIDE_LANGS.map(l => `<label class="check"><input type="checkbox" name="lang" value="${l}" ${g?.languages.includes(l) ? "checked" : ""}> ${LANG_NAME[l]}</label>`).join("")}
      </fieldset>
      <label class="wide">${t("guide_cities")}<input name="cityAdd" list="cityList" placeholder="${t("city_ph")}" autocomplete="off"></label>
      <div class="chips wide" id="guideCities">${cities.map(id => CITY[id] ? `<span class="chip" data-city-chip="${id}">${esc(cityName(CITY[id]))} ${icon("x")}</span>` : "").join("")}</div>
      <button class="btn gold-btn" type="submit">${g ? t("guide_save") : t("guide_apply")}</button>
    </form>`;
}

function tourForm(g) {
  return `
    <form class="guide-form" id="tourForm">
      <label>${t("region")}<select name="city">${g.cities.filter(id => CITY[id]).map(id => `<option value="${id}">${esc(cityName(CITY[id]))}</option>`).join("")}</select></label>
      <label>${t("tour_title")}<input name="title" maxlength="100" minlength="5" required></label>
      <label class="wide">${t("description")}<textarea name="description" rows="3" minlength="20" maxlength="2000" required></textarea></label>
      <label>${t("tour_duration")}<input type="number" name="duration_h" min="0.5" max="72" step="0.5" value="3" required></label>
      <label>${t("tour_price")}<input type="number" name="price_usd" min="0" max="10000" step="1" value="30" required></label>
      <label>${t("tour_max")}<input type="number" name="max_people" min="1" max="100" value="8" required></label>
      <button class="btn gold-btn" type="submit">${t("tour_publish")}</button>
    </form>`;
}

// ---------- События ----------
document.addEventListener("click", async e => {
  const book = e.target.closest("[data-book]");
  if (book) {
    const box = book.parentElement.querySelector(".book-box");
    box.innerHTML = box.innerHTML ? "" : bookingForm(book.dataset.book, +book.dataset.max);
    return;
  }
  const bk = e.target.closest("[data-bk]");
  if (bk) {
    try { await api(`/api/bookings/${bk.dataset.bk}/status`, { method: "POST", body: JSON.stringify({ status: bk.dataset.st }) }); toast(t("saved")); }
    catch { toast(t("review_error")); }
    renderMyBookings(); renderGuideCabinet();
    return;
  }
  const tt = e.target.closest("[data-tour-toggle]");
  if (tt) {
    try { await api(`/api/tours/${tt.dataset.tourToggle}`, { method: "PUT", body: JSON.stringify({ status: tt.dataset.st }) }); } catch { toast(t("review_error")); }
    renderGuideCabinet();
    return;
  }
  const chip = e.target.closest("[data-city-chip]");
  if (chip) chip.remove();
});

// Добавление города в заявку гида — выбором из списка
document.addEventListener("change", e => {
  if (e.target.name !== "cityAdd") return;
  const v = e.target.value.trim(), lv = v.toLowerCase();
  const c = CITIES.find(c => cityLabel(c) === v) || CITIES.find(c => c.hay.includes(lv));
  if (c && !$(`#guideCities [data-city-chip="${c.id}"]`)) $("#guideCities").insertAdjacentHTML("beforeend", `<span class="chip" data-city-chip="${c.id}">${esc(cityName(c))} ${icon("x")}</span>`);
  e.target.value = "";
});

document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.matches(".book-form")) {
    e.preventDefault();
    try {
      await api("/api/bookings", { method: "POST", body: JSON.stringify({
        tour_id: +f.dataset.tourId, date: f.date.value, people: +f.people.value, contact: f.contact.value, message: f.message.value }) });
      f.outerHTML = `<p class="ok-note">${icon("circle-check")} ${t("tour_sent")}</p>`;
    } catch { toast(t("review_error")); }
  }
  if (f.id === "guideForm") {
    e.preventDefault();
    const body = {
      name: f.name.value, phone: f.phone.value, bio: f.bio.value,
      languages: $$("input[name=lang]:checked", f).map(i => i.value),
      cities: $$("[data-city-chip]", f.parentElement).map(c => c.dataset.cityChip)
    };
    if (!body.languages.length || !body.cities.length) return toast(t("guide_need"));
    try { await api("/api/guides/apply", { method: "POST", body: JSON.stringify(body) }); toast(t("guide_sent")); renderGuideCabinet(); }
    catch { toast(t("review_error")); }
  }
  if (f.id === "tourForm") {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    try { await api("/api/tours", { method: "POST", body: JSON.stringify(fd) }); toast(t("tour_published")); renderGuideCabinet(); }
    catch { toast(t("review_error")); }
  }
});

// ---------- Подключение ----------
EXT.routes.tours = openTours;
EXT.cityTabs.push({
  id: "tours",
  // Число — как у остальных вкладок, и только если экскурсии есть (без «(0)»)
  label: c => TOUR_COUNTS ? `${icon("flag")} ${t("tours_title")}${TOUR_COUNTS[c.id] ? ` <b class="n">${TOUR_COUNTS[c.id]}</b>` : ""}` : null,
  render: (c, el) => { el.innerHTML = `<div class="tour-list"></div>`; loadTours(el.firstChild, c.id); }
});
EXT.homeTiles.push(() => TOUR_COUNTS ? ["#tours", "flag", t("tours_title"), t("tours_sub")] : null);
EXT.onAccountRender.push(u => { if (u) { renderMyBookings(); renderGuideCabinet(); } });
EXT.onConfig.push(async cfg => {
  if (!cfg.telegramBot) return;
  try { TOUR_COUNTS = await api("/api/tours/counts"); } catch { return; }
  if (rendered.home) renderHome();
});
