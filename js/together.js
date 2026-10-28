// «Поездка с друзьями» (как в Wanderlog): общий план по ссылке #together/<код> (server/together.js).
// Общее: маршрут, даты, настройки бюджета и «Делёж расходов». Все, у кого есть ссылка, могут менять план;
// изменения уходят на сервер через секунду, а чужие правки приложение забирает раз в 15 секунд.
// Если двое поменяли план одновременно — побеждает тот, кто успел первым, второму показываем свежую версию.
const TW_POLL = 15000;
const twGroup = () => store.get("safar_together", null);
let twApplying = false, twPending = false;

async function twFetch(method, path, body) {
  const res = await fetch(path, {
    method, headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000)
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const twState = () => ({ ...tripState(), split: store.get("safar_split", { people: [], items: [] }) });
const twMe = () => window.SAFAR_USER?.name || "";
const twSave = v => store.set("safar_together", { code: v.code, ver: v.ver, by: v.by || "", updated: v.updated || Date.now() });
const twLink = code => `${location.origin}${location.pathname}#together/${code}`;

// Показать план с сервера (чужие правки или вход по ссылке)
function twApply(v) {
  twApplying = true;
  try {
    applyTripState(v.state);
    if (v.state.split) { store.set("safar_split", v.state.split); if (typeof renderSplit === "function") renderSplit(); }
    if (rendered.budget) { renderTripDays(); if (typeof renderTripHolidays === "function") renderTripHolidays(); }
  } finally { twApplying = false; }
  twSave(v);
  twRender();
}

async function twPush() {
  twPending = false;
  const g = twGroup();
  if (!g || !navigator.onLine) return;
  try {
    const r = await twFetch("PUT", "/api/together/" + g.code, { state: twState(), ver: g.ver, name: twMe() });
    if (r.status === 200) { twSave(r.json); twRender(); }
    else if (r.status === 409) { twApply(r.json); toast(t("tw_conflict")); }
    else if (r.status === 404) { store.set("safar_together", null); twRender(); toast(t("tw_gone")); }
  } catch { /* без сети — отправим при следующей правке */ }
}
const twPushNow = debounce(twPush, 1000);
const twPushSoon = () => { if (twGroup() && !twApplying) { twPending = true; twPushNow(); } };

async function twPoll() {
  const g = twGroup();
  if (!g || twPending || document.hidden || !navigator.onLine) return;
  try {
    const r = await twFetch("GET", `/api/together/${g.code}?ver=${g.ver}`);
    if (r.status === 404) { store.set("safar_together", null); twRender(); return toast(t("tw_gone")); }
    if (r.status === 200 && !r.json.same && r.json.ver > (twGroup()?.ver || 0) && !twPending) {
      twApply(r.json);
      toast(r.json.by ? t("tw_updated_by", { name: r.json.by }) : t("tw_updated"));
    }
  } catch { /* без сети */ }
}

async function twShare(code) {
  const url = twLink(code);
  try {
    if (navigator.share) await navigator.share({ title: "Hamyol — " + t("tw_title"), text: t("tw_share_text"), url });
    else { await navigator.clipboard.writeText(url); toast(t("link_copied")); }
  } catch { /* окно «Поделиться» закрыто */ }
}

async function twInvite(btn) {
  const g = twGroup();
  if (g) return twShare(g.code);
  if (!(await requireConsent())) return;
  btn.disabled = true;
  try {
    const r = await twFetch("POST", "/api/together", { state: twState(), name: twMe() });
    if (r.status !== 200) throw new Error(r.status);
    twSave(r.json);
    twRender();
    await twShare(r.json.code);
  } catch { toast(t("tw_err")); }
  finally { btn.disabled = false; }
}

// Вход по ссылке #together/<код>
async function twJoin(code) {
  navGo("#budget");
  closeModal(false);
  showTab("budget");
  if (!/^[A-Za-z0-9_-]{12}$/.test(code || "")) return;
  if (twGroup()?.code === code) return twPoll();
  try {
    const r = await twFetch("GET", "/api/together/" + code);
    if (r.status === 404) return toast(t("tw_gone"));
    if (r.status !== 200) throw new Error(r.status);
    if (tripRoute.length && !confirm(t("tw_join_confirm"))) return;
    twApply(r.json);
    toast(t("tw_joined"));
  } catch { toast(t("tw_err")); }
}

function twRender() {
  const bar = $("#twBar");
  if (!bar) return;
  const g = twGroup();
  bar.classList.toggle("on", !!g);
  const when = g ? new Date(g.updated).toLocaleTimeString(LOCALE[LANG], { hour: "2-digit", minute: "2-digit" }) : "";
  bar.innerHTML = g ? `
    <div class="tw-text"><b>${icon("users")} ${t("tw_on")}</b>
      <small>${t("tw_on_sub")} · ${t("tw_saved")} ${when}${g.by ? ` · ${esc(g.by)}` : ""}</small></div>
    <div class="tw-acts">
      <button type="button" class="btn small gold-btn" data-tw="invite">${icon("share")} ${t("tw_invite_more")}</button>
      <button type="button" class="btn small ghost" data-tw="leave">${icon("logout")} ${t("tw_leave")}</button>
    </div>` : `
    <div class="tw-text"><b>${icon("users")} ${t("tw_title")}</b><small>${t("tw_sub")}</small></div>
    <div class="tw-acts"><button type="button" class="btn small gold-btn" data-tw="invite">${icon("share")} ${t("tw_invite")}</button></div>`;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-tw]");
  if (!b) return;
  if (b.dataset.tw === "invite") twInvite(b);
  if (b.dataset.tw === "leave" && confirm(t("tw_leave_confirm"))) { store.set("safar_together", null); twRender(); }
});

EXT.routes.together = twJoin;
EXT.onDataChange.push(what => { if (what === "trip") twPushSoon(); });
EXT.onLang.push(twRender);
EXT.onInit.push(() => {
  const days = $("#tab-budget .trip-days");
  if (days && !$("#twBar")) days.insertAdjacentHTML("beforebegin", `<section class="panel tw-bar" id="twBar"></section>`);
  twRender();
  // «Делёж расходов» и настройки бюджета — тоже общие
  const set = store.set.bind(store);
  store.set = (k, v) => { set(k, v); if (k === "safar_split") twPushSoon(); };
  ["#bPeople", "#bRooms", "#bHotel", "#bFood", "#bTransport"].forEach(s => $(s)?.addEventListener("change", twPushSoon));
  setInterval(twPoll, TW_POLL);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) twPoll(); });
  twPoll();
});
