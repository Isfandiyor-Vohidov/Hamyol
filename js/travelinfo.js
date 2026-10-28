// Справка для туриста: поезда между городами (#trains), «Безопасно ли?» (#safety)
// и кнопки партнёров — eSIM и страховка (адреса из /api/config: ESIM_URL, INSURANCE_URL; пусто — кнопок нет).
// Тексты: uz, ru, en; для остальных языков — английский.
const TX = v => isUz() ? v[0] : LANG === "ru" ? v[1] : v[2];
const RAIL_URL = "https://eticket.uzrailpass.uz";

// ---------- Поезда ----------
// Время в пути — примерное (по расписанию последних лет); точное — на uzrailpass.uz
const TRAINS = [
  ["Ташкент", "Самарканд", [["afrosiyob", "2:10"], ["sharq", "3:30"]]],
  ["Ташкент", "Бухара", [["afrosiyob", "3:50"], ["sharq", "6:30"]]],
  ["Самарканд", "Бухара", [["afrosiyob", "1:40"], ["sharq", "2:50"]]],
  ["Ташкент", "Хива", [["fast", "14:00"]]],
  ["Бухара", "Хива", [["fast", "6:30"]]],
  ["Ташкент", "Нукус", [["fast", "15:00"]]],
  ["Ташкент", "Андижан", [["fast", "5:30"]]],
  ["Ташкент", "Термез", [["fast", "13:00"]]],
  ["Самарканд", "Карши", [["fast", "2:30"]]]
];
const TRAIN_KIND = {
  afrosiyob: { ic: "train-fast", name: "Afrosiyob" },
  sharq: { ic: "train", name: "Sharq" },
  fast: { ic: "train", name: null }
};
const durTxt = s => { const [h, m] = s.split(":").map(Number); return t("tn_dur", { h, m: String(m).padStart(2, "0") }); };

function openTrains() {
  const name = ru => { const c = byRu(ru); return c ? esc(cityName(c)) : ru; };
  const cities = [...new Set(TRAINS.flatMap(([from, to]) => [from, to]))].sort((a, b) => name(a).localeCompare(name(b), LOCALE[LANG]));
  const rows = (from, to, kind) => TRAINS.flatMap(([a, b, options]) => {
    if ((from && a !== from) || (to && b !== to)) return [];
    const available = options.filter(([routeKind]) => !kind || routeKind === kind);
    if (!available.length) return [];
    return [`<article class="tn-row">
      <h3 class="tn-cities"><b>${name(a)}</b>${icon("arrow-right")}<b>${name(b)}</b></h3>
      <div class="tn-opts">${available.map(([routeKind, duration]) => `
        <div class="tn-option">${icon(TRAIN_KIND[routeKind].ic)}<b>${TRAIN_KIND[routeKind].name || t("tn_regular")}</b><span>≈ ${durTxt(duration)}</span></div>`).join("")}</div>
    </article>`];
  }).join("");
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-c);min-height:150px;padding-top:60px"><h2>${icon("train-fast")} ${t("tn_title")}</h2></div>
    <div class="m-body">
      <p class="hint">${t("tn_sub")}</p>
      <div class="tn-filters">
        <label><span>${t("tn_filter_from")}</span><select id="tnFrom"><option value="">${t("tn_filter_any_city")}</option>${cities.map(c => `<option value="${esc(c)}">${name(c)}</option>`).join("")}</select></label>
        <label><span>${t("tn_filter_to")}</span><select id="tnTo"><option value="">${t("tn_filter_any_city")}</option>${cities.map(c => `<option value="${esc(c)}">${name(c)}</option>`).join("")}</select></label>
        <label><span>${t("tn_filter_train")}</span><select id="tnKind">
          <option value="">${t("tn_filter_any_train")}</option>
          ${Object.entries(TRAIN_KIND).map(([k, v]) => `<option value="${k}">${v.name || t("tn_regular")}</option>`).join("")}
        </select></label>
        <button type="button" class="btn ghost tn-reset" id="tnReset">${t("tn_filter_reset")}</button>
      </div>
      <p class="hint tn-empty hidden" id="tnEmpty">${t("tn_no_routes")}</p>
      <div class="tn-list" id="tnList"></div>
      <p class="tn-note">${icon("info")}<span>${t("tn_note")}</span></p>
      <a class="btn gold-btn tn-buy" href="${RAIL_URL}" target="_blank" rel="noopener" data-track="rail" data-key="app:rail">${icon("arrow-up-right")} ${t("tn_buy")}</a>
    </div>`);
  const update = () => {
    $("#tnList").innerHTML = rows($("#tnFrom").value, $("#tnTo").value, $("#tnKind").value);
    $("#tnEmpty").classList.toggle("hidden", !!$("#tnList").childElementCount);
  };
  ["#tnFrom", "#tnTo", "#tnKind"].forEach(selector => $(selector).addEventListener("change", update));
  $("#tnReset").addEventListener("click", () => {
    $("#tnFrom").value = "";
    $("#tnTo").value = "";
    $("#tnKind").value = "";
    update();
  });
  update();
}

// ---------- Безопасно ли? ----------
const SAFETY = [
  ["file-text", ["Viza va ro'yxatdan o'tish", "Виза и регистрация", "Visa and registration"],
    ["Ko'plab davlatlar fuqarolari (YeI, Turkiya, Koreya va boshqalar) vizasiz kirishi mumkin, qolganlar uchun e-viza: e-visa.gov.uz. Mehmonxona sizni o'zi ro'yxatdan o'tkazadi. Tanishlarnikida yashasangiz — ro'yxatdan o'tish kerak, muddat va tartibni emehmon.uz da aniqlang.",
     "Гражданам многих стран (ЕС, Турция, Корея и др.) виза не нужна, для остальных — электронная виза на e-visa.gov.uz. Гостиница регистрирует вас сама. Если живёте у знакомых — нужна регистрация, сроки и порядок уточните на emehmon.uz.",
     "Citizens of many countries (EU, Turkey, Korea and others) need no visa; others can get an e-visa at e-visa.gov.uz. Hotels register you automatically. If you stay with friends, you must register — check the rules and deadlines at emehmon.uz."]],
  ["wallet", ["Pul va kartalar", "Деньги и карты", "Money and cards"],
    ["Valyuta — so'm. Visa va Mastercard yirik mehmonxona va restoranlarda qabul qilinadi, bozor va taksida — naqd pul. Bankomatlar shaharlarda bor. Pulni faqat bank va rasmiy shoxobchalarda almashtiring — ko'chada almashtirish noqonuniy.",
     "Валюта — сум. Visa и Mastercard принимают в крупных отелях и ресторанах, на базарах и в такси — только наличные. Банкоматы есть в городах. Меняйте деньги только в банках и официальных обменниках — обмен «с рук» на улице незаконен.",
     "The currency is the sum. Visa and Mastercard work in large hotels and restaurants; bazaars and taxis are cash only. ATMs are common in cities. Exchange money only at banks and official booths — street exchange is illegal."]],
  ["smartphone", ["Internet va SIM", "Интернет и SIM-карта", "Internet and SIM"],
    ["SIM-kartani pasport bilan operator ofisida olish mumkin (Ucell, Beeline, Mobiuz, Uzmobile). Qulayroq — safardan oldin eSIM olish: aeroportdan chiqishingiz bilan internet bo'ladi.",
     "SIM-карту продают по паспорту в офисах операторов (Ucell, Beeline, Mobiuz, Uzmobile). Проще — купить eSIM до поездки: интернет будет сразу после посадки.",
     "SIM cards are sold with your passport at operator stores (Ucell, Beeline, Mobiuz, Uzmobile). Easier: buy an eSIM before the trip and have internet as soon as you land."], "esim"],
  ["car", ["Taksi", "Такси", "Taxi"],
    ["Yandex Go'da narx oldindan ma'lum — bu eng xotirjam yo'l. Ko'chadagi taksida narxni o'tirishdan oldin kelishib oling. Odatiy narxni «Joyidagi narxlar» bo'limida tekshiring.",
     "В Yandex Go цена известна заранее — это самый спокойный вариант. С уличным таксистом договаривайтесь о цене до посадки. Нормальную цену проверьте в разделе «Цены на месте».",
     "Yandex Go shows the price upfront — the calmest option. With street taxis, agree on the fare before getting in. Check the fair price in «Prices on the spot»."]],
  ["glass-water", ["Suv va ovqat", "Вода и еда", "Water and food"],
    ["Vodoprovod suvini ichmang — butilkadagi suv arzon va hamma joyda bor. Palov an'anaviy tarzda tushlikda yeyiladi. Yozda ko'cha ovqatiga ehtiyot bo'ling: odam ko'p bo'lgan joyni tanlang.",
     "Воду из-под крана не пейте — бутилированная дешёвая и продаётся везде. Плов традиционно едят в обед. Летом осторожнее с уличной едой: выбирайте места, где много людей.",
     "Don't drink tap water — bottled water is cheap and everywhere. Plov is traditionally a lunch dish. In summer, be careful with street food: choose busy places."]],
  ["users", ["Ayollar uchun", "Женщинам", "For women"],
    ["O'zbekiston umuman xavfsiz mamlakat, mehmondo'st. Masjid va mahallalarda yelka va tizzalarni yopib yuring, masjidga ro'mol oling. Kechasi rasmiy taksidan foydalaning.",
     "Узбекистан в целом безопасная и гостеприимная страна. В мечетях и махаллях закрывайте плечи и колени, в мечеть возьмите платок. Вечером пользуйтесь официальным такси.",
     "Uzbekistan is generally safe and very hospitable. Cover shoulders and knees in mosques and traditional neighbourhoods, bring a headscarf for mosques. Use official taxis at night."]],
  ["camera", ["Suratga olish", "Фото и съёмка", "Photos"],
    ["Odamlarni suratga olishdan oldin ruxsat so'rang. Harbiy va chegara obyektlarini suratga olmang. Ba'zi muzey va madrasalarda suratga olish pullik.",
     "Людей фотографируйте с их разрешения. Военные и пограничные объекты снимать нельзя. В некоторых музеях и медресе съёмка платная.",
     "Ask before photographing people. Do not photograph military or border sites. Some museums and madrasas charge a photo fee."]],
  ["siren", ["Favqulodda", "Экстренные случаи", "Emergencies"],
    ["101 — o't o'chirish, 102 — militsiya, 103 — tez yordam. Pasport nusxasini telefonda saqlang.",
     "101 — пожарные, 102 — полиция, 103 — скорая. Держите копию паспорта в телефоне.",
     "101 — fire, 102 — police, 103 — ambulance. Keep a copy of your passport on your phone."], "insurance"]
];

function partnerBtn(kind) {
  const url = SAFAR_CONFIG?.[kind === "esim" ? "esimUrl" : "insuranceUrl"];
  if (!url) return "";
  return `<a class="btn ghost small pt-btn" href="${esc(url)}" target="_blank" rel="noopener sponsored" data-track="${kind}" data-key="app:${kind}">${icon(kind === "esim" ? "wifi" : "shield")} ${t(kind === "esim" ? "pt_esim" : "pt_insurance")}</a>`;
}

function openSafety() {
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-u);min-height:150px;padding-top:60px"><h2>${icon("shield")} ${t("sf_title")}</h2></div>
    <div class="m-body">
      <p class="hint">${t("sf_sub")}</p>
      <div class="sf-list">${SAFETY.map(([ic, title, text, partner], i) => `
        <details class="sf-item" ${i === 0 ? "open" : ""}>
          <summary><i>${icon(ic)}</i><b>${TX(title)}</b></summary>
          <p>${TX(text)}</p>
          ${partner ? partnerBtn(partner) : ""}
          ${ic === "siren" ? `<a class="btn ghost small" href="#guide/sos">${icon("phone")} ${t("sos")}</a>` : ""}
          ${ic === "car" ? `<a class="btn ghost small" href="#prices">${icon("wallet")} ${t("pr_title")}</a>` : ""}
        </details>`).join("")}</div>
      <p class="tn-note">${icon("info")}<span>${t("sf_note")}</span></p>
    </div>`);
}

// ---------- Подключение ----------
EXT.routes.trains = openTrains;
EXT.routes.safety = openSafety;
EXT.homeTiles.push(() => ["#safety", "shield", t("sf_title"), t("sf_tile")]);
EXT.homeTiles.push(() => ["#trains", "train-fast", t("tn_title"), t("tn_tile")]);

// «Перед поездкой» во вкладке «Поездка»: поезда, безопасность и партнёры (если заданы)
function renderTripExtras() {
  const tab = $("#tab-budget");
  if (!tab) return;
  let box = $("#tripExtras");
  if (!box) {
    const split = $("#splitBox");
    split ? split.insertAdjacentHTML("beforebegin", `<section class="panel trip-extras" id="tripExtras"></section>`)
      : tab.insertAdjacentHTML("beforeend", `<section class="panel trip-extras" id="tripExtras"></section>`);
    box = $("#tripExtras");
  }
  box.innerHTML = `
    <h3>${icon("plane")} ${t("pt_title")}</h3>
    <div class="trip-extras-btns">
      <a class="btn ghost small" href="#trains">${icon("train-fast")} ${t("tn_title")}</a>
      <a class="btn ghost small" href="#safety">${icon("shield")} ${t("sf_title")}</a>
      ${partnerBtn("esim")}${partnerBtn("insurance")}
    </div>`;
}
EXT.onInit.push(renderTripExtras);
EXT.onLang.push(renderTripExtras);
EXT.onConfig.push(renderTripExtras);

// Внутри Telegram внешние сайты (билеты, такси, бронирование) открываем во встроенном браузере Telegram —
// поверх Safar: купил, закрыл крестиком и снова в приложении. t.me-ссылки Telegram открывает сам.
document.addEventListener("click", e => {
  const a = e.target.closest("a[href^='http']");
  if (!a || typeof WA === "undefined" || !WA?.openLink || a.host === location.host) return;
  if (/^(t\.me|telegram\.me)$/.test(a.hostname)) { if (WA.openTelegramLink) { e.preventDefault(); WA.openTelegramLink(a.href); } return; }
  e.preventDefault();
  WA.openLink(a.href);
});
