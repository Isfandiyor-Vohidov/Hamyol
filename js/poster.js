// QR-постер для печати (#poster или #poster/<id места>): отель вешает его на ресепшене — гости открывают Safar.
// QR рисует библиотека qrcode-generator (грузится только на этой странице).
const QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
function loadQrLib() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = QR_LIB; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}
// Флаги рисуем сами (SVG): эмодзи-флаги на Windows показываются буквами «UZ», «RU»
const flag = body => `<svg class="flag" viewBox="0 0 30 20" aria-hidden="true"><clipPath id="fc"><rect width="30" height="20" rx="3"/></clipPath><g clip-path="url(#fc)">${body}</g></svg>`;
const FLAGS = {
  uz: flag(`<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.4" fill="#0099b5"/><rect y="13.6" width="30" height="6.4" fill="#1eb53a"/>
    <rect y="6.4" width="30" height=".6" fill="#ce1126"/><rect y="13" width="30" height=".6" fill="#ce1126"/>
    <circle cx="5.2" cy="3.2" r="2.2" fill="#fff"/><circle cx="6" cy="3.2" r="2" fill="#0099b5"/>
    <g fill="#fff">${[[9, 1.6], [11, 1.6], [13, 1.6], [10, 3.2], [12, 3.2], [14, 3.2], [11, 4.8], [13, 4.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".45"/>`).join("")}</g>`),
  ru: flag(`<rect width="30" height="20" fill="#fff"/><rect y="6.67" width="30" height="6.67" fill="#0039a6"/><rect y="13.33" width="30" height="6.67" fill="#d52b1e"/>`),
  gb: flag(`<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/>
    <path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.6"/>`),
  kr: flag(`<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#0047a0"/><path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0" fill="#cd2e3a"/>
    <g stroke="#000" stroke-width="1"><path d="M4 4l3-2.4M5 5.3l3-2.4M6 6.6l3-2.4M21 15.8l3-2.4M22 17.1l3-2.4M23 18.4l3-2.4M4 16l3 2.4M5 14.7l3 2.4M23 1.6l3 2.4M22 2.9l3 2.4"/></g>`),
  cn: flag(`<rect width="30" height="20" fill="#de2910"/><path d="M5 2.2l1.1 3.4h3.6l-2.9 2.1 1.1 3.4L5 9l-2.9 2.1 1.1-3.4L.3 5.6h3.6z" fill="#ffde00"/>
    <g fill="#ffde00">${[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".8"/>`).join("")}</g>`),
  tr: flag(`<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/>
    <path d="M16.5 10l3.6-1.2-2.2 3.1V8.1l2.2 3.1z" fill="#fff"/>`)
};
const POSTER_LANGS = [
  ["uz", "Sayohat qo‘llanmasi"], ["ru", "Путеводитель по Узбекистану"], ["gb", "Travel guide to Uzbekistan"],
  ["kr", "우즈베키스탄 여행 가이드"], ["cn", "乌兹别克斯坦旅行指南"], ["tr", "Özbekistan gezi rehberi"]
];

async function openPoster(id) {
  const p = POI[id];
  const base = (SAFAR_CONFIG?.publicUrl || location.origin).replace(/\/+$/, "");
  // Метка ?from= — в статистике видно, сколько людей пришло с постера этого места (js/stats.js)
  const url = p ? `${base}/place/${p.id}?from=poster_${p.id}` : `${base}/?from=poster`;
  openModal(`
    <div class="m-body poster-wrap">
      <p class="hint poster-hint">${t("ps_hint")}</p>
      <div class="poster" id="poster">
        <div class="poster-brand">${icon("girih")}<span>HAMYOL</span></div>
        <h1>${p ? esc(poiName(p)) : "Uzbekistan · Oʻzbekiston"}</h1>
        <div class="poster-qr" id="posterQr"><div class="spinner"></div></div>
        <p class="poster-scan">${icon("smartphone")} Scan · Skanerlang · Отсканируйте</p>
        <div class="poster-langs">${POSTER_LANGS.map(([f, txt]) => `<span>${FLAGS[f]}<em>${txt}</em></span>`).join("")}</div>
        <p class="poster-feats">${["Offline", "Map · Karta", "Prices · Narxlar", "Taxi", "SOS"].map(x => `<span>${x}</span>`).join("")}</p>
        <p class="poster-url">${esc(url.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</p>
      </div>
    </div>`);
  // Кнопка «Печать» — внизу экрана, под пальцем (сверху её закрывают время, батарея и «Назад»).
  // Кладём в body: внутри окна (у него размытие фона) закреплённые элементы ведут себя неправильно.
  $("#posterBar")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="poster-tools" id="posterBar"><button type="button" class="btn gold-btn" data-poster-print>${icon("print")} ${t("ps_print")}</button></div>`);
  const bar = $("#posterBar"), gone = () => { if (!$("#poster") || $("#modal").classList.contains("hidden")) { bar.remove(); obs.disconnect(); } };
  const obs = new MutationObserver(gone);
  obs.observe($("#modal"), { attributes: true, attributeFilter: ["class"] });
  obs.observe($("#modalBody"), { childList: true });
  try {
    await loadQrLib();
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    $("#posterQr").innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch {
    $("#posterQr").innerHTML = `<p class="hint">${t("ps_noqr")}</p>`;
  }
}
document.addEventListener("click", e => { if (e.target.closest("[data-poster-print]")) window.print(); });
EXT.routes.poster = openPoster;
