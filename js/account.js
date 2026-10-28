// Аккаунт: вход через Telegram, синхронизация избранного и поездки, режим Telegram Mini App.
// Всё работает, только если сервер настроен (/api/config сообщает имя бота).

let SAFAR_CONFIG = { telegramBot: null, googleClientId: null, ai: false, bookingAid: null };
// Вход включён, если настроен хотя бы один способ: Telegram-бот или Google
const loginOn = () => !!(SAFAR_CONFIG.telegramBot || SAFAR_CONFIG.googleClientId);
window.SAFAR_USER = null;
const WA = window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null;   // открыто внутри Telegram

const authToken = () => { try { return localStorage.getItem("safar_token"); } catch { return null; } };
function setToken(tok) { try { tok ? localStorage.setItem("safar_token", tok) : localStorage.removeItem("safar_token"); } catch { /* приватный режим */ } }

// Запрос к API с токеном
async function api(path, opts = {}) {
  const tok = authToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(tok ? { Authorization: "Bearer " + tok } : {}), ...opts.headers },
    signal: opts.signal || AbortSignal.timeout(20000)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(json.error || "HTTP " + res.status); e.status = res.status; throw e; }
  return json;
}

// ---------- Синхронизация ----------
const tripUpdated = () => +store.get("safar_trip_updated", 0);
let syncing = false;
async function pullAndMerge() {
  const { user, data } = await api("/api/me");
  window.SAFAR_USER = user;
  // Избранное — объединение; поездка — побеждает более свежая
  const merged = [...new Set([...FAVS, ...data.favs])];
  const favsChanged = merged.length !== FAVS.size || merged.length !== data.favs.length;
  FAVS = new Set(merged);
  store.set("safar_favs", merged);
  $("#favCount").textContent = FAVS.size || "";
  if (data.trip && data.tripUpdated > tripUpdated()) {
    syncing = true;
    applyTripState(data.trip);
    store.set("safar_trip_updated", data.tripUpdated);
    syncing = false;
  }
  if (favsChanged || tripUpdated() > data.tripUpdated) await push();
  renderAccountButton();
}
async function push() {
  if (!window.SAFAR_USER) return;
  try {
    await api("/api/me/data", { method: "PUT", body: JSON.stringify({ favs: [...FAVS], trip: tripState(), tripUpdated: tripUpdated() }) });
  } catch (e) { if (e.status === 401) signedOut(); }
}
const pushSoon = debounce(push, 1500);
EXT.onDataChange.push(what => {
  if (what === "trip" && !syncing) store.set("safar_trip_updated", Date.now());
  if (window.SAFAR_USER) pushSoon();
});

// После входа и выхода всё на экране сразу показывает новое состояние — не нужно закрывать и открывать аккаунт заново
function authChanged() {
  renderAccountButton();
  if ($("#accBox")) renderAccount();
  $("#favCount") && ($("#favCount").textContent = FAVS.size || "");
  document.dispatchEvent(new CustomEvent("safar:auth", { detail: window.SAFAR_USER }));
}
function signedIn(token, user) {
  setToken(token);
  window.SAFAR_USER = user;
  authChanged();
  // Избранное и поездка с сервера — когда придут, обновляем ещё раз (числа на плитках, «Поездка»)
  pullAndMerge().then(() => { authChanged(); if (rendered.budget) updateRoute(); }).catch(() => {});
}
function signedOut() {
  setToken(null);
  window.SAFAR_USER = null;
  authChanged();
}

// ---------- Вход на сайте через бота ----------
let loginPoll = null;
async function startLogin() {
  if (!(await requireConsent())) return;
  const box = $("#accBox");
  try {
    const { code, url, app, ttl } = await api("/api/auth/start", { method: "POST", body: JSON.stringify({ ret: location.origin + "/#account" }) });
    // На телефоне — сразу в приложение Telegram (tg://), без промежуточной страницы t.me, которую потом надо закрывать.
    // Telegram не установлен (страница не ушла в фон) — открываем обычную ссылку.
    if (app && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      location.href = app;
      setTimeout(() => { if (!document.hidden && box.isConnected && loginPoll) window.open(url, "_blank", "noopener"); }, 1600);
    } else window.open(url, "_blank", "noopener");
    box.innerHTML = `
      <div class="acc-wait">
        <div class="spinner"></div>
        <p><b>${t("acc_wait")}</b></p>
        <p class="hint">${t("acc_wait_hint")}</p>
        <a class="btn gold-btn" href="${esc(url)}" target="_blank" rel="noopener">${icon("tg")} ${t("acc_open_tg")}</a>
        <button class="btn ghost" data-acc="cancel">${t("acc_cancel")}</button>
      </div>`;
    const until = Date.now() + ttl;
    clearInterval(loginPoll); loginPoll = null;
    // Вернулись из Telegram — проверяем вход сразу, не дожидаясь таймера
    const onBack = () => { if (!document.hidden && loginPoll) check(); };
    document.addEventListener("visibilitychange", onBack);
    const check = async () => {
      if (Date.now() > until || !box.isConnected) { clearInterval(loginPoll); loginPoll = null; if (box.isConnected) renderAccount(); return; }
      try {
        const r = await api("/api/auth/poll?code=" + encodeURIComponent(code));
        if (r.token) {
          clearInterval(loginPoll); loginPoll = null;
          signedIn(r.token, r.user);
          toast(t("acc_welcome", { name: r.user.name }));
          if (box.isConnected) renderAccount();
        }
      } catch (e) { if (e.status === 410) { clearInterval(loginPoll); loginPoll = null; toast(t("acc_expired")); if (box.isConnected) renderAccount(); } }
      if (!loginPoll) document.removeEventListener("visibilitychange", onBack);
    };
    loginPoll = setInterval(check, 2000);
  } catch { toast(t("review_error")); }
}

// ---------- Вход в Mini App ----------
async function miniAppLogin() {
  if (!WA || !SAFAR_CONFIG.telegramBot) return;
  try {
    const r = await api("/api/auth/telegram", { method: "POST", body: JSON.stringify({ initData: WA.initData }) });
    signedIn(r.token, r.user);
  } catch { /* без входа приложение тоже работает */ }
}

function setupMiniApp() {
  if (!WA) return;
  WA.ready();
  WA.expand();
  waColors();
  // Кнопка «Назад» Telegram закрывает окно приложения
  const back = WA.BackButton;
  back?.onClick(() => goBack());
  new MutationObserver(() => {
    $("#modal").classList.contains("hidden") ? back?.hide() : back?.show();
  }).observe($("#modal"), { attributes: true, attributeFilter: ["class"] });
}

// ---------- Окно аккаунта (#account) ----------
const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
// Раздел аккаунта: карточка с заголовком, которая сворачивается (используют и market.js, business.js).
// Все разделы закрыты: аккаунт открывается коротким списком, нужный раздел человек раскрывает сам.
const accSection = (ic, title, body) => `
  <details class="acc-section">
    <summary><i>${icon(ic)}</i><b>${title}</b></summary>
    <div class="acc-body">${body}</div>
  </details>`;
function openAccount() {
  openModal(`
    <div class="m-head" style="background:${CAT_BG.h};min-height:170px;padding-top:70px"><h2>${icon("user")} ${t("acc_title")}</h2></div>
    <div class="m-body"><div id="accBox"></div></div>`);
  renderAccount();
}
// Быстрые плитки: всё «моё» в одном месте — видны и без входа (билеты, избранное и т.д. хранятся на устройстве)
function accQuickHtml() {
  const days = tripRoute.reduce((a, r) => a + (+r.nights || 0), 0) + (tripRoute.length ? 1 : 0);
  const tile = (href, ic, label, n, attr = "") => `<a class="acc-q" href="${href}" ${attr}><i>${icon(ic)}</i><span>${label}</span>${n != null ? `<em>${n}</em>` : ""}</a>`;
  return `<nav class="acc-quick" aria-label="${t("acc_title")}">
    ${tile("#tickets", "ticket", t("tk_title"), "", 'data-acc-tk')}
    ${EXT.routes.docs ? tile("#docs", "folder-lock", t("doc_short")) : ""}
    ${tile("#favs", "heart", t("acc_stat_favs"), FAVS.size || null)}
    ${tile("#budget", "calendar-range", t("acc_stat_trip"), days ? t("acc_stat_days", { n: days }) : null)}
    ${typeof openOfflineMenu === "function" || EXT.routes.offline ? tile("#offline", "wifi-off", t("off_menu")) : ""}
    ${EXT.routes.passport ? tile("#passport", "award", t("pp_short")) : ""}
    <button type="button" class="acc-q" data-acc-disp><i>${icon("text-size")}</i><span>${t("ds_title")}</span></button>
  </nav>`;
}
// Число билетов — из хранилища на устройстве (js/tickets.js)
function accQuickFill() {
  if (typeof tkAll !== "function") return;
  tkAll().then(all => { const em = $("[data-acc-tk] em"); if (em) em.textContent = all.length || ""; em?.classList.toggle("hidden", !all.length); });
}
document.addEventListener("click", e => { if (e.target.closest("[data-acc-disp]") && typeof openDisp === "function") openDisp(); });

function renderAccount() {
  const box = $("#accBox");
  if (!box) return;
  const u = window.SAFAR_USER;
  if (!loginOn()) { box.innerHTML = accQuickHtml() + `<p class="hint">${t("acc_disabled")}</p>` + accFbLink(); accQuickFill(); return; }
  if (!u) {
    box.innerHTML = accQuickHtml() + `
      <div class="acc-login">
        <p>${t("acc_login_hint")}</p>
        <ul class="acc-perks"><li>${icon("heart")} ${t("acc_perk_favs")}</li><li>${icon("calendar")} ${t("acc_perk_trip")}</li><li>${icon("badge-check")} ${t("acc_perk_reviews")}</li></ul>
        <div class="acc-ways">
          ${googleOn() ? `<div class="g-btn-box" id="gBtn" aria-label="Google"></div>` : ""}
          ${SAFAR_CONFIG.telegramBot ? `<button class="btn tg-btn" data-acc="login">${icon("tg")} ${t("acc_login")}</button>` : ""}
        </div>
        <p class="hint acc-nologin">${icon("circle-check")} ${t("acc_no_login")}</p>
        <p class="hint legal-accept">${t("legal_accept", { terms: `<a href="#terms">${t("legal_terms_gen")}</a>`, privacy: `<a href="#privacy">${t("legal_privacy_gen")}</a>` })}</p>
      </div>${accFbLink()}`;
    accQuickFill();
    if (googleOn()) googleButton();
    return;
  }
  box.innerHTML = `
    <div class="acc-card">
      <div class="avatar">${u.photo ? `<img src="${esc(u.photo)}" alt="">` : initials(u.name)}</div>
      <div class="acc-who">
        <b>${esc(u.name)}</b>
        <small>${u.username ? `@${esc(u.username)} · ` : ""}${u.via === "google" ? `${icon("globe")} ${t("acc_via_google")}` : `${icon("tg")} ${t("acc_via_tg")}`}</small>
        <small class="acc-sync">${icon("circle-check")} ${t("acc_stat_sync")}</small>
      </div>
      ${WA ? "" : `<button class="acc-out" data-acc="logout" title="${t("acc_logout")}" aria-label="${t("acc_logout")}">${icon("logout")}</button>`}
    </div>
    ${accQuickHtml()}
    ${accFbLink()}
    <h3 class="acc-more-h">${t("acc_more")}</h3>
    ${EXT.accountSections.map(fn => fn(u)).join("")}`;
  accQuickFill();
  EXT.onAccountRender.forEach(fn => fn(u));
}

function renderAccountButton() {
  const btn = $("#accountBtn");
  if (!btn) return;
  btn.classList.toggle("hidden", !loginOn());
  const u = window.SAFAR_USER;
  btn.innerHTML = u ? (u.photo ? `<img src="${esc(u.photo)}" alt="">` : `<span>${initials(u.name)}</span>`) : icon("user");
  btn.classList.toggle("on", !!u);
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-acc]");
  if (!b) return;
  const act = b.dataset.acc;
  if (act === "login") startLogin();
  if (act === "cancel") { clearInterval(loginPoll); loginPoll = null; renderAccount(); }
  if (act === "logout") {
    // Сначала спрашиваем: случайное нажатие не должно выкидывать из аккаунта
    if (!(await askConfirm({ title: t("acc_logout_q"), text: t("acc_logout_sub"), ok: t("acc_logout"), cancel: t("acc_stay"), danger: true, icon: "logout" }))) return;
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* всё равно выходим */ }
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* Google не загружен */ }
    signedOut(); renderAccount(); toast(t("acc_bye"));
  }
});

// ---------- Подключение ----------
// Настройки сервера. Без сети не загрузились — js/network.js вызовет ещё раз, когда сеть появится
let configLoaded = false;
async function loadConfig() {
  if (configLoaded) return true;
  if (!location.protocol.startsWith("http")) return false;
  try { SAFAR_CONFIG = await api("/api/config"); } catch { return false; }
  configLoaded = true;
  EXT.onConfig.forEach(fn => fn(SAFAR_CONFIG));
  return true;
}
EXT.routes.account = openAccount;
EXT.onInit.push(async () => {
  setupMiniApp();
  $("#accountBtn").onclick = () => { location.hash = "#account"; };
  if (!(await loadConfig())) return;
  renderAccountButton();
  if (WA) return miniAppLogin();
  if (authToken()) pullAndMerge().catch(e => { if (e.status === 401) signedOut(); });
});

// ---------- «Жалобы и предложения» — заметной строкой в аккаунте (и без входа) ----------
const accFbLink = () => EXT.routes.feedback ? `<a class="acc-link acc-fb" href="#feedback"><i>${icon("alert")}</i><span><b>${t("fb_title")}</b><small>${t("acc_fb_sub")}</small></span>${icon("arrow-right")}</a>` : "";

// ---------- Вход через Google (Google Identity Services, бесплатно) ----------
// Кнопка «Продолжить с Google» рисуется самим Google; на телефоне — выбор аккаунта в один тап, без паролей и писем.
// В Telegram Mini App не показываем: там вход и так автоматический, а Google не пускает во встроенные браузеры.
const GSI_SRC = "https://accounts.google.com/gsi/client";
const googleOn = () => !!SAFAR_CONFIG.googleClientId && !WA && location.protocol.startsWith("http");
let gsiLoading = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return gsiLoading ||= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = GSI_SRC; s.async = true; s.onload = ok; s.onerror = () => { gsiLoading = null; fail(new Error("gsi")); };
    document.head.append(s);
  });
}
async function googleButton() {
  const box = $("#gBtn");
  if (!box) return;
  try { await loadGsi(); } catch { box.innerHTML = `<p class="hint">${t("acc_google_off")}</p>`; return; }
  if (!box.isConnected) return;
  google.accounts.id.initialize({ client_id: SAFAR_CONFIG.googleClientId, callback: googleSignedIn, ux_mode: "popup", auto_select: false, use_fedcm_for_prompt: true, itp_support: true });
  google.accounts.id.renderButton(box, {
    type: "standard", theme: "outline",   // белая «таблетка» Google — узнаваемо и хорошо видно в обеих темах
    size: "large", text: "continue_with", shape: "pill", logo_alignment: "left", locale: LANG, width: Math.min(360, box.clientWidth || 300)
  });
}
async function googleSignedIn(resp) {
  if (!resp?.credential) return;
  if (!(await requireConsent())) return;
  try {
    const r = await api("/api/auth/google", { method: "POST", body: JSON.stringify({ credential: resp.credential }) });
    signedIn(r.token, r.user);
    toast(t("acc_hello", { name: r.user.name }));
  } catch { toast(t("acc_google_err")); }
}

// ---------- Смена темы: всё, что рисуется не через CSS, тоже перекрашиваем ----------
// Тема, которая сейчас на экране: выбранная в «Aa» или системная
const themeNow = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
// Telegram Mini App: фон окна Telegram (виден при прокрутке за край) — в цвет темы Safar
function waColors() {
  if (!WA) return;
  try {
    WA.setHeaderColor("#0b1f3a");
    WA.setBackgroundColor(themeNow() === "light" ? "#f6efe2" : "#0a1424");
    WA.setBottomBarColor?.(themeNow() === "light" ? "#ffffff" : "#0f1d33");
  } catch { /* старая версия Telegram */ }
}
document.addEventListener("safar:theme", () => {
  waColors();
  if ($("#gBtn") && window.google?.accounts?.id) { $("#gBtn").innerHTML = ""; googleButton(); }   // кнопка Google — в цвет темы
});
