// «Дневник поездки» (#diary), как в Polarsteps: из штампов паспорта (js/passport.js) — маршрут на карте,
// города по датам, цифры поездки и картинка, которой можно поделиться (рисуется на устройстве, без фото —
// чужие картинки на холст не кладём). Всё хранится только на этом устройстве.
function diaryData() {
  const v = typeof visits === "function" ? visits() : store.get("safar_visits", {});
  const stops = Object.entries(v).filter(([id]) => CITY[id]).sort((a, b) => a[1] - b[1]).map(([id, ts]) => ({ c: CITY[id], ts }));
  let kmTotal = 0;
  for (let i = 1; i < stops.length; i++) kmTotal += km(stops[i - 1].c, stops[i].c) * 1.25;   // по дорогам ~ на четверть длиннее
  const days = stops.length ? Math.max(1, Math.round((stops.at(-1).ts - stops[0].ts) / 864e5) + 1) : 0;
  const medals = typeof MEDALS !== "undefined" ? MEDALS.filter(m => m.need()).length : 0;
  return { stops, kmTotal: Math.round(kmTotal), days, medals };
}

function openDiary() {
  const d = diaryData();
  const date = ts => new Date(ts).toLocaleDateString(LOCALE[LANG], { day: "numeric", month: "long" });
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-c);min-height:150px;padding-top:60px"><h2>${icon("route")} ${t("dy_title")}</h2><p>${t("dy_sub")}</p></div>
    <div class="m-body">
      ${d.stops.length ? `
        <div class="dy-stats">
          <div><b>${d.stops.length}</b><span>${t("dy_cities")}</span></div>
          <div><b>${fmtNum(d.kmTotal)}</b><span>${t("dy_km")}</span></div>
          <div><b>${d.days}</b><span>${t("dy_days")}</span></div>
          <div><b>${d.medals}</b><span>${t("pp_medals")}</span></div>
        </div>
        <div id="diaryMap"></div>
        <ol class="dy-line">${d.stops.map((s, i) => `
          <li style="--n:${i}"><a href="#city/${s.c.id}" class="dy-stop">
            <span class="dy-ph" style="${s.c.img ? `background-image:url('${commonsImg(s.c.img, 320)}')` : `background:${regionBg(s.c.r)}`}"></span>
            <span><b>${esc(cityName(s.c))}</b><small>${date(s.ts)} · ${esc(regionName(s.c.r))}</small></span></a></li>`).join("")}</ol>
        <button type="button" class="btn gold-btn dy-share" data-dy-share>${icon("share")} ${t("dy_share")}</button>
        <p class="hint">${icon("shield")} ${t("pp_private")}</p>`
      : `<div class="tk-empty">${icon("route")}<p>${t("dy_empty")}</p><a class="btn ghost" href="#passport">${icon("award")} ${t("pp_title")}</a></div>`}
    </div>`);
  if (d.stops.length && typeof makeMap === "function" && window.L) {
    const pts = d.stops.map(s => [s.c.lat, s.c.lon]);
    const m = makeMap("diaryMap", { scrollWheelZoom: false });
    L.polyline(pts, { color: "#e6b450", weight: 4, dashArray: "8 8" }).addTo(m);
    d.stops.forEach((s, i) => L.marker(pts[i], { icon: L.divIcon({ className: "", html: `<div class="dy-pin">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(m));
    pts.length > 1 ? m.fitBounds(pts, { padding: [30, 30] }) : m.setView(pts[0], 10);
  }
}

// Картинка для соцсетей 1080×1350: тёмно-синий фон, золото, города и цифры
async function diaryImage() {
  const d = diaryData(), c = document.createElement("canvas");
  c.width = 1080; c.height = 1350;
  const g = c.getContext("2d"), font = (w, s) => `${w} ${s}px Montserrat, system-ui, sans-serif`;
  const bg = g.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, "#14305a"); bg.addColorStop(1, "#0b1f3a");
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
  g.strokeStyle = "rgba(230,180,80,.18)"; g.lineWidth = 2;   // лёгкий узор-звезда
  for (let y = 60; y < 1350; y += 140) for (let x = (y / 140 % 2) * 70 + 40; x < 1080; x += 140) {
    g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 10 : 26, a = k * Math.PI / 4; g[k ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath(); g.stroke();
  }
  g.fillStyle = "#e6b450"; g.font = font(800, 54); g.fillText("S A F A R", 80, 140);
  g.fillStyle = "#fff"; g.font = font(800, 76); g.fillText(t("dy_card_title"), 80, 270);
  const stats = [[d.stops.length, t("dy_cities")], [fmtNum(d.kmTotal), t("dy_km")], [d.days, t("dy_days")]];
  stats.forEach(([n, l], i) => { const x = 80 + i * 320; g.fillStyle = "#e6b450"; g.font = font(800, 72); g.fillText(String(n), x, 420); g.fillStyle = "#b9c8de"; g.font = font(600, 30); g.fillText(l, x, 465); });
  g.fillStyle = "#fff"; g.font = font(700, 44);
  d.stops.slice(0, 9).forEach((s, i) => {
    const y = 580 + i * 72;
    g.fillStyle = "#e6b450"; g.beginPath(); g.arc(102, y - 14, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0b1f3a"; g.font = font(800, 22); g.textAlign = "center"; g.fillText(String(i + 1), 102, y - 6); g.textAlign = "left";
    g.fillStyle = "#fff"; g.font = font(700, 42); g.fillText(cityName(s.c), 140, y);
  });
  if (d.stops.length > 9) { g.fillStyle = "#b9c8de"; g.font = font(600, 32); g.fillText(`+${d.stops.length - 9}`, 140, 580 + 9 * 72); }
  // Схема маршрута внизу — точки по настоящим координатам городов, соединённые золотой линией
  if (d.stops.length >= 2 && d.stops.length <= 6) {
    const box = { x: 120, y: 1010, w: 840, h: 200 };
    const lats = d.stops.map(s => s.c.lat), lons = d.stops.map(s => s.c.lon);
    const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
    const sx = box.w / Math.max(lo1 - lo0, .5), sy = box.h / Math.max(la1 - la0, .5), s = Math.min(sx, sy);
    const pt = c => [box.x + box.w / 2 + (c.lon - (lo0 + lo1) / 2) * s, box.y + box.h / 2 - (c.lat - (la0 + la1) / 2) * s];
    g.strokeStyle = "#e6b450"; g.lineWidth = 6; g.setLineDash([18, 14]); g.beginPath();
    d.stops.forEach((st, i) => { const [x, y] = pt(st.c); g[i ? "lineTo" : "moveTo"](x, y); }); g.stroke(); g.setLineDash([]);
    d.stops.forEach((st, i) => {
      const [x, y] = pt(st.c);
      g.fillStyle = "#e6b450"; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 4; g.stroke();
      g.fillStyle = "#dbe5f3"; g.font = font(700, 26); g.textAlign = "center"; g.fillText(cityName(st.c), x, y + (i % 2 ? 52 : -30)); g.textAlign = "left";
    });
  }
  g.fillStyle = "#b9c8de"; g.font = font(600, 30); g.fillText(location.host.replace(/^www\./, ""), 80, 1290);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.9));   // JPEG: в 4–5 раз легче PNG
}

document.addEventListener("click", async e => {
  if (!e.target.closest("[data-dy-share]")) return;
  const blob = await diaryImage();
  const file = new File([blob], "safar-diary.jpg", { type: "image/jpeg" });
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: t("dy_card_title"), text: location.origin });
  } catch { return; /* закрыли окно «Поделиться» */ }
  // Нет «Поделиться» с файлами (компьютер) — сохраняем картинку
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "safar-diary.jpg"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

EXT.routes.diary = openDiary;
// Кнопка в «Паспорте путешественника»
new MutationObserver(() => {
  const h = $("#modalBody .pp-stamps")?.previousElementSibling;
  if (h && !$("#modalBody [href='#diary']")) h.insertAdjacentHTML("beforebegin", `<a class="btn gold-btn dy-open" href="#diary">${icon("route")} ${t("dy_title")}</a>`);
}).observe(document.getElementById("modalBody"), { childList: true });
