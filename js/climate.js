// «Когда ехать»: климат по месяцам (архив наблюдений Open-Meteo / ERA5, 2021–2024).
// Данные в data/cities.js: climate[i].m[месяц] = [средний максимум °C, средний минимум °C, осадки мм, дней с осадками].

const UZ_MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
const UZ_MONTHS_FULL = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const monthShort = i => isUz() ? uzText(UZ_MONTHS[i]) : new Date(2024, i, 15).toLocaleDateString(LOCALE[LANG], { month: "short" }).replace(".", "");
const monthLong = i => isUz() ? uzText(UZ_MONTHS_FULL[i]) : new Date(2024, i, 15).toLocaleDateString(LOCALE[LANG], { month: "long" });
const climateOf = c => c && DB.climate?.[c.cl];

// Комфорт месяца для прогулок: 18–28 °C днём и мало дождливых дней
function comfort([tx, , , rd]) {
  let s = 10;
  if (tx > 28) s -= (tx - 28) * 0.8;
  if (tx < 18) s -= (18 - tx) * 0.6;
  s -= Math.max(0, rd - 4) * 0.4;
  return Math.max(0, s);
}
function bestMonths(cl) {
  const sc = cl.m.map(comfort);
  const top = Math.max(...sc);
  return sc.map((v, i) => v >= Math.max(6.5, top - 1.5) ? i : -1).filter(i => i >= 0);
}
// [3,4,8,9] → «апрель–май, сентябрь–октябрь»
function monthRanges(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push(i === j ? monthLong(list[i]) : `${monthLong(list[i])}–${monthLong(list[j])}`);
    i = j;
  }
  return out.join(", ");
}
// Для планировщика: обычная погода в этом месяце
function climateFor(c, month) {
  const cl = climateOf(c);
  if (!cl) return "";
  const [tx, tn] = cl.m[month];
  return `<span title="${esc(t("clim_usual"))}">${icon("thermometer")} ~${Math.round(tx)}° / ${Math.round(tn)}°</span>`;
}

// ---------- Графики ----------
function climateCharts(cl) {
  const best = new Set(bestMonths(cl));
  const W = 600, bandW = W / 12, barW = 18;
  // Температура: плавающие столбики от минимума до максимума
  const lo = Math.floor((Math.min(...cl.m.map(m => m[1])) - 2) / 10) * 10;
  const hi = Math.ceil((Math.max(...cl.m.map(m => m[0])) + 2) / 10) * 10;
  const H = 200, top = 14, bottom = 24, ph = H - top - bottom;
  const y = v => top + (hi - v) / (hi - lo) * ph;
  const ticks = [];
  for (let v = lo; v <= hi; v += 10) ticks.push(v);
  const iMax = cl.m.reduce((a, m, i) => m[0] > cl.m[a][0] ? i : a, 0);
  const iMin = cl.m.reduce((a, m, i) => m[1] < cl.m[a][1] ? i : a, 0);
  const temp = `
    <svg class="viz-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("clim_temp"))}">
      ${ticks.map(v => `<line class="viz-grid${v === 0 ? " zero" : ""}" x1="28" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>
        <text class="viz-tick" x="22" y="${y(v) + 4}" text-anchor="end">${v}°</text>`).join("")}
      ${cl.m.map(([tx, tn], i) => {
        const x = 28 + i * (W - 28) / 12 + ((W - 28) / 12 - barW) / 2;
        return `<rect class="viz-bar ${best.has(i) ? "best" : ""}" x="${x}" y="${y(tx)}" width="${barW}" height="${Math.max(2, y(tn) - y(tx))}" rx="4"/>
          ${i === iMax ? `<text class="viz-label" x="${x + barW / 2}" y="${y(tx) - 5}" text-anchor="middle">${Math.round(tx)}°</text>` : ""}
          ${i === iMin ? `<text class="viz-label" x="${x + barW / 2}" y="${y(tn) + 14}" text-anchor="middle">${Math.round(tn)}°</text>` : ""}
          <text class="viz-tick" x="${x + barW / 2}" y="${H - 6}" text-anchor="middle">${monthShort(i)}</text>`;
      }).join("")}
      ${cl.m.map((m, i) => `<rect class="viz-hit" data-m="${i}" tabindex="0" x="${28 + i * (W - 28) / 12}" y="0" width="${(W - 28) / 12}" height="${H}"/>`).join("")}
    </svg>`;
  // Осадки: обычные столбики от нуля (отдельный график — не вторая ось)
  const pMax = Math.max(10, ...cl.m.map(m => m[2]));
  const PH = 110, ptop = 16, pbottom = 22, pph = PH - ptop - pbottom;
  const py = v => ptop + (1 - v / pMax) * pph;
  const iRain = cl.m.reduce((a, m, i) => m[2] > cl.m[a][2] ? i : a, 0);
  const rain = `
    <svg class="viz-svg" viewBox="0 0 ${W} ${PH}" role="img" aria-label="${esc(t("clim_rain"))}">
      <line class="viz-grid zero" x1="28" x2="${W}" y1="${py(0)}" y2="${py(0)}"/>
      ${cl.m.map(([, , p], i) => {
        const x = 28 + i * (W - 28) / 12 + ((W - 28) / 12 - barW) / 2;
        const h = Math.max(1, py(0) - py(p)), r = Math.min(4, h);
        const d = `M${x} ${py(0)} V${py(0) - h + r} Q${x} ${py(0) - h} ${x + r} ${py(0) - h} H${x + barW - r} Q${x + barW} ${py(0) - h} ${x + barW} ${py(0) - h + r} V${py(0)} Z`;
        return `<path class="viz-rain" d="${d}"/>
          ${i === iRain ? `<text class="viz-label" x="${x + barW / 2}" y="${py(p) - 5}" text-anchor="middle">${p}</text>` : ""}
          <text class="viz-tick" x="${x + barW / 2}" y="${PH - 5}" text-anchor="middle">${monthShort(i)}</text>`;
      }).join("")}
      ${cl.m.map((m, i) => `<rect class="viz-hit" data-m="${i}" x="${28 + i * (W - 28) / 12}" y="0" width="${(W - 28) / 12}" height="${PH}"/>`).join("")}
    </svg>`;
  const table = `<details class="viz-table"><summary>${t("clim_table")}</summary><table>
    <thead><tr><th></th><th>${t("clim_max")}</th><th>${t("clim_min")}</th><th>${t("clim_mm")}</th><th>${t("clim_days")}</th></tr></thead>
    <tbody>${cl.m.map(([tx, tn, p, rd], i) => `<tr class="${best.has(i) ? "best" : ""}"><th>${monthLong(i)}</th><td>${Math.round(tx)}°</td><td>${Math.round(tn)}°</td><td>${p}</td><td>${rd}</td></tr>`).join("")}</tbody>
  </table></details>`;
  return `
    <div class="viz">
      <div class="viz-head"><b>${t("clim_temp")}</b>
        <span class="viz-key"><i class="best"></i>${t("clim_best_key")} <i></i>${t("clim_other_key")}</span></div>
      <div class="viz-plot">${temp}<div class="viz-tip" hidden></div></div>
      <div class="viz-head"><b>${t("clim_rain")}</b></div>
      <div class="viz-plot">${rain}<div class="viz-tip" hidden></div></div>
      ${table}
      <p class="hint">${t("clim_source", { ref: esc(cl.n) })}</p>
    </div>`;
}

// Подсказка при наведении / фокусе на месяц
function bindClimateTips(root, cl) {
  root.querySelectorAll(".viz-plot").forEach(plot => {
    const tip = plot.querySelector(".viz-tip");
    const show = e => {
      const r = e.target.closest(".viz-hit");
      if (!r) return;
      const [tx, tn, p, rd] = cl.m[+r.dataset.m];
      tip.innerHTML = `<b>${monthLong(+r.dataset.m)}</b><br>${t("clim_max")}: ${Math.round(tx)}° · ${t("clim_min")}: ${Math.round(tn)}°<br>${t("clim_mm")}: ${p} · ${t("clim_days")}: ${rd}`;
      tip.hidden = false;
      const box = plot.getBoundingClientRect(), rb = r.getBoundingClientRect();
      const left = Math.min(Math.max(rb.left - box.left + rb.width / 2, 70), box.width - 70);
      tip.style.left = left + "px";
    };
    plot.addEventListener("mouseover", show);
    plot.addEventListener("focusin", show);
    plot.addEventListener("mouseleave", () => { tip.hidden = true; });
    plot.addEventListener("focusout", () => { tip.hidden = true; });
  });
}

// ---------- Подключение ----------
// В обзоре города — строка «Лучшее время» и графики
EXT.cityOverview.push(c => {
  const cl = climateOf(c);
  if (!cl) return "";
  return `<section class="when-go">
    <h3>${icon("calendar-range")} ${t("clim_title")}</h3>
    <p class="best-line">${icon("sparkles")} ${t("clim_best", { months: monthRanges(bestMonths(cl)) })}</p>
    ${climateCharts(cl)}
  </section>`;
});
EXT.cityOverviewBind.push((c, root) => { const cl = climateOf(c); if (cl) bindClimateTips(root, cl); });
