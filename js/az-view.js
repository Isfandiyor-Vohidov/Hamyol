// Просмотр на весь экран в приложении «Азербайджан»: фото обложки (нажать — открыть, двумя пальцами — приблизить)
// и «Прогулка по улице» — панорама улиц Google (как человечек в Google Картах), прямо в приложении.
// Окно поверх экрана: закрыли — вы на том же месте страницы. Кнопка «Назад» телефона тоже закрывает окно.
// Подключается до js/az-app.js; всё из приложения берётся при вызове.
const VIEW_TX = {
  close: ["Закрыть", "Close"], zoom: ["Нажмите на фото — посмотреть целиком", "Tap the photo to see it in full"],
  pano: ["Прогулка по улице (360°)", "Walk the street (360°)"], pano_sub: ["Осмотритесь и пройдитесь, как в Google Картах", "Look around and walk, like in Google Maps"],
  pano_hint: ["Тяните пальцем — осмотреться. Нажмите на дорогу — пройти вперёд.", "Drag to look around. Tap the road to walk forward."],
  pano_off: ["Прогулка по улице работает только с интернетом.", "Street walk needs the internet."],
  pano_none: ["Панорама загружается 5–10 секунд. Если и потом серый экран — рядом с этим местом панорамы нет.", "The panorama takes 5–10 seconds to load. If it stays grey, there is no panorama near this place."],
  src: ["Фото: Wikimedia Commons", "Photo: Wikimedia Commons"], pinch: ["Двумя пальцами — приблизить", "Pinch to zoom"]
};
const vt = k => VIEW_TX[k][LANG === "en" ? 1 : 0];
let VIEW_OPEN = false;

function viewOpen(html, cls) {
  viewClose(true);
  document.body.insertAdjacentHTML("beforeend", `<div class="az-view ${cls}" id="azView" role="dialog" aria-modal="true">${html}
    <button type="button" class="az-view-x" data-view-close>${icon("x")} ${vt("close")}</button></div>`);
  document.documentElement.classList.add("view-on");
  // «Назад» на телефоне закрывает окно, а не уводит со страницы
  if (!VIEW_OPEN) history.pushState({ azView: 1 }, "");
  VIEW_OPEN = true;
}
function viewClose(quiet) {
  const el = $("#azView");
  if (!el) return;
  el.remove();
  document.documentElement.classList.remove("view-on");
  if (!quiet && VIEW_OPEN) { VIEW_OPEN = false; if (history.state?.azView) history.back(); }
}
addEventListener("popstate", () => { if (VIEW_OPEN) { VIEW_OPEN = false; viewClose(true); } });
document.addEventListener("click", e => { if (e.target.closest("[data-view-close]")) viewClose(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && VIEW_OPEN) viewClose(); });

// ---------- Фото целиком ----------
function photoOpen(file, name) {
  const big = commonsImg(file, Math.min(2560, Math.ceil(innerWidth * (devicePixelRatio || 1) / 320) * 320 * 2 || 1280));
  viewOpen(`<div class="az-view-stage" id="viewStage"><img id="viewImg" alt="${esc(name)}" src="${commonsImg(file, 640)}" draggable="false"></div>
    <div class="az-view-cap"><b>${esc(name)}</b><small>${vt("pinch")} · <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}" target="_blank" rel="noopener">${vt("src")}</a></small></div>`, "photo");
  // сначала маленькое (уже в кэше) — сразу видно, потом подменяем на чёткое
  const img = new Image();
  img.onload = () => { const el = $("#viewImg"); if (el) el.src = big; };
  img.src = big;
  photoZoom($("#viewStage"), $("#viewImg"));
}
// Приближение: двумя пальцами или колесом; двойное нажатие — ×2 / обратно; одним пальцем — двигать приближенное
function photoZoom(stage, img) {
  let s = 1, x = 0, y = 0, last = 0;
  const pts = new Map();
  let start = null;
  const apply = () => { s = Math.min(6, Math.max(1, s)); if (s === 1) { x = 0; y = 0; } img.style.transform = `translate(${x}px, ${y}px) scale(${s})`; };
  const snap = () => ({ s, x, y, pts: [...pts.values()].map(p => ({ ...p })) });
  const dist = a => Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  stage.addEventListener("pointerdown", e => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = snap();
    if (pts.size === 1) {
      const now = Date.now();
      if (now - last < 300) { s = s > 1 ? 1 : 2.5; apply(); start = snap(); }
      last = now;
    }
  });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = [...pts.values()];
    if (now.length >= 2 && start.pts.length >= 2) {
      s = start.s * dist(now) / (dist(start.pts) || 1);
      x = start.x + ((now[0].x + now[1].x) - (start.pts[0].x + start.pts[1].x)) / 2;
      y = start.y + ((now[0].y + now[1].y) - (start.pts[0].y + start.pts[1].y)) / 2;
    } else if (now.length === 1 && s > 1) {
      x = start.x + now[0].x - start.pts[0].x;
      y = start.y + now[0].y - start.pts[0].y;
    }
    apply();
  });
  const up = e => { pts.delete(e.pointerId); start = snap(); };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", e => { e.preventDefault(); s *= e.deltaY < 0 ? 1.15 : 1 / 1.15; apply(); }, { passive: false });
}
// Нажали на обложку города или места — открыть фото
document.addEventListener("click", e => {
  const c = e.target.closest(".az-cover[data-cover]");
  if (!c || e.target.closest("a, button")) return;
  photoOpen(c.dataset.cover, c.querySelector("h1")?.textContent || "");
});

// ---------- Прогулка по улице ----------
const panoBtn = (la, lo, name) => `<button type="button" class="az-row pano-row" data-pano="${la},${lo}" data-pano-n="${esc(name)}">${icon("walk")}<div><b>${vt("pano")}</b><small>${vt("pano_sub")}</small></div>${icon("chevron-right", "go")}</button>`;
function panoOpen(la, lo, name) {
  if (!navigator.onLine) return toast(vt("pano_off"));
  const src = `https://maps.google.com/maps?layer=c&cbll=${la},${lo}&cbp=12,0,0,0,0&output=svembed&hl=${LANG === "en" ? "en" : "ru"}`;
  viewOpen(`<iframe class="az-view-pano" src="${src}" title="${esc(vt("pano"))}" allow="fullscreen; accelerometer; gyroscope" referrerpolicy="no-referrer-when-downgrade"></iframe>
    <div class="az-view-cap"><b>${esc(name)}</b><small>${vt("pano_hint")} ${vt("pano_none")}</small></div>`, "pano");
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-pano]");
  if (!b) return;
  const [la, lo] = b.dataset.pano.split(",").map(Number);
  panoOpen(la, lo, b.dataset.panoN || "");
});
