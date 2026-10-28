// «Когда людно» на странице места: график по часам из отметок «Я здесь» (server/crowd.js).
// Отметиться можно, только находясь в 300 м от места (геолокация с согласием), раз в день.
// Пока отметок мало — честно пишем «мало данных» и зовём отметиться.
const CROWD_M = 300;
const crowdMarked = () => store.get("safar_crowd", {});

EXT.placeExtras.push(p => {
  if (!location.protocol.startsWith("http") || !p.key || p.c === "h") return "";
  setTimeout(() => renderCrowd(p));
  return `<section class="crowd" id="crowdBox" data-crowd-key="${esc(p.key)}">
    <h3 class="sec-title">${icon("users")} ${t("crowd_title")}</h3><div class="crowd-body"><div class="skeleton"></div></div>
  </section>`;
});

function crowdChart(s) {
  const from = 7, to = 22, hs = s.hours.slice(from, to + 1), max = Math.max(...hs, 1);
  const now = s.hour >= from && s.hour <= to ? s.hours[s.hour] / max : null;
  const level = now == null ? "" : now >= .66 ? "crowd_busy" : now >= .33 ? "crowd_mid" : "crowd_calm";
  return `${level ? `<p class="crowd-now ${level}">${icon("clock")} ${t("crowd_now")}: <b>${t(level)}</b></p>` : ""}
    <div class="crowd-bars" role="img" aria-label="${t("crowd_title")}">${hs.map((v, i) => `
      <i class="${from + i === s.hour ? "now" : ""}" style="--h:${Math.max(4, Math.round(v / max * 100))}%" title="${from + i}:00"></i>`).join("")}</div>
    <div class="crowd-axis"><span>${from}:00</span><span>12:00</span><span>17:00</span><span>${to}:00</span></div>`;
}

async function renderCrowd(p, data) {
  const box = $("#crowdBox");
  if (!box || box.dataset.crowdKey !== p.key) return;
  let s = data;
  if (!s) try { s = await getJSON("/api/crowd?key=" + encodeURIComponent(p.key)); } catch { s = null; }
  if (!box.isConnected) return;
  if (!s) { box.remove(); return; }
  const today = new Date().toISOString().slice(0, 10), done = crowdMarked()[p.key] === today;
  box.querySelector(".crowd-body").innerHTML = `
    ${s.hours ? crowdChart(s) : `<p class="hint">${t("crowd_few", { n: s.n, min: s.min })}</p>`}
    <button type="button" class="btn small ${done ? "ghost" : "gold-btn"}" data-crowd-mark="${esc(p.key)}" ${done ? "disabled" : ""}>
      ${icon(done ? "badge-check" : "pin")} ${t(done ? "crowd_done" : "crowd_here")}</button>
    <p class="hint crowd-note">${icon("shield")} ${t("crowd_private")}</p>`;
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-crowd-mark]");
  if (!b) return;
  const p = POI[b.dataset.crowdMark.replace(/^poi:/, "")];
  if (!p) return;
  b.disabled = true;
  try {
    const me = await locate();
    const m = km(me, p) * 1000;
    if (m > CROWD_M) { b.disabled = false; return toast(t("crowd_far", { km: (m / 1000).toFixed(m < 10000 ? 1 : 0) })); }
    const s = await api("/api/crowd", { method: "POST", body: JSON.stringify({ key: b.dataset.crowdMark, lat: me.lat, lon: me.lon }) });
    store.set("safar_crowd", { ...crowdMarked(), [b.dataset.crowdMark]: new Date().toISOString().slice(0, 10) });
    navigator.vibrate?.(15);
    toast(t("crowd_thanks"));
    renderCrowd(p, s);
  } catch (err) {
    b.disabled = false;
    if (err?.message !== "no consent") toast(err?.status ? t("crowd_err") : t("geo_denied"));
  }
});
