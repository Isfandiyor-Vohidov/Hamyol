// «Делёж расходов» во вкладке «Поездка»: участники, траты (кто платил, сколько, на кого делится)
// и итог «кто кому сколько» с минимумом переводов. Хранится только на этом устройстве (safar_split).
// Сумма запоминается в той валюте, в которой её ввели, итог считается в сумах по курсу ЦБ.

const splitData = () => store.get("safar_split", { people: [], items: [] });
const splitSave = d => { store.set("safar_split", d); renderSplit(); };
const splitId = () => Math.random().toString(36).slice(2, 9);
const splitUzs = it => it.amt * (RATES.rates[it.cur] || 0);
const splitWho = (d, id) => d.people.find(p => p.id === id)?.name || "?";

// Баланс каждого: заплатил минус его доля. Плюс — ему должны, минус — должен он
function splitBalances(d) {
  const bal = Object.fromEntries(d.people.map(p => [p.id, 0]));
  for (const it of d.items) {
    const share = it.for.filter(id => id in bal);
    if (!share.length || !(it.by in bal)) continue;
    const v = splitUzs(it);
    bal[it.by] += v;
    share.forEach(id => { bal[id] -= v / share.length; });
  }
  return bal;
}

// Переводы: самый большой должник платит самому большому кредитору, пока все не в расчёте.
// Получается не больше (участников − 1) переводов
function splitTransfers(bal) {
  const eps = 1;   // меньше 1 сума — уже в расчёте
  const debt = Object.entries(bal).filter(([, v]) => v < -eps).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const cred = Object.entries(bal).filter(([, v]) => v > eps).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out = [];
  while (debt.length && cred.length) {
    const a = debt[0], b = cred[0], v = Math.min(a.v, b.v);
    out.push({ from: a.id, to: b.id, v });
    a.v -= v; b.v -= v;
    if (a.v <= eps) debt.shift();
    if (b.v <= eps) cred.shift();
    debt.sort((x, y) => y.v - x.v); cred.sort((x, y) => y.v - x.v);
  }
  return out;
}

function renderSplit() {
  const box = $("#splitBox");
  if (!box) return;
  const d = splitData();
  const bal = splitBalances(d), moves = splitTransfers(bal);
  const total = d.items.reduce((a, it) => a + splitUzs(it), 0);
  const opts = d.people.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  box.innerHTML = `
    <div class="block-head"><h2>${icon("coins")} ${t("sp_title")}</h2>
      ${d.people.length || d.items.length ? `<button class="btn ghost small" data-sp="clear">${icon("reset")} ${t("sp_clear")}</button>` : ""}</div>
    <p class="hint">${t("sp_hint")}</p>

    <div class="sp-people">
      ${d.people.map(p => `<span class="chip sp-person">${icon("user")} ${esc(p.name)}
        <button type="button" data-sp="del-person" data-id="${p.id}" aria-label="${t("sp_remove")}" title="${t("sp_remove")}">${icon("x")}</button></span>`).join("")}
      <form class="sp-add-person" data-sp-form="person">
        <input name="name" maxlength="24" placeholder="${t("sp_name_ph")}" autocomplete="off" required>
        <button class="btn ghost small" type="submit">${icon("plus")} ${t("sp_add_person")}</button>
      </form>
    </div>

    ${d.people.length >= 2 ? `
    <form class="sp-add" data-sp-form="item">
      <input name="what" maxlength="40" placeholder="${t("sp_what_ph")}" autocomplete="off">
      <label class="sp-amt"><input name="amt" type="number" min="0" step="any" inputmode="decimal" placeholder="0" required><span>${currency}</span></label>
      <label class="sp-by"><span>${t("sp_paid")}</span><select name="by">${opts}</select></label>
      <div class="sp-for"><span>${t("sp_for")}</span>${d.people.map(p => `<label><input type="checkbox" name="for" value="${p.id}" checked> ${esc(p.name)}</label>`).join("")}</div>
      <button class="btn gold-btn" type="submit">${icon("plus")} ${t("sp_add_item")}</button>
    </form>` : `<p class="empty sp-empty">${icon("users")} ${t("sp_need_two")}</p>`}

    ${d.items.length ? `
    <ul class="sp-items">${d.items.map(it => `
      <li><div><b>${esc(it.what || t("sp_item"))}</b>
        <small>${t("sp_paid_by", { name: esc(splitWho(d, it.by)) })} · ${t("sp_for_n", { names: it.for.map(id => esc(splitWho(d, id))).join(", ") })}</small></div>
        <span class="sp-sum">${money(splitUzs(it))}${it.cur !== currency ? `<small>${fmtNum(it.amt)} ${it.cur}</small>` : ""}</span>
        <button type="button" class="sp-del" data-sp="del-item" data-id="${it.id}" aria-label="${t("sp_remove")}" title="${t("sp_remove")}">${icon("x")}</button></li>`).join("")}
    </ul>
    <div class="sp-result">
      <div class="sp-total"><span>${t("sp_total")}</span><b>${money(total)}</b></div>
      <div class="sp-bal">${d.people.map(p => {
        const v = bal[p.id] || 0;
        return `<span class="${v > 1 ? "plus" : v < -1 ? "minus" : ""}">${esc(p.name)} <b>${v > 1 ? "+" : v < -1 ? "−" : ""}${money(Math.abs(v))}</b></span>`;
      }).join("")}</div>
      <h3>${icon("handshake")} ${t("sp_who_pays")}</h3>
      ${moves.length ? `<ol class="sp-moves">${moves.map(m => `<li><b>${esc(splitWho(d, m.from))}</b> ${icon("arrow-right")} <b>${esc(splitWho(d, m.to))}</b><span>${money(m.v)}</span></li>`).join("")}</ol>
        <button class="btn ghost small" data-sp="copy">${icon("copy")} ${t("copy")}</button>`
      : `<p class="sp-even">${icon("circle-check")} ${t("sp_even")}</p>`}
    </div>` : ""}`;
}

document.addEventListener("submit", e => {
  const form = e.target.closest("[data-sp-form]");
  if (!form) return;
  e.preventDefault();
  const d = splitData();
  if (form.dataset.spForm === "person") {
    const name = form.name.value.trim();
    if (!name) return;
    if (d.people.some(p => p.name.toLowerCase() === name.toLowerCase())) return toast(t("sp_dup"));
    d.people.push({ id: splitId(), name });
    splitSave(d);
    $("#splitBox [data-sp-form=person] input")?.focus();
    return;
  }
  const amt = +form.amt.value;
  const forIds = $$("input[name=for]:checked", form).map(x => x.value);
  if (!(amt > 0)) return toast(t("sp_need_amt"));
  if (!forIds.length) return toast(t("sp_need_for"));
  d.items.push({ id: splitId(), what: form.what.value.trim(), amt, cur: currency, by: form.by.value, for: forIds });
  splitSave(d);
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-sp]");
  if (!b) return;
  const d = splitData(), id = b.dataset.id;
  const act = b.dataset.sp;
  if (act === "del-person") {
    // Человека с тратами не удаляем молча: его траты исчезнут вместе с ним
    const used = d.items.some(it => it.by === id || it.for.includes(id));
    if (used && !confirm(t("sp_del_person_q", { name: splitWho(d, id) }))) return;
    d.people = d.people.filter(p => p.id !== id);
    d.items = d.items.filter(it => it.by !== id).map(it => ({ ...it, for: it.for.filter(x => x !== id) })).filter(it => it.for.length);
    splitSave(d);
  }
  if (act === "del-item") {
    const li = b.closest("li");
    const done = () => { d.items = d.items.filter(it => it.id !== id); splitSave(d); };
    if (li && !matchMedia("(prefers-reduced-motion: reduce)").matches) { li.classList.add("closing"); setTimeout(done, 200); } else done();
  }
  if (act === "clear") {
    if (!confirm(t("sp_clear_q"))) return;
    splitSave({ people: [], items: [] });
  }
  if (act === "copy") {
    const lines = [t("sp_title") + " · " + t("sp_total") + ": " + money(d.items.reduce((a, it) => a + splitUzs(it), 0)),
      ...splitTransfers(splitBalances(d)).map(m => `${splitWho(d, m.from)} → ${splitWho(d, m.to)}: ${money(m.v)}`)];
    navigator.clipboard?.writeText(lines.join("\n")).then(() => toast(t("copied")), () => {});
  }
});

// ---------- Подключение ----------
EXT.onInit.push(() => {
  $("#tab-budget")?.insertAdjacentHTML("beforeend", `<section class="panel split" id="splitBox"></section>`);
  renderSplit();
});
EXT.onLang.push(renderSplit);       // язык и валюта
EXT.onBudget.push(() => { if (!$("#splitBox form :focus")) renderSplit(); });   // курсы обновились
