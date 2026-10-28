// Кабинет бизнеса (#business) и админ-панель (#admin).
// Правки владельцев (фото, реальные цены, телефоны, часы) подмешиваются в данные мест при запуске.

let MY_PLACES = new Set();

// ---------- Правки владельцев ----------
async function loadOverrides() {
  let all;
  try { all = await api("/api/overrides"); } catch { return; }
  for (const [id, o] of Object.entries(all)) {
    const p = POI[id];
    if (!p) continue;
    p.owned = true;
    p.pro = o.plan === "pro";
    if (o.ph) p.ph = o.ph;
    if (o.w) p.w = o.w;
    if (o.oh) { p.oh = o.oh; delete p._oh; }
    if (o.d) p.de = o.d;
    if (o.img) p.photo = o.img;
    if (o.pf != null) { p.priceFrom = o.pf; p.usd = o.pf; }
    if (o.pt != null) p.priceTo = o.pt;
  }
  for (const k of ["hotels", "places"]) if (rendered[k]) RENDER[k]();
}

async function loadMyPlaces() {
  try { const r = await api("/api/business/me"); MY_PLACES = new Set(r.places.map(p => p.poi_id)); return r; }
  catch { MY_PLACES = new Set(); return null; }
}

// ---------- Блок в карточке места ----------
EXT.placeExtras.push(p => {
  if (!SAFAR_CONFIG.telegramBot) return "";
  if (MY_PLACES.has(p.id)) return `<p><a class="btn gold-btn" href="#business">${icon("edit")} ${t("biz_manage")}</a></p>`;
  if (p.owned) return "";
  return `<details class="claim-box"><summary>${icon("store")} ${t("biz_claim_q")}</summary>
    ${window.SAFAR_USER ? `
      <p class="hint">${t("biz_claim_hint")}</p>
      <form class="guide-form" id="claimForm" data-poi="${p.id}">
        <label>${t("biz_role")}<select name="role"><option value="owner">${t("biz_role_owner")}</option><option value="manager">${t("biz_role_manager")}</option><option value="staff">${t("biz_role_staff")}</option></select></label>
        <label>${t("tour_contact")}<input name="contact" maxlength="60" required></label>
        <label class="wide">${t("biz_proof")}<textarea name="proof" rows="2" minlength="10" maxlength="1000" placeholder="${t("biz_proof_ph")}" required></textarea></label>
        <button class="btn gold-btn" type="submit">${t("biz_send")}</button>
      </form>` : `<p class="hint">${t("tour_login")}</p><a class="btn tg-btn" href="#account">${icon("tg")} ${t("acc_login")}</a>`}
  </details>`;
});

// ---------- Кабинет бизнеса ----------
async function openBusiness() {
  openModal(`
    <div class="m-head" style="background:${CAT_BG.h};min-height:150px;padding-top:60px"><h2>${icon("store")} ${t("biz_title")}</h2></div>
    <div class="m-body"><div id="bizBox"><div class="skeleton"></div><div class="skeleton"></div></div></div>`);
  if (!window.SAFAR_USER) { $("#bizBox").innerHTML = `<a class="btn tg-btn" href="#account">${icon("tg")} ${t("acc_login")}</a>`; return; }
  const data = await loadMyPlaces();
  const box = $("#bizBox");
  if (!box) return;
  if (!data) { box.innerHTML = `<p class="hint">${t("weather_na")}</p>`; return; }
  const placeName = id => POI[id] ? esc(poiName(POI[id])) : id;
  box.innerHTML = `
    ${data.claims.some(c => c.status !== "rejected") ? `<h3>${t("biz_claims")}</h3>${data.claims.filter(c => c.status !== "rejected").map(c => `<div class="bk-row"><div><b><a href="#place/${c.poi_id}">${placeName(c.poi_id)}</a></b></div><span class="bk-status ${c.status}">${statusLabel(c.status)}</span></div>`).join("")}` : ""}
    <h3>${t("biz_places")}</h3>
    ${data.places.length ? data.places.map(pl => {
      const p = POI[pl.poi_id], o = pl.overrides, st = Object.fromEntries(pl.stats.map(x => [x.kind, x.n]));
      return `<section class="biz-place">
        <div class="bk-row"><div><b><a href="#place/${pl.poi_id}">${placeName(pl.poi_id)}</a></b>
          <small>${p ? typeLabel(p.s) + " · " + esc(cityName(p.city)) : ""} · ${pl.plan === "pro" ? icon("crown") + " " + t("partner") : t("biz_plan_free")}</small></div>
          <span class="gold">${pl.rating.n ? icon("star", "fill") + " " + pl.rating.avg.toFixed(1) + " (" + pl.rating.n + ")" : icon("star")}</span></div>
        <p class="hint">${t("biz_stats", { b: st.booking || 0, d: st.directions || 0, w: st.website || 0 })}</p>
        <details><summary>${icon("edit")} ${t("biz_edit")}</summary>
          <form class="guide-form biz-form" data-poi="${pl.poi_id}">
            <label class="wide">${t("description")}<textarea name="description" rows="3" maxlength="1000">${esc(o.description || "")}</textarea></label>
            <label>${t("phone")}<input name="phone" maxlength="40" value="${esc(o.phone || p?.ph || "")}"></label>
            <label>${t("website")}<input name="website" maxlength="300" value="${esc(o.website || "")}"></label>
            <label>${t("hours")}<input name="hours" maxlength="200" placeholder="Mo-Su 09:00-21:00" value="${esc(o.hours || p?.oh || "")}"></label>
            ${p?.c === "h" ? `<label>${t("biz_price_from")}<input type="number" name="price_from" min="0" value="${o.price_from ?? ""}"></label>
              <label>${t("biz_price_to")}<input type="number" name="price_to" min="0" value="${o.price_to ?? ""}"></label>` : ""}
            <label class="wide">${t("biz_photo")}<input name="photo" maxlength="500" placeholder="https://…/photo.jpg" value="${esc(o.photo || "")}"></label>
            <button class="btn gold-btn" type="submit">${t("guide_save")}</button>
          </form>
        </details>
        <details><summary>${icon("message")} ${t("reviews")} (${pl.reviews.length})</summary>
          ${pl.reviews.map(r => `<div class="review"><div class="r-head"><b>${esc(r.name)}</b><span class="gold">${starStr(r.stars)}</span></div><p>${esc(r.text)}</p>
            <form class="reply-form" data-review="${r.id}"><textarea name="text" rows="2" maxlength="1000" placeholder="${t("biz_reply_ph")}">${esc(r.reply || "")}</textarea>
            <button class="btn small gold-btn" type="submit">${t("biz_reply")}</button></form></div>`).join("") || `<p class="hint">${t("first_review")}</p>`}
        </details>
      </section>`;
    }).join("") : `<p class="hint">${t("biz_none")}</p>`}`;
}

// ---------- Админ-панель ----------
const adminToken = () => { try { return sessionStorage.getItem("safar_admin") || ""; } catch { return ""; } };
const adminApi = (path, opts = {}) => api(path, { ...opts, headers: { ...(adminToken() ? { "X-Admin-Token": adminToken() } : {}), ...opts.headers } });

async function openAdmin(tab = "overview") {
  openModal(`
    <div class="m-head" style="background:${CAT_BG.a};min-height:140px;padding-top:56px"><h2>${icon("shield")} ${t("admin_title")}</h2></div>
    <div class="m-body">
      <div class="m-tabs">${["overview", "stats", "guides", "claims", "reviews", "reports", "feedback", "qa"].map(id => `<button class="${id === tab ? "active" : ""}" data-admin-tab="${id}">${t("admin_" + id)}</button>`).join("")}</div>
      <div id="adminBox"><div class="skeleton"></div></div>
    </div>`);
  renderAdmin(tab);
}

// «Статистика» в админке (server/stats.js): люди по дням, разделы, действия, источники, опрос
const ADM_EV = {
  "v:home": ["Bosh sahifa", "Главная", "Home"], "v:cities": ["Shaharlar", "Города", "Cities"], "v:hotels": ["Mehmonxonalar", "Отели", "Hotels"],
  "v:places": ["Joylar", "Места", "Places"], "v:map": ["Xarita", "Карта", "Map"], "v:budget": ["Sayohat", "Поездка", "Trip"],
  "v:city": ["Shahar sahifasi", "Страница города", "City page"], "v:place": ["Joy sahifasi", "Страница места", "Place page"],
  "v:favs": ["Saralangan", "Избранное", "Favourites"], "v:account": ["Akkaunt", "Аккаунт", "Account"], "v:prices": ["Narxlar", "Цены на месте", "Prices"],
  "v:guide": ["Qo‘llanma", "Путеводитель", "Guide"], "v:tickets": ["Chiptalar", "Билеты", "Tickets"], "v:offline": ["Oflayn", "Офлайн", "Offline"],
  "v:passport": ["Pasport", "Паспорт", "Passport"], "v:diary": ["Kundalik", "Дневник", "Diary"], "v:feedback": ["Murojaat", "Обращения", "Feedback"],
  "v:partners": ["Biznes uchun", "Для бизнеса", "For business"], "v:poster": ["QR-poster", "QR-постер", "QR poster"], "v:nav": ["Navigatsiya", "Навигация", "Navigation"],
  "a:trip_quick": ["Sayohat yig‘ildi", "Собрали поездку", "Built a trip"], "a:trip_ready": ["Tayyor marshrut", "Готовый маршрут", "Ready route"],
  "a:trip_share": ["Sayohat ulashildi", "Поделились поездкой", "Shared trip"], "a:together_create": ["Do‘stlar taklif qilindi", "Пригласили друзей", "Invited friends"],
  "a:together_join": ["Umumiy sayohatga qo‘shildi", "Вошли в общую поездку", "Joined shared trip"], "a:fav_add": ["Saralanganga", "В избранное", "Added to favourites"],
  "a:review": ["Sharh", "Отзыв", "Review"], "a:ticket_add": ["Chipta qo‘shildi", "Добавили билет", "Added ticket"], "a:crowd_mark": ["«Shu yerdaman»", "«Я здесь»", "“I'm here”"],
  "a:route": ["Marshrut", "Маршрут", "Directions"], "a:taxi": ["Taksi", "Такси", "Taxi"], "a:call": ["Qo‘ng‘iroq", "Звонок", "Call"],
  "a:install": ["O‘rnatildi", "Установили приложение", "Installed"], "a:login": ["Kirish", "Вход", "Sign-in"], "a:lang": ["Til almashtirildi", "Сменили язык", "Language changed"]
};
const admEv = k => ADM_EV[k]?.[["uz", "ru", "en"].indexOf(LANG) >= 0 ? ["uz", "ru", "en"].indexOf(LANG) : 2] || k.slice(2);
// Источник: «poster_n123» → «QR-постер: Название места»
const ADM_SRC = { poster: ["QR-poster", "QR-постер", "QR poster"], telegram: ["Telegram", "Telegram", "Telegram"], direct: ["To‘g‘ridan-to‘g‘ri", "Напрямую", "Direct"],
  app: ["Ilova", "Приложение", "App"], friend: ["Do‘st tavsiyasi", "Совет друга", "Friend's link"] };
function admSrc(src) {
  const i = Math.max(0, ["uz", "ru", "en"].indexOf(LANG)), m = src.match(/^poster_([nwr]\d+)$/);
  if (m) return `${icon("print")} ${ADM_SRC.poster[i]}: ${POI[m[1]] ? `<a href="#place/${m[1]}">${esc(poiName(POI[m[1]]))}</a>` : esc(m[1])}`;
  return ADM_SRC[src] ? esc(ADM_SRC[src][i]) : esc(src);
}
function adminStatsHtml(s) {
  const sum = k => s.byDay.reduce((a, d) => a + d[k], 0), max = Math.max(1, ...s.byDay.map(d => d.users));
  const rows = (list, label) => list.length ? list.map(x => `<div class="bk-row"><div><b>${label(x)}</b></div><span class="bk-status">${x.n}</span></div>`).join("") : `<p class="hint">${t("adm_empty")}</p>`;
  const views = s.events.filter(e => e.name.startsWith("v:")), acts = s.events.filter(e => e.name.startsWith("a:"));
  return `
    <div class="stats admin-stats">${[["adm_st_users", sum("users")], ["adm_st_new", sum("fresh")], ["adm_st_trips", acts.filter(e => /trip_quick|trip_ready/.test(e.name)).reduce((a, e) => a + e.n, 0)], ["adm_st_rating", s.survey.avg ? s.survey.avg + "★" : "—"]]
      .map(([k, n]) => `<div class="stat"><b>${n}</b><span>${t(k)}</span></div>`).join("")}</div>
    <p class="hint">${t("adm_st_note", { d: s.days })}</p>
    <h3>${t("adm_st_days")}</h3>
    <table class="st-days"><thead><tr><th></th><th>${t("adm_st_users")}</th><th>${t("adm_st_new")}</th></tr></thead><tbody>
      ${s.byDay.slice().reverse().map(d => `<tr><td>${esc(d.day.slice(5).split("-").reverse().join("."))}</td><td><span class="st-bar" style="--w:${Math.round(d.users / max * 100)}%"></span>${d.users}</td><td>${d.fresh}</td></tr>`).join("")
        || `<tr><td colspan="3" class="hint">${t("adm_empty")}</td></tr>`}</tbody></table>
    <h3>${t("adm_st_sources")}</h3>${rows(s.sources, x => admSrc(x.src))}
    <h3>${t("adm_st_actions")}</h3>${rows(acts, x => esc(admEv(x.name)))}
    <h3>${t("adm_st_views")}</h3>${rows(views, x => esc(admEv(x.name)))}
    <h3>${t("adm_st_survey")} ${s.survey.n ? `<span class="badge">${s.survey.n}</span>` : ""}</h3>
    ${s.survey.n ? `<p>${[5, 4, 3, 2, 1].map(n => `${"★".repeat(n)} — ${s.survey.stars[n] || 0}`).join("<br>")}</p>` : `<p class="hint">${t("adm_empty")}</p>`}
    ${s.survey.comments.map(c => `<div class="review"><div class="r-head"><b>${esc(c.day)} · ${esc(c.lang || "")}</b><span class="gold">${"★".repeat(c.stars)}</span></div><p>${esc(c.text)}</p></div>`).join("")}`;
}

async function renderAdmin(tab) {
  const box = $("#adminBox");
  try {
    if (tab === "overview") {
      const o = await adminApi("/api/admin/overview");
      box.innerHTML = `<div class="stats admin-stats">${[["users", o.users], ["reviews", o.reviews], ["guides", o.guides], ["tours", o.tours], ["bookings", o.bookings], ["guidesPending", o.guidesPending], ["claimsPending", o.claimsPending], ["reportsNew", o.reportsNew || 0], ["feedbackNew", o.feedbackNew || 0]]
        .map(([k, n]) => `<div class="stat"><b>${n}</b><span>${t("adm_" + k)}</span></div>`).join("")}</div>
        <h3>${t("adm_partners")}</h3><div class="bk-row"><div><b>${t("adm_partner")}</b></div><span class="hint">${t("adm_30d")} · ${t("adm_7d")}</span></div>${(o.partners || []).map(x => `<div class="bk-row"><div><b>${t("adm_p_" + x.kind)}</b></div><span class="bk-status">${x.n} · ${x.week}</span></div>`).join("")}
        <h3>${t("adm_top_booking")}</h3>${o.topBooking.map(x => { const p = POI[x.key.slice(4)]; return `<div class="bk-row"><div><b>${p ? `<a href="#place/${p.id}">${esc(poiName(p))}</a>` : esc(x.key)}</b></div><span class="bk-status">${x.n}</span></div>`; }).join("") || `<p class="hint">${t("bk_none")}</p>`}`;
    }
    if (tab === "stats") box.innerHTML = adminStatsHtml(await adminApi("/api/admin/stats?days=14"));
    if (tab === "guides") {
      const rows = await adminApi("/api/admin/guides?status=pending");
      box.innerHTML = rows.map(g => `<div class="bk-row"><div><b>${esc(g.name)}</b>${g.username ? ` <small>@${esc(g.username)}</small>` : ""}
        <small>${icon("phone")} ${esc(g.phone)} · ${icon("languages")} ${g.languages.join(", ")} · ${icon("city")} ${g.cities.map(id => CITY[id] ? esc(cityName(CITY[id])) : id).join(", ")}</small><p>${esc(g.bio)}</p></div>
        <button class="btn small gold-btn" data-admin-guide="${g.id}" data-st="approved">${t("adm_approve")}</button>
        <button class="btn small ghost" data-admin-guide="${g.id}" data-st="rejected">${t("adm_reject")}</button></div>`).join("") || `<p class="hint">${t("adm_empty")}</p>`;
    }
    if (tab === "claims") {
      const rows = await adminApi("/api/admin/claims?status=pending");
      box.innerHTML = rows.map(c => `<div class="bk-row"><div><b>${c.place ? `<a href="#place/${c.poi_id}">${esc(c.place.name)}</a> · ${esc(c.place.city)}` : esc(c.poi_id)}</b>
        <small>${icon("user")} ${esc(c.user_name)}${c.username ? " (@" + esc(c.username) + ")" : ""} · ${t("biz_role_" + c.role)} · ${icon("phone")} ${esc(c.contact)}</small><p>${esc(c.proof)}</p></div>
        <button class="btn small gold-btn" data-admin-claim="${c.id}" data-st="approved">${t("adm_approve")}</button>
        <button class="btn small ghost" data-admin-claim="${c.id}" data-st="rejected">${t("adm_reject")}</button></div>`).join("") || `<p class="hint">${t("adm_empty")}</p>`;
    }
    if (tab === "reviews") {
      const rows = await adminApi("/api/admin/reviews");
      box.innerHTML = rows.map(r => `<div class="review ${r.hidden ? "is-hidden" : ""}"><div class="r-head"><b>${esc(r.name)} · <a href="#${r.key.replace(":", "/").replace("poi/", "place/")}">${esc(r.key)}</a></b><span class="gold">${starStr(r.stars)}</span></div>
        <p>${esc(r.text)}</p><button class="btn small ghost" data-admin-review="${r.id}" data-hide="${r.hidden ? 0 : 1}">${r.hidden ? t("adm_show") : t("adm_hide")}</button></div>`).join("") || `<p class="hint">${t("adm_empty")}</p>`;
    }
    if (tab === "reports") {
      const rows = await adminApi("/api/admin/reports?status=new");
      box.innerHTML = rows.map(r => `<div class="bk-row"><div><b>${r.place ? `<a href="#place/${r.poi_id}">${esc(r.place.name)}</a> · ${esc(r.place.city)}` : esc(r.poi_id)}</b>
        <small>${icon("alert")} ${t("rp_r_" + r.reason)} · ${fmtDate(new Date(r.date))}</small>${r.comment ? `<p>${esc(r.comment)}</p>` : ""}</div>
        <button class="btn small gold-btn" data-admin-report="${r.id}" data-st="fixed">${t("adm_fixed")}</button>
        <button class="btn small ghost" data-admin-report="${r.id}" data-st="rejected">${t("adm_reject")}</button></div>`).join("") || `<p class="hint">${t("adm_empty")}</p>`;
    }
    if (tab === "qa") {
      const rows = await adminApi("/api/admin/qa");
      box.innerHTML = rows.map(r => `<div class="bk-row ${r.hidden ? "is-hidden" : ""}"><div><b>${r.type === "q" ? icon("help") : icon("message")} ${esc(r.place)}</b>
        <small>${esc(r.name)}${r.role && r.role !== "user" ? " · " + t("qa_" + r.role) : ""} · ${fmtDate(new Date(r.date))}</small><p>${esc(r.text)}</p></div>
        <button class="btn small ghost" data-admin-qa="${r.type}/${r.id}" data-hide="${r.hidden ? 0 : 1}">${r.hidden ? t("adm_show") : t("adm_hide")}</button></div>`).join("") || `<p class="hint">${t("adm_empty")}</p>`;
    }
    if (tab === "feedback") {
      const rows = await adminApi("/api/admin/feedback?status=new");
      box.innerHTML = rows.map(r => `<div class="bk-row fb-adm"><div><b>#${r.id} · ${t("fb_k_" + r.kind)}</b>
        <small>${fmtDate(new Date(r.created))}${r.meta?.page ? " · " + esc(r.meta.page) : ""}${r.meta?.device ? " · " + esc(r.meta.device) : ""}${r.contact ? " · " + icon("phone") + " " + esc(r.contact) : ""}${r.user_id ? " · " + icon("tg") + " Telegram" : ""}</small>
        <p>${esc(r.text)}</p>
        <textarea class="fb-adm-reply" data-fb-reply="${r.id}" rows="2" maxlength="1000" placeholder="${t("fb_adm_reply_ph")}"></textarea></div>
        <button class="btn small gold-btn" data-admin-fb="${r.id}" data-st="done">${t("fb_adm_done")}</button>
        <button class="btn small ghost" data-admin-fb="${r.id}" data-st="rejected">${t("adm_reject")}</button></div>`).join("") || `<p class="hint">${t("adm_empty")}</p>`;
    }
  } catch (e) {
    if (e.status === 403 || e.status === 401) {
      box.innerHTML = `<form class="guide-form" id="adminLogin"><label class="wide">${t("adm_token")}<input name="token" type="password" autocomplete="off" required></label>
        <button class="btn gold-btn" type="submit">${t("adm_enter")}</button><p class="hint wide">${t("adm_token_hint")}</p></form>`;
    } else box.innerHTML = `<p class="hint">${t("weather_na")}</p>`;
  }
}

// ---------- События ----------
document.addEventListener("click", async e => {
  const tab = e.target.closest("[data-admin-tab]");
  if (tab) {
    $$("[data-admin-tab]").forEach(b => b.classList.toggle("active", b === tab));
    return renderAdmin(tab.dataset.adminTab);
  }
  const act = e.target.closest("[data-admin-guide],[data-admin-claim],[data-admin-review],[data-admin-report],[data-admin-fb],[data-admin-qa]");
  if (!act) return;
  try {
    if (act.dataset.adminGuide) await adminApi(`/api/admin/guides/${act.dataset.adminGuide}`, { method: "POST", body: JSON.stringify({ status: act.dataset.st }) });
    if (act.dataset.adminClaim) await adminApi(`/api/admin/claims/${act.dataset.adminClaim}`, { method: "POST", body: JSON.stringify({ status: act.dataset.st }) });
    if (act.dataset.adminQa) await adminApi(`/api/admin/qa/${act.dataset.adminQa}`, { method: "POST", body: JSON.stringify({ hidden: act.dataset.hide === "1" }) });
    if (act.dataset.adminFb) await adminApi(`/api/admin/feedback/${act.dataset.adminFb}`, { method: "POST", body: JSON.stringify({ status: act.dataset.st, reply: $(`[data-fb-reply="${act.dataset.adminFb}"]`)?.value || "" }) });
    if (act.dataset.adminReport) await adminApi(`/api/admin/reports/${act.dataset.adminReport}`, { method: "POST", body: JSON.stringify({ status: act.dataset.st }) });
    if (act.dataset.adminReview) await adminApi(`/api/admin/reviews/${act.dataset.adminReview}`, { method: "POST", body: JSON.stringify({ hidden: act.dataset.hide === "1" }) });
    toast(t("saved"));
  } catch { toast(t("review_error")); }
  renderAdmin($(".m-tabs [data-admin-tab].active")?.dataset.adminTab || "overview");
});

document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "claimForm") {
    e.preventDefault();
    try {
      await api("/api/business/claim", { method: "POST", body: JSON.stringify({ poi_id: f.dataset.poi, role: f.role.value, contact: f.contact.value, proof: f.proof.value }) });
      f.outerHTML = `<p class="ok-note">${icon("circle-check")} ${t("biz_sent")}</p>`;
    } catch (err) { toast(err.status === 409 ? t("biz_dup") : t("review_error")); }
  }
  if (f.matches(".biz-form")) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(f));
    try { await api(`/api/business/places/${f.dataset.poi}`, { method: "PUT", body: JSON.stringify(body) }); toast(t("biz_saved")); loadOverrides(); }
    catch (err) { toast(err.message.includes("photo") ? t("biz_bad_photo") : t("review_error")); }
  }
  if (f.matches(".reply-form")) {
    e.preventDefault();
    try { await api(`/api/business/reviews/${f.dataset.review}/reply`, { method: "POST", body: JSON.stringify({ text: f.text.value }) }); toast(t("biz_saved")); }
    catch { toast(t("review_error")); }
  }
  if (f.id === "adminLogin") {
    e.preventDefault();
    try { sessionStorage.setItem("safar_admin", f.token.value.trim()); } catch { /* приватный режим */ }
    renderAdmin("overview");
  }
});

// ---------- Подключение ----------
EXT.routes.business = openBusiness;
// Админка открывается, только если включена на сервере (ADMIN_ENABLED=1)
EXT.routes.admin = (...a) => typeof SAFAR_CONFIG !== "undefined" && SAFAR_CONFIG.admin ? openAdmin(...a) : (location.hash = "#home");
EXT.accountSections.push(() => accSection("store", t("biz_title"),
  `<p class="hint">${t("biz_pitch")}</p><a class="btn ghost" href="#business">${icon("arrow-right")} ${t("biz_open")}</a>`, false));
EXT.onAccountRender.push(u => { if (u) loadMyPlaces(); });
EXT.onConfig.push(cfg => { if (cfg.telegramBot) loadOverrides(); });
