// Напоминания о поездке (push-уведомления): кнопка «Напоминания» во вкладке «Поездка».
// Сервер (server/push.js) присылает уведомление накануне поездки и каждое утро в пути — с погодой.
// На iPhone push работает только у приложения, установленного на экран «Домой» (iOS 16.4+).
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol.startsWith("http");
const pushTrip = () => ({ start: tripStartDate() ? isoDate(tripStartDate()) : null, stops: tripRoute.map(r => ({ id: r.id, nights: +r.nights || 0 })) });

async function pushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function pushSend(sub, test = false) {
  await fetch("/api/push/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), lang: LANG, trip: pushTrip(), test })
  });
}

async function pushEnable() {
  if (!pushSupported()) {
    // iPhone вне установленного приложения: подсказываем установить
    if (typeof IS_IOS !== "undefined" && IS_IOS && !IS_STANDALONE) return toast(t("push_ios"));
    return toast(t("push_unsupported"));
  }
  if (!tripStartDate()) { toast(t("push_need_date")); return $("#tripStart")?.focus(); }
  if (!(await requireConsent())) return;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return toast(t("push_denied"));
  const { key } = await getJSON("/api/push/key");
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await pushSend(sub, true);
  toast(t("push_on"));
}
async function pushDisable() {
  const sub = await pushSubscription();
  if (sub) {
    await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  toast(t("push_off"));
}

async function renderPushBtn() {
  const btn = $("#tripPush");
  if (!btn) return;
  const on = !!(await pushSubscription().catch(() => null));
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-pressed", on);
  btn.innerHTML = `${icon("bell")} <span>${t(on ? "push_btn_on" : "push_btn")}</span>`;
}

EXT.onInit.push(() => {
  const actions = $(".trip-actions");
  if (!actions || !location.protocol.startsWith("http")) return;
  actions.insertAdjacentHTML("afterbegin", `<button class="btn ghost push-btn" id="tripPush" type="button"></button>`);
  renderPushBtn();
  $("#tripPush").onclick = async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { (await pushSubscription()) ? await pushDisable() : await pushEnable(); }
    catch { toast(t("push_error")); }
    btn.disabled = false;
    renderPushBtn();
  };
});
EXT.onLang.push(renderPushBtn);

// Поменялась поездка — обновляем её на сервере, чтобы напоминания пришли о новых датах и городах
let pushTimer = null;
EXT.onDataChange.push(what => {
  if (what !== "trip") return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => { const sub = await pushSubscription().catch(() => null); if (sub) pushSend(sub).catch(() => {}); }, 1500);
});
