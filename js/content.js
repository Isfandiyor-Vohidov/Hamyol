// Справочные данные, которых нет на картах: регионы, описания главных городов, тарифы.
// Реальные города и места загружаются из data/cities.js и data/pois.js (scripts/fetch-data.mjs).

const REGIONS = {
  tashkent_city: ["Toshkent shahri", "г. Ташкент", "Tashkent City"],
  tashkent: ["Toshkent viloyati", "Ташкентская область", "Tashkent Region"],
  samarkand: ["Samarqand viloyati", "Самаркандская область", "Samarkand Region"],
  bukhara: ["Buxoro viloyati", "Бухарская область", "Bukhara Region"],
  khorezm: ["Xorazm viloyati", "Хорезмская область", "Khorezm Region"],
  karakalpakstan: ["Qoraqalpog‘iston", "Каракалпакстан", "Karakalpakstan"],
  navoi: ["Navoiy viloyati", "Навоийская область", "Navoi Region"],
  kashkadarya: ["Qashqadaryo viloyati", "Кашкадарьинская область", "Kashkadarya Region"],
  surkhandarya: ["Surxondaryo viloyati", "Сурхандарьинская область", "Surkhandarya Region"],
  jizzakh: ["Jizzax viloyati", "Джизакская область", "Jizzakh Region"],
  syrdarya: ["Sirdaryo viloyati", "Сырдарьинская область", "Syrdarya Region"],
  fergana: ["Farg‘ona viloyati", "Ферганская область", "Fergana Region"],
  andijan: ["Andijon viloyati", "Андижанская область", "Andijan Region"],
  namangan: ["Namangan viloyati", "Наманганская область", "Namangan Region"]
};

// Описания ключевых городов (ключ — русское название из Wikidata). [uz, ru, en]
const CITY_STORIES = {
  "Ташкент": { e: "city", d: [
    "Poytaxt va mamlakatning eng katta shahri: saroydek metro bekatlari, Chorsu bozori, Hazrati Imom majmuasi va zamonaviy Tashkent City.",
    "Столица и крупнейший город страны: метро с дворцовыми станциями, базар Чорсу, комплекс Хазрати Имам и современный Tashkent City.",
    "The capital and largest city: palatial metro stations, Chorsu Bazaar, the Hazrati Imam complex and modern Tashkent City."] },
  "Самарканд": { e: "dome", d: [
    "Buyuk Ipak yo‘lining durdonasi, 2700 yildan ortiq tarixga ega. Registon, Go‘ri Amir va Shohi Zinda — YUNESKO merosi.",
    "Жемчужина Великого шёлкового пути с историей более 2700 лет. Регистан, Гур-Эмир и Шахи-Зинда — наследие ЮНЕСКО.",
    "The jewel of the Silk Road, over 2,700 years old. Registan, Gur-Emir and Shah-i-Zinda are UNESCO World Heritage."] },
  "Бухара": { e: "dome", d: [
    "140 dan ortiq me’moriy yodgorlikka ega ochiq osmon ostidagi muzey-shahar: Ark qal’asi, Poi Kalon, savdo gumbazlari.",
    "Город-музей под открытым небом с более чем 140 памятниками: крепость Арк, Пои-Калян, торговые купола.",
    "An open-air museum city with over 140 monuments: the Ark fortress, Po-i-Kalyan and the trading domes."] },
  "Хива": { e: "castle", d: [
    "Ichan Qal’a devorlari ichidagi shahar — O‘rta Osiyodagi birinchi YUNESKO obyekti. Minoralar va xon saroylari.",
    "Город внутри стен Ичан-Калы — первый объект ЮНЕСКО в Средней Азии. Минареты и дворцы ханов.",
    "A city inside the walls of Itchan Kala — Central Asia's first UNESCO site. Minarets and khans' palaces."] },
  "Ургенч": { e: "city", d: [
    "Xorazm markazi va Xivaga darvoza (30 km). Aeroport va temir yo‘l vokzali bor.",
    "Центр Хорезма и ворота в Хиву (30 км). Аэропорт и ж/д вокзал.",
    "Capital of Khorezm and the gateway to Khiva (30 km). Airport and railway station."] },
  "Нукус": { e: "palette", d: [
    "Qoraqalpog‘iston poytaxti. Savitskiy muzeyi — rus avangardining dunyodagi eng yirik to‘plamlaridan biri.",
    "Столица Каракалпакстана. Музей Савицкого — одна из крупнейших в мире коллекций русского авангарда.",
    "Capital of Karakalpakstan, home to the Savitsky Museum — one of the world's largest collections of Russian avant-garde."] },
  "Муйнак": { e: "ship", d: [
    "Orol dengizi bo‘yidagi sobiq port shahri. «Kemalar qabristoni» va Stihia festivali bilan mashhur.",
    "Бывший порт на берегу Аральского моря. Знаменит «кладбищем кораблей» и фестивалем Stihia.",
    "A former Aral Sea port famous for its ship graveyard and the Stihia festival."] },
  "Фергана": { e: "trees", d: [
    "Farg‘ona vodiysining yashil markazi — Marg‘ilon va Rishtonga sayohat uchun qulay baza.",
    "Зелёный центр Ферганской долины и удобная база для поездок в Маргилан и Риштан.",
    "The green heart of the Fergana Valley and a handy base for Margilan and Rishtan."] },
  "Коканд": { e: "crown", d: [
    "Qo‘qon xonligining sobiq poytaxti: Xudoyorxon saroyi va 98 ta o‘ymakor ustunli Jome masjidi.",
    "Бывшая столица Кокандского ханства: дворец Худояр-хана и Джума-мечеть с 98 резными колоннами.",
    "Former capital of the Kokand Khanate: Khudayar Khan's palace and a Friday mosque with 98 carved columns."] },
  "Маргилан": { e: "spool", d: [
    "O‘zbek ipagining poytaxti. «Yodgorlik» fabrikasida xon-atlas va adras yaratilishini ko‘rish mumkin.",
    "Столица узбекского шёлка. На фабрике «Ёдгорлик» видно, как создаются хан-атлас и адрас.",
    "The silk capital of Uzbekistan. At the Yodgorlik factory you can watch khan-atlas and adras being made."] },
  "Риштан": { e: "amphora", d: [
    "Mashhur ko‘k «ishqor» kulolchiligi markazi. Ustaxonalar sayyohlar uchun ochiq.",
    "Центр знаменитой синей керамики «ишкор». Мастерские открыты для гостей.",
    "Home of the famous blue 'ishkor' ceramics. Workshops are open to visitors."] },
  "Шахрисабз": { e: "gate", d: [
    "Amir Temurning vatani. Oqsaroy xarobalari va Dorut-Tilovat majmuasi YUNESKO ro‘yxatida.",
    "Родина Амира Темура. Руины Ак-Сарая и комплекс Дорут-Тиловат — в списке ЮНЕСКО.",
    "Birthplace of Amir Timur. The Ak-Saray ruins and Dorut-Tilovat are UNESCO-listed."] },
  "Термез": { e: "monument", d: [
    "Amudaryo bo‘yidagi eng janubiy shahar. Fayoztepa va Qoratepa buddaviy yodgorliklari, Hakim at-Termiziy majmuasi.",
    "Самый южный город на берегу Амударьи. Буддийские Фаёз-Тепа и Кара-Тепа, комплекс Хаким ат-Термези.",
    "The southernmost city on the Amu Darya: Buddhist Fayaz Tepe and Kara Tepe, and the Hakim at-Termezi complex."] },
  "Андижан": { e: "city", d: [
    "Boburiylar sulolasi asoschisi Zahiriddin Muhammad Boburning vatani.",
    "Родина Захириддина Мухаммада Бабура — основателя империи Великих Моголов.",
    "Birthplace of Babur, founder of the Mughal Empire."] },
  "Наманган": { e: "flower", d: [
    "Gullar va bog‘lar shahri — har yili Gullar festivali o‘tkaziladi.",
    "Город цветов и садов — здесь ежегодно проходит Фестиваль цветов.",
    "A city of flowers and gardens that hosts an annual Flower Festival."] },
  "Нурата": { e: "droplets", d: [
    "Muqaddas Chashma buloqi va Aleksandr Makedonskiy qal’asi. Yaqinida Aydarko‘l bo‘yidagi o‘tov lagerlari.",
    "Священный источник Чашма и крепость Александра Македонского. Рядом — юртовые лагеря у озера Айдаркуль.",
    "The holy Chashma spring and Alexander the Great's fortress, near yurt camps on Lake Aydarkul."] },
  "Карши": { e: "city", d: [
    "Qashqadaryo markazi: qadimiy ko‘prik va Ko‘k Gumbaz masjidi.",
    "Центр Кашкадарьи: старинный мост и мечеть Кок-Гумбаз.",
    "Capital of Kashkadarya: an old bridge and the Kok-Gumbaz mosque."] }
};
const POPULAR = ["Самарканд", "Бухара", "Хива", "Ташкент", "Шахрисабз", "Коканд", "Маргилан", "Нукус", "Термез", "Фергана"];
const WEATHER_CITIES = ["Ташкент", "Самарканд", "Бухара", "Хива", "Фергана", "Нукус", "Термез"];

// Подложка карты. Тайлы OpenStreetMap бесплатны для небольшой нагрузки; для продакшена
// подключите провайдера с ключом (MapTiler, Stadia, Thunderforest) — достаточно поменять url.
const MAP_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19
};

// Валюты для переключателя и запасные курсы (если cbu.uz недоступен)
const CURRENCIES = ["UZS", "USD", "EUR", "RUB", "KZT", "CNY", "GBP", "TRY"];
const SYMBOL = { UZS: " so‘m", USD: "$", EUR: "€", RUB: " ₽", KZT: " ₸", CNY: " ¥", GBP: "£", TRY: " ₺" };
const FALLBACK_RATES = { UZS: 1, USD: 11900, EUR: 13300, RUB: 147, KZT: 23, CNY: 1670, GBP: 15600, TRY: 290 };

// Тарифы бюджета (в сумах) — значения по умолчанию, пользователь может менять
const DEFAULT_TARIFFS = {
  transportPerKm: { train: 400, afrosiyob: 900, bus: 300, shared_taxi: 650, car: 2500, plane: 1100 },
  hotelPerNight: { 2: 300000, 3: 550000, 4: 1000000, 5: 2200000 },
  foodPerDay: { budget: 120000, mid: 250000, premium: 550000 },
  localPerDay: 60000,
  sightsPerDay: 80000
};

// Оценка цены отеля за ночь (USD): по звёздам или типу, с поправкой на туристические города
const HOTEL_BASE_USD = { hostel: 12, guest_house: 30, motel: 25, apartment: 40, hotel: 45 };
const STAR_USD = { 1: 20, 2: 30, 3: 50, 4: 90, 5: 180 };
const CITY_PRICE_FACTOR = { "Ташкент": 1.25, "Самарканд": 1.1, "Бухара": 1, "Хива": 1 };

// Иконки категорий и типов мест (см. js/icons.js)
const CAT_ICON = { h: "hotel", a: "dome", s: "shopping", f: "food", c: "city", u: "pin" };
const TYPE_ICON = {
  hotel: "hotel", guest_house: "house", hostel: "bed", motel: "bed-single", apartment: "building",
  marketplace: "basket", mall: "mall", department_store: "shopping", souvenir: "gift", gift: "gift", art: "palette", craft: "scissors",
  carpet: "rug", jewelry: "gem", tea: "teapot", spices: "flame", confectionery: "candy",
  attraction: "star", museum: "sight", viewpoint: "viewpoint", gallery: "gallery", zoo: "zoo", theme_park: "theme-park",
  castle: "castle", fort: "castle", ruins: "ruins", archaeological_site: "pickaxe", tomb: "dome", monument: "monument",
  city_gate: "gate", minaret: "minaret", building: "dome", restaurant: "food", cafe: "coffee"
};

// Насколько тип места интересен путешественнику (для сортировки)
const TYPE_WEIGHT = {
  marketplace: 3, mall: 2, souvenir: 2.5, craft: 2.5, carpet: 2.5, art: 2, jewelry: 1, gift: 1, tea: 1, spices: 1.5,
  museum: 3, minaret: 3, castle: 3, fort: 2.5, tomb: 2.5, archaeological_site: 2.5, city_gate: 2.5, attraction: 2,
  viewpoint: 2, ruins: 2, gallery: 1.5, zoo: 1.5, theme_park: 1.5, building: 1.5, monument: 0.5,
  restaurant: 1, hotel: 1, guest_house: 1
};

// ---------- Путеводитель ----------
// Разговорник: [узбекский, произношение (кириллицей), русский, английский]
const PHRASES = [
  ["Assalomu alaykum", "Ассалому алайкум", "Здравствуйте", "Hello"],
  ["Rahmat", "Рахмат", "Спасибо", "Thank you"],
  ["Katta rahmat", "Катта рахмат", "Большое спасибо", "Thank you very much"],
  ["Ha / Yo‘q", "Ха / Йук", "Да / Нет", "Yes / No"],
  ["Iltimos", "Илтимос", "Пожалуйста", "Please"],
  ["Kechirasiz", "Кечирасиз", "Извините", "Excuse me / Sorry"],
  ["Xayr", "Хайр", "До свидания", "Goodbye"],
  ["Qancha turadi?", "Канча туради?", "Сколько стоит?", "How much is it?"],
  ["Juda qimmat", "Жуда киммат", "Очень дорого", "Too expensive"],
  ["Arzonroq bo‘ladimi?", "Арзонрок буладими?", "Можно дешевле?", "Can you make it cheaper?"],
  ["… qayerda?", "… каерда?", "Где …?", "Where is …?"],
  ["Hojatxona qayerda?", "Хожатхона каерда?", "Где туалет?", "Where is the toilet?"],
  ["Menga yordam bering", "Менга ёрдам беринг", "Помогите мне", "Please help me"],
  ["Tushunmayapman", "Тушунмаяпман", "Я не понимаю", "I don't understand"],
  ["Ruscha / inglizcha gapirasizmi?", "Русча / инглизча гапирасизми?", "Вы говорите по-русски / по-английски?", "Do you speak Russian / English?"],
  ["Hisobni olib keling", "Хисобни олиб келинг", "Принесите счёт, пожалуйста", "The bill, please"],
  ["Juda mazali!", "Жуда мазали!", "Очень вкусно!", "Very tasty!"],
  ["Choy, non, suv", "Чой, нон, сув", "Чай, хлеб, вода", "Tea, bread, water"],
  ["Bir, ikki, uch, to‘rt, besh", "Бир, икки, уч, турт, беш", "Один, два, три, четыре, пять", "One, two, three, four, five"]
];

// Экстренные службы Узбекистана
const SOS = [
  ["101", "flame", ["Yong‘in xizmati", "Пожарная служба", "Fire service"]],
  ["102", "shield-plain", ["Politsiya", "Полиция", "Police"]],
  ["103", "ambulance", ["Tez yordam", "Скорая помощь", "Ambulance"]],
  ["104", "alert", ["Gaz avariya xizmati", "Аварийная газовая служба", "Gas emergency"]]
];

// Советы путешественнику: иконка, заголовок [uz, ru, en], текст [uz, ru, en]
const TIPS = [
  ["banknote", ["Pul", "Деньги", "Money"], [
    "Milliy valyuta — so‘m (UZS). Pulni banklar va rasmiy ayirboshlash shoxobchalarida almashtiring. Yirik shaharlarda Visa/Mastercard kartalari qabul qilinadi, bozor va taksida naqd pul kerak bo‘ladi.",
    "Национальная валюта — сум (UZS). Меняйте деньги в банках и официальных обменных пунктах. В крупных городах принимают Visa/Mastercard, но на базарах и в такси пригодятся наличные.",
    "The national currency is the som (UZS). Exchange money at banks and official exchange offices. Visa/Mastercard work in big cities, but bazaars and taxis need cash."]],
  ["train-fast", ["Poyezdlar", "Поезда", "Trains"], [
    "Tezyurar «Afrosiyob» poyezdlari Toshkent, Samarqand va Buxoroni bog‘laydi. Chiptalar uzrailpass.uz saytida sotiladi va tez tugaydi — oldindan xarid qiling.",
    "Скоростные поезда «Афросиаб» связывают Ташкент, Самарканд и Бухару. Билеты продаются на uzrailpass.uz и быстро заканчиваются — покупайте заранее.",
    "Afrosiyob high-speed trains link Tashkent, Samarkand and Bukhara. Tickets are sold on uzrailpass.uz and sell out fast — book ahead."]],
  ["taxi", ["Taksi", "Такси", "Taxis"], [
    "Shaharlarda Yandex Go ilovasidan foydalanish qulay — narx oldindan ma’lum bo‘ladi.",
    "В городах удобно вызывать такси через Yandex Go — цена известна заранее.",
    "In cities it's easiest to order a taxi in the Yandex Go app — you see the price upfront."]],
  ["smartphone", ["Aloqa", "Связь", "SIM cards"], [
    "Ucell, Beeline, Mobiuz yoki Uzmobile SIM-kartasini aloqa salonida pasport bilan sotib olish mumkin.",
    "SIM-карту Ucell, Beeline, Mobiuz или Uzmobile можно купить в салоне связи по паспорту.",
    "You can buy a Ucell, Beeline, Mobiuz or Uzmobile SIM card at a mobile shop with your passport."]],
  ["dome", ["Odob", "Этикет", "Etiquette"], [
    "Masjid va maqbaralarga yopiq kiyimda kiring: yelka va tizzalar yopiq, ayollarga ro‘mol tavsiya etiladi. So‘ralsa, poyabzalni yeching.",
    "В мечети и мавзолеи приходите в закрытой одежде: плечи и колени закрыты, женщинам желателен платок. Снимайте обувь, если об этом просят.",
    "Dress modestly in mosques and mausoleums: cover shoulders and knees; a headscarf is advisable for women. Take off your shoes when asked."]],
  ["wheat", ["Non", "Хлеб", "Bread"], [
    "Nonni qo‘l bilan sindirish odat bo‘lgan va uni teskari qo‘yishmaydi — bu hurmat belgisi.",
    "Лепёшку (нон) принято ломать руками и не класть лицевой стороной вниз — это знак уважения.",
    "Flatbread (non) is broken by hand and never placed upside down — it's a sign of respect."]],
  ["handshake", ["Savdolashish", "Торг", "Bargaining"], [
    "Bozorlarda savdolashish odatiy hol — tabassum bilan boshlang.",
    "На базарах торговаться нормально — начинайте с улыбки.",
    "Bargaining at bazaars is normal — start with a smile."]],
  ["file-text", ["Ro‘yxatdan o‘tish", "Регистрация", "Registration"], [
    "Xorijiy mehmonlar turar joy bo‘yicha ro‘yxatdan o‘tishi kerak — mehmonxonalar buni o‘zi qiladi. Tanishlarnikida tursangiz, qoidalarni oldindan aniqlang.",
    "Иностранные гости должны быть зарегистрированы по месту пребывания — отели делают это сами. Если остановились у знакомых, уточните правила заранее.",
    "Foreign visitors must be registered where they stay — hotels do it for you. If you stay with friends, check the rules in advance."]],
  ["sun", ["Mavsum", "Сезон", "Season"], [
    "Sayohat uchun eng yaxshi vaqt — bahor (aprel–may) va kuz (sentabr–oktabr). Yozda Buxoro va Xivada +40 °C dan oshishi mumkin.",
    "Лучшее время для поездки — весна (апрель–май) и осень (сентябрь–октябрь). Летом в Бухаре и Хиве бывает жарче +40 °C.",
    "The best time to visit is spring (April–May) and autumn (September–October). In summer Bukhara and Khiva can exceed +40 °C."]],
  ["glass-water", ["Suv", "Вода", "Water"], [
    "Shisha idishdagi suv iching.",
    "Пейте бутилированную воду.",
    "Drink bottled water."]]
];

// План на день: сколько минут обычно занимает посещение
const VISIT_MIN = {
  museum: 75, marketplace: 60, gallery: 45, castle: 50, fort: 50, zoo: 90, theme_park: 90,
  ruins: 40, archaeological_site: 40, attraction: 40, viewpoint: 20
};

// Группы кухонь (значения тега cuisine из OSM) и отметки заведений
const CUISINE_GROUPS = {
  national: ["uzbek", "regional", "local", "oriental", "central_asian", "plov", "lagman", "samsa", "shashlik", "uyghur", "tatar", "kazakh"],
  coffee: ["coffee_shop", "tea", "cake", "breakfast", "ice_cream", "dessert", "bakery"],
  fast: ["burger", "pizza", "hot_dog", "chicken", "sandwich", "kebab", "doner", "fish_and_chips", "friture", "fast_food", "shawarma"],
  asian: ["asian", "korean", "japanese", "chinese", "sushi", "thai", "vietnamese", "indian", "beef_bowl", "noodle"],
  intl: ["international", "italian", "russian", "european", "turkish", "georgian", "french", "pasta", "steak_house", "grill", "barbecue", "fish", "seafood", "mediterranean", "american"]
};
const FOOD_FLAGS = [["o", "outdoor"], ["w", "wifi"], ["d", "delivery"], ["t", "takeaway"], ["v", "leaf"], ["h", "halal"]];

// Готовые маршруты: [русское название города, ночей]; транспорт по умолчанию
const COLLECTIONS = [
  { id: "silk", hero: "Хива", icon: "route", tr: "afrosiyob", stops: [["Ташкент", 2], ["Самарканд", 3], ["Бухара", 2], ["Хива", 2]],
    t: ["Buyuk Ipak yo‘li klassikasi", "Классика Шёлкового пути", "Silk Road classic"],
    d: ["Uch YUNESKO shahri: Registon, Ark qal’asi va Ichan Qal’a devorlari.", "Три города ЮНЕСКО: Регистан, крепость Арк и стены Ичан-Калы.", "Three UNESCO cities: Registan, the Ark fortress and the walls of Itchan Kala."] },
  { id: "weekend", hero: "Самарканд", icon: "zap", tr: "afrosiyob", stops: [["Ташкент", 1], ["Самарканд", 2]],
    t: ["Dam olish kunlari: Toshkent + Samarqand", "Выходные: Ташкент + Самарканд", "Weekend: Tashkent + Samarkand"],
    d: ["«Afrosiyob» poyezdida 2 soat — va siz Registondasiz.", "Два часа на «Афросиабе» — и вы на Регистане.", "Two hours on the Afrosiyob train and you're at the Registan."] },
  { id: "crafts", hero: "Маргилан", icon: "spool", tr: "shared_taxi", stops: [["Ташкент", 1], ["Коканд", 1], ["Риштан", 1], ["Маргилан", 2]],
    t: ["Farg‘ona ipagi va kulolchiligi", "Шёлк и керамика Ферганы", "Fergana silk & ceramics"],
    d: ["Xon saroyi, Rishton ko‘k kulolchiligi va Marg‘ilonda atlas to‘qish.", "Дворец хана, синяя керамика Риштана и ткачество атласа в Маргилане.", "A khan's palace, Rishtan's blue ceramics and atlas weaving in Margilan."] },
  { id: "aral", hero: "Муйнак", icon: "ship", tr: "car", stops: [["Ургенч", 1], ["Хива", 2], ["Нукус", 1], ["Муйнак", 1]],
    t: ["Orol va Qoraqalpog‘iston", "Арал и Каракалпакстан", "Aral Sea & Karakalpakstan"],
    d: ["Savitskiy muzeyi, cho‘l qal’alari va «kemalar qabristoni».", "Музей Савицкого, крепости пустыни и «кладбище кораблей».", "The Savitsky Museum, desert fortresses and the ship graveyard."] },
  { id: "south", hero: "Шахрисабз", icon: "monument", tr: "car", stops: [["Самарканд", 2], ["Шахрисабз", 1], ["Байсун", 1], ["Термез", 2]],
    t: ["Janub: Temur va buddizm", "Юг: Тимур и буддизм", "The south: Timur & Buddhism"],
    d: ["Temur vatani, Boysun tog‘lari va Termizning qadimiy buddaviy ibodatxonalari.", "Родина Тимура, горы Байсуна и древние буддийские храмы Термеза.", "Timur's birthplace, the Boysun mountains and Termez's ancient Buddhist temples."] },
  { id: "desert", hero: "Бухара", icon: "tent", tr: "car", stops: [["Самарканд", 1], ["Нурата", 2], ["Бухара", 2], ["Гиждуван", 1]],
    t: ["Cho‘l va o‘tovlar", "Пустыня и юрты", "Desert & yurts"],
    d: ["Aydarko‘l bo‘yida o‘tovda tunash, tuya safari va G‘ijduvon kulolchiligi.", "Ночь в юрте у озера Айдаркуль, прогулка на верблюдах и керамика Гиждувана.", "A night in a yurt by Lake Aydarkul, a camel ride and Gijduvan ceramics."] },
  { id: "mountains", hero: "Газалкент", icon: "mountain", tr: "car", stops: [["Ташкент", 1], ["Газалкент", 1], ["Чимган", 2]],
    t: ["Toshkent yonidagi tog‘lar", "Горы рядом с Ташкентом", "Mountains near Tashkent"],
    d: ["Chorvoq suv ombori, Chimyon tog‘lari va toza havo — shahardan 1,5 soat.", "Чарвакское водохранилище, горы Чимгана и чистый воздух — 1,5 часа от города.", "Charvak Reservoir, the Chimgan mountains and fresh air — 1.5 hours from the city."] },
  { id: "grand", hero: "Коканд", icon: "map", tr: "train", stops: [["Ташкент", 2], ["Коканд", 1], ["Маргилан", 1], ["Самарканд", 3], ["Шахрисабз", 1], ["Бухара", 3], ["Хива", 2], ["Нукус", 1]],
    t: ["Katta sayohat", "Большое путешествие", "The grand tour"],
    d: ["Ikki hafta ichida butun mamlakat: vodiydan Orolgacha.", "Вся страна за две недели: от Ферганской долины до Арала.", "The whole country in two weeks: from the Fergana Valley to the Aral Sea."] },
  // Маршруты не из Ташкента — для тех, кто прилетает в Бухару, Ургенч, Фергану, Нукус или Термез
  { id: "oasis", hero: "Бухара", icon: "dome", tr: "train", stops: [["Бухара", 3], ["Хива", 2]],
    t: ["Buxoro va Xiva", "Бухара и Хива", "Bukhara & Khiva"],
    d: ["Ikki muzey-shahar: Buxoroning savdo gumbazlari va Xivaning Ichan Qal’asi.", "Два города-музея: торговые купола Бухары и Ичан-Кала Хивы.", "Two open-air museum cities: Bukhara's trading domes and Khiva's Itchan Kala."] },
  { id: "silkback", hero: "Самарканд", icon: "train", tr: "afrosiyob", stops: [["Бухара", 2], ["Самарканд", 2], ["Ташкент", 1]],
    t: ["Buxorodan Toshkentgacha", "Из Бухары в Ташкент", "Bukhara to Tashkent"],
    d: ["Shoyi yo‘li teskari yo‘nalishda: Buxoro, Registon va poytaxt — «Afrosiyob» poyezdida.", "Шёлковый путь наоборот: Бухара, Регистан и столица — на «Афросиабе».", "The Silk Road in reverse: Bukhara, the Registan and the capital by Afrosiyob train."] },
  { id: "khorezm", hero: "Хива", icon: "gate", tr: "car", stops: [["Хива", 2], ["Нукус", 1], ["Муйнак", 1]],
    t: ["Xivadan Orolgacha", "Из Хивы к Аралу", "Khiva to the Aral Sea"],
    d: ["Ichan Qal’a, Savitskiy muzeyi va Mo‘ynoqdagi kemalar qabristoni.", "Ичан-Кала, музей Савицкого и кладбище кораблей в Муйнаке.", "Itchan Kala, the Savitsky Museum and the ship graveyard in Muynak."] },
  { id: "aralwest", hero: "Нукус", icon: "ship", tr: "car", stops: [["Нукус", 1], ["Муйнак", 1], ["Хива", 2], ["Бухара", 2]],
    t: ["Oroldan Buxorogacha", "От Арала до Бухары", "From the Aral Sea to Bukhara"],
    d: ["Nukusdan boshlang: Orol, Xiva devorlari va Qizilqum orqali Buxoroga.", "Начните в Нукусе: Арал, стены Хивы и через Кызылкум — в Бухару.", "Start in Nukus: the Aral Sea, Khiva's walls and across the Kyzylkum to Bukhara."] },
  { id: "valley", hero: "Фергана", icon: "spool", tr: "shared_taxi", stops: [["Андижан", 1], ["Наманган", 1], ["Фергана", 2], ["Маргилан", 1]],
    t: ["Farg‘ona vodiysi bo‘ylab", "По Ферганской долине", "Around the Fergana Valley"],
    d: ["Andijon bozori, Namangan bog‘lari va Marg‘ilondagi «Yodgorlik» atlas fabrikasi.", "Базар Андижана, сады Намангана и атласная фабрика «Ёдгорлик» в Маргилане.", "Andijan's bazaar, Namangan's gardens and the Yodgorlik silk factory in Margilan."] },
  { id: "fergtash", hero: "Коканд", icon: "train", tr: "train", stops: [["Фергана", 2], ["Маргилан", 1], ["Риштан", 1], ["Коканд", 1], ["Ташкент", 2]],
    t: ["Farg‘onadan Toshkentgacha", "Из Ферганы в Ташкент", "Fergana to Tashkent"],
    d: ["Vodiyning hunarmandlari, Qo‘qon xoni saroyi va Qamchiq dovoni orqali poytaxtga.", "Ремесленники долины, дворец кокандского хана и через перевал Камчик — в столицу.", "The valley's craftsmen, the Kokand khan's palace and over the Kamchik Pass to the capital."] },
  { id: "termez", hero: "Термез", icon: "monument", tr: "car", stops: [["Термез", 2], ["Денау", 1], ["Байсун", 1], ["Шахрисабз", 1], ["Самарканд", 2]],
    t: ["Termizdan Samarqandgacha", "Из Термеза в Самарканд", "Termez to Samarkand"],
    d: ["Buddaviy Fayoztepa, Boysun tog‘lari, Oqsaroy va Registon.", "Буддийский Фаязтепа, горы Байсуна, Ак-Сарай и Регистан.", "Buddhist Fayaz Tepa, the Boysun mountains, Ak-Saray and the Registan."] }
];
