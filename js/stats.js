// Анонимная статистика (server/stats.js): какие разделы открывают и что делают — только счётчики.
// Без cookie, IP и идентификаторов: устройство само отмечает «первый заход сегодня» (u) и «первый заход вообще» (f).
// Источник первого захода — метка ?from= (QR-постер хостела, бот, соцсети) или сайт, с которого пришли.
// События копятся и уходят пачкой раз в 20 секунд и при сворачивании приложения.
const STAT_VIEWS = new Set(["home", "cities", "hotels", "places", "map", "budget", "city", "place", "favs", "account", "prices", "guide", "tickets",
  "offline", "passport", "diary", "feedback", "partners", "poster", "together", "trip", "list", "nav", "docs", "sos", "translate", "mecca"]);
const STAT_TRACK = { directions: "route", taxi: "taxi", phone: "call" };
const statBuf = {};
let statDay = null, statFirst = false;
const statOn = () => location.protocol.startsWith("http");
const stat = name => { statBuf[name] = (statBuf[name] || 0) + 1; };
const statAct = name => stat("a:" + name);

// Откуда пришёл человек в первый раз
function statSource() {
  const q = new URLSearchParams(location.search), from = (q.get("from") || "").toLowerCase();
  if (/^[a-z0-9_-]{1,40}$/.test(from)) return from;
  if (q.get("start") || q.get("tgWebAppStartParam") || window.Telegram?.WebApp?.initData) return "telegram";
  if (matchMedia("(display-mode: standalone)").matches) return "app";
  try {
    const h = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (h && h !== location.hostname) return h.split(".").slice(-2, -1)[0].replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "direct";
  } catch { /* без referrer */ }
  return "direct";
}

function statFlush() {
  if (!statOn()) return;
  const ev = { ...statBuf }, body = {};
  Object.keys(statBuf).forEach(k => delete statBuf[k]);
  if (statDay) { body.u = 1; statDay = null; }
  if (statFirst) { body.f = 1; body.src = statSource(); statFirst = false; }
  if (Object.keys(ev).length) body.ev = ev;
  if (!Object.keys(body).length) return;
  try { navigator.sendBeacon?.("/api/stats", JSON.stringify(body)); } catch { /* без сети — не страшно */ }
}

function statView() {
  const kind = (location.hash.slice(1).split("/")[0] || "home").toLowerCase();
  if (STAT_VIEWS.has(kind)) stat("v:" + kind);
  if (kind === "collection") statAct("trip_ready");
}

// Действия — по кликам на известные кнопки (ядро про статистику не знает)
document.addEventListener("click", e => {
  const el = e.target.closest("[data-fav], [data-qt-open], #tripShare, [data-tw='invite'], [data-crowd-mark], [data-track]");
  if (!el) return;
  if (el.dataset.fav != null && !FAVS.has(el.dataset.fav)) statAct("fav_add");   // до переключения: значит, добавляют
  else if (el.dataset.qtOpen != null) statAct("trip_quick");
  else if (el.id === "tripShare") statAct("trip_share");
  else if (el.dataset.tw === "invite" && !store.get("safar_together", null)) statAct("together_create");
  else if (el.dataset.crowdMark) statAct("crowd_mark");
  else if (STAT_TRACK[el.dataset.track]) statAct(STAT_TRACK[el.dataset.track]);
}, true);
document.addEventListener("change", e => { if (e.target.id === "tkFile" && e.target.files?.length) statAct("ticket_add"); }, true);
window.addEventListener("appinstalled", () => statAct("install"));

// Отзыв и вход — по запросам к серверу
const statFetch = window.fetch;
window.fetch = function (input, opts) {
  try {
    const url = typeof input === "string" ? input : input?.url || "";
    if (opts?.method === "POST" && /\/api\/reviews(\?|$)/.test(url)) statAct("review");
  } catch { /* учёт не должен мешать запросу */ }
  return statFetch.apply(this, arguments);
};
let statWasUser = null;
EXT.onAccountRender.push(u => { if (u && statWasUser === false) statAct("login"); statWasUser = !!u; });
EXT.onLang.push(() => statAct("lang"));
EXT.routes.together && (() => {
  const join = EXT.routes.together;
  EXT.routes.together = code => { statAct("together_join"); return join(code); };
})();

EXT.onInit.push(() => {
  if (!statOn()) return;
  const day = new Date().toISOString().slice(0, 10);
  if (store.get("safar_stat_day", "") !== day) { store.set("safar_stat_day", day); statDay = day; }
  if (!store.get("safar_stat_first", 0)) { store.set("safar_stat_first", 1); statFirst = true; }
  statView();
  window.addEventListener("hashchange", statView);
  setInterval(statFlush, 20000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) statFlush(); });
  window.addEventListener("pagehide", statFlush);
  setTimeout(statFlush, 3000);
});
