// «Цены на месте»: сколько обычно стоят такси, еда, вход в памятники и сувениры; проверка «не завышают ли»
// и сообщение реальной цены. Справочник — js/prices-data.js, медианы реальных цен — сервер (server/prices.js).
const BARGAIN = "Qimmat-ku! Arzonroq bo‘ladimi?";

// Вилка цен для города: стартовая оценка с поправкой на город, округлённая до «живых» сумм
function priceRange(item, cityId) {
  const k = priceTier(cityId), round = v => v >= 20000 ? Math.round(v / 5000) * 5000 : v >= 5000 ? Math.round(v / 1000) * 1000 : Math.round(v / 500) * 500;
  return [round(item.min * k), round(item.max * k)];
}
// Сумы — так считают на месте; рядом — в выбранной валюте
function fmtSum(uzs) { return fmtNum(uzs) + " " + t("sum"); }
function fmtCur(uzs) {
  if (currency === "UZS") return "";
  const v = uzs / RATES.rates[currency];
  const n = v.toLocaleString(NUM_LOCALE[LANG], { maximumFractionDigits: v < 10 ? 1 : 0 });
  return ["USD", "EUR", "GBP"].includes(currency) ? SYMBOL[currency] + n : n + SYMBOL[currency];
}

// Медианы реальных цен города (с сервера; без сети — сохранённые)
async function loadPriceStats(cityId) {
  if (!location.protocol.startsWith("http")) return {};
  const key = "prices:" + cityId;
  const fresh = Cache.get(key, HOUR);
  if (fresh) return fresh;
  return orStale(key, async () => {
    const data = await getJSON("/api/prices?city=" + encodeURIComponent(cityId), { timeout: 6000 });
    Cache.set(key, data);
    return data;
  }).catch(() => ({}));
}

function priceRow(item, cityId, stats) {
  const [lo, hi] = priceRange(item, cityId);
  const s = stats[item.id];
  const real = s && s.n >= 3;
  const main = real ? "≈ " + fmtSum(s.median) : `${fmtNum(lo)}–${fmtSum(hi)}`;
  const cur = real ? fmtCur(s.median) : (fmtCur(lo) && `${fmtCur(lo)}–${fmtCur(hi)}`);
  return `
    <details class="pr-item" data-pr="${item.id}">
      <summary>
        <i>${icon(item.icon)}</i>
        <span class="pr-name"><b>${L3(item.n, item.x)}</b>${item.note ? `<small>${L3(item.note, item.nx)}</small>` : ""}</span>
        <span class="pr-val"><b>${main}</b><small>${cur ? cur + " · " : ""}<em class="${real ? "real" : ""}">${real ? t("pr_real", { n: s.n }) : t("pr_est")}</em></small></span>
      </summary>
      <div class="pr-tools">
        <label>${t("pr_asked")}<input type="number" inputmode="numeric" min="0" step="500" placeholder="${fmtNum(hi)}"></label>
        <div class="pr-btns">
          <button type="button" class="btn small gold-btn" data-pr-check>${icon("search")} ${t("pr_check")}</button>
          ${location.protocol.startsWith("http") ? `<button type="button" class="btn small ghost" data-pr-report>${icon("send")} ${t("pr_paid")}</button>` : ""}
        </div>
        <div class="pr-verdict" aria-live="polite"></div>
      </div>
    </details>`;
}

async function renderPrices(el, cityId) {
  const stats = await loadPriceStats(cityId);
  if (!el.isConnected) return;
  el.dataset.city = cityId;
  el.innerHTML = Object.entries(PRICE_GROUPS).map(([g, grp]) => `
    <section class="pr-group">
      <h3 class="sec-title">${icon(grp.icon)} ${L3(grp.n, grp.x)}</h3>
      ${PRICE_ITEMS.filter(i => i.g === g).map(i => priceRow(i, cityId, stats)).join("")}
    </section>`).join("") + `<p class="hint pr-note">${icon("info")} ${t("pr_note")}</p>`;
}

// Проверка: в пределах вилки — нормально; до +40% — чуть дороже; выше — завышают
function verdict(item, cityId, asked, stats) {
  const [lo, hi] = priceRange(item, cityId);
  const s = stats[item.id];
  const top = s && s.n >= 3 ? Math.max(hi, Math.round(s.median * 1.2)) : hi;
  if (asked <= top) return { cls: "ok", ic: "circle-check", text: t("pr_ok") };
  if (asked <= top * 1.4) return { cls: "bit", ic: "alert", text: t("pr_bit") };
  return { cls: "high", ic: "ban", text: t("pr_high", { max: fmtSum(top) }), bargain: true };
}

document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-pr-check], [data-pr-report]");
  if (!btn) return;
  const row = btn.closest("[data-pr]"), box = row.closest("[data-city]");
  const item = PRICE_ITEMS.find(i => i.id === row.dataset.pr), cityId = box.dataset.city;
  const input = row.querySelector("input"), out = row.querySelector(".pr-verdict");
  const asked = Math.round(+input.value);
  if (!(asked > 0)) { out.innerHTML = `<p class="pr-msg bit">${icon("info")} ${t("pr_enter")}</p>`; input.focus(); return; }
  const stats = await loadPriceStats(cityId);

  if (btn.matches("[data-pr-check]")) {
    const v = verdict(item, cityId, asked, stats);
    out.innerHTML = `<p class="pr-msg ${v.cls}">${icon(v.ic)}<span>${v.text}</span></p>` +
      (v.bargain ? `<p class="pr-bargain">${icon("message")}<span>${t("pr_bargain", { phrase: `<b>${esc(isUz() ? uzText(BARGAIN) : BARGAIN)}</b>` })}</span></p>` : "");
    return;
  }
  // Сообщить реальную цену
  if (!(await requireConsent())) return;
  btn.disabled = true;
  try {
    const res = await fetch("/api/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(typeof authToken === "function" && authToken() ? { Authorization: "Bearer " + authToken() } : {}) },
      body: JSON.stringify({ city: cityId, item: item.id, price: asked })
    });
    if (res.status === 422) { out.innerHTML = `<p class="pr-msg bit">${icon("alert")} ${t("pr_bad")}</p>`; return; }
    if (!res.ok) throw new Error(res.status);
    localStorage.removeItem("c:prices:" + cityId);
    out.innerHTML = `<p class="pr-msg ok">${icon("heart")} ${t("pr_thanks")}</p>`;
  } catch {
    out.innerHTML = `<p class="pr-msg bit">${icon("wifi-off")} ${t("off_need_net")}</p>`;
  } finally { btn.disabled = false; }
});

// ---------- Окно «Цены на месте» (#prices или #prices/samarkand) ----------
function openPrices(id) {
  const cityId = CITY[id] ? id : (currentCity?.id || store.get("safar_prices_city", "samarkand"));
  // Город — через поиск (js/citypick.js), а не длинный список из 349 строк
  openModal(`
    <div class="m-head" style="background:${CAT_BG.s};min-height:170px;padding-top:70px"><h2>${icon("coins")} ${t("pr_title")}</h2><p>${t("pr_sub")}</p></div>
    <div class="m-body">
      ${cityPickHtml("prCity", cityId)}
      <div id="prBox"><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>`);
  renderPrices($("#prBox"), cityId);
  $("#prCity").addEventListener("citypick", e => {
    store.set("safar_prices_city", e.detail);
    renderPrices($("#prBox"), e.detail);
  });
}

EXT.routes.prices = openPrices;
EXT.homeTiles.push(() => ["#prices", "coins", t("pr_title"), t("pr_sub")]);
EXT.cityTabs.push({ id: "prices", label: () => `${icon("coins")} ${t("pr_tab")}`, render: (c, el) => renderPrices(el, c.id) });
