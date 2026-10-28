// Быстрые фильтры отелей (как в Booking): кнопки над списком — цена за ночь, с отзывами (когда они есть), с телефоном.
// Нажатие включает/выключает; цена — в валюте приложения. Выбор запоминается на устройстве.
const HQ_PRICES = [20, 40, 70];
let hq = { max: 0, reviews: false, phone: false, ...store.get("safar_hotel_quick", {}), photo: false };

function hotelQuickOk(p) {
  if (hq.max && !(p.usd > 0 && p.usd <= hq.max)) return false;
  if (hq.reviews && !Reviews.rating(p.key).count) return false;
  if (hq.photo && !(p.photo || p.im)) return false;
  if (hq.phone && !p.ph) return false;
  return true;
}

function renderHotelQuick() {
  const anchor = $("#hotelFound")?.closest("p");
  if (!anchor) return;
  let box = $("#hotelQuick");
  if (!box) { anchor.insertAdjacentHTML("beforebegin", `<div class="hq" id="hotelQuick" role="group"></div>`); box = $("#hotelQuick"); }
  const chip = (attr, on, html) => `<button type="button" class="chip ${on ? "on" : ""}" ${attr} aria-pressed="${on}">${html}</button>`;
  box.innerHTML = HQ_PRICES.map(v => chip(`data-hq-max="${v}"`, hq.max === v, `${icon("wallet")} ${t("hq_upto", { p: money(usd(v)) })}`)).join("")
    + (hq.reviews || POIS.some(x => x.c === "h" && Reviews.rating(x.key).count) ? chip(`data-hq="reviews"`, hq.reviews, `${icon("star")} ${t("hq_reviews")}`) : "")
    + chip(`data-hq="phone"`, hq.phone, `${icon("phone")} ${t("hq_phone")}`)
    + (hq.max || hq.reviews || hq.phone ? chip(`data-hq-reset`, false, `${icon("x")} ${t("hq_reset")}`) : "");
}

document.addEventListener("click", e => {
  const b = e.target.closest("#hotelQuick [data-hq-max], #hotelQuick [data-hq], #hotelQuick [data-hq-reset]");
  if (!b) return;
  if (b.dataset.hqReset != null) hq = { max: 0, reviews: false, photo: false, phone: false };
  else if (b.dataset.hqMax) hq.max = hq.max === +b.dataset.hqMax ? 0 : +b.dataset.hqMax;
  else hq[b.dataset.hq] = !hq[b.dataset.hq];
  store.set("safar_hotel_quick", hq);
  renderHotelQuick();
  renderHotels();
});

EXT.onInit.push(renderHotelQuick);
EXT.onLang.push(renderHotelQuick);
EXT.onBudget.push(renderHotelQuick);   // курсы и валюта обновились — цены в кнопках тоже
