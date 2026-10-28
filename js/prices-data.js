// Справочник «Цены на месте»: ориентиры в сумах для туристического города (Самарканд, Бухара, Хива).
// Это стартовые оценки, не точные данные: в приложении они помечены как «оценка», а когда путешественники
// присылают реальные цены (не меньше трёх по позиции), показывается медиана их сообщений.
// Поправка по городу — PRICE_TIER. Файл общий: его читает и браузер, и сервер (проверка присланных цен).
// n — название [uz, ru, en], x — [tr, de, zh, ko]; note/nx — подсказка в том же порядке.
const PRICE_GROUPS = {
  transport: { icon: "taxi", n: ["Transport", "Транспорт", "Transport"], x: ["Ulaşım", "Verkehr", "交通", "교통"] },
  food: { icon: "food", n: ["Ovqat", "Еда", "Food"], x: ["Yemek", "Essen", "餐饮", "음식"] },
  sights: { icon: "dome", n: ["Diqqatga sazovor joylar", "Достопримечательности", "Sights"], x: ["Gezilecek yerler", "Sehenswürdigkeiten", "景点", "명소"] },
  shopping: { icon: "shopping", n: ["Xaridlar", "Покупки", "Shopping"], x: ["Alışveriş", "Einkaufen", "购物", "쇼핑"] },
  connect: { icon: "smartphone", n: ["Aloqa", "Связь", "Connectivity"], x: ["İletişim", "Mobilfunk", "通讯", "통신"] }
};

const PRICE_ITEMS = [
  { id: "taxi_app", g: "transport", icon: "taxi", min: 15000, max: 30000,
    n: ["Ilova orqali taksi, shahar bo‘ylab ~5 km", "Такси по приложению, ~5 км по городу", "Ride-hailing taxi, ~5 km in town"],
    x: ["Uygulama taksisi, şehir içi ~5 km", "App-Taxi, ~5 km in der Stadt", "打车软件，市内约5公里", "앱 택시, 시내 약 5km"],
    note: ["Yandex Go yoki MyTaxi — narx oldindan ma’lum", "Yandex Go или MyTaxi — цена известна заранее", "Yandex Go or MyTaxi — price shown upfront"],
    nx: ["Yandex Go veya MyTaxi — fiyat önceden belli", "Yandex Go oder MyTaxi — Preis vorab sichtbar", "Yandex Go 或 MyTaxi——价格提前可见", "Yandex Go 또는 MyTaxi — 요금이 미리 표시됨"] },
  { id: "taxi_airport", g: "transport", icon: "plane", min: 40000, max: 90000,
    n: ["Aeroportdan markazga taksi (ilova)", "Такси из аэропорта в центр (по приложению)", "Airport to centre taxi (app)"],
    x: ["Havalimanından merkeze taksi (uygulama)", "Taxi vom Flughafen ins Zentrum (App)", "机场到市中心打车（软件）", "공항→시내 택시(앱)"],
    note: ["Chiqishdagi taksichilar ko‘pincha 3–5 baravar qimmat so‘raydi", "Таксисты у выхода часто просят в 3–5 раз больше", "Drivers at the exit often ask 3–5× more"],
    nx: ["Çıkıştaki taksiciler çoğu zaman 3–5 kat fazla ister", "Fahrer am Ausgang verlangen oft das 3–5-Fache", "出口处的司机常要价高出3–5倍", "출구의 기사들은 종종 3~5배를 부릅니다"] },
  { id: "metro", g: "transport", icon: "bus", min: 2000, max: 3500,
    n: ["Metro yoki shahar avtobusi, bir safar", "Метро или городской автобус, поездка", "Metro or city bus, one ride"],
    x: ["Metro veya şehir otobüsü, tek yolculuk", "Metro oder Stadtbus, eine Fahrt", "地铁或公交，单程", "지하철·시내버스 1회"] },
  { id: "shared_taxi", g: "transport", icon: "car", min: 30000, max: 60000,
    n: ["Shaharlararo yo‘ldosh taksi, 100 km uchun bir o‘rin", "Попутное такси между городами, место за 100 км", "Shared taxi between cities, seat per 100 km"],
    x: ["Şehirlerarası paylaşımlı taksi, 100 km koltuk", "Sammeltaxi zwischen Städten, Platz pro 100 km", "城际拼车，每100公里一个座位", "도시 간 합승 택시, 100km당 1석"] },
  { id: "plov", g: "food", icon: "pot", min: 30000, max: 55000,
    n: ["Bir porsiya osh (palov)", "Порция плова", "A plate of plov"],
    x: ["Bir porsiyon pilav", "Eine Portion Plov", "一份抓饭", "플로프 1인분"] },
  { id: "lunch", g: "food", icon: "food", min: 50000, max: 110000,
    n: ["Choyxonada tushlik, bir kishiga", "Обед в чайхане на одного", "Lunch at a teahouse, per person"],
    x: ["Çayhanede öğle yemeği, kişi başı", "Mittagessen im Teehaus pro Person", "茶馆午餐（每人）", "찻집 점심 1인"] },
  { id: "non", g: "food", icon: "wheat", min: 4000, max: 9000,
    n: ["Non (lepyoshka)", "Лепёшка (нон)", "Flatbread (non)"],
    x: ["Pide ekmeği (non)", "Fladenbrot (Non)", "馕饼", "난(빵)"] },
  { id: "samsa", g: "food", icon: "cake", min: 6000, max: 13000,
    n: ["Somsa", "Самса", "Samsa"], x: ["Samsa", "Samsa", "烤包子", "삼사"] },
  { id: "tea", g: "food", icon: "teapot", min: 5000, max: 12000,
    n: ["Bir choynak choy", "Чайник чая", "A pot of tea"], x: ["Bir demlik çay", "Eine Kanne Tee", "一壶茶", "차 한 주전자"] },
  { id: "water", g: "food", icon: "glass-water", min: 4000, max: 7000,
    n: ["Suv 1,5 l (do‘konda)", "Вода 1,5 л (в магазине)", "Water 1.5 L (shop)"],
    x: ["Su 1,5 L (markette)", "Wasser 1,5 l (Laden)", "瓶装水1.5升（商店）", "생수 1.5L(가게)"] },
  { id: "coffee", g: "food", icon: "coffee", min: 20000, max: 40000,
    n: ["Kafeda kapuchino", "Капучино в кафе", "Cappuccino at a café"], x: ["Kafede kapuçino", "Cappuccino im Café", "咖啡馆卡布奇诺", "카페 카푸치노"] },
  { id: "sight_main", g: "sights", icon: "dome", min: 50000, max: 100000,
    n: ["Asosiy yodgorlikka kirish (chet elliklar uchun)", "Вход в главный памятник (для иностранцев)", "Main monument entry (foreigners)"],
    x: ["Ana anıta giriş (yabancılar)", "Eintritt Hauptdenkmal (Ausländer)", "主要古迹门票（外国人）", "주요 유적 입장(외국인)"],
    note: ["Registon, Ark, Ichan-qal’a: narx kassada yozilgan", "Регистан, Арк, Ичан-Кала: цена написана у кассы", "Registan, Ark, Itchan Kala: price posted at the ticket office"],
    nx: ["Registan, Ark, İçan Kale: fiyat gişede yazılı", "Registan, Ark, Itchan Kala: Preis an der Kasse", "雷吉斯坦、雅克城堡、伊钦卡拉：价格标在售票处", "레기스탄, 아르크, 이찬칼라: 매표소에 가격 표시"] },
  { id: "museum", g: "sights", icon: "sight", min: 20000, max: 60000,
    n: ["Muzeyga kirish", "Вход в музей", "Museum entry"], x: ["Müze girişi", "Museumseintritt", "博物馆门票", "박물관 입장"] },
  { id: "guide_hour", g: "sights", icon: "flag", min: 100000, max: 250000,
    n: ["Gid xizmati, bir soat", "Гид, час", "Guide, per hour"], x: ["Rehber, saatlik", "Reiseführer, pro Stunde", "导游（每小时）", "가이드 1시간"] },
  { id: "plate", g: "shopping", icon: "palette", min: 50000, max: 200000,
    n: ["Qo‘lda bo‘yalgan likopcha (Rishton)", "Тарелка ручной росписи (Риштан)", "Hand-painted plate (Rishtan)"],
    x: ["El boyaması tabak (Rişton)", "Handbemalter Teller (Rischtan)", "手绘盘子（里什坦）", "수공 채색 접시(리시탄)"] },
  { id: "suzani", g: "shopping", icon: "rug", min: 300000, max: 1200000,
    n: ["Kichik so‘zana, qo‘l ishi", "Сюзане небольшое, ручная работа", "Small suzani, handmade"],
    x: ["Küçük suzani, el işi", "Kleiner Suzani, handgemacht", "小型苏扎尼刺绣（手工）", "소형 수자니(수공)"],
    note: ["Bozorda narxning 50–60% idan savdolashing", "На базаре начинайте торг с 50–60% названной цены", "At bazaars, start bargaining at 50–60% of the asking price"],
    nx: ["Pazarda istenen fiyatın %50–60’ından pazarlığa başlayın", "Auf dem Basar bei 50–60 % des Preises anfangen", "在巴扎从报价的50–60%开始还价", "시장에서는 부른 값의 50~60%부터 흥정하세요"] },
  { id: "spices", g: "shopping", icon: "flame", min: 10000, max: 30000,
    n: ["Ziravorlar, 100 g (bozorda)", "Специи, 100 г (на базаре)", "Spices, 100 g (bazaar)"],
    x: ["Baharat, 100 g (pazar)", "Gewürze, 100 g (Basar)", "香料100克（巴扎）", "향신료 100g(시장)"] },
  { id: "dried_fruit", g: "shopping", icon: "basket", min: 60000, max: 160000,
    n: ["Quruq meva yoki yong‘oq, 1 kg", "Сухофрукты или орехи, 1 кг", "Dried fruit or nuts, 1 kg"],
    x: ["Kuru meyve veya kuruyemiş, 1 kg", "Trockenobst oder Nüsse, 1 kg", "干果或坚果1公斤", "말린 과일·견과 1kg"] },
  { id: "sim", g: "connect", icon: "smartphone", min: 50000, max: 150000,
    n: ["Internetli SIM-karta (sayyoh uchun)", "SIM-карта с интернетом для туриста", "Tourist SIM card with data"],
    x: ["İnternetli turist SIM kartı", "Touristen-SIM mit Daten", "游客上网电话卡", "데이터 포함 여행자 유심"],
    note: ["Ofislarda pasport bilan beriladi", "Выдают в офисах операторов по паспорту", "Sold at operator offices with a passport"],
    nx: ["Operatör ofislerinde pasaportla verilir", "In Shops der Anbieter mit Reisepass", "凭护照在运营商营业厅办理", "통신사 매장에서 여권으로 개통"] }
];

// Поправка по городу: Ташкент дороже, туристические города — базовый уровень, остальные дешевле
const PRICE_TIER = { tashkent: 1.15, samarkand: 1, bukhara: 1, khiva: 1, shahrisabz: 0.95 };
const priceTier = cityId => PRICE_TIER[cityId] ?? 0.8;

if (typeof module !== "undefined") module.exports = { PRICE_GROUPS, PRICE_ITEMS, priceTier };
