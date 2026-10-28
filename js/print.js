// Печать: печатаем только нужный лист, а не всю страницу.
// Нужное копируется в #printRoot (отдельно от приложения), всё остальное на печати скрыто.
// Так QR-постер помещается на один лист A4, а план поездки — без карт, кнопок и тёмного фона.
function printOnly(html, kind) {
  $("#printRoot")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div id="printRoot" class="print-${kind}">${html}</div>`);
  document.documentElement.classList.add("printing");
  const done = () => { document.documentElement.classList.remove("printing"); $("#printRoot")?.remove(); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done);
  // Даём браузеру дорисовать копию (картинки, QR) перед печатью
  setTimeout(() => { window.print(); setTimeout(() => { if (!matchMedia("print").matches) done(); }, 1500); }, 150);
}

// QR-постер — один лист A4
function printPoster() {
  const p = $("#poster");
  if (!p) return;
  printOnly(p.outerHTML.replace('id="poster"', 'id="posterPrint"'), "poster");
}

// План поездки: заголовок, итог бюджета, маршрут и все дни (раскрытые)
function printTrip() {
  $$("#tripDays details").forEach(d => d.open = true);
  const b = typeof lastBudget !== "undefined" && lastBudget;
  const route = tripRoute.map(r => `${esc(cityName(CITY[r.id]))} (${r.nights} ${t("nights")})`).join(" → ");
  const start = typeof tripStartDate === "function" && tripStartDate();
  const days = $("#tripDays")?.cloneNode(true);
  days?.querySelectorAll("button, .btn, .leaflet-container, [data-noprint]").forEach(el => el.remove());
  printOnly(`
    <header class="pr-head"><b>HAMYOL</b><span>${start ? start.toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "long", year: "numeric" }) : ""}</span></header>
    <h1>${t("trip_days")}</h1>
    <p class="pr-route">${route}</p>
    ${b ? `<p class="pr-total">${t("total")}: <b>${money(b.total)}</b> · ${money(b.total / b.people)} ${t("per_person")} · ${t("summary", { days: b.days, nights: b.nights, km: fmtNum(b.distance) })}</p>` : ""}
    <div class="pr-days">${days ? days.innerHTML : ""}</div>`, "trip");
}

document.addEventListener("click", e => {
  if (e.target.closest("[data-poster-print]")) { e.stopImmediatePropagation(); return printPoster(); }
  if (e.target.closest("#tripPrint")) { e.stopImmediatePropagation(); return printTrip(); }
}, true);
