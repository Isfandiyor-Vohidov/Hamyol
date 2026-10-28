// Связь с интернетом: плашка «Нет интернета» и восстановление, когда сеть вернулась.
// navigator.onLine и события online/offline на телефонах врут (Wi-Fi без интернета, TWA после сна),
// поэтому связь проверяем лёгким запросом к серверу (/api/config без кэша).
// Когда сеть вернулась — тост и повторная загрузка всего, что без неё не загрузилось:
// курсы, отзывы, настройки, текущий раздел, открытое окно (описание, погода), тайлы карт.

const NET = { online: navigator.onLine, checking: null, timer: 0 };
EXT.onOnline ||= [];   // расширения: что ещё перезагрузить после возврата сети

// Есть ли связь на самом деле
async function netProbe() {
  if (!navigator.onLine) return false;
  if (!location.protocol.startsWith("http")) return true;
  try {
    await fetch("/api/config", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return true;
  } catch { return false; }
}

// Проверить связь и, если состояние поменялось, переключиться (одна проверка за раз)
function netCheck() {
  NET.checking ||= netProbe().then(ok => {
    NET.checking = null;
    netSet(ok);
    return ok;
  });
  return NET.checking;
}

function netSet(online) {
  clearTimeout(NET.timer);
  // Без связи — проверяем каждые 8 секунд (пока экран открыт): событие online приходит не всегда
  if (!online) NET.timer = setTimeout(() => document.hidden ? netSet(false) : netCheck(), 8000);
  if (online === NET.online) return;
  NET.online = online;
  renderNetBanner();
  if (online) {
    toast(t("net_back"));
    netRecover();
  }
}

// Запрос к внешнему сервису упал — возможно, пропала связь. Проверяем не чаще раза в 3 секунды
let netSuspectAt = 0;
function netSuspect() {
  if (!NET.online || Date.now() - netSuspectAt < 3000) return;
  netSuspectAt = Date.now();
  netCheck();
}

// ---------- Восстановление ----------
async function netRecover() {
  // Настройки сервера (вход, экскурсии), если при запуске сети не было
  if (typeof loadConfig === "function") loadConfig();
  // Отзывы (без сети переключаются на «только это устройство») и курсы ЦБ
  await Promise.allSettled([
    Reviews.init(),
    API.rates().then(r => { RATES = r; })
  ]);
  // Текущий раздел — заново (погода, курсы, фото карточек); остальные — при следующем открытии
  for (const k in rendered) rendered[k] = false;
  rendered[currentTab] = true;
  RENDER[currentTab]?.();
  if (currentTab === "budget") {
    rendered.budget = true;
    if (!routeInfo.real && tripRoute.length > 1) updateRoute(); else renderBudget();
  }
  // Карты: пересчитать размер и заново запросить тайлы, которые не загрузились
  [bigMap, miniMap, planMap, routeMap].forEach(m => {
    if (!m) return;
    m.invalidateSize();
    m.eachLayer(l => { if (l instanceof L.TileLayer) l.redraw(); });
  });
  netRerenderModal();
  EXT.onOnline.forEach(fn => { try { fn(); } catch { /* расширение не должно ломать восстановление */ } });
}

// Открытое окно (город, место, путеводитель…) — перерисовать, сохранив вкладку и прокрутку.
// Окна с вводом (аккаунт, бизнес, навигация в пути) и недописанный отзыв не трогаем.
const NET_MODALS = ["city", "place", "favs", "guide", "prices", "nearby", "tours", "safety"];
function netRerenderModal() {
  const m = $("#modal");
  if (m.classList.contains("hidden") || m.classList.contains("closing")) return;
  const kind = decodeURIComponent(location.hash.slice(1)).split("/")[0];
  if (!NET_MODALS.includes(kind)) return;
  if ($$("#modalBody textarea, #modalBody input[type=text], #modalBody input:not([type])").some(x => x.value.trim())) return;
  const pane = $("#modalBody .m-tabs button.active")?.dataset.pane, top = m.scrollTop;
  route();
  if (pane && pane !== "overview") $(`#modalBody .m-tabs [data-pane="${pane}"]`)?.click();
  m.scrollTop = top;
}

// ---------- События ----------
window.addEventListener("offline", () => netSet(false));
window.addEventListener("online", () => netCheck());
// Вернулись в приложение (телефон проснулся, переключились из другого) — проверить связь
document.addEventListener("visibilitychange", () => { if (!document.hidden && !NET.online) netCheck(); });
EXT.onInit.push(() => { if (!NET.online) netSet(false); });
