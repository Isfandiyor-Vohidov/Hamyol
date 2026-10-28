// «Мои документы» (#docs): копии паспорта, визы, страховки, брони, регистрации — и медицинская карточка для врача (#med).
// Всё хранится ТОЛЬКО на этом устройстве (IndexedDB «safar-docs»): на сервер не отправляется, в аккаунт не синхронизируется.
// Зачем: украли паспорт — копия под рукой для полиции и посольства; плохо стало — врач видит группу крови и аллергии.
const DOC_DB = "safar-docs", DOC_STORE = "d", MED_KEY = "med";
const DOC_KINDS = { passport: "id-card", visa: "file-check", insurance: "shield-plus", booking: "hotel", registration: "badge-check", other: "file-text" };

function docDb() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DOC_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DOC_STORE, { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}
async function docTx(mode, fn) {
  const db = await docDb();
  return new Promise((ok, fail) => {
    const tx = db.transaction(DOC_STORE, mode), st = tx.objectStore(DOC_STORE);
    const out = fn(st);
    tx.oncomplete = () => ok(out?.result ?? out);
    tx.onerror = () => fail(tx.error);
  });
}
const docAll = () => docTx("readonly", st => st.getAll()).then(r => (r || []).filter(x => x.id !== MED_KEY)).catch(() => []);
const docGet = id => docTx("readonly", st => st.get(id));
const docPut = x => docTx("readwrite", st => st.put(x));
const docDel = id => docTx("readwrite", st => st.delete(id));
const docId = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const medGet = () => docGet(MED_KEY).then(x => x?.data || null).catch(() => null);
// Попросить браузер не удалять данные при нехватке места (особенно важно для документов)
const docPersist = () => { try { navigator.storage?.persist?.(); } catch { /* нет поддержки */ } };
const docToday = () => new Date().toISOString().slice(0, 10);
const docDate = d => new Date(d + "T12:00").toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "long", year: "numeric" });

function docRow(x) {
  const today = docToday(), soon = x.until && x.until >= today && (new Date(x.until) - new Date(today)) / 864e5 <= 30;
  const state = !x.until ? "" : x.until < today ? `<em class="doc-bad">${t("doc_expired")}</em>` : soon ? `<em class="doc-warn">${t("doc_soon", { d: docDate(x.until) })}</em>` : `<span>${t("doc_until_short", { d: docDate(x.until) })}</span>`;
  return `<div class="tk-row doc-row" data-doc="${x.id}">
    <button type="button" class="tk-open" data-doc-open="${x.id}"><i>${icon(DOC_KINDS[x.kind] || "file-text")}</i>
      <span><b>${esc(x.name || t("doc_k_" + x.kind))}</b><small>${t("doc_k_" + x.kind)}${state ? " · " + state : ""}</small></span></button>
    <button type="button" class="tk-more" data-doc-edit="${x.id}" aria-label="${t("doc_edit")}">${icon("edit")}</button>
  </div>`;
}

// Медицинская карточка — коротко в списке
function medSummary(m) {
  if (!m) return `<button type="button" class="med-card empty" data-med-edit><i>${icon("heart-pulse")}</i><span><b>${t("med_title")}</b><small>${t("med_empty")}</small></span>${icon("plus")}</button>`;
  const bits = [m.blood && `${t("med_blood")}: <b>${esc(m.blood)}</b>`, m.allergy && `${t("med_allergy")}: ${esc(m.allergy)}`].filter(Boolean).join(" · ");
  return `<div class="med-card">
    <i>${icon("heart-pulse")}</i>
    <span><b>${t("med_title")}</b><small>${bits || esc(m.name || "")}</small></span>
    <div class="med-acts">
      <button type="button" class="btn small gold-btn" data-med-show>${icon("stethoscope")} ${t("med_show")}</button>
      <button type="button" class="btn small ghost" data-med-edit>${icon("edit")} ${t("doc_edit")}</button>
    </div>
  </div>`;
}

async function renderDocs() {
  const box = $("#docList");
  if (!box) return;
  const [all, med] = await Promise.all([docAll(), medGet()]);
  const order = Object.keys(DOC_KINDS);
  all.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.created - a.created);
  $("#medBox").innerHTML = medSummary(med);
  box.innerHTML = all.length ? all.map(docRow).join("")
    : `<div class="tk-empty">${icon("id-card")}<p>${t("doc_empty")}</p></div>`;
}

function openDocs(sub) {
  if (sub === "med") return openMed();
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-c);min-height:150px;padding-top:60px"><h2>${icon("folder-lock")} ${t("doc_title")}</h2><p>${t("doc_sub")}</p></div>
    <div class="m-body">
      <div id="medBox"></div>
      <h3 class="sec-title">${icon("id-card")} ${t("doc_copies")}</h3>
      <div class="tk-add">
        <label class="btn gold-btn tk-file">${icon("camera")} ${t("doc_add")}<input type="file" id="docFile" accept="image/*,application/pdf" hidden></label>
      </div>
      <div id="docForm"></div>
      <div id="docList"><div class="skeleton"></div></div>
      <p class="hint doc-private">${icon("lock")} <span>${t("doc_private")}</span></p>
      ${IS_IOS && !IS_STANDALONE ? `<p class="hint doc-private">${icon("info")} <span>${t("doc_ios")}</span></p>` : ""}
    </div>`);
  renderDocs();
}

// ---------- Документ: добавить, подписать, просмотреть ----------
function docFormHtml(x) {
  return `<form class="tk-edit" data-doc-form="${x.id}">
    <div class="tk-edit-row">
      <label><span>${t("doc_kind")}</span><select name="kind">${Object.keys(DOC_KINDS).map(k => `<option value="${k}" ${x.kind === k ? "selected" : ""}>${t("doc_k_" + k)}</option>`).join("")}</select></label>
      <label><span>${t("doc_until")}</span><input name="until" type="date" value="${x.until || ""}"></label>
    </div>
    <label><span>${t("doc_name")}</span><input name="name" maxlength="80" value="${esc(x.name || "")}" placeholder="${t("doc_name_ph")}"></label>
    <div class="tk-edit-acts">
      <button class="btn gold-btn" type="submit">${icon("check")} ${t("tk_save")}</button>
      <button class="btn ghost danger-btn" type="button" data-doc-del="${x.id}">${icon("ban")} ${t("tk_delete")}</button>
    </div>
  </form>`;
}
async function docShowForm(id) {
  const x = await docGet(id), f = $("#docForm");
  if (!x || !f) return;
  f.innerHTML = docFormHtml(x);
  f.scrollIntoView({ behavior: "smooth", block: "center" });
}
async function docView(id) {
  const x = await docGet(id);
  if (!x?.blob) return;
  const url = URL.createObjectURL(x.blob), pdf = x.mime === "application/pdf", title = x.name || t("doc_k_" + x.kind);
  document.body.insertAdjacentHTML("beforeend", `
    <div id="tkView" class="tk-view" role="dialog" aria-modal="true">
      <div class="tk-view-bar"><b>${esc(title)}</b><button type="button" class="tc-x" data-tk-close aria-label="${t("cs_close")}">${icon("x")}</button></div>
      ${pdf ? `<iframe src="${url}#view=FitH" title="${esc(title)}"></iframe><a class="btn gold-btn tk-pdf" href="${url}" target="_blank" rel="noopener">${icon("external")} ${t("tk_open_pdf")}</a>`
            : `<img src="${url}" alt="${esc(title)}">`}
      <p class="tk-view-hint">${t("doc_copy_note")}</p>
    </div>`);
  const v = $("#tkView");
  v._url = url;
  try { navigator.wakeLock?.request("screen").then(l => (v.isConnected ? (v._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}

document.addEventListener("change", async e => {
  if (e.target.id !== "docFile") return;
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (!/^(application\/pdf|image\/)/.test(file.type)) return toast(t("tk_type"));
  if (file.size > 20 * 1048576) return toast(t("tk_big"));
  const have = await docAll();
  // Первый документ — скорее всего паспорт; дальше — «другое», человек выберет сам
  const x = { id: docId(), kind: have.some(d => d.kind === "passport") ? "other" : "passport", name: "", until: "", mime: file.type, blob: file, created: Date.now() };
  await docPut(x);
  docPersist();
  await renderDocs();
  docShowForm(x.id);
});

document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-doc-form]");
  if (f) {
    e.preventDefault();
    const x = await docGet(f.dataset.docForm);
    if (!x) return;
    await docPut({ ...x, kind: f.kind.value, until: f.until.value, name: f.name.value.trim() });
    $("#docForm").innerHTML = "";
    toast(t("tk_saved"));
    return renderDocs();
  }
  const m = e.target.closest("[data-med-form]");
  if (m) {
    e.preventDefault();
    const data = Object.fromEntries([...new FormData(m)].map(([k, v]) => [k, String(v).trim().slice(0, 300)]));
    await docPut({ id: MED_KEY, data, created: Date.now() });
    docPersist();
    toast(t("tk_saved"));
    location.hash = "#docs";
  }
});

document.addEventListener("click", async e => {
  const open = e.target.closest("[data-doc-open]");
  if (open) return docView(open.dataset.docOpen);
  const edit = e.target.closest("[data-doc-edit]");
  if (edit) return docShowForm(edit.dataset.docEdit);
  const del = e.target.closest("[data-doc-del]");
  if (del) {
    if (!(await askConfirm({ title: t("doc_delete_q"), ok: t("tk_delete"), danger: true, icon: "ban" }))) return;
    await docDel(del.dataset.docDel);
    $("#docForm").innerHTML = "";
    return renderDocs();
  }
  if (e.target.closest("[data-med-edit]")) { location.hash = "#docs/med"; return; }
  if (e.target.closest("[data-med-show]")) return showMed();
  if (e.target.closest("[data-med-close]") || e.target.id === "medCard") return closeMed();
  if (e.target.closest("[data-med-clear]")) {
    if (!(await askConfirm({ title: t("med_clear_q"), ok: t("tk_delete"), danger: true, icon: "ban" }))) return;
    await docDel(MED_KEY);
    location.hash = "#docs";
  }
});

// ---------- Медицинская карточка: заполнить ----------
const BLOOD = ["O(I) Rh+", "O(I) Rh−", "A(II) Rh+", "A(II) Rh−", "B(III) Rh+", "B(III) Rh−", "AB(IV) Rh+", "AB(IV) Rh−"];
async function openMed() {
  const m = await medGet() || {};
  const f = (name, ph = "", type = "text") => `<label><span>${t("med_" + name)}</span><input name="${name}" type="${type}" maxlength="200" value="${esc(m[name] || "")}" ${ph ? `placeholder="${ph}"` : ""} ${type === "tel" ? 'inputmode="tel" autocomplete="off"' : ""}></label>`;
  const area = (name, ph) => `<label><span>${t("med_" + name)}</span><textarea name="${name}" rows="2" maxlength="300" placeholder="${ph}">${esc(m[name] || "")}</textarea></label>`;
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-f);min-height:150px;padding-top:60px"><h2>${icon("heart-pulse")} ${t("med_title")}</h2><p>${t("med_sub")}</p></div>
    <div class="m-body">
      <form class="tk-edit med-form" data-med-form>
        ${f("name")}
        <div class="tk-edit-row">
          ${f("birth", "", "date")}
          <label><span>${t("med_blood")}</span><select name="blood"><option value="">${t("med_unknown")}</option>${BLOOD.map(b => `<option ${m.blood === b ? "selected" : ""}>${b}</option>`).join("")}</select></label>
        </div>
        ${area("allergy", t("med_allergy_ph"))}
        ${area("meds", t("med_meds_ph"))}
        ${area("cond", t("med_cond_ph"))}
        <h3>${icon("contact")} ${t("med_who")}</h3>
        <div class="tk-edit-row">${f("contact")}${f("phone", "+", "tel")}</div>
        <h3>${icon("shield-plus")} ${t("med_insurance")}</h3>
        <div class="tk-edit-row">${f("ins")}${f("ins_phone", "+", "tel")}</div>
        ${f("langs", t("med_langs_ph"))}
        <div class="tk-edit-acts">
          <button class="btn gold-btn" type="submit">${icon("check")} ${t("tk_save")}</button>
          ${m.name || m.blood ? `<button class="btn ghost danger-btn" type="button" data-med-clear>${icon("ban")} ${t("tk_delete")}</button>` : ""}
        </div>
      </form>
      <p class="hint doc-private">${icon("lock")} <span>${t("doc_private")}</span></p>
    </div>`);
}

// ---------- Медицинская карточка: показать врачу ----------
// Подписи — сразу на узбекском, русском и английском: врач в Узбекистане поймёт хотя бы один язык
const MED_L = {
  title: "TIBBIY KARTA · МЕДИЦИНСКАЯ КАРТА · MEDICAL CARD",
  name: "Ism · Имя · Name", birth: "Tug‘ilgan sana · Дата рождения · Date of birth", blood: "Qon guruhi · Группа крови · Blood type",
  allergy: "Allergiya · Аллергия · Allergies", meds: "Dorilar · Лекарства · Medications", cond: "Kasalliklar · Болезни · Conditions",
  contact: "Favqulodda aloqa · Кому звонить · Emergency contact", ins: "Sug‘urta · Страховка · Insurance", langs: "Tillar · Языки · Languages"
};
async function showMed() {
  const m = await medGet();
  if (!m) return openMed();
  const row = (k, v, big) => v ? `<div class="mc-row ${big ? "big" : ""}"><small>${MED_L[k]}</small><b>${esc(v)}</b></div>` : "";
  const tel = p => p ? ` · <a href="tel:${esc(p.replace(/[^\d+]/g, ""))}">${esc(p)}</a>` : "";
  document.body.insertAdjacentHTML("beforeend", `
    <div id="medCard" class="tc mc" role="dialog" aria-modal="true" aria-label="${MED_L.title}">
      <button type="button" class="tc-x" data-med-close aria-label="${t("cs_close")}">${icon("x")}</button>
      <p class="mc-title">${icon("heart-pulse")} ${MED_L.title}</p>
      ${row("name", m.name, true)}
      ${row("birth", m.birth && docDate(m.birth))}
      ${row("blood", m.blood, true)}
      ${row("allergy", m.allergy, true)}
      ${row("meds", m.meds)}
      ${row("cond", m.cond)}
      ${m.contact || m.phone ? `<div class="mc-row"><small>${MED_L.contact}</small><b>${esc(m.contact || "")}${tel(m.phone)}</b></div>` : ""}
      ${m.ins || m.ins_phone ? `<div class="mc-row"><small>${MED_L.ins}</small><b>${esc(m.ins || "")}${tel(m.ins_phone)}</b></div>` : ""}
      ${row("langs", m.langs)}
      <p class="mc-sos">${typeof sosNumsLine === "function" ? sosNumsLine() : "🚑 103 · 👮 102 · 🚒 101"}</p>
    </div>`);
  try { navigator.wakeLock?.request("screen").then(l => ($("#medCard") ? ($("#medCard")._lock = l) : l.release())).catch(() => {}); } catch { /* нет поддержки */ }
}
function closeMed() {
  const el = $("#medCard");
  if (!el || el.classList.contains("out")) return;
  el._lock?.release?.();
  el.classList.add("out");
  setTimeout(() => el.remove(), 240);
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#medCard")) closeMed(); });

EXT.routes.docs = openDocs;
EXT.routes.med = () => { location.replace("#docs"); setTimeout(showMed, 400); };
EXT.homeTiles.push(() => ["#docs", "folder-lock", t("doc_title"), t("doc_tile")]);
