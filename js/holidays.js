// Праздники и Рамадан: предупреждение на странице места («сегодня может работать по-другому»)
// и список праздников, которые попадают на даты поездки (вкладка «Поездка»).
// Даты Рамадана и хайитов зависят от луны — указаны примерно, официально их объявляют ближе к сроку.
const HOLIDAYS_FIXED = [
  ["01-01", "hd_newyear"], ["03-08", "hd_women"], ["03-21", "hd_navruz"], ["05-09", "hd_memory"],
  ["09-01", "hd_independence"], ["10-01", "hd_teachers"], ["12-08", "hd_constitution"]
];
const HOLIDAYS_MOON = { 2026: [["03-20", "hd_ramazan"], ["05-27", "hd_qurbon"]], 2027: [["03-10", "hd_ramazan"], ["05-16", "hd_qurbon"]], 2028: [["02-27", "hd_ramazan"], ["05-05", "hd_qurbon"]] };
const RAMADAN = { 2026: ["02-18", "03-19"], 2027: ["02-08", "03-09"], 2028: ["01-28", "02-26"] };

const mmdd = d => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function holidayOn(d) {
  const md = mmdd(d), y = d.getFullYear();
  const f = HOLIDAYS_FIXED.find(([x]) => x === md) || (HOLIDAYS_MOON[y] || []).find(([x]) => x === md);
  return f ? { key: f[1], moon: !!(HOLIDAYS_MOON[y] || []).find(([x]) => x === md) } : null;
}
function isRamadan(d) {
  const r = RAMADAN[d.getFullYear()];
  return !!r && mmdd(d) >= r[0] && mmdd(d) <= r[1];
}

// Страница места: если сегодня праздник или Рамадан — короткое предупреждение
EXT.placeExtras.push(p => {
  const now = new Date(), h = holidayOn(now);
  if (h) return `<p class="hd-note">${icon("calendar")}<span>${t("hd_today", { name: t(h.key) })}${h.moon ? " " + t("hd_moon") : ""}</span></p>`;
  if (isRamadan(now) && (p.c === "f" || p.c === "s")) return `<p class="hd-note">${icon("moon")}<span>${t("hd_ramadan_now")}</span></p>`;
  return "";
});

// «Поездка»: праздники на датах поездки
function renderTripHolidays() {
  const box = $("#tripExtras");
  if (!box) return;
  box.querySelector(".hd-trip")?.remove();
  const start = typeof tripStartDate === "function" ? tripStartDate() : null;
  if (!start) return;
  const nights = (typeof tripRoute !== "undefined" ? tripRoute : []).reduce((a, r) => a + (+r.nights || 0), 0);
  const days = [], ram = [];
  for (let i = 0; i <= nights; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const h = holidayOn(d);
    if (h) days.push(`<li><b>${d.toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "long" })}</b> — ${t(h.key)}${h.moon ? " " + t("hd_moon") : ""}</li>`);
    if (isRamadan(d)) ram.push(d);
  }
  if (!days.length && !ram.length) return;
  box.insertAdjacentHTML("beforeend", `
    <div class="hd-trip">
      <p><b>${icon("calendar")} ${t("hd_trip")}</b></p>
      ${days.length ? `<ul>${days.join("")}</ul><p class="hint">${t("hd_trip_hint")}</p>` : ""}
      ${ram.length ? `<p class="hint">${icon("moon")} ${t("hd_ramadan_trip")}</p>` : ""}
    </div>`);
}
EXT.onInit.push(() => setTimeout(renderTripHolidays));
EXT.onLang.push(() => setTimeout(renderTripHolidays));
EXT.onConfig.push(() => setTimeout(renderTripHolidays));
EXT.onBudget.push(() => setTimeout(renderTripHolidays));   // поменяли города или ночи
document.addEventListener("change", e => { if (e.target.closest("#tripStart, #tab-budget")) setTimeout(renderTripHolidays, 50); });
