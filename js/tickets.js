// «Мои билеты» (#tickets): билеты на поезд, самолёт, автобус, в музей — в одном месте и без интернета.
// Как попадают: 1) переслать PDF/фото Telegram-боту (появится здесь после входа через Telegram);
// 2) «Поделиться → Safar» на Android (sw.js, share_target); 3) выбрать файл или фото вручную.
// Хранятся в IndexedDB на устройстве; билеты из бота ещё и в аккаунте (server/tickets.js).
const TK_DB = "safar-tickets", TK_STORE = "t";
const TK_KINDS = { train: "train", plane: "plane", bus: "bus", event: "ticket", other: "file-text" };

function tkDb() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(TK_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TK_STORE, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
async function tkTx(mode, fn) {
  const db = await tkDb();
  return new Promise((ok, fail) => {
    const tx = db.transaction(TK_STORE, mode), st = tx.objectStore(TK_STORE);
    const out = fn(st);
    tx.oncomplete = () => ok(out?.result ?? out);
    tx.onerror = () => fail(tx.error);
  });
}
const tkAll = () => tkTx("readonly", st => st.getAll()).then(r => r || []).catch(() => []);
const tkPut = t => tkTx("readwrite", st => st.put(t));
const tkDel = id => tkTx("readwrite", st => st.delete(id));
const tkGet = id => tkTx("readonly", st => st.get(id));
const tkId = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Билеты из бота: подтягиваем в устройство (один раз), чтобы открывались без интернета
async function tkSync() {
  if (typeof authToken !== "function" || !authToken() || !navigator.onLine) return;
  try {
    const { tickets } = await api("/api/tickets");
    const have = new Set((await tkAll()).map(t => t.id));
    for (const s of tickets) {
      if (have.has("s" + s.id)) continue;
      const res = await fetch(`/api/tickets/${s.id}/file`, { headers: { Authorization: "Bearer " + authToken() } });
      if (!res.ok) continue;
      await tkPut({ id: "s" + s.id, server: s.id, name: tkNiceName(s.name, s.mime === "application/pdf" ? "train" : "other", s.created), mime: s.mime, blob: await res.blob(), date: "", kind: s.mime === "application/pdf" ? "train" : "other", created: s.created, src: "bot" });
    }
  } catch { /* без сети — покажем то, что уже есть */ }
}

function tkNiceName(raw, kind, created) {
  const base = String(raw || "").replace(/\.(pdf|jpe?g|png|webp|heic|heif)$/i, "").replace(/[_]+/g, " ").trim();
  const random = !base || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(base) || /^[0-9a-f]{16,}$/i.test(base) || /^(img|image|photo|scan|document|file|ticket|download|screenshot)?[\s-]*\d[\d\s-]*$/i.test(base);
  if (!random) return base.slice(0, 120);
  const d = new Date(created || Date.now()).toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "short" });
  return `${kind && kind !== "other" ? t("tk_k_" + kind) : t("tk_one")} · ${d}`;
}
const tkSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const tkDate = d => d ? new Date(d + "T12:00").toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "long", weekday: "short" }) : "";
const tkToday = () => new Date().toISOString().slice(0, 10);

function tkRow(x) {
  return `<div class="tk-row" data-tk="${x.id}">
    <button type="button" class="tk-open" data-tk-open="${x.id}"><i>${icon(TK_KINDS[x.kind] || "file-text")}</i>
      <span><b>${esc(tkNiceName(x.name, x.kind, x.created))}</b><small>${x.date ? tkDate(x.date) : t("tk_nodate")} · ${x.mime === "application/pdf" ? "PDF" : t("tk_photo")} · ${tkSize(x.blob?.size || 0)}${x.src === "bot" ? " · Telegram" : ""}</small></span></button>
    <button type="button" class="tk-more" data-tk-edit="${x.id}" aria-label="${t("tk_edit")}">${icon("edit")}</button>
  </div>`;
}

async function renderTickets() {
  const box = $("#tkList");
  if (!box) return;
  const all = (await tkAll()).sort((a, b) => (a.date || "9999") < (b.date || "9999") ? -1 : (a.date || "9999") > (b.date || "9999") ? 1 : b.created - a.created);
  const today = tkToday();
  const soon = all.filter(x => x.date && x.date >= today), nodate = all.filter(x => !x.date), past = all.filter(x => x.date && x.date < today).reverse();
  box.innerHTML = all.length ? [
    soon.length && `<h3>${t("tk_soon")}</h3>${soon.map(tkRow).join("")}`,
    nodate.length && `<h3>${t("tk_nodate_h")}</h3>${nodate.map(tkRow).join("")}`,
    past.length && `<details class="tk-past"><summary>${t("tk_past")} (${past.length})</summary>${past.map(tkRow).join("")}</details>`
  ].filter(Boolean).join("") : `<div class="tk-empty">${icon("ticket")}<p>${t("tk_empty")}</p></div>`;
  renderTripTickets(all);
}

function openTickets(sub) {
  const bot = typeof SAFAR_CONFIG !== "undefined" && SAFAR_CONFIG.telegramBot;
  const signed = typeof authToken === "function" && authToken();
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-a);min-height:150px;padding-top:60px"><h2>${icon("ticket")} ${t("tk_title")}</h2><p>${t("tk_sub")}</p></div>
    <div class="m-body">
      <div class="tk-add">
        <label class="btn gold-btn tk-file">${icon("plus")} ${t("tk_add")}<input type="file" id="tkFile" accept="application/pdf,image/*" hidden></label>
        ${bot ? `<a class="btn ghost" href="https://t.me/${esc(bot)}" target="_blank" rel="noopener">${icon("tg")} ${t("tk_bot")}</a>` : ""}
      </div>
      <p class="hint tk-how">${icon("info")} <span>${t("tk_how")}${bot && !signed ? " " + t("tk_how_login") : ""}</span></p>
      <div id="tkForm"></div>
      <div id="tkList"><div class="skeleton"></div></div>
    </div>`);
  renderTickets();
  tkSync().then(renderTickets);
  if (sub === "new") setTimeout(tkEditLatestShared, 300);
}

// Форма: название, дата, вид — для нового файла и для правки
function tkFormHtml(x) {
  return `<form class="tk-edit" data-tk-form="${x.id}">
    <label><span>${t("tk_name")}</span><input name="name" maxlength="120" value="${esc(tkNiceName(x.name, x.kind, x.created))}" required></label>
    <div class="tk-edit-row">
      <label><span>${t("tk_date")}</span><input name="date" type="date" value="${x.date || ""}"></label>
      <label><span>${t("tk_kind")}</span><select name="kind">${Object.keys(TK_KINDS).map(k => `<option value="${k}" ${x.kind === k ? "selected" : ""}>${t("tk_k_" + k)}</option>`).join("")}</select></label>
    </div>
    <div class="tk-edit-acts">
      <button class="btn gold-btn" type="submit">${icon("check")} ${t("tk_save")}</button>
      <button class="btn ghost danger-btn" type="button" data-tk-del="${x.id}">${icon("ban")} ${t("tk_delete")}</button>
    </div>
  </form>`;
}
async function tkShowForm(id) {
  const x = await tkGet(id), f = $("#tkForm");
  if (!x || !f) return;
  f.innerHTML = tkFormHtml(x);
  f.scrollIntoView({ behavior: "smooth", block: "center" });
}
async function tkEditLatestShared() {
  const last = (await tkAll()).filter(x => x.src === "share").sort((a, b) => b.created - a.created)[0];
  if (last && Date.now() - last.created < 120e3) tkShowForm(last.id);
}

// Просмотр: фото — на весь экран и с максимальной яркостью, PDF — во встроенном просмотрщике
async function tkView(id) {
  const x = await tkGet(id);
  if (!x?.blob) return;
  const url = URL.createObjectURL(x.blob);
  const pdf = x.mime === "application/pdf";
  document.body.insertAdjacentHTML("beforeend", `
    <div id="tkView" class="tk-view" role="dialog" aria-modal="true">
      <div class="tk-view-bar"><b>${esc(x.name)}</b><button type="button" class="tc-x" data-tk-close aria-label="${t("cs_close")}">${icon("x")}</button></div>
      ${pdf ? `<iframe src="${url}#view=FitH" title="${esc(x.name)}"></iframe><a class="btn gold-btn tk-pdf" href="${url}" target="_blank" rel="noopener">${icon("external")} ${t("tk_open_pdf")}</a>`
            : `<img src="${url}" alt="${esc(x.name)}">`}
      <p class="tk-view-hint">${t("tk_show")}</p>
    </div>`);
  const v = $("#tkView");
  v._url = url;
  try { navigator.wakeLock?.request("screen").then(l => (v.isConnected ? (v._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function tkCloseView() {
  const v = $("#tkView");
  if (!v) return;
  v._lock?.release?.();
  v.classList.add("out");
  setTimeout(() => { URL.revokeObjectURL(v._url); v.remove(); }, 220);
}

document.addEventListener("change", async e => {
  if (e.target.id !== "tkFile") return;
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (!/^(application\/pdf|image\/)/.test(file.type)) return toast(t("tk_type"));
  if (file.size > 20 * 1048576) return toast(t("tk_big"));
  const x = { id: tkId(), name: tkNiceName(file.name, file.type === "application/pdf" ? "train" : "other"), mime: file.type, blob: file, date: "", kind: file.type === "application/pdf" ? "train" : "other", created: Date.now(), src: "local" };
  await tkPut(x);
  await renderTickets();
  tkShowForm(x.id);
});

document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-tk-form]");
  if (!f) return;
  e.preventDefault();
  const x = await tkGet(f.dataset.tkForm);
  if (!x) return;
  await tkPut({ ...x, name: f.name.value.trim() || x.name, date: f.date.value, kind: f.kind.value });
  $("#tkForm").innerHTML = "";
  toast(t("tk_saved"));
  renderTickets();
});

document.addEventListener("click", async e => {
  const open = e.target.closest("[data-tk-open]");
  if (open) return tkView(open.dataset.tkOpen);
  const edit = e.target.closest("[data-tk-edit]");
  if (edit) return tkShowForm(edit.dataset.tkEdit);
  if (e.target.closest("[data-tk-close]") || e.target.id === "tkView") return tkCloseView();
  const del = e.target.closest("[data-tk-del]");
  if (del) {
    if (!confirm(t("tk_delete_q"))) return;
    const x = await tkGet(del.dataset.tkDel);
    await tkDel(del.dataset.tkDel);
    if (x?.server && typeof authToken === "function" && authToken()) api(`/api/tickets/${x.server}`, { method: "DELETE" }).catch(() => {});
    $("#tkForm").innerHTML = "";
    renderTickets();
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#tkView")) tkCloseView(); });

// «Поездка» → вкладка «Билеты»: ближайшие билеты и кнопка ко всем
function renderTripTickets(all) {
  const box = $("#ticketsBox");
  if (!box) return;
  const today = tkToday(), soon = (all || []).filter(x => !x.date || x.date >= today).slice(0, 4);
  box.innerHTML = `
    ${soon.length ? soon.map(tkRow).join("") : `<p class="hint">${t("tk_trip_empty")}</p>`}
    <a class="btn ghost tk-all" href="#tickets">${icon("ticket")} ${t("tk_all")}</a>`;
}

EXT.routes.tickets = openTickets;
EXT.homeTiles.push(() => ["#tickets", "ticket", t("tk_title"), t("tk_tile")]);
EXT.onInit.push(() => {
  // Блок во «Поездке» — до того, как js/triplayout.js разложит блоки по вкладкам
  $("#tab-budget")?.insertAdjacentHTML("beforeend", `<section class="panel" id="ticketsBox"></section>`);
  tkAll().then(renderTripTickets);
  setTimeout(() => tkSync().then(() => tkAll().then(renderTripTickets)), 4000);
});
EXT.onLang.push(() => tkAll().then(renderTripTickets));

// «Поездка» → «По дням»: если дата билета совпадает с днём поездки — кнопка «Билет» прямо в карточке дня
async function tkMarkDays() {
  const box = $("#tripDays");
  if (!box) return;
  const all = (await tkAll()).filter(x => x.date);
  box.querySelectorAll(".day-tk").forEach(el => el.remove());
  if (!all.length) return;
  box.querySelectorAll(".day-w[data-date]").forEach(w => {
    const list = all.filter(x => x.date === w.dataset.date);
    if (!list.length) return;
    w.closest(".day-main")?.querySelector("header")?.insertAdjacentHTML("afterend",
      `<div class="day-tk">${list.map(x => `<button type="button" class="day-tk-btn" data-tk-open="${x.id}">${icon(TK_KINDS[x.kind] || "ticket")} ${t("tk_one")}: ${esc(tkNiceName(x.name, x.kind, x.created))}</button>`).join("")}</div>`);
  });
}
EXT.onInit.push(() => { const d = $("#tripDays"); if (d) new MutationObserver(m => { if (m.some(r => [...r.addedNodes].some(n => n.classList?.contains("day-card")))) tkMarkDays(); }).observe(d, { childList: true }); });
