/* ===================== Safar · Азербайджан =====================
   Отдельное приложение на странице /az. Узбекское приложение (/) и Мекку (/mecca) не загружает и не меняет;
   из общего берёт только значки (js/icons.js) и вход в аккаунт (тот же токен safar_token, сервер — server/telegram.js).
   Для взрослых и пожилых: шесть больших кнопок на главной, каждый раздел — отдельный экран с крупной кнопкой «Назад». */
window.SAFAR_APP = "az";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } }
};
// Открыли Азербайджан — при следующем входе на сайт (/) сразу он; Узбекистан и Мекка — в самом низу «Настроек»
store.set("safar_region", "az");

// ---------- Языки: русский и английский ----------
let LANG = (() => { try { const l = localStorage.getItem("az_lang"); if (l === "ru" || l === "en") return l; } catch { /* приватный режим */ } return /^en/i.test(navigator.language) ? "en" : "ru"; })();
// Не «L»: это имя занято библиотекой карты Leaflet
const LL = (ru, en) => (LANG === "en" ? en : ru);
const TX = {
  app_sub: ["Азербайджан", "Azerbaijan"],
  hello: ["Добро пожаловать!", "Welcome!"],
  hello_sub: ["Выберите, что нужно. Всё крупно и по шагам.", "Choose what you need. Everything is big and step by step."],
  back: ["Назад", "Back"],
  home: ["Главная", "Home"],
  trips: ["Поездки", "Trips"], trips_sub: ["Куда съездить", "Where to go"],
  buses: ["Автобусы", "Buses"], buses_sub: ["По городу и между городами", "In the city and between cities"],
  pay: ["Как платить", "How to pay"], pay_sub: ["За автобус и метро", "For bus and metro"],
  tr: ["Переводчик", "Translator"], tr_sub: ["На азербайджанский", "To Azerbaijani"],
  chat: ["Чат", "Chat"], chat_sub: ["Переписка с людьми", "Message people"],
  sos: ["Помощь SOS", "Help SOS"], sos_sub: ["Скорая, полиция", "Ambulance, police"],
  account: ["Настройки", "Settings"],
  // Поездки
  trips_lead: ["Готовые поездки из Баку. Нажмите, чтобы узнать, что посмотреть и как доехать.", "Ready trips from Baku. Tap to see what to visit and how to get there."],
  see: ["Что посмотреть", "What to see"],
  how_get: ["Как доехать", "How to get there"],
  route_btn: ["Маршрут на карте", "Route on the map"],
  ticket_btn: ["Билет на автобус (biletim.az)", "Bus ticket (biletim.az)"],
  time: ["В пути", "Travel time"], days_n: ["{n} дн.", "{n} days"], day_1: ["1 день", "1 day"],
  // Автобусы
  bus_city: ["Автобусы по Баку", "Buses in Baku"], bus_city_sub: ["Проезд 0,60 AZN, карта BakıKart", "Fare 0.60 AZN, BakıKart card"],
  bus_inter: ["Между городами", "Between cities"], bus_inter_sub: ["Шеки, Габала, Гянджа и другие", "Sheki, Gabala, Ganja and more"],
  bus_find: ["Найти автобус до места", "Find a bus to a place"], bus_find_sub: ["Карта покажет номер автобуса", "The map will show the bus number"],
  bus_find_ph: ["Куда едете? Например: Девичья башня", "Where to? For example: Maiden Tower"],
  bus_find_go: ["Показать автобусы", "Show buses"],
  bus_city_lead: ["В Баку автобусы и метро оплачивают картой BakıKart — наличные водитель не берёт.", "In Baku, buses and the metro are paid with a BakıKart card — drivers do not take cash."],
  bus_city_1: ["Входите в автобус и прикладываете карту к жёлтому терминалу у двери.", "Get on the bus and tap your card on the yellow reader by the door."],
  bus_city_2: ["Одно прикладывание — одна поездка. Если едете вдвоём, приложите карту два раза.", "One tap is one ride. If two people travel, tap the card twice."],
  bus_city_3: ["Номер автобуса и остановку проще всего найти на карте — кнопка ниже.", "The easiest way to find the bus number and stop is the map — button below."],
  bus_airport: ["Из аэропорта в центр — экспресс-автобус H1 (BakuBus), тоже по BakıKart.", "From the airport to the centre — express bus H1 (BakuBus), also with BakıKart."],
  bus_inter_lead: ["Междугородние автобусы уходят с Международного автовокзала Баку (метро «Автовокзал»).", "Intercity buses leave from Baku International Bus Terminal (metro station “Avtovağzal”)."],
  bus_inter_tbl: ["Куда", "To"], bus_inter_time: ["В пути", "Time"], bus_inter_price: ["Цена", "Price"],
  bus_inter_note: ["Время и цены — примерные. Точные — в кассе автовокзала или на biletim.az.", "Times and prices are approximate. Exact ones are at the bus station ticket office or on biletim.az."],
  bus_station_map: ["Автовокзал на карте", "Bus terminal on the map"],
  // Оплата
  pay_lead: ["Метро и новые автобусы Баку — одна цена за поездку, оплата только картой BakıKart.", "The metro and new buses in Baku have one fare per ride, paid only with a BakıKart card."],
  pay_fare: ["за одну поездку (с 1 октября 2025)", "per ride (since 1 October 2025)"],
  pay_s1: ["Купите карту BakıKart", "Buy a BakıKart card"], pay_s1p: ["Её продают автоматы на станциях метро и на многих остановках.", "Machines at metro stations and many bus stops sell it."],
  pay_s2: ["Положите деньги на карту", "Top up the card"], pay_s2p: ["В том же автомате: вставьте карту, выберите сумму, оплатите наличными или банковской картой.", "In the same machine: insert the card, choose the amount, pay in cash or by bank card."],
  pay_s3: ["Приложите карту при входе", "Tap the card when you get on"], pay_s3p: ["К жёлтому терминалу в автобусе или к турникету в метро. Раздастся сигнал — оплачено.", "On the yellow reader in the bus or the metro turnstile. A beep means it is paid."],
  pay_s4: ["Можно оплачивать телефоном", "You can pay with your phone"], pay_s4p: ["В приложении BakıKart — найдите его в магазине приложений.", "With the BakıKart app — find it in your app store."],
  pay_old: ["В старых маршрутках и пригородных автобусах цена может быть другой — спросите у водителя.", "Older minibuses and suburban buses may charge a different fare — ask the driver."],
  pay_inter: ["Билет на междугородний автобус покупают отдельно: в кассе автовокзала или на сайте biletim.az.", "Intercity bus tickets are bought separately: at the bus station ticket office or on biletim.az."],
  pay_near: ["Где пополнить карту рядом", "Where to top up nearby"],
  pay_app: ["Приложение BakıKart", "BakıKart app"],
  // Переводчик
  tr_lead: ["Напишите или скажите фразу — переведу и прочитаю вслух.", "Type or say a phrase — I will translate it and read it aloud."],
  tr_ph: ["Например: Где остановка автобуса?", "For example: Where is the bus stop?"],
  tr_go: ["Перевести", "Translate"], tr_mic: ["Сказать голосом", "Speak"], tr_listen: ["Слушаю…", "Listening…"],
  tr_say: ["Прочитать вслух", "Read aloud"], tr_show: ["Показать крупно", "Show big"], tr_tap_close: ["Нажмите, чтобы закрыть", "Tap to close"],
  tr_phrases: ["Готовые фразы (работают без интернета)", "Ready phrases (work offline)"],
  tr_hist: ["Мои переводы (работают без интернета)", "My translations (work offline)"], tr_hist_clear: ["Очистить", "Clear"],
  tr_hist_clear_q: ["Удалить все мои переводы?", "Delete all my translations?"], tr_hist_more: ["Показать все ({n})", "Show all ({n})"],
  tr_saved: ["сохранено — работает без интернета", "saved — works offline"],
  tr_any_off: ["Любой текст без интернета", "Any text offline"],
  tr_google_tip: ["Если нужно переводить что угодно без сети, поможет бесплатное приложение «Google Переводчик»:", "To translate anything without a connection, use the free Google Translate app:"],
  tr_g1: ["Установите «Google Переводчик» из магазина приложений.", "Install Google Translate from your app store."],
  tr_g2: ["Откройте меню → «Скачанные языки».", "Open the menu → “Downloaded languages”."],
  tr_g3: ["Скачайте «Азербайджанский» (и свой язык), пока есть интернет.", "Download “Azerbaijani” (and your language) while you have internet."],
  tr_google: ["Открыть Google Переводчик", "Open Google Translate"],
  // Только в Android-приложении (на iPhone и в браузере этот блок не показываем)
  tr_dl: ["Другие языки без интернета", "Other languages offline"],
  tr_dl_btn: ["Скачать другой язык", "Download another language"],
  tr_dl_sub: ["Кроме азербайджанского можно скачать турецкий, арабский и ещё ~50 языков (около 30 МБ каждый) — для перевода текстом и голосом без интернета.", "Besides Azerbaijani you can download Turkish, Arabic and ~50 more languages (about 30 MB each) — for offline text and voice translation."],
  // Офлайн-азербайджанский (модели Mozilla, работают прямо в браузере)
  mt_title: ["Азербайджанский без интернета", "Azerbaijani offline"],
  mt_sub: ["Скачайте один раз, пока есть интернет (около {mb} МБ, лучше по Wi-Fi), — и любой текст {pairs} будет переводиться прямо на телефоне, без сети. Переводчик от Mozilla (как в Firefox), бесплатно.", "Download once while you have internet (about {mb} MB, Wi-Fi is best) — then any text {pairs} is translated right on the phone, without a connection. Translator by Mozilla (as in Firefox), free."],
  mt_pairs: ["русский ↔ азербайджанский и английский ↔ азербайджанский", "English ↔ Azerbaijani"],
  mt_dl: ["Скачать азербайджанский", "Download Azerbaijani"],
  mt_dir: ["Что скачать", "What to download"], mt_dir_both: ["В обе стороны", "Both ways"], mt_dir_to: ["Только с {l} на азербайджанский", "Only {l} → Azerbaijani"], mt_dir_from: ["Только с азербайджанского на {l2}", "Only Azerbaijani → {l2}"],
  mt_busy: ["Скачиваем… {p}%", "Downloading… {p}%"],
  mt_ready: ["Скачано — переводит без интернета", "Downloaded — translates offline"],
  mt_del: ["Удалить", "Delete"],
  mt_done: ["Азербайджанский скачан. Теперь переводит без интернета.", "Azerbaijani downloaded. It now translates offline."],
  mt_fail: ["Загрузка прервалась. Скачанное сохранено — продолжим с того же места, как только будет интернет.", "The download stopped. What was downloaded is kept — it will continue from the same place once you are online."],
  mt_paused: ["Загрузка на паузе — продолжим, когда вернётесь в приложение.", "Download paused — it will continue when you come back to the app."],
  mt_resume: ["Продолжить загрузку", "Continue the download"], mt_keep: ["Не закрывайте эту страницу — экран не погаснет, пока идёт загрузка.", "Keep this page open — the screen stays on while downloading."],
  mt_space: ["На телефоне мало места: нужно около {mb} МБ.", "Not enough space on the phone: about {mb} MB is needed."],
  mt_old: ["Этот браузер слишком старый для офлайн-перевода. Обновите Chrome.", "This browser is too old for offline translation. Update Chrome."],
  mt_loading: ["Перевожу на телефоне… (первый раз — несколько секунд)", "Translating on the phone… (the first time takes a few seconds)"],
  mt_by: ["переведено без интернета", "translated offline"],
  tr_dl_android: ["Скачивание языков работает в Android-приложении Hamyol.", "Downloading languages works in the Hamyol Android app."],
  tr_fail: ["Нет интернета или сервис занят. Попробуйте готовые фразы ниже.", "No internet or the service is busy. Try the ready phrases below."],
  tr_no_mic: ["Этот браузер не умеет слушать голос.", "This browser cannot listen to voice."],
  tr_no_voice: ["На телефоне нет голоса для этого языка.", "This phone has no voice for this language."],
  // Чат
  chat_lead: ["Пишите другим людям, которые пользуются Hamyol.", "Message other people who use Hamyol."],
  chat_login: ["Войти через Telegram", "Log in with Telegram"], chat_login_sub: ["Чтобы писать сообщения, нужен вход. Это бесплатно.", "You need to log in to send messages. It is free."],
  chat_login_wait: ["Подтвердите вход в Telegram и вернитесь сюда…", "Confirm the login in Telegram and come back here…"],
  chat_login_off: ["Вход пока не настроен на сервере.", "Login is not set up on the server yet."],
  chat_new: ["Найти человека", "Find a person"], chat_search_ph: ["Имя или ID человека", "Person's name or ID"],
  my_id: ["Мой ID", "My ID"],
  my_id_sub: ["Этот номер никогда не меняется и есть только у вашего аккаунта. Скажите его человеку — и он сможет вам написать.", "This number never changes and belongs only to your account. Tell it to someone and they can message you."],
  id_login: ["Войдите, чтобы получить свой постоянный ID.", "Log in to get your permanent ID."],
  copy: ["Скопировать", "Copy"], copied: ["ID скопирован", "ID copied"], share: ["Поделиться", "Share"],
  share_text: ["Мой ID в Hamyol: {id}. Напишите мне в чате: {url}", "My Hamyol ID: {id}. Message me in the chat: {url}"],
  write_by_id: ["Написать по ID", "Message by ID"], id_ph: ["100001", "100001"], open: ["Открыть", "Open"],
  id_none: ["Человек с таким ID не найден. Он должен хотя бы раз открыть чат.", "No one with this ID. The person must open the chat at least once."],
  id_self: ["Это ваш собственный ID.", "This is your own ID."],
  chat_none: ["Пока нет переписок. Нажмите «Найти человека».", "No chats yet. Tap “Find a person”."],
  chat_nobody: ["Никого не нашли. Человек должен хотя бы раз открыть чат в Hamyol.", "Nobody found. The person must open the chat in Hamyol at least once."],
  chat_ph: ["Сообщение…", "Message…"], chat_send: ["Отправить", "Send"],
  chat_you: ["Вы: ", "You: "], chat_first: ["Напишите первое сообщение.", "Write the first message."],
  chat_block: ["Заблокировать", "Block"], chat_unblock: ["Разблокировать", "Unblock"], chat_report: ["Пожаловаться", "Report"],
  chat_block_q: ["Заблокировать {name}?", "Block {name}?"], chat_block_sub: ["Этот человек больше не сможет вам писать.", "This person will no longer be able to message you."],
  chat_report_q: ["Пожаловаться на {name}?", "Report {name}?"], chat_report_sub: ["Жалоба уйдёт администратору, а человек будет заблокирован.", "The report goes to the administrator and the person will be blocked."],
  chat_blocked: ["Вы заблокировали этого человека.", "You blocked this person."],
  chat_reported: ["Жалоба отправлена. Спасибо!", "Report sent. Thank you!"],
  chat_err: ["Не удалось отправить. Проверьте интернет.", "Could not send. Check the internet."],
  chat_my_name: ["Моё имя в чате", "My name in chat"], chat_save: ["Сохранить", "Save"], chat_saved: ["Сохранено", "Saved"],
  chat_logout: ["Выйти из аккаунта", "Log out"],
  online: ["в сети", "online"], seen: ["был(а) {t}", "seen {t}"],
  // SOS
  sos_lead: ["Нажмите на нужную службу. Перед звонком спросим ещё раз — чтобы не позвонить случайно.", "Tap the service you need. We will ask once more before calling, so you do not call by accident."],
  sos_112: ["Единый номер экстренной помощи", "Single emergency number"], sos_103: ["Скорая помощь", "Ambulance"], sos_102: ["Полиция", "Police"], sos_101: ["Пожарная служба", "Fire service"],
  sos_call_q: ["Позвонить {n}?", "Call {n}?"], sos_call: ["Позвонить", "Call"], cancel: ["Отмена", "Cancel"],
  sos_where: ["Где я? (координаты)", "Where am I? (coordinates)"], sos_where_sub: ["Покажите экран или прочитайте диспетчеру.", "Show the screen or read it to the operator."],
  sos_geo_wait: ["Определяем место…", "Finding your location…"], sos_geo_fail: ["Не удалось определить место. Включите геолокацию.", "Could not get your location. Turn on location."],
  sos_share: ["Отправить место", "Share location"],
  // Настройки
  set_size: ["Размер текста", "Text size"], set_theme: ["Тема", "Theme"], set_light: ["Светлая", "Light"], set_dark: ["Тёмная", "Dark"],
  off: ["Без интернета", "Offline"], off_sub: ["Скачать приложение и карты городов", "Download the app and city maps"],
  off_lead: ["Пока есть интернет, скачайте приложение и нужные города — потом они откроются и без сети.", "While you have internet, download the app and the cities you need — later they open without a connection."],
  off_app: ["Приложение целиком", "The whole app"], off_app_sub: ["Поездки, автобусы, оплата, фразы, SOS", "Trips, buses, payment, phrases, SOS"],
  off_app_btn: ["Скачать приложение", "Download the app"], off_app_ok: ["Скачано — откроется без интернета", "Downloaded — opens offline"],
  off_app_no: ["Этот браузер не умеет работать без интернета.", "This browser cannot work offline."],
  off_cities: ["Карты городов", "City maps"],
  off_cities_sub: ["Любой из 97 городов: места, вокзалы, аптеки, больницы, банкоматы и туалеты на карте с расстоянием от вас, а ещё фото и описания. Скачивается за секунды.", "Any of the 97 cities: sights, stations, pharmacies, hospitals, ATMs and toilets on the map with the distance from you, plus photos and descriptions. Takes seconds."],
  off_dl: ["Скачать", "Download"], acc_cities: ["Города без интернета", "Offline cities"],
  acc_cities_sub: ["Скачано городов: {n}. Можно скачать любой из {all} — он откроется без интернета.", "Cities downloaded: {n}. You can download any of {all} — it opens without internet."],
  acc_cities_btn: ["Скачать города", "Download cities"], off_update: ["Обновить", "Update"], off_del: ["Удалить", "Delete"], off_open: ["Открыть карту", "Open map"],
  off_busy: ["Скачиваем…", "Downloading…"], off_done: ["{city}: скачано {n} мест", "{city}: {n} places downloaded"],
  off_fail: ["Не удалось скачать. Проверьте интернет и попробуйте ещё раз.", "Download failed. Check the internet and try again."],
  off_places: ["{n} мест · {date}", "{n} places · {date}"], off_need_net: ["Чтобы скачать, нужен интернет.", "You need internet to download."],
  off_tiles_note: ["Подложка карты без сети видна только там, где вы уже смотрели карту с интернетом (так требуют правила OpenStreetMap). Места и ваше положение видны всегда.", "Without a connection the map background shows only where you already looked with internet (OpenStreetMap rules). Places and your position are always shown."],
  off_del_q: ["Удалить {city} с телефона?", "Delete {city} from the phone?"],
  map_city: ["Карта города", "City map"], map_offline_btn: ["Карта города (без интернета)", "City map (offline)"],
  map_where: ["Где я", "Where am I"], map_no_geo: ["Не удалось определить место. Включите геолокацию.", "Could not get your location. Turn on location."],
  map_not_dl: ["Этот город ещё не скачан.", "This city is not downloaded yet."], map_no_lib: ["Карта не загрузилась — ниже список мест с расстоянием.", "The map did not load — below is a list of places with distances."],
  map_near: ["Ближайшие", "Nearest"], map_dir: ["Как пройти", "Directions"], map_all: ["Все", "All"],
  k_sight: ["Что посмотреть", "Sights"], k_move: ["Транспорт", "Transport"], k_health: ["Здоровье", "Health"], k_money: ["Банкоматы", "ATMs"], k_toilet: ["Туалеты", "Toilets"], k_police: ["Полиция", "Police"],
  // Цены
  pr_free: ["бесплатно", "free"], pr_ticket: ["Вход", "Entry"], pr_night: ["Ночь", "Night"], pr_person: ["Средний чек", "Per person"],
  pr_est: ["примерно, точнее — на месте", "approximate, check on site"], pr_checked: ["проверено {d}", "checked {d}"],
  pr_per_night: [" / ночь", " / night"], pr_sum: ["сум", "so‘m"], pr_k: ["тыс.", "k"],
  fare_metro: ["Метро: {0.6} за поездку (карта BakıKart — {3})", "Metro: {0.6} per ride (BakıKart card — {3})"],
  fare_bus_baku: ["Автобус по Баку: {0.6} · межгород: ~{5-15}", "Baku city bus: {0.6} · intercity: ~{5-15}"],
  fare_bus: ["Межгородний автобус: ~{3-15} (до Баку)", "Intercity bus: ~{3-15} (to Baku)"],
  fare_train: ["Поезд: ~{5-20} (билеты — ticket.ady.az)", "Train: ~{5-20} (tickets — ticket.ady.az)"],
  fare_gyd: ["В центр: автобус H1 — {1.3} · такси — {30-35}", "To the centre: bus H1 — {1.3} · taxi — {30-35}"],
  fare_airport: ["Такси до центра: ~{5-15}", "Taxi to the centre: ~{5-15}"],
  t_metro: ["Метро", "Metro"], t_metro_rail: ["Метро или электричка", "Metro or suburban train"], t_bus: ["Автовокзал", "Bus station"], t_train: ["Вокзал", "Railway station"], t_pharmacy: ["Аптека", "Pharmacy"], t_hospital: ["Больница", "Hospital"],
  t_clinic: ["Поликлиника", "Clinic"], t_atm: ["Банкомат", "ATM"], t_toilets: ["Туалет", "Toilet"], t_police: ["Полиция", "Police"], t_museum: ["Музей", "Museum"], t_sight: ["Достопримечательность", "Sight"],
  set_lang: ["Язык", "Language"], set_other: ["Другие приложения Hamyol", "Other Hamyol apps"], set_uz: ["Узбекистан", "Uzbekistan"], set_mecca: ["Мекка и Медина", "Mecca & Medina"],
  set_other_sub: ["Выбранное приложение будет открываться сразу. Вернуться сюда можно из его аккаунта.", "The chosen app will open first. You can come back here from its account."],
  set_uz_sub: ["Города, карта, маршруты, цены", "Cities, map, routes, prices"], set_mecca_sub: ["Умра и хадж: переводчик, намаз, SOS", "Umrah & Hajj: translator, prayer, SOS"],
  map_btn: ["Карта", "Map"], hours: ["{n} ч", "{n} h"],
  offline: ["Нет интернета", "No internet"]
};
function t(key, vars) {
  let s = TX[key] ? TX[key][LANG === "en" ? 1 : 0] : key;
  if (vars) for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
  return s;
}
const fmtTime = ms => new Date(ms).toLocaleTimeString(LANG === "en" ? "en-GB" : "ru-RU", { hour: "2-digit", minute: "2-digit" });
const fmtDay = ms => new Date(ms).toLocaleDateString(LANG === "en" ? "en-GB" : "ru-RU", { day: "numeric", month: "long" });

// ---------- Поездки (из Баку) ----------
// see: что посмотреть; how: как доехать; h: часов в пути (от/до); d: дней; p: [широта, долгота]
const TRIPS = [
  { id: "baku", city: "baku", ic: "city", d: 2, h: null, p: [40.3664, 49.8372],
    n: ["Баку за 1–2 дня", "Baku in 1–2 days"],
    see: [["Ичеришехер — Старый город", "Icherisheher — the Old City"], ["Девичья башня", "Maiden Tower"], ["Дворец Ширваншахов", "Palace of the Shirvanshahs"], ["Приморский бульвар", "Seaside Boulevard"], ["Пламенные башни (вечером светятся)", "Flame Towers (lit up at night)"], ["Центр Гейдара Алиева", "Heydar Aliyev Center"]],
    how: ["По городу — метро и автобусы, 0,60 AZN за поездку по карте BakıKart. Старый город удобно обходить пешком.", "Around the city — metro and buses, 0.60 AZN per ride with a BakıKart card. The Old City is best on foot."] },
  { id: "gobustan", ic: "mountain", d: 1, h: [1, 1.5], p: [40.1112, 49.3846],
    n: ["Гобустан и грязевые вулканы", "Gobustan & mud volcanoes"],
    see: [["Наскальные рисунки — памятник ЮНЕСКО", "Rock carvings — a UNESCO site"], ["Музей Гобустана", "Gobustan Museum"], ["Грязевые вулканы", "Mud volcanoes"]],
    how: ["Около 60 км на юг от Баку. Удобнее всего на такси или с экскурсией: к вулканам ведёт грунтовая дорога.", "About 60 km south of Baku. Easiest by taxi or with a tour: the road to the volcanoes is unpaved."] },
  { id: "absheron", ic: "flame", d: 1, h: [0.5, 1], p: [40.4153, 50.0083],
    n: ["Огни Абшерона", "Fires of Absheron"],
    see: [["Атешгях — Храм огня", "Ateshgah — Fire Temple"], ["Янардаг — «горящая гора»", "Yanar Dag — the “burning mountain”"]],
    how: ["Рядом с Баку: 30–40 минут на такси или автобусе. Янардаг лучше смотреть вечером.", "Close to Baku: 30–40 minutes by taxi or bus. Yanar Dag is best in the evening."] },
  { id: "quba", city: "guba", ic: "trees", d: 2, h: [2.5, 3], p: [41.3611, 48.5134],
    n: ["Губа и горы", "Quba & the mountains"],
    see: [["Красная Слобода", "Red Settlement (Qırmızı Qəsəbə)"], ["Яблоневые сады", "Apple orchards"], ["Курорт Шахдаг (зимой — лыжи)", "Shahdag resort (skiing in winter)"]],
    how: ["Автобус с Международного автовокзала Баку, около 3 часов.", "Bus from Baku International Bus Terminal, about 3 hours."] },
  { id: "gabala", city: "gabala", ic: "waves", d: 2, h: [4, 5], p: [40.9981, 47.87],
    n: ["Габала", "Gabala"],
    see: [["Озеро Нохур", "Lake Nohur"], ["Канатная дорога Туфандаг", "Tufandag cable car"], ["Водопад «Семь красавиц»", "Seven Beauties waterfall"]],
    how: ["Автобус с Международного автовокзала Баку, 4–5 часов. Билет можно купить на biletim.az.", "Bus from Baku International Bus Terminal, 4–5 hours. Tickets on biletim.az."] },
  { id: "sheki", city: "sheki", ic: "castle", d: 2, h: [5, 6], p: [41.1975, 47.1706],
    n: ["Шеки", "Sheki"],
    see: [["Дворец шекинских ханов", "Palace of the Sheki Khans"], ["Старый караван-сарай", "Old caravanserai"], ["Шекинская халва", "Sheki halva"]],
    how: ["Автобус с Международного автовокзала Баку, 5–6 часов.", "Bus from Baku International Bus Terminal, 5–6 hours."] },
  { id: "ganja", city: "ganja", ic: "monument", d: 2, h: [5, 5.5], p: [40.6828, 46.3606],
    n: ["Гянджа", "Ganja"],
    see: [["Мавзолей Низами", "Nizami Mausoleum"], ["Бутылочный дом", "Bottle House"], ["Парк Хан-бага", "Khan's Garden park"]],
    how: ["Автобус с Международного автовокзала Баку (около 5 часов) или поезд.", "Bus from Baku International Bus Terminal (about 5 hours) or train."] }
];
// Междугородние автобусы из Баку: [ru, en, часы, цена AZN «от–до»] — ориентиры, точные данные в кассе / biletim.az
const INTERCITY = [
  ["Шамахы", "Shamakhi", "2", "3–5"], ["Губа", "Quba", "2,5–3", "5–7"], ["Габала", "Gabala", "4–5", "8–11"],
  ["Лянкяран", "Lankaran", "4–5", "8–11"], ["Гянджа", "Ganja", "5", "8–12"], ["Шеки", "Sheki", "5–6", "9–12"], ["Мингячевир", "Mingachevir", "4,5", "8–11"]
];
const BUS_TERMINAL = [40.4205, 49.7956];
const mapsTransit = dest => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(Array.isArray(dest) ? dest.join(",") : dest)}&travelmode=transit`;
const hrs = h => t("hours", { n: h.join("–").replace(/\./g, LANG === "en" ? "." : ",") });

// ---------- Готовые фразы по темам: [ru, en, az] — встроены в приложение, работают без интернета ----------
const PHRASE_GROUPS = [
  { id: "basic", ic: "message", n: ["Основное", "Basics"], items: [
    ["Здравствуйте", "Hello", "Salam"],
    ["Спасибо", "Thank you", "Təşəkkür edirəm"],
    ["Пожалуйста (прошу)", "Please", "Zəhmət olmasa"],
    ["Не за что", "You're welcome", "Dəyməz"],
    ["Да / Нет", "Yes / No", "Bəli / Xeyr"],
    ["Хорошо", "Okay", "Yaxşı"],
    ["Извините", "Excuse me", "Bağışlayın"],
    ["Я не понимаю", "I don't understand", "Başa düşmürəm"],
    ["Говорите медленнее, пожалуйста", "Please speak slowly", "Zəhmət olmasa, yavaş danışın"],
    ["Повторите, пожалуйста", "Please repeat", "Zəhmət olmasa, təkrar edin"],
    ["Напишите, пожалуйста", "Please write it down", "Zəhmət olmasa, yazın"],
    ["Вы говорите по-русски?", "Do you speak Russian?", "Rusca danışırsınız?"],
    ["Вы говорите по-английски?", "Do you speak English?", "İngiliscə danışırsınız?"],
    ["Я не говорю по-азербайджански", "I don't speak Azerbaijani", "Mən azərbaycanca danışmıram"],
    ["Как вас зовут?", "What is your name?", "Adınız nədir?"],
    ["Подождите минуту", "Wait a minute", "Bir dəqiqə gözləyin"],
    ["До свидания", "Goodbye", "Görüşənədək"]
  ] },
  { id: "transport", ic: "bus", n: ["Транспорт", "Transport"], items: [
    ["Где автобусная остановка?", "Where is the bus stop?", "Avtobus dayanacağı haradadır?"],
    ["Где метро?", "Where is the metro?", "Metro haradadır?"],
    ["Где автовокзал?", "Where is the bus station?", "Avtovağzal haradadır?"],
    ["Где вокзал?", "Where is the railway station?", "Vağzal haradadır?"],
    ["Где касса?", "Where is the ticket office?", "Kassa haradadır?"],
    ["Сколько стоит билет?", "How much is a ticket?", "Bilet neçəyədir?"],
    ["Когда отправляется автобус?", "When does the bus leave?", "Avtobus nə vaxt yola düşür?"],
    ["Этот автобус идёт в центр?", "Does this bus go to the centre?", "Bu avtobus mərkəzə gedir?"],
    ["Скажите, когда мне выходить", "Tell me when to get off", "Düşməli olanda deyin, zəhmət olmasa"],
    ["Остановите здесь, пожалуйста", "Stop here, please", "Burada saxlayın, zəhmət olmasa"],
    ["Где пополнить BakıKart?", "Where can I top up BakıKart?", "BakıKartı harada artırmaq olar?"],
    ["Отвезите меня по этому адресу", "Take me to this address", "Məni bu ünvana aparın"],
    ["Сколько стоит до аэропорта?", "How much to the airport?", "Hava limanına qədər neçəyədir?"],
    ["Это далеко?", "Is it far?", "Uzaqdır?"],
    ["Сколько ехать?", "How long does it take?", "Nə qədər vaxt çəkir?"]
  ] },
  { id: "food", ic: "food", n: ["Еда", "Food"], items: [
    ["Меню, пожалуйста", "The menu, please", "Menyu, zəhmət olmasa"],
    ["Столик на двоих", "A table for two", "İki nəfərlik masa"],
    ["Я не ем свинину", "I don't eat pork", "Mən donuz əti yemirəm"],
    ["Без мяса", "Without meat", "Ətsiz"],
    ["Не острое, пожалуйста", "Not spicy, please", "Acısız olsun, zəhmət olmasa"],
    ["Это халяль?", "Is it halal?", "Halaldır?"],
    ["Чай", "Tea", "Çay"],
    ["Вода", "Water", "Su"],
    ["Хлеб", "Bread", "Çörək"],
    ["Очень вкусно!", "Very tasty!", "Çox dadlıdır!"],
    ["Можно оплатить картой?", "Can I pay by card?", "Kartla ödəmək olar?"],
    ["Счёт, пожалуйста", "The bill, please", "Hesab, zəhmət olmasa"]
  ] },
  { id: "health", ic: "heart-pulse", n: ["Здоровье", "Health"], items: [
    ["Мне плохо", "I feel bad", "Özümü pis hiss edirəm"],
    ["Мне нужен врач", "I need a doctor", "Mənə həkim lazımdır"],
    ["Вызовите врача", "Call a doctor", "Həkim çağırın"],
    ["Где больница?", "Where is the hospital?", "Xəstəxana haradadır?"],
    ["Где аптека?", "Where is the pharmacy?", "Aptek haradadır?"],
    ["Болит голова", "I have a headache", "Başım ağrıyır"],
    ["Болит живот", "I have a stomach ache", "Qarnım ağrıyır"],
    ["Болит сердце", "My heart hurts", "Ürəyim ağrıyır"],
    ["У меня высокое давление", "I have high blood pressure", "Təzyiqim yüksəkdir"],
    ["У меня диабет", "I have diabetes", "Məndə diabet var"],
    ["У меня аллергия", "I have an allergy", "Məndə allergiya var"]
  ] },
  { id: "hotel", ic: "bed", n: ["Гостиница", "Hotel"], items: [
    ["У меня забронирован номер", "I have a reservation", "Mənim otaq bronum var"],
    ["Номер на одну ночь", "A room for one night", "Bir gecəlik otaq"],
    ["Сколько стоит ночь?", "How much per night?", "Bir gecə neçəyədir?"],
    ["Во сколько завтрак?", "What time is breakfast?", "Səhər yeməyi saat neçədədir?"],
    ["Какой пароль от Wi-Fi?", "What is the Wi-Fi password?", "Wi-Fi şifrəsi nədir?"],
    ["Здесь не работает", "It doesn't work here", "Burada işləmir"],
    ["Ключ, пожалуйста", "The key, please", "Açar, zəhmət olmasa"],
    ["Где туалет?", "Where is the toilet?", "Tualet haradadır?"]
  ] },
  { id: "shop", ic: "shopping", n: ["Магазин", "Shopping"], items: [
    ["Сколько стоит?", "How much is it?", "Neçəyədir?"],
    ["Можно посмотреть?", "May I look?", "Baxmaq olar?"],
    ["Дорого", "It's expensive", "Bahadır"],
    ["Можно дешевле?", "Can it be cheaper?", "Ucuz olar?"],
    ["Я беру", "I'll take it", "Götürürəm"],
    ["Где банкомат?", "Where is an ATM?", "Bankomat haradadır?"],
    ["Пакет, пожалуйста", "A bag, please", "Paket, zəhmət olmasa"]
  ] },
  { id: "sos", ic: "siren", n: ["Экстренное", "Emergency"], items: [
    ["Помогите!", "Help!", "Kömək edin!"],
    ["Мне нужна помощь", "I need help", "Mənə kömək lazımdır"],
    ["Вызовите скорую помощь", "Call an ambulance", "Təcili yardım çağırın"],
    ["Вызовите полицию", "Call the police", "Polis çağırın"],
    ["Я потерялся", "I am lost", "Mən azmışam"],
    ["У меня украли сумку", "My bag was stolen", "Çantamı oğurladılar"],
    ["Позвоните моим родным", "Call my family", "Qohumlarıma zəng edin"],
    ["Я иностранец", "I am a foreigner", "Mən əcnəbiyəm"]
  ] }
];
const PHRASES = PHRASE_GROUPS.flatMap(g => g.items);

// ---------- Города для работы без интернета: любой из городов приложения (список собирается после загрузки данных) ----------
let OFF_CITIES = [], OFF_CITY = {};
// Вид места → группа (фильтр на карте), значок и цвет метки
const KINDS = {
  sight: ["sight", "dome", "#b7791f"], museum: ["sight", "museum", "#b7791f"],
  metro: ["move", "train", "#0e6a8f"], bus: ["move", "bus", "#0e6a8f"], train: ["move", "train-fast", "#0e6a8f"], airport: ["move", "plane", "#0e6a8f"],
  pharmacy: ["health", "pill", "#1d7a46"], hospital: ["health", "hospital", "#c0392b"], clinic: ["health", "clinic", "#1d7a46"],
  atm: ["money", "banknote", "#6b4fa0"], toilets: ["toilet", "toilet", "#4a5a66"], police: ["police", "shield", "#1f3f73"]
};
const KIND_GROUPS = ["sight", "move", "health", "money", "toilet"];

// ---------- Данные: города и места Азербайджана (data/az-*.js — собирает scripts/fetch-az.mjs из OpenStreetMap и Wikidata) ----------
const AZDB = window.SAFAR_CITIES || { cities: [], climate: [] };
const CITIES = (AZDB.cities || []).map(c => ({ ...c, counts: { h: 0, a: 0, s: 0, f: 0 } }));
const CITY = Object.fromEntries(CITIES.map(c => [c.id, c]));
const POIS = (window.SAFAR_POIS || []).filter(p => CITIES[p.ci]).map(p => {
  const city = CITIES[p.ci];
  city.counts[p.c]++;
  return { ...p, city, hay: [p.n, p.nr, p.ne].filter(Boolean).join(" ").toLowerCase() };
});
const POI = Object.fromEntries(POIS.map(p => [p.id, p]));
CITIES.forEach(c => { c.hay = [c.n.az, c.n.ru, c.n.en].filter(Boolean).join(" ").toLowerCase(); });
const cityName = c => (LANG === "en" ? c.n.en || c.n.az : c.n.ru || c.n.en) || c.n.az;
const poiName = p => (LANG === "en" ? p.ne : p.nr) || p.n;
const commonsImg = (file, width = 640) =>
  file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file).replace(/['()]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase())}?width=${width}` : "";
const fmtNum = n => Number(n).toLocaleString(LANG === "en" ? "en-US" : "ru-RU");
const byEn = re => CITIES.find(c => re.test(c.n.en || "") || re.test(c.n.az || ""));
// Главные города — для главной; если в данных нет — просто самые крупные с фото
const MAIN_CITIES = [/^Baku$/i, /^Ganja$/i, /^Sheki$|^Şəki$/i, /^Gabala$|^Qəbələ$/i, /^Quba$/i, /^Shamakhi$|^Şamaxı$/i, /^Lankaran$|^Lənkəran$/i, /^Nakhchivan$|^Naxçıvan$/i, /^Mingachevir$|^Mingəçevir$/i, /^Sumqayit$|^Sumqayıt$/i]
  .map(byEn).filter(Boolean);
const POPULAR = MAIN_CITIES.length >= 6 ? MAIN_CITIES : CITIES.filter(c => c.img).slice(0, 8);
const BAKU = byEn(/^Baku$/i) || CITIES[0];
// Скачать без интернета можно любой город: центр и названия — из данных
OFF_CITIES = CITIES.map(c => ({ id: c.id, n: [c.n.ru || c.n.en, c.n.en || c.n.az], p: [c.lat, c.lon], city: c }));
OFF_CITY = Object.fromEntries(OFF_CITIES.map(c => [c.id, c]));

// Тип места → подпись и значок (как в узбекском приложении)
const TYPE_TX = {
  hotel: ["Гостиница", "Hotel"], guest_house: ["Гостевой дом", "Guest house"], hostel: ["Хостел", "Hostel"], motel: ["Мотель", "Motel"], apartment: ["Апартаменты", "Apartment"],
  marketplace: ["Базар", "Bazaar"], mall: ["Торговый центр", "Mall"], department_store: ["Универмаг", "Department store"], souvenir: ["Сувениры", "Souvenirs"], gift: ["Подарки", "Gifts"],
  art: ["Искусство", "Art"], craft: ["Ремёсла", "Crafts"], carpet: ["Ковры", "Carpets"], jewelry: ["Ювелирный", "Jewellery"], tea: ["Чай", "Tea"], spices: ["Специи", "Spices"], confectionery: ["Сладости", "Sweets"],
  attraction: ["Достопримечательность", "Attraction"], museum: ["Музей", "Museum"], viewpoint: ["Смотровая площадка", "Viewpoint"], gallery: ["Галерея", "Gallery"], zoo: ["Зоопарк", "Zoo"], theme_park: ["Парк развлечений", "Theme park"],
  castle: ["Крепость", "Castle"], fort: ["Крепость", "Fort"], ruins: ["Руины", "Ruins"], archaeological_site: ["Раскопки", "Archaeological site"], tomb: ["Мавзолей", "Mausoleum"], monument: ["Памятник", "Monument"],
  city_gate: ["Городские ворота", "City gate"], minaret: ["Минарет", "Minaret"], building: ["Историческое здание", "Historic building"], restaurant: ["Ресторан", "Restaurant"], cafe: ["Кафе", "Café"]
};
const typeLabel = s => LL(...(TYPE_TX[s] || ["Место", "Place"]));
const TYPE_ICON = { museum: "museum", viewpoint: "viewpoint", gallery: "gallery", zoo: "zoo", theme_park: "theme-park", castle: "castle", fort: "castle", ruins: "ruins",
  archaeological_site: "pickaxe", tomb: "dome", monument: "monument", city_gate: "gate", minaret: "minaret", building: "dome", attraction: "star",
  hotel: "hotel", guest_house: "house", hostel: "bed", motel: "bed-single", apartment: "building", restaurant: "food", cafe: "coffee",
  marketplace: "basket", mall: "mall", department_store: "shopping", souvenir: "gift", gift: "gift", jewelry: "gem", spices: "flame", confectionery: "candy", tea: "teapot", carpet: "rug", art: "palette", craft: "scissors" };
const CAT_ICON = { h: "hotel", a: "dome", s: "shopping", f: "food", t: "bus" };
const poiIcon = p => TYPE_ICON[p.s] || CAT_ICON[p.c] || "pin";
const poiPhoto = (p, w) => p.im ? commonsImg(p.im, w) : "";
// Известность места: статьи в Википедии, фото, звёзды — для сортировки «сначала главное»
const fame = p => (p.fm || 0) * 3 + (p.im ? 4 : 0) + (p.wd ? 2 : 0) + (p.st || 0) + (p.ph ? 1 : 0) + (p.oh ? 1 : 0);
const placeDist = p => USER_POS ? km(USER_POS, [p.la, p.lo]) : null;
let USER_POS = null;
const dirUrl = p => `https://www.google.com/maps/dir/?api=1&destination=${p.la},${p.lo}&travelmode=transit`;
// Свой навигатор (js/az-nav.js): #go/широта,долгота,название — работает и без интернета
const goHref = (la, lo, name = "") => `#go/${(+la).toFixed(5)},${(+lo).toFixed(5)},${encodeURIComponent(name)}`;
const goBtn = (la, lo, name, label = t("route_btn"), cls = "") => `<a class="az-btn ${cls}" href="${goHref(la, lo, name)}">${icon("directions")} ${label}</a>`;
const bookingUrl = p => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(poiName(p) + ", " + (p.city.n.en || ""))}&lang=${LANG === "en" ? "en-gb" : "ru"}`;

// Строка места — как в узбекском приложении: фото или значок, название, тип, город, кнопки
// ---------- Цены на карте и в списках (манаты). Проверено по открытым источникам в октябре 2026 ----------
// Известные места — их реальная цена входа для иностранца; остальное — обычная вилка для такого вида места
// (в Баку дороже, в регионах ~0,7 от бакинской). Всё помечено «оценка», кроме известных цен.
const PRICE_CHECKED = ["окт. 2026", "Oct 2026"];
const AZ_FEES = [
  [/qız qalası|maiden tower|девичья башня/i, [15], /^Baku$/],
  [/şirvanşahlar|shirvanshah|ширваншах/i, [15, 24], /^Baku$/],
  [/heydər əliyev mərkəzi|heydar aliyev (cultural )?cent|центр гейдара/i, [15]],
  [/xalça muzeyi|carpet museum|музей ковра/i, [7, 10]],
  [/atəşgah|ateshgah|атешгях/i, [6, 10]],
  [/yanar ?dağ|yanardag|янардаг/i, [9, 10]],
  [/qobustan.*(qoruğ|muzey)|gobustan.*(reserve|museum|national)|гобустан/i, [10]],
  [/xan sarayı|khan'?s palace|ханский дворец/i, [5, 10], /^Sheki$|^Shaki$|^Şəki$/],
  [/kiş.*(kilsə|məbəd)|church of kish|кишская/i, [4]],
  [/tufandağ|tufandag/i, [11, 20]],
  [/qəbələnd|gabaland/i, [4, 15]],
  [/kiçik venesiya|little venice|малая венеция/i, [3]],
  [/dağüstü park|highland park|нагорный парк|dənizkənarı bulvar|seaside boulevard|приморский бульвар|alov qüllələri|flame towers/i, [0]]
];
const AZ_FREE = new Set(["monument", "viewpoint", "city_gate", "building", "tomb", "ruins", "archaeological_site", "minaret"]);
// [мин, макс] в манатах для Баку; null — не знаем
const AZ_KIND_PRICE = {
  museum: [5, 10], gallery: [2, 5], castle: [2, 5], fort: [2, 5], theme_park: [5, 20], zoo: [3, 6],
  hotel: [70, 150], guest_house: [35, 70], hostel: [15, 30], motel: [30, 60], apartment: [50, 110],
  cafe: [6, 12], restaurant: [15, 35]
};
const AZ_STAR_PRICE = { 1: [35, 60], 2: [45, 75], 3: [60, 100], 4: [110, 200], 5: [220, 450] };
const roundAzn = v => v >= 20 ? Math.round(v / 5) * 5 : v >= 5 ? Math.round(v) : Math.round(v * 10) / 10;
// Цена места: { lo, hi, est (оценка), unit ("night" | "person" | "ticket") } или null
function poiPrice(p) {
  const names = [p.n, p.nr, p.ne].filter(Boolean).join(" | ");
  if (p.c === "a") {
    const fee = AZ_FEES.find(([re, , city]) => re.test(names) && (!city || city.test(p.city?.n?.en || p.city?.n?.az || "")));
    if (fee) return { lo: fee[1][0], hi: fee[1][1] ?? fee[1][0], est: false, unit: "ticket" };
    if (AZ_FREE.has(p.s)) return { lo: 0, hi: 0, est: true, unit: "ticket" };
  }
  const base = p.c === "h" && p.st && AZ_STAR_PRICE[p.st] || AZ_KIND_PRICE[p.s];
  if (!base) return null;
  const k = p.city === BAKU ? 1 : 0.7;
  return { lo: roundAzn(base[0] * k), hi: roundAzn(base[1] * k), est: true, unit: p.c === "h" ? "night" : p.c === "f" ? "person" : "ticket" };
}
// 0,60 ₼ и 1,30 ₼ — с копейками, целые — без
const fmtMan = v => Number.isInteger(v) ? fmtNum(v) : v.toLocaleString(LANG === "en" ? "en-US" : "ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtAzn = (lo, hi) => lo === 0 && hi === 0 ? t("pr_free") : lo === hi ? `${fmtMan(lo)} ₼` : `${fmtMan(lo)}–${fmtMan(hi)} ₼`;
const isGyd = name => /heydər|heydar|gyd|гейдар/i.test(name);
// Короткая подпись под значком на карте и в списке
const priceChip = pr => pr ? (pr.est && pr.lo ? "~" : "") + fmtAzn(pr.lo, pr.hi) : "";
// Рядом — в узбекских сумах (курс маната с главной; без сети — последний сохранённый или примерный)
const AZN_UZS_FALLBACK = 6900;   // ≈ курс октября 2026
const aznUzs = () => store.get("az_rates", null)?.rates?.UZS || AZN_UZS_FALLBACK;
const uzsRound = v => v >= 1000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100;
const uzsShort = v => v >= 1000 ? fmtNum(Math.round(v / 1000)) : fmtNum(uzsRound(v));
// «≈ 104 тыс. сум» / «≈ 485–1 040 тыс. сум» (коротко, для значка и списков) или «≈ 104 000 сум» (полностью)
function fmtUzs(lo, hi = lo, full = false) {
  if (!lo && !hi) return "";
  const r = aznUzs(), a = lo * r, b = hi * r, k = b >= 1000 && !full ? " " + t("pr_k") : "";
  const f = full ? v => fmtNum(uzsRound(v)) : uzsShort;
  return "≈ " + (uzsRound(a) === uzsRound(b) ? f(a) : f(a) + "–" + f(b)) + k + " " + t("pr_sum");
}
const uzsOf = pr => pr ? fmtUzs(pr.lo, pr.hi) : "";
// Строка для всплывающей карточки: «Вход: 15 ₼ · проверено окт. 2026»
function priceLine(pr) {
  if (!pr) return "";
  const what = t("pr_" + pr.unit);
  const uz = fmtUzs(pr.lo, pr.hi, true);
  return `<div class="az-price-line">${icon("banknote")} <b>${what}: ${fmtAzn(pr.lo, pr.hi)}</b>${uz ? `<span class="az-uzs">${uz}</span>` : ""}<small>${pr.est ? t("pr_est") : t("pr_checked", { d: LL(...PRICE_CHECKED) })}</small></div>`;
}
// Транспорт: проезд (вид из офлайн-карты или из справочника станций)
// В строках тарифов цены записаны как {0.6} или {3-15} — подставляем манаты и рядом сумы
const fareText = key => t(key).replace(/\{([\d.]+)(?:-([\d.]+))?\}/g, (m, a, b) => { const lo = +a, hi = +(b || a); return `${fmtAzn(lo, hi)} (${fmtUzs(lo, hi)})`; });
// Проезд: { text, est, lo, hi } — lo/hi — главный тариф (для подписи на значке)
function farePrice(kind, city, name = "") {
  const baku = city === BAKU, f = (key, est, lo, hi = lo) => ({ text: fareText(key), est, lo, hi });
  if (kind === "metro" || (kind === "train" && baku)) return f("fare_metro", false, 0.6);
  if (kind === "bus") return baku ? f("fare_bus_baku", false, 0.6) : f("fare_bus", true, 3, 15);
  if (kind === "train") return f("fare_train", true, 5, 20);
  if (kind === "airport") return isGyd(name) ? f("fare_gyd", false, 1.3) : f("fare_airport", true, 5, 15);
  return null;
}
// Подпись цены под значком карты (видна при приближении — см. .az-map.far в az.css)
// Подписи цен не должны налезать друг на друга: оставляем первую (места идут по важности / близости),
// остальные прячем — они появятся при приближении карты
function declutterPrices() {
  const taken = [], pins = $$("#azMap .az-pin").map(p => p.getBoundingClientRect());
  // точные цены (известные места) — в первую очередь
  $$("#azMap .az-pin-price").sort((x, y) => y.classList.contains("exact") - x.classList.contains("exact")).forEach(el => {
    el.classList.remove("hide");
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    // чужой значок поверх подписи тоже мешает читать
    if (!el.classList.contains("exact") && pins.some(o => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top) ||
      taken.some(o => r.left < o.right + 4 && r.right > o.left - 4 && r.top < o.bottom + 2 && r.bottom > o.top - 2)) return el.classList.add("hide");
    taken.push(r);
  });
}
// Подпись под значком: манаты, ниже — сумы
const pinPrice = (pr, exact) => pr ? `<em class="az-pin-price${exact ? " exact" : ""}">${esc(priceChip(pr))}${uzsOf(pr) ? `<small>${esc(uzsOf(pr))}</small>` : ""}</em>` : "";
const fareChip = (kind, city, name = "") => farePrice(kind, city, name);
// Транспорт на карте страны: вокзалы, автовокзалы, аэропорты, метро (из data/az-services.js)
const TRANSPORT = [];
async function loadTransport() {
  if (TRANSPORT.length) return TRANSPORT;
  const svc = await loadServices().catch(() => []);
  svc.forEach((r, i) => { if (r[0] === "rail" || r[0] === "bus" || r[0] === "airport") TRANSPORT.push({ id: "t" + i, c: "t", k: SVC_KIND[r[0]], la: r[1], lo: r[2], city: CITIES[r[3]] || BAKU, n: r[4] || "" }); });
  return TRANSPORT;
}
const trLabel = p => t(p.k === "train" && p.city === BAKU ? "t_metro_rail" : "t_" + p.k);
const trName = p => p.n || trLabel(p);
function transportMarker(p) {
  const [, ic, color] = KINDS[p.k];
  return L.marker([p.la, p.lo], { pid: p.id, icon: L.divIcon({ className: "", html: `<span class="az-pin" style="background:${color}">${icon(ic)}</span>${pinPrice(fareChip(p.k, p.city, p.n), p.city === BAKU || isGyd(p.n))}`, iconSize: [30, 30], iconAnchor: [15, 15] }) })
    .bindPopup(`<b>${esc(trName(p))}</b><br>${trLabel(p)} · ${esc(cityName(p.city))}${fareLine(farePrice(p.k, p.city, p.n))}<a href="${goHref(p.la, p.lo, trName(p))}">${icon("directions")} ${t("route_short")} →</a>`);
}
function transportRow(p) {
  const [, ic, color] = KINDS[p.k], f = farePrice(p.k, p.city, p.n);
  return `<button type="button" class="az-row" data-map-go="${p.la},${p.lo}"><span class="az-pin big" style="background:${color}">${icon(ic)}</span><div><b>${esc(trName(p))}</b><small>${trLabel(p)} · ${esc(cityName(p.city))}</small>${f ? `<small class="az-row-price">${esc(f.text)}</small>` : ""}</div></button>`;
}
const fareLine = f => f ? `<div class="az-price-line">${icon("ticket")} <b>${f.text}</b><small>${f.est ? t("pr_est") : t("pr_checked", { d: LL(...PRICE_CHECKED) })}</small></div>` : "";

function poiRow(p) {
  const ph = poiPhoto(p, 160), d = placeDist(p);
  const ico = ph ? `<div class="ico img" style="background-image:url('${ph}')"></div>` : `<div class="ico cat-${p.c}">${icon(poiIcon(p))}</div>`;
  const stars = p.st ? ` <span class="stars gold">${icon("star", "fill").repeat(p.st)}</span>` : "";
  const extra = [p.ad && `<span>${icon("pin")} ${esc(p.ad)}</span>`, p.oh && `<span>${icon("clock")} ${esc(p.oh)}</span>`].filter(Boolean).join(" · ");
  return `
    <div class="row" data-go="#place/${p.id}" tabindex="0" role="link">
      ${ico}
      <div>
        <h4>${esc(poiName(p))}${stars}<span class="badge type">${typeLabel(p.s)}</span></h4>
        <div class="sub"><span>${icon("city")} ${esc(cityName(p.city))}</span>${d != null ? ` · <span>${icon("locate")} ${fmtDist(d)}</span>` : ""}${(pr => pr ? ` · <span class="az-row-price">${icon("banknote")} ${priceChip(pr)}${pr.unit === "night" ? t("pr_per_night") : ""}${uzsOf(pr) ? " · " + uzsOf(pr) : ""}</span>` : "")(poiPrice(p))}</div>
        ${extra ? `<div class="sub">${extra}</div>` : ""}
        <div class="acts">
          <a class="btn small gold-btn" href="${goHref(p.la, p.lo, poiName(p))}">${icon("directions")} ${t("route_short")}</a>
          ${p.c === "h" ? `<a class="btn small ghost" href="${bookingUrl(p)}" target="_blank" rel="noopener">${icon("search")} Booking</a>` : ""}
          ${p.ph ? `<a class="btn small ghost" href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${icon("phone")} ${t("call")}</a>` : ""}
        </div>
      </div>
    </div>`;
}
// Карточка города — как в узбекском приложении
function cityCard(c) {
  const img = c.img ? `background-image:url('${commonsImg(c.img, 480)}')` : "background:var(--g-c)";
  return `
    <div class="card" data-go="#city/${c.id}" tabindex="0" role="link">
      <div class="card-img ${c.img ? "has-img" : ""}" style="${img}">${c.img ? "" : `<span class="card-mono">${esc(cityName(c).slice(0, 1))}</span>`}
        <span class="tag">${c.t === "city" ? t("city") : t("town")}${c.pop ? " · " + popText(c.pop) : ""}</span></div>
      <div class="card-body">
        <h3>${esc(cityName(c))}</h3>
        ${c.n.az && c.n.az !== cityName(c) ? `<div class="sub">${esc(c.n.az)}</div>` : ""}
        <div class="meta"><span title="${t("cat_a")}">${icon("dome")} ${c.counts.a}</span> <span title="${t("cat_h")}">${icon("hotel")} ${c.counts.h}</span> <span title="${t("cat_f")}">${icon("food")} ${c.counts.f}</span></div>
      </div>
    </div>`;
}
const popText = n => n >= 1e6 ? LL(`${(n / 1e6).toFixed(1).replace(".", ",")} млн жителей`, `${(n / 1e6).toFixed(1)}M people`) : n >= 1e3 ? LL(`${Math.round(n / 1e3)} тыс. жителей`, `${Math.round(n / 1e3)}k people`) : LL(`${n} жителей`, `${n} people`);
// Список с кнопкой «Показать ещё»
function paged(box, items, render, page = 20) {
  let shown = 0;
  const more = () => {
    box.querySelector(".az-more")?.remove();
    box.insertAdjacentHTML("beforeend", items.slice(shown, shown + page).map(render).join(""));
    shown += page;
    if (shown < items.length) box.insertAdjacentHTML("beforeend", `<button type="button" class="az-btn ghost wide az-more">${icon("chevron-down")} ${t("more")} (${fmtNum(items.length - shown)})</button>`);
  };
  box.innerHTML = items.length ? "" : `<p class="az-empty">${icon("search")}${t("nothing")}</p>`;
  box.onclick = e => { if (e.target.closest(".az-more")) more(); };
  if (items.length) more();
}

// ---------- Погода сейчас (Open-Meteo, бесплатно) и курс маната ----------
const W_ICON = c => c === 0 ? "w-sun" : c <= 2 ? "w-partly" : c === 3 ? "w-cloud" : c <= 48 ? "w-fog" : c <= 57 ? "w-drizzle" : c <= 67 ? "w-rain" : c <= 77 ? "w-snow" : c <= 82 ? "w-rain" : c <= 86 ? "w-snow" : "w-storm";
async function loadWeather(list) {
  const key = "az_weather", cached = store.get(key, null);
  if (cached && Date.now() - cached.at < 30 * 60e3 && cached.ids === list.map(c => c.id).join()) return cached.data;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${list.map(c => c.lat).join(",")}&longitude=${list.map(c => c.lon).join(",")}&current=temperature_2m,weather_code&timezone=Asia%2FBaku`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json(), arr = Array.isArray(j) ? j : [j];
    const data = arr.map(x => ({ t: Math.round(x.current.temperature_2m), c: x.current.weather_code }));
    store.set(key, { at: Date.now(), ids: list.map(c => c.id).join(), data });
    return data;
  } catch { return cached?.data || null; }
}
async function renderWeather(box, list) {
  if (!box || !list.length) return;
  box.innerHTML = list.map(() => `<div class="wcard"><div class="skeleton"></div><div class="skeleton"></div></div>`).join("");
  const data = await loadWeather(list);
  if (!data) { box.innerHTML = `<p class="hint">${t("offline")}</p>`; return; }
  box.innerHTML = list.map((c, i) => data[i] ? `<a class="wcard" href="#city/${c.id}"><span class="w-city">${esc(cityName(c))}</span><span class="w-ico">${icon(W_ICON(data[i].c))}</span><b class="w-temp">${data[i].t > 0 ? "+" : ""}${data[i].t}°</b></a>` : "").join("");
}
// Курс маната (раз в 6 часов): для блока на главной и для цен в сумах на карте
async function loadAzRates() {
  let r = store.get("az_rates", null);
  if (!r || Date.now() - r.at > 6 * 3600e3) {
    try {
      const j = await (await fetch("https://open.er-api.com/v6/latest/AZN", { signal: AbortSignal.timeout(10000) })).json();
      if (j.result === "success") { r = { at: Date.now(), rates: j.rates }; store.set("az_rates", r); }
    } catch { /* без сети — прошлый курс */ }
  }
  return r;
}
setTimeout(loadAzRates, 2000);
async function renderRates(box) {
  if (!box) return;
  const r = await loadAzRates();
  if (!r) { box.innerHTML = `<p class="hint">${t("offline")}</p>`; return; }
  box.innerHTML = `<div class="az-rates">${["USD", "EUR", "RUB", "TRY", "UZS"].filter(k => r.rates[k]).map(k => {
    const per = 1 / r.rates[k], n = k === "RUB" || k === "TRY" ? 100 : k === "UZS" ? 10000 : 1;
    return `<div class="az-rate"><small>${n === 1 ? "1" : fmtNum(n)} ${k}</small><b>${(per * n).toFixed(2).replace(".", LANG === "en" ? "." : ",")} ₼</b></div>`;
  }).join("")}</div><p class="hint">${t("rates_src", { date: new Date(r.at).toLocaleDateString(LANG === "en" ? "en-GB" : "ru-RU") })}</p>`;
}

// Описание из Википедии (кэшируется на телефоне — второй раз открывается и без сети)
async function wikiSummary(title, langs = LANG === "en" ? ["en", "ru"] : ["ru", "en"]) {
  if (!title) return null;
  const titles = typeof title === "string" ? Object.fromEntries(langs.map(l => [l, title])) : title;
  for (const l of langs) {
    if (!titles[l]) continue;
    const key = "az_wiki_" + l + ":" + titles[l], hit = store.get(key, null);
    if (hit) return hit;
    try {
      const r = await fetch(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[l].replace(/ /g, "_"))}`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.extract) { const v = { text: j.extract, url: j.content_urls?.mobile?.page || "" }; store.set(key, v); return v; }
    } catch { /* без сети */ }
  }
  return null;
}

Object.assign(TX, {
  nav_home: ["Главная", "Home"], nav_cities: ["Города", "Cities"], nav_places: ["Места", "Places"], nav_map: ["Карта", "Map"], nav_buses: ["Автобусы", "Buses"], nav_chat: ["Чат", "Chat"],
  hero_title: ["Куда поедем?", "Where to?"], hero_sub: ["Города, места, отели, автобусы и переводчик — по всему Азербайджану", "Cities, places, hotels, buses and a translator — all over Azerbaijan"],
  search_ph: ["Город, место или отель…", "City, place or hotel…"], quick: ["Главное — быстро", "The essentials"], popular: ["Популярные города", "Popular cities"], see_all: ["Все →", "All →"],
  stat_cities: ["городов", "cities"], stat_sights: ["мест", "sights"], stat_hotels: ["отелей", "hotels"], stat_food: ["кафе и ресторанов", "cafés & restaurants"],
  top_sights: ["Что посмотреть", "Top sights"], weather_now: ["Погода сейчас", "Weather now"], rates_title: ["Курс маната", "Manat rates"], rates_src: ["Курс на {date}", "Rates as of {date}"],
  data_src: ["Данные: OpenStreetMap, Wikidata, Википедия, Open-Meteo", "Data: OpenStreetMap, Wikidata, Wikipedia, Open-Meteo"],
  cities_lead: ["Нажмите на город — откроются места, отели и еда.", "Tap a city to see places, hotels and food."], search_city: ["Название города", "City name"],
  sort: ["Сортировка", "Sort"], sort_pop: ["Сначала крупные", "Largest first"], sort_sights: ["Больше мест", "Most sights"], sort_name: ["По алфавиту", "A–Z"],
  city: ["город", "city"], town: ["посёлок", "town"], cat_a: ["Места", "Sights"], cat_h: ["Отели", "Hotels"], cat_f: ["Еда", "Food"], cat_s: ["Магазины", "Shops"],
  auto_title: ["Скачивать для работы без интернета само", "Download for offline use automatically"],
  auto_sub: ["Сразу при открытии приложения сами скачиваются: город, где вы сейчас (или Баку), перевод по фото и азербайджанский переводчик. Всё будет работать без интернета, даже если вы забыли. Не на медленной связи и не при экономии трафика.", "As soon as you open the app it downloads by itself: the city you are in (or Baku), photo translation and the Azerbaijani translator. Everything works offline even if you forget. Not on slow connections or with Data Saver on."],
  auto_ocr: ["Перевод по фото скачан — работает без интернета", "Photo translation downloaded — works offline"],
  auto_mt: ["Скачиваем азербайджанский переводчик для работы без интернета…", "Downloading the Azerbaijani translator for offline use…"],
  auto_start: ["Скачиваем «{city}» для работы без интернета…", "Downloading “{city}” for offline use…"],
  auto_done: ["«{city}» скачан — карта и места работают без интернета", "“{city}” downloaded — map and places work offline"], taxi_t: ["Такси", "Taxi"], mine: ["Мои места", "My places"], mine_sub: ["Отель и избранное", "Hotel and favourites"], cat_t: ["Транспорт", "Transport"],
  route_short: ["Маршрут", "Route"], call: ["Позвонить", "Call"], more: ["Показать ещё", "Show more"], nothing: ["Ничего не найдено", "Nothing found"],
  places_lead: ["Выберите, что ищете, и город.", "Choose what you need and a city."], search_place: ["Название места", "Place name"], all_cities: ["Все города", "All cities"],
  on_map: ["На карте", "On the map"], no_details: ["Подробностей пока нет.", "No details yet."], nearby: ["Рядом стоит посмотреть", "Worth seeing nearby"], found: ["Найдено: {n}", "Found: {n}"]
});
const CITY_TAB = {};
let PLACE_CAT = "a";
// Запуск интерактивных частей новых экранов (вызывается из route после отрисовки)
function screenStart(kind, id) {
  // Без интернета: все города с поиском — скачанные первыми, дальше крупные
  if (kind === "offline") {
    const draw = () => {
      const q = $("#offQ").value.trim().toLowerCase(), pk = offPacks();
      const list = OFF_CITIES.filter(c => !q || c.city.hay.includes(q)).sort((a, b) => (pk[b.id] ? 1 : 0) - (pk[a.id] ? 1 : 0) || (b.city.pop || 0) - (a.city.pop || 0));
      paged($("#offCities"), list, offCityHtml, 12);
    };
    $("#offQ").oninput = draw;
    draw();
  }
  if (kind === "home") { renderWeather($("#azWeather"), POPULAR.slice(0, 6)); renderRates($("#azRates")); }
  if (kind === "cities") {
    const draw = () => {
      const q = $("#cityQ").value.trim().toLowerCase(), s = $("#citySort").value;
      const list = CITIES.filter(c => !q || c.hay.includes(q)).sort(s === "name" ? (a, b) => cityName(a).localeCompare(cityName(b)) : s === "sights" ? (a, b) => b.counts.a - a.counts.a : (a, b) => (b.pop || 0) - (a.pop || 0));
      $("#cityFound").textContent = t("found", { n: list.length });
      paged($("#cityGrid"), list, cityCard, 24);
    };
    $("#cityQ").oninput = draw; $("#citySort").onchange = draw; draw();
  }
  if (kind === "places") {
    const k = ["a", "h", "f", "s"].includes(id) ? id : PLACE_CAT;
    PLACE_CAT = k;
    const draw = () => {
      const q = $("#placeQ").value.trim().toLowerCase(), c = $("#placeCity").value;
      const list = POIS.filter(p => p.c === k && (!c || p.city.id === c) && (!q || p.hay.includes(q))).sort((a, b) => fame(b) - fame(a));
      $("#placeFound").textContent = t("found", { n: fmtNum(list.length) });
      paged($("#placeList"), list, poiRow);
    };
    $("#placeQ").oninput = draw; $("#placeCity").onchange = draw; draw();
  }
  if (kind === "city" && CITY[id]) {
    const c = CITY[id];
    const draw = k => { CITY_TAB[c.id] = k; paged($("#cityList"), POIS.filter(p => p.city === c && p.c === k).sort((a, b) => fame(b) - fame(a)), poiRow); };
    draw(CITY_TAB[c.id] || (c.counts.a ? "a" : "h"));
    $("#cityTabs").onclick = e => { const b = e.target.closest("[data-city-tab]"); if (!b) return; $$("#cityTabs button").forEach(x => x.classList.toggle("on", x === b)); draw(b.dataset.cityTab); };
    wikiSummary(c.wiki || {}).then(w => { const box = $("#cityStory"); if (box) box.innerHTML = w ? `<p>${esc(w.text)}</p>${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${t("wiki_more")}</a>` : ""}` : `<p class="hint">${t("no_details")}</p>`; });
    loadWeather([c]).then(d => { const el = $("#cityWx"); if (el && d?.[0]) el.innerHTML = `${icon(W_ICON(d[0].c))} ${d[0].t > 0 ? "+" : ""}${d[0].t}°`; });
  }
  if (kind === "place" && POI[id]) {
    const p = POI[id];
    const wp = p.wp ? Object.fromEntries([p.wp.split(":")].map(([l, ...r]) => [l, r.join(":")])) : null;
    if (wp) wikiSummary(wp, Object.keys(wp)).then(w => { const box = $("#placeStory"); if (box && w) { box.hidden = false; box.innerHTML = `<p>${esc(w.text)}</p>`; } });
    loadLeaflet().then(ok => { const el = $("#placeMini"); if (!ok || !el) return el?.remove(); const m = L.map(el, { zoomControl: false, attributionControl: false }).setView([p.la, p.lo], 16); azBase(m, [p.la, p.lo], { noAttr: true }); L.marker([p.la, p.lo]).addTo(m); });
  }
}
TX.wiki_more = ["Подробнее в Википедии", "More on Wikipedia"];
Object.assign(TX, {
  map_lead: ["Выберите, что показать. Нажмите на значок — увидите фото и название.", "Choose what to show. Tap a pin to see the photo and name."],
  map_in_view: ["Интересное на этой части карты", "Highlights in this part of the map"], details: ["Подробнее", "Details"],
  map_zoom_out: ["Здесь ничего нет — отдалите карту или выберите другой раздел.", "Nothing here — zoom out or pick another category."]
});
// Поиск на главной: города и места
document.addEventListener("input", e => {
  if (e.target.id !== "azSearch") return;
  const q = e.target.value.trim().toLowerCase(), box = $("#azResults");
  if (q.length < 2) { box.classList.add("hidden"); return; }
  const cs = CITIES.filter(c => c.hay.includes(q)).slice(0, 5), ps = POIS.filter(p => p.hay.includes(q)).sort((a, b) => fame(b) - fame(a)).slice(0, 8);
  box.innerHTML = [...cs.map(c => `<a class="sr-item" href="#city/${c.id}"><span class="ic">${icon("city")}</span><div>${esc(cityName(c))}<small>${esc(c.n.az || "")}</small></div></a>`),
    ...ps.map(p => `<a class="sr-item" href="#place/${p.id}"><span class="ic">${icon(poiIcon(p))}</span><div>${esc(poiName(p))}<small>${typeLabel(p.s)} · ${esc(cityName(p.city))}</small></div></a>`)].join("") || `<div class="empty">${t("nothing")}</div>`;
  box.classList.remove("hidden");
});
// Карточки и строки с data-go открываются по нажатию (как в узбекском приложении)
document.addEventListener("click", e => {
  if (e.target.closest("a, button")) return;
  const go = e.target.closest("[data-go]");
  if (go) location.hash = go.dataset.go;
});

// ---------- Мелочи интерфейса ----------
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}
function askConfirm(title, text, ok, danger = false) {
  return new Promise(resolve => {
    $(".az-confirm")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="az-confirm" role="alertdialog" aria-modal="true" aria-labelledby="azCfT">
      <div><h3 id="azCfT">${title}</h3>${text ? `<p>${text}</p>` : ""}
        <div class="az-btns"><button type="button" class="az-btn ghost" data-cf="0">${t("cancel")}</button><button type="button" class="az-btn ${danger ? "red" : ""}" data-cf="1">${ok}</button></div></div></div>`);
    const box = $(".az-confirm");
    const done = v => { box.remove(); document.removeEventListener("keydown", key); resolve(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    box.addEventListener("click", e => { const b = e.target.closest("[data-cf]"); if (b) done(b.dataset.cf === "1"); else if (e.target === box) done(false); });
    document.addEventListener("keydown", key);
    box.querySelector('[data-cf="0"]').focus();
  });
}
const backBtn = () => `<button type="button" class="az-back" data-back>${icon("arrow-left")} ${t("back")}</button>`;
const head = (ic, title, lead) => `${backBtn()}<h1 class="az-h1">${icon(ic)} ${title}</h1>${lead ? `<p class="az-lead">${lead}</p>` : ""}`;
const row = (href, ic, title, sub, attrs = "") => `<a class="az-row" href="${href}" ${attrs}>${icon(ic)}<div><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>${icon("chevron-right", "go")}</a>`;
const ext = (href, ic, label, cls = "") => `<a class="az-btn ${cls}" href="${href}" target="_blank" rel="noopener">${icon(ic)} ${label}</a>`;

// ---------- «Назад»: история переходов внутри приложения ----------
// «Назад» возвращает на предыдущий экран; если пришли по ссылке сразу внутрь — на главную, а не прочь из приложения
const NAV = [];
const SCROLL = new Map();
function goBack() {
  if (NAV.length > 1) history.back();
  else location.replace("#home");
}
document.addEventListener("click", e => { if (e.target.closest("[data-back]")) goBack(); });

// ---------- Экраны ----------
const SCREENS = {
  go(id) { return navScreen(id); },
  mine() { return placesScreen(); },
  taxi(id) { return taxiScreen(id); },

  home() {
    const tile = (href, ic, k, cls, badge = "") => `<a class="az-tile ${cls}" href="${href}"><i>${icon(ic)}</i><span>${t(k)}</span><small>${t(k + "_sub")}</small>${badge}</a>`;
    const unread = CHAT.unread ? `<span class="az-badge">${CHAT.unread}</span>` : "";
    const cnt = c => fmtNum(POIS.filter(p => p.c === c).length);
    const sights = POIS.filter(p => p.c === "a" && p.im).sort((a, b) => fame(b) - fame(a)).slice(0, 6);
    const tripCity = tr => tr.city && CITY[tr.city] ? CITY[tr.city] : POIS.find(p => p.im && km(tr.p, [p.la, p.lo]) < 15) || null;
    return `
      <div class="hero az-hero" id="azHero" style="${BAKU?.img ? `background-image:linear-gradient(180deg,rgba(11,31,58,.35),rgba(11,31,58,.78)),url('${commonsImg(BAKU.img, 1280)}')` : ""}">
        <div class="hero-inner">
          <h1>${t("hero_title")}</h1>
          <p>${t("hero_sub")}</p>
          <div class="search-wrap">
            ${icon("search", "search-ico")}
            <input id="azSearch" type="search" autocomplete="off" placeholder="${esc(t("search_ph"))}" aria-label="${esc(t("search_ph"))}">
            <div id="azResults" class="search-results hidden"></div>
          </div>
          <div class="az-hero-ctas">
            <a class="btn gold-btn" href="#translate">${icon("languages")} ${t("tr")}</a>
            <a class="btn hero-ghost" href="#map">${icon("map")} ${t("nav_map")}</a>
            ${(h => h ? `<a class="btn hero-ghost" href="${goHref(h.la, h.lo, h.n)}">${icon("home")} ${pt("back")}</a>` : "")(placesHome())}
          </div>
        </div>
      </div>
      ${CITIES.length ? `<div class="stats">
        <a class="stat" href="#cities"><i>${icon("city")}</i><b>${fmtNum(CITIES.length)}</b><span>${t("stat_cities")}</span></a>
        <a class="stat" href="#places/a"><i style="background:var(--g-a)">${icon("dome")}</i><b>${cnt("a")}</b><span>${t("stat_sights")}</span></a>
        <a class="stat" href="#places/h"><i style="background:var(--g-h)">${icon("hotel")}</i><b>${cnt("h")}</b><span>${t("stat_hotels")}</span></a>
        <a class="stat" href="#places/f"><i style="background:var(--g-f)">${icon("food")}</i><b>${cnt("f")}</b><span>${t("stat_food")}</span></a>
      </div>` : ""}

      <section class="block">
        <div class="block-head"><h2>${icon("compass")}<span>${t("quick")}</span></h2></div>
        <div class="az-tiles">
          ${tile("#trips", "route", "trips", "t-trips")}${tile("#buses", "bus", "buses", "t-bus")}${tile("#pay", "credit-card", "pay", "t-pay")}
          ${tile("#translate", "languages", "tr", "t-tr")}${tile("#chat", "message", "chat", "t-chat", unread)}${tile("#mine", "star", "mine", "t-mine")}
          ${tile("#sos", "siren", "sos", "t-sos")}
        </div>
      </section>

      ${POPULAR.length ? `<section class="block">
        <div class="block-head"><h2>${icon("star")}<span>${t("popular")}</span></h2><a href="#cities">${t("see_all")}</a></div>
        <div class="grid">${POPULAR.slice(0, 6).map(cityCard).join("")}</div>
      </section>` : ""}

      <section class="block">
        <div class="block-head"><h2>${icon("route")}<span>${t("trips")}</span></h2><a href="#trips">${t("see_all")}</a></div>
        <div class="grid">${TRIPS.map(tr => {
          const c = tripCity(tr), img = c?.img ? commonsImg(c.img, 480) : c?.im ? commonsImg(c.im, 480) : "";
          return `<div class="card az-trip-card" data-go="#trips/${tr.id}" tabindex="0" role="link">
            <div class="card-img ${img ? "has-img" : ""}" style="${img ? `background-image:url('${img}')` : "background:var(--g-a)"}"><span class="tag">${tr.d === 1 ? t("day_1") : t("days_n", { n: tr.d })}${tr.h ? " · " + hrs(tr.h) : ""}</span></div>
            <div class="card-body"><h3>${esc(LL(...tr.n))}</h3><div class="sub">${esc(tr.see.slice(0, 2).map(s => LL(...s)).join(" · "))}</div></div>
          </div>`;
        }).join("")}</div>
      </section>

      ${sights.length ? `<section class="block">
        <div class="block-head"><h2>${icon("dome")}<span>${t("top_sights")}</span></h2><a href="#places/a">${t("see_all")}</a></div>
        <div class="list">${sights.map(poiRow).join("")}</div>
      </section>` : ""}

      <section class="block">
        <div class="block-head"><h2>${icon("w-partly")}<span>${t("weather_now")}</span></h2></div>
        <div class="weather-strip" id="azWeather"></div>
      </section>
      <section class="block panel">
        <div class="block-head"><h2>${icon("exchange")}<span>${t("rates_title")}</span></h2></div>
        <div id="azRates"></div>
      </section>
      <section class="block">${row("#offline", "download", t("off"), t("off_sub"))}</section>
      <footer class="footer"><p>${t("data_src")}</p></footer>`;
  },

  cities() {
    return `${head("city", t("nav_cities"), t("cities_lead"))}
      <div class="az-filters"><input id="cityQ" type="search" placeholder="${esc(t("search_city"))}" aria-label="${esc(t("search_city"))}">
        <select id="citySort" aria-label="${esc(t("sort"))}"><option value="pop">${t("sort_pop")}</option><option value="sights">${t("sort_sights")}</option><option value="name">${t("sort_name")}</option></select></div>
      <p class="az-found" id="cityFound"></p>
      <div class="grid" id="cityGrid"></div>`;
  },

  city(id) {
    const c = CITY[id];
    if (!c) return SCREENS.cities();
    const tab = CITY_TAB[c.id] || (c.counts.a ? "a" : "h");
    return `${backBtn()}
      <div class="az-cover" ${c.img ? `data-cover="${esc(c.img)}"` : ""}><div>
        <span class="tag">${c.t === "city" ? t("city") : t("town")}${c.pop ? " · " + popText(c.pop) : ""}</span>
        <h1>${esc(cityName(c))}</h1>${c.n.az && c.n.az !== cityName(c) ? `<p>${esc(c.n.az)}</p>` : ""}</div></div>
      <div class="az-facts"><span>${icon("dome")} ${c.counts.a} ${t("cat_a").toLowerCase()}</span><span>${icon("hotel")} ${c.counts.h} ${t("cat_h").toLowerCase()}</span><span>${icon("food")} ${c.counts.f} ${t("cat_f").toLowerCase()}</span><span id="cityWx"></span></div>
      <div class="az-btns two">${goBtn(c.lat, c.lon, cityName(c))}
        ${OFF_CITY[c.id] ? `<a class="az-btn ghost" href="${offPacks()[c.id] ? `#map/${c.id}` : "#offline"}">${icon("map-pinned")} ${t("map_offline_btn")}</a>` : `<a class="az-btn ghost" href="#map/@${c.id}">${icon("map")} ${t("nav_map")}</a>`}</div>
      <div class="az-card az-story" id="cityStory" style="margin-top:14px"><p class="hint">…</p></div>
      <div class="az-chips" id="cityTabs">${["a", "h", "f", "s"].filter(k => c.counts[k]).map(k => `<button type="button" class="${k === tab ? "on" : ""}" data-city-tab="${k}">${icon(CAT_ICON[k])} ${t("cat_" + k)} (${c.counts[k]})</button>`).join("")}</div>
      <div class="list" id="cityList"></div>`;
  },

  places(cat) {
    const k = ["a", "h", "f", "s"].includes(cat) ? cat : PLACE_CAT;
    return `${head(CAT_ICON[k], t("nav_places"), t("places_lead"))}
      <div class="az-chips" id="placeCats">${["a", "h", "f", "s"].map(x => `<button type="button" class="${x === k ? "on" : ""}" data-place-cat="${x}">${icon(CAT_ICON[x])} ${t("cat_" + x)}</button>`).join("")}</div>
      <div class="az-filters"><input id="placeQ" type="search" placeholder="${esc(t("search_place"))}" aria-label="${esc(t("search_place"))}">
        <select id="placeCity" aria-label="${esc(t("nav_cities"))}"><option value="">${t("all_cities")}</option>${CITIES.filter(c => c.counts[k]).sort((a, b) => b.counts[k] - a.counts[k]).map(c => `<option value="${c.id}">${esc(cityName(c))} (${c.counts[k]})</option>`).join("")}</select></div>
      <p class="az-found" id="placeFound"></p>
      <div class="list" id="placeList"></div>`;
  },

  place(id) {
    const p = POI[id];
    if (!p) return SCREENS.places();
        const site = p.w ? (/^https?:/.test(p.w) ? p.w : "https://" + p.w.replace(/^@/, "instagram.com/")) : "";
    return `${backBtn()}
      <div class="az-cover" style="background:var(--g-${p.c})" ${p.im ? `data-cover="${esc(p.im)}"` : ""}><div>
        <span class="tag">${typeLabel(p.s)}${p.st ? " · " + "★".repeat(p.st) : ""}</span>
        <h1>${esc(poiName(p))}</h1><p>${esc(cityName(p.city))}${p.n !== poiName(p) ? " · " + esc(p.n) : ""}</p></div></div>
      <div class="az-btns two">${goBtn(p.la, p.lo, poiName(p))}
        ${p.ph ? `<a class="az-btn ghost" href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${icon("phone")} ${t("call")}</a>` : p.c === "h" ? ext(bookingUrl(p), "search", "Booking", "ghost") : `<a class="az-btn ghost" href="#map/=${p.id}">${icon("map")} ${t("on_map")}</a>`}</div>
      <div class="az-btns two">${placeSaveBtn(p.la, p.lo, poiName(p), p.id)}<a class="az-btn ghost" href="${taxiHref(p.la, p.lo, poiName(p))}">${icon("car")} ${t("taxi_t")}</a></div>
      ${p.c === "h" ? `<div class="az-btns">${placeHomeBtn(p.la, p.lo, poiName(p), p.id)}</div>` : ""}
      ${(pr => pr ? `<div class="az-card az-price-card" style="margin-top:14px">${priceLine(pr)}</div>` : "")(poiPrice(p))}
      <div class="az-card" style="margin-top:14px">
        ${[p.ad && [icon("pin"), esc(p.ad)], p.oh && [icon("clock"), esc(p.oh)], p.ph && [icon("phone"), `<a href="tel:${esc(p.ph.replace(/[^\d+]/g, ""))}">${esc(p.ph)}</a>`],
          site && [icon("globe"), `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(p.w.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40))}</a>`], p.cu && [icon("chef"), esc(p.cu)]]
          .filter(Boolean).map(([i, v]) => `<div class="az-facts" style="font-weight:600">${i} <span>${v}</span></div>`).join("") || `<p class="hint" style="margin:0">${t("no_details")}</p>`}
      </div>
      <div class="az-card az-story" id="placeStory" hidden></div>
      <div id="placeMini" class="az-map" style="height:240px;margin-top:12px"></div>
      ${p.c === "h" && p.ph ? `<div class="az-btns">${ext(bookingUrl(p), "search", "Booking", "ghost")}</div>` : ""}
      <h2 class="az-h2">${icon("locate")} ${t("nearby")}</h2>
      <div class="list">${POIS.filter(x => x !== p && x.c === "a" && km([p.la, p.lo], [x.la, x.lo]) < 3).sort((a, b) => fame(b) - fame(a)).slice(0, 5).map(poiRow).join("") || `<p class="hint">—</p>`}</div>`;
  },

  trips(id) {
    const tr = TRIPS.find(x => x.id === id);
    if (!tr) return head("route", t("trips"), t("trips_lead")) + TRIPS.map(x => row(`#trips/${x.id}`, x.ic, LL(...x.n),
      [x.d === 1 ? t("day_1") : t("days_n", { n: x.d }), x.h ? `${icon("bus")} ${hrs(x.h)}` : ""].filter(Boolean).join(" · "))).join("");
    return `${head(tr.ic, LL(...tr.n))}
      <div class="az-card"><div class="az-facts"><span>${icon("calendar")} ${tr.d === 1 ? t("day_1") : t("days_n", { n: tr.d })}</span>${tr.h ? `<span>${icon("clock")} ${t("time")}: ${hrs(tr.h)}</span>` : ""}</div></div>
      <h2 class="az-h2">${t("see")}</h2>
      <div class="az-card"><ul class="az-list">${tr.see.map(s => `<li>${esc(LL(...s))}</li>`).join("")}</ul></div>
      <h2 class="az-h2">${t("how_get")}</h2>
      <div class="az-card"><p style="margin:0">${esc(LL(...tr.how))}</p></div>
      <div class="az-btns">${goBtn(tr.p[0], tr.p[1], LL(...tr.n))}${tr.city ? `<a class="az-btn ghost" href="${offPacks()[tr.city] ? `#map/${tr.city}` : "#offline"}">${icon("map-pinned")} ${t("map_offline_btn")}</a>` : ""}${tr.h && tr.h[0] >= 2 ? ext("https://biletim.az", "ticket", t("ticket_btn"), "ghost") : ""}</div>`;
  },

  offline() {
    return `${head("download", t("off"), t("off_lead"))}
      <div class="az-card"><b style="font-size:1.1rem">${icon("smartphone")} ${t("off_app")}</b><p class="az-lead" style="margin:4px 0 0">${t("off_app_sub")}</p>
        <div class="az-btns" id="offApp">${offAppHtml()}</div></div>
      <label class="az-card auto-dl"><input type="checkbox" data-auto-dl ${autoOn() ? "checked" : ""}><span><b>${t("auto_title")}</b><small>${t("auto_sub")}</small></span></label>
      <h2 class="az-h2">${t("off_cities")}</h2>
      <p class="az-lead">${t("off_cities_sub")}</p>
      <div class="az-filters" style="grid-template-columns:1fr"><input id="offQ" type="search" placeholder="${esc(t("search_city"))}" aria-label="${esc(t("search_city"))}"></div>
      <div id="offCities"></div>
      <div class="az-note">${icon("info")}<span>${t("off_tiles_note")}</span></div>`;
  },

  map(id) {
    const c = OFF_CITY[id];
    // Карта страны: #map, #map/@город, #map/=место (офлайн-карты городов — #map/<город из списка «Без интернета»>)
    if (!c) return `${head("map", t("nav_map"), t("map_lead"))}
      <div class="az-chips" id="worldCats">${["a", "h", "f", "s", "t"].map(k => `<button type="button" class="${k === WORLD.cat ? "on" : ""}" data-world-cat="${k}">${icon(CAT_ICON[k])} ${t("cat_" + k)}</button>`).join("")}</div>
      <div id="azMap" class="az-map"></div>
      <div class="az-btns two"><button type="button" class="az-btn" data-world-where>${icon("locate")} ${t("map_where")}</button><a class="az-btn ghost" href="#offline">${icon("download")} ${t("off")}</a></div>
      <h2 class="az-h2">${icon("star")} ${t("map_in_view")}</h2>
      <div class="list" id="worldList"></div>`;
    if (!offPacks()[id]) return `${head("map", LL(...c.n))}<div class="az-card"><p style="margin-top:0">${t("map_not_dl")}</p><div class="az-btns"><a class="az-btn" href="#offline">${icon("download")} ${t("off")}</a></div></div>`;
    return `${head("map-pinned", `${t("map_city")}: ${LL(...c.n)}`)}
      <div class="az-chips" id="mapKinds"><button type="button" class="on" data-map-kind="">${t("map_all")}</button>${KIND_GROUPS.map(g => `<button type="button" data-map-kind="${g}">${t("k_" + g)}</button>`).join("")}</div>
      <div id="azMap" class="az-map"></div>
      <div class="az-btns"><button type="button" class="az-btn" data-map-where>${icon("locate")} ${t("map_where")}</button></div>
      <h2 class="az-h2" id="mapListTitle">${t("map_near")}</h2>
      <div id="mapList"><p class="az-empty">…</p></div>`;
  },

  buses(sub) {
    // Метро, поезда, автобусы по номеру и маршрут автобуса — js/az-transit.js
    if (sub === "metro" || sub === "trains" || sub === "routes" || /^r\d+$/.test(sub || "")) return transitScreen(sub);
    if (sub === "city") return `${head("bus", t("bus_city"), t("bus_city_lead"))}
      <ol class="az-steps"><li><div><b>${t("bus_city_1")}</b></div></li><li><div><b>${t("bus_city_2")}</b></div></li><li><div><b>${t("bus_city_3")}</b></div></li></ol>
      <div class="az-note">${icon("plane")}<span>${t("bus_airport")}</span></div>
      <div class="az-btns"><a class="az-btn" href="#buses/routes">${icon("search")} ${t("bus_find")}</a><a class="az-btn ghost" href="#pay">${icon("credit-card")} ${t("pay")}</a></div>`;
    if (sub === "inter") return `${head("bus", t("bus_inter"), t("bus_inter_lead"))}
      <table class="az-table"><thead><tr><th>${t("bus_inter_tbl")}</th><th>${t("bus_inter_time")}</th><th>${t("bus_inter_price")}</th></tr></thead>
        <tbody>${INTERCITY.map(([ru, en, h, p]) => `<tr><td><b>${LL(ru, en)}</b></td><td>${t("hours", { n: LANG === "en" ? h.replace(/,/g, ".") : h })}</td><td>${p} AZN</td></tr>`).join("")}</tbody></table>
      <div class="az-note">${icon("info")}<span>${t("bus_inter_note")}</span></div>
      <div class="az-btns">${ext("https://biletim.az", "ticket", t("ticket_btn"))}${goBtn(BUS_TERMINAL[0], BUS_TERMINAL[1], t("bus_station_map"), t("bus_station_map"), "ghost")}</div>`;
    if (sub === "find") return `${head("search", t("bus_find"), t("bus_find_sub"))}
      <form id="azFind" class="az-btns"><input class="az-input" name="q" required autocomplete="off" placeholder="${esc(t("bus_find_ph"))}" aria-label="${esc(t("bus_find_ph"))}">
        <button class="az-btn" type="submit">${icon("bus")} ${t("bus_find_go")}</button></form>`;
    return head("bus", t("buses")) + row("#buses/metro", "train", tu("metro"), tu("metro_sub")) + row("#buses/routes", "bus", tu("buses_n"), tu("buses_n_sub")) +
      row("#buses/trains", "train-fast", tu("trains"), tu("trains_sub")) + row("#buses/city", "info", t("bus_city"), t("bus_city_sub")) +
      row("#buses/inter", "route", t("bus_inter"), t("bus_inter_sub")) + row("#pay", "credit-card", t("pay"), t("pay_sub"));
  },

  pay() {
    return `${head("credit-card", t("pay"), t("pay_lead"))}
      <div class="az-price"><b>0,60 AZN</b><span>${t("pay_fare")}</span></div>
      <ol class="az-steps">${[1, 2, 3, 4].map(n => `<li><div><b>${t("pay_s" + n)}</b><p>${t("pay_s" + n + "p")}</p></div></li>`).join("")}</ol>
      <div class="az-note">${icon("info")}<span>${t("pay_old")}</span></div>
      <div class="az-note">${icon("ticket")}<span>${t("pay_inter")}</span></div>
      <div class="az-btns">${ext("https://www.google.com/maps/search/BakıKart", "pin", t("pay_near"))}${ext(/iphone|ipad/i.test(navigator.userAgent) ? "https://apps.apple.com/search?term=BakiKart" : "https://play.google.com/store/search?q=BakiKart&c=apps", "smartphone", t("pay_app"), "ghost")}</div>`;
  },

  translate() {
    const st = trState();
    const opt = v => Object.entries(TR_LANGS).map(([k, n]) => `<option value="${k}" ${k === v ? "selected" : ""}>${n[0]}</option>`).join("");
    return `${head("languages", t("tr"), t("tr_lead"))}
      ${talkHtml()}
      ${photoHtml()}
      <div class="az-langs"><select class="az-select" id="trFrom" aria-label="From">${opt(st.from)}</select>
        <button type="button" class="az-swap" data-tr-swap aria-label="Swap">${icon("exchange")}</button>
        <select class="az-select" id="trTo" aria-label="To">${opt(st.to)}</select></div>
      <textarea class="az-textarea" id="trText" maxlength="450" placeholder="${esc(t("tr_ph"))}" aria-label="${esc(t("tr_ph"))}"></textarea>
      <div class="az-btns two"><button type="button" class="az-btn" data-tr-go>${icon("languages")} ${t("tr_go")}</button><button type="button" class="az-btn ghost" data-tr-mic>${icon("mic")} ${t("tr_mic")}</button></div>
      <div id="trOut"></div>
      <div id="trHist">${trHistHtml()}</div>
      <h2 class="az-h2">${t("tr_phrases")}</h2>
      <div class="az-chips" role="tablist">${PHRASE_GROUPS.map(g => `<button type="button" role="tab" class="${g.id === trGroup() ? "on" : ""}" data-tr-group="${g.id}" aria-selected="${g.id === trGroup()}">${icon(g.ic)} ${LL(...g.n)}</button>`).join("")}</div>
      <div id="trPhrases">${trPhrasesHtml()}</div>
      <h2 class="az-h2">${icon("download")} ${t("mt_title")}</h2>
      <div class="az-card" id="mtBox">${mtBoxHtml()}</div>
      ${/Android/i.test(navigator.userAgent) ? `<h2 class="az-h2">${icon("download")} ${t("tr_dl")}</h2>
      <div class="az-card"><p style="margin-top:0">${t("tr_dl_sub")}</p>
        <div class="az-btns"><button type="button" class="az-btn" data-az-tr-dl>${icon("download")} ${t("tr_dl_btn")}</button></div></div>` : ""}
      <h2 class="az-h2">${t("tr_any_off")}</h2>
      <div class="az-card"><p style="margin-top:0">${t("tr_google_tip")}</p>
        <ol class="az-list"><li>${t("tr_g1")}</li><li>${t("tr_g2")}</li><li>${t("tr_g3")}</li></ol>
        <div class="az-btns">${ext("https://translate.google.com/?sl=auto&tl=az&op=translate", "external", t("tr_google"), "ghost")}</div></div>`;
  },

  chat(id) { return chatScreen(id); },

  sos() {
    const call = (n, k) => `<button type="button" class="az-call" data-call="${n}"><b>${n}</b><div><span>${t(k)}</span></div></button>`;
    return `${head("siren", t("sos"), t("sos_lead"))}
      <div class="az-sos">${call("112", "sos_112")}${call("103", "sos_103")}${call("102", "sos_102")}${call("101", "sos_101")}</div>
      <h2 class="az-h2">${t("sos_where")}</h2>
      <div class="az-card" id="sosWhere"><p class="az-lead" style="margin:0">${t("sos_where_sub")}</p>
        <div class="az-btns"><button type="button" class="az-btn" data-where>${icon("locate")} ${t("sos_where")}</button></div></div>`;
  },

  account() {
    const size = Math.round((+getComputedStyle(document.documentElement).getPropertyValue("--az-size") || 1) * 100);
    const dark = isDark();
    return `${head("user", t("account"))}
      ${row("#mine", "star", pt("title"), pt("sub"))}
      ${CHAT.token ? idCard() : `<div class="az-card"><p style="margin-top:0">${t("id_login")}</p><div id="chatLogin" class="az-btns"><button type="button" class="az-btn" data-login>${icon("tg")} ${t("chat_login")}</button></div></div>`}
      ${CHAT.token ? `<h2 class="az-h2">${t("chat_my_name")}</h2>
        <form id="azName" class="az-btns" style="grid-template-columns:1fr auto"><input class="az-input" name="name" minlength="2" maxlength="40" value="${esc(CHAT.me?.name || "")}" aria-label="${esc(t("chat_my_name"))}"><button class="az-btn" type="submit">${t("chat_save")}</button></form>` : ""}
      <h2 class="az-h2">${t("set_size")}</h2>
      <div class="az-seg">${[[100, "A"], [115, "A+"], [130, "A++"]].map(([v, l]) => `<button type="button" class="${size === v ? "on" : ""}" data-size="${v}" style="font-size:${v / 100}rem">${l}</button>`).join("")}</div>
      <h2 class="az-h2">${t("set_theme")}</h2>
      <div class="az-seg"><button type="button" class="${!dark ? "on" : ""}" data-theme-set="light">${icon("sun")} ${t("set_light")}</button><button type="button" class="${dark ? "on" : ""}" data-theme-set="dark">${icon("moon")} ${t("set_dark")}</button></div>
      <h2 class="az-h2">${t("set_lang")}</h2>
      <div class="az-seg"><button type="button" class="${LANG === "ru" ? "on" : ""}" data-lang-set="ru">Русский</button><button type="button" class="${LANG === "en" ? "on" : ""}" data-lang-set="en">English</button></div>
      <h2 class="az-h2">${icon("download")} ${t("acc_cities")}</h2>
      <div class="az-card"><p style="margin-top:0">${t("acc_cities_sub", { n: Object.keys(offPacks()).length, all: OFF_CITIES.length })}</p>
        <div class="az-btns"><a class="az-btn" href="#offline">${icon("download")} ${t("acc_cities_btn")}</a></div></div>
      ${CHAT.token ? `<div class="az-btns"><button type="button" class="az-btn ghost" data-logout>${icon("logout")} ${t("chat_logout")}</button></div>` : ""}
      <h2 class="az-h2">${t("set_other")}</h2>
      <p class="az-lead">${t("set_other_sub")}</p>
      <button type="button" class="az-row" data-go-app="uz"><span class="az-app-flag">🇺🇿</span><div><b>${t("set_uz")}</b><small>${t("set_uz_sub")}</small></div>${icon("chevron-right", "go")}</button>
      <button type="button" class="az-row" data-go-app="mecca"><span class="az-app-flag">🕋</span><div><b>${t("set_mecca")}</b><small>${t("set_mecca_sub")}</small></div>${icon("chevron-right", "go")}</button>`;
  }
};

// ---------- Маршрутизация по адресу #раздел/подраздел ----------
let curHash = "";
function route() {
  const h = location.hash && location.hash !== "#" ? location.hash : "#home";
  if (curHash) SCROLL.set(curHash, scrollY);
  const goingBack = NAV.length > 1 && NAV[NAV.length - 2] === h;
  if (goingBack) NAV.pop(); else if (NAV[NAV.length - 1] !== h) NAV.push(h);
  if (NAV.length > 40) NAV.splice(0, NAV.length - 40);
  curHash = h;
  const [kind, id] = decodeURIComponent(h.slice(1)).split("/");
  chatStop();
  mapStop();
  navStop();
  talkAbort();
  const fn = SCREENS[kind] || SCREENS.home;
  $("#azMain").innerHTML = fn(id);
  // Назад — на то же место, что было; новый экран — сверху
  scrollTo(0, goingBack ? SCROLL.get(h) || 0 : 0);
  if (!goingBack) $("#azMain").focus({ preventScroll: true });
  startScreen(kind, id);
}
addEventListener("hashchange", route);
// Всё «живое» на экране (списки, карта, погода, чат) — после отрисовки; и при переходе, и при смене языка
// Большое фото обложки: показываем, только когда загрузилось; не грузится крупное — пробуем меньше (как на главной в Узбекистане).
// Пока грузится — фирменная заливка, а не белый прямоугольник
function loadCovers() {
  $$("[data-cover]").forEach(el => {
    const file = el.dataset.cover, want = Math.min(1280, Math.ceil(Math.min(innerWidth, 1000) * Math.min(devicePixelRatio || 1, 2) / 320) * 320);
    const sizes = [...new Set([want, 640, 480])];
    const tryLoad = i => {
      if (i >= sizes.length || !el.isConnected) return;
      const url = commonsImg(file, sizes[i]), img = new Image();
      const tm = setTimeout(() => { img.onload = img.onerror = null; tryLoad(i + 1); }, 9000);
      img.onload = () => { clearTimeout(tm); el.style.backgroundImage = `url('${url}')`; el.classList.add("photo-in"); };
      img.onerror = () => { clearTimeout(tm); tryLoad(i + 1); };
      img.src = url;
    };
    tryLoad(0);
  });
}
function startScreen(kind, id) {
  loadCovers();
  if (kind === "chat") chatStart(id);
  screenStart(kind, id);
  if (kind === "offline") offAppCheck();
  if (kind === "map") OFF_CITY[id] ? mapStart(id) : worldStart(id);
  if (kind === "go") navStart(id);
  if (kind === "buses" && (id === "metro" || id === "trains" || id === "routes" || /^r\d+$/.test(id || ""))) transitStart(id);
  $$("[data-tab]").forEach(x => x.classList.toggle("active", x.dataset.tab === ({ city: "cities", place: "places", pay: "buses" }[kind] || kind || "home")));
  const title = { go: "route_btn", mine: "mine", taxi: "taxi_t", trips: "trips", buses: "buses", pay: "pay", translate: "tr", chat: "chat", sos: "sos", account: "account", offline: "off", map: "nav_map", cities: "nav_cities", places: "nav_places" }[kind];
  document.title = (kind === "city" && CITY[id] ? cityName(CITY[id]) + " — " : kind === "place" && POI[id] ? poiName(POI[id]) + " — " : title ? t(title) + " — " : "") + "Hamyol · " + t("app_sub");
}

// ---------- Шапка: язык и аккаунт ----------
function renderTop() {
  document.documentElement.lang = LANG;
  $("#azLang").textContent = LANG === "en" ? "RU" : "EN";
  $("#azLang").setAttribute("aria-label", LANG === "en" ? "Русский" : "English");
  $$("[data-t]").forEach(x => { if (TX[x.dataset.t]) x.textContent = t(x.dataset.t); });
  $("#azAccBtn").innerHTML = icon("user") + (CHAT.unread ? `<span class="az-badge">${CHAT.unread}</span>` : "");
  $("#azAccBtn").setAttribute("aria-label", t("account"));
  $("#themeBtn").innerHTML = icon(isDark() ? "sun" : "moon");
  $("#themeBtn").setAttribute("aria-label", t("set_theme"));
}
function setLang(l) {
  LANG = l;
  try { localStorage.setItem("az_lang", l); } catch { /* приватный режим */ }
  renderTop();
  chatStop();
  mapStop();
  navStop();
  talkAbort();
  const y = scrollY, [kind, id] = decodeURIComponent(curHash.slice(1)).split("/");
  $("#azMain").innerHTML = (SCREENS[kind] || SCREENS.home)(id);
  startScreen(kind, id);
  scrollTo(0, y);
}
// Тема: кнопка в шапке и выбор в «Настройках» — одно и то же
function setTheme(th) {
  document.documentElement.dataset.theme = th;
  try { localStorage.setItem("az_theme", th); } catch { /* приватный режим */ }
  $$("[data-theme-set]").forEach(b => b.classList.toggle("on", b.dataset.themeSet === th));
  renderTop();
}
// Размер текста: и крупные элементы Азербайджана (--az-size), и общий стиль (--uz, класс big)
function setSize(v) {
  const r = document.documentElement;
  r.style.setProperty("--az-size", v / 100);
  r.style.setProperty("--uz", v / 100);
  r.classList.toggle("big", v >= 115);
  try { localStorage.setItem("az_size", v); } catch { /* приватный режим */ }
  $$("[data-size]").forEach(b => b.classList.toggle("on", +b.dataset.size === v));
  MAP.map?.invalidateSize();
}
const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

document.addEventListener("click", async e => {
  if (e.target.closest("#azLang")) return setLang(LANG === "en" ? "ru" : "en");
  // Переход в другое приложение Safar: запоминаем выбор — с ним сайт и будет открываться
  const app = e.target.closest("[data-go-app]");
  if (app) { store.set("safar_region", app.dataset.goApp); location.href = app.dataset.goApp === "mecca" ? "/mecca" : "/"; return; }
  const lg = e.target.closest("[data-lang-set]");
  if (lg) return setLang(lg.dataset.langSet);
  const sz = e.target.closest("[data-size]");
  if (sz) return setSize(+sz.dataset.size);
  const th = e.target.closest("[data-theme-set]");
  if (th) return setTheme(th.dataset.themeSet);
  if (e.target.closest("#themeBtn")) return setTheme(isDark() ? "light" : "dark");
  // Результаты поиска закрываются при нажатии мимо них
  if (!e.target.closest(".search-wrap")) $("#azResults")?.classList.add("hidden");
  // SOS: звонок — только после подтверждения
  const call = e.target.closest("[data-call]");
  if (call) {
    const n = call.dataset.call;
    if (await askConfirm(t("sos_call_q", { n }), "", `${t("sos_call")} ${n}`, true)) location.href = "tel:" + n;
    return;
  }
  if (e.target.closest("[data-where]")) return sosWhere();
  if (e.target.closest("[data-logout]")) { chatLogout(); return route(); }
  // Переводчик
  if (e.target.closest("[data-tr-swap]")) { const f = $("#trFrom"), to = $("#trTo"); [f.value, to.value] = [to.value, f.value]; trSave(); return; }
  if (e.target.closest("[data-tr-go]")) return trGo();
  if (e.target.closest("[data-tr-mic]")) return trMic(e.target.closest("[data-tr-mic]"));
  const grp = e.target.closest("[data-tr-group]");
  if (grp) {
    store.set("az_tr_group", grp.dataset.trGroup);
    $$("[data-tr-group]").forEach(b => { b.classList.toggle("on", b === grp); b.setAttribute("aria-selected", b === grp); });
    $("#trPhrases").innerHTML = trPhrasesHtml();
    return;
  }
  const hi = e.target.closest("[data-tr-hist]");
  if (hi) { const h = trHist()[+hi.dataset.trHist]; if (h) trShow(h.s, h.r, h.t, true); return; }
  if (e.target.closest("[data-tr-hist-more]")) { trHistAll = true; $("#trHist").innerHTML = trHistHtml(); return; }
  if (e.target.closest("[data-tr-hist-clear]")) {
    if (await askConfirm(t("tr_hist_clear_q"), "", t("tr_hist_clear"), true)) { store.set("az_tr_hist", []); $("#trHist").innerHTML = ""; }
    return;
  }
  const ph = e.target.closest("[data-phrase]");
  if (ph) { const p = PHRASES[+ph.dataset.phrase]; return trShow(LANG === "en" ? p[1] : p[0], p[2], "az"); }
  const say = e.target.closest("[data-say]");
  if (say) return trSay(say.dataset.say, say.dataset.lang);
  const big = e.target.closest("[data-big]");
  if (big) return trBig(big.dataset.big);
  if (e.target.closest(".az-big")) return $(".az-big").remove();
});
document.addEventListener("change", e => { if (e.target.id === "trFrom" || e.target.id === "trTo") trSave(); });
document.addEventListener("submit", async e => {
  if (e.target.id === "azFind") {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q) window.open(mapsTransit(q + ", Baku"), "_blank", "noopener");
  }
  if (e.target.id === "azName") {
    e.preventDefault();
    try { CHAT.me = await chatApi("/api/az/me", { method: "PUT", body: JSON.stringify({ name: e.target.name.value }) }); toast(t("chat_saved")); }
    catch { toast(t("chat_err")); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $(".az-big")) $(".az-big").remove(); });

// ---------- SOS: «Где я» ----------
function sosWhere() {
  const box = $("#sosWhere");
  if (!navigator.geolocation) return toast(t("sos_geo_fail"));
  box.innerHTML = `<p class="az-lead" style="margin:0">${t("sos_geo_wait")}</p>`;
  navigator.geolocation.getCurrentPosition(p => {
    const lat = p.coords.latitude.toFixed(5), lon = p.coords.longitude.toFixed(5), url = `https://maps.google.com/?q=${lat},${lon}`;
    box.innerHTML = `<p style="font-size:1.6rem;font-weight:800;margin:0">${lat}, ${lon}</p><p class="az-lead">± ${Math.round(p.coords.accuracy)} m</p>
      <div class="az-btns">${navigator.share ? `<button type="button" class="az-btn" data-share-url="${url}">${icon("share")} ${t("sos_share")}</button>` : ""}${ext(url, "map", t("map_btn"), "ghost")}</div>`;
    box.querySelector("[data-share-url]")?.addEventListener("click", ev => navigator.share({ title: "SOS", text: `${lat}, ${lon}`, url: ev.currentTarget.dataset.shareUrl }).catch(() => {}));
  }, () => { box.innerHTML = `<p class="az-lead" style="margin:0">${t("sos_geo_fail")}</p>`; }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}

// ---------- Переводчик (сервис MyMemory, бесплатно; без интернета — готовые фразы) ----------
const TR_LANGS = { ru: ["Русский", "ru-RU"], uz: ["Oʻzbekcha", "uz-UZ"], en: ["English", "en-US"], az: ["Azərbaycanca", "az-AZ"], tr: ["Türkçe", "tr-TR"] };
const trState = () => ({ from: store.get("az_tr_from", LANG), to: store.get("az_tr_to", "az") });
function trSave() { store.set("az_tr_from", $("#trFrom").value); store.set("az_tr_to", $("#trTo").value); }
async function trGo() {
  const text = $("#trText").value.trim(), from = $("#trFrom").value, to = $("#trTo").value;
  if (!text) return $("#trText").focus();
  if (from === to) return trShow(text, text, to);
  // Сначала — среди готовых фраз (работает без интернета)
  const norm = s => s.toLowerCase().replace(/[!?.,«»"]/g, "").trim();
  const col = { ru: 0, en: 1, az: 2 };
  if (col[from] != null && col[to] != null) {
    const hit = PHRASES.find(p => norm(p[col[from]]) === norm(text));
    if (hit) return trShow(text, hit[col[to]], to);
  }
  // Потом — среди того, что человек уже переводил (тоже без интернета)
  const old = trHist().find(h => h.f === from && h.t === to && norm(h.s) === norm(text));
  if (old) return trShow(old.s, old.r, to, true);
  const out = $("#trOut");
  out.innerHTML = `<div class="az-result"><p>…</p></div>`;
  const res = await trTranslate(text, from, to, true, () => { out.innerHTML = `<div class="az-result"><p class="hint">${t("mt_loading")}</p></div>`; });
  if (res) return trShow(text, res, to, true);
  out.innerHTML = `<div class="az-note">${icon("wifi-off")}<span>${t("tr_fail")}</span></div>`;
}
// Перевод одной фразы (и для «Разговора голосом»): готовые фразы → история → онлайн (ключ на сервере) →
// модель Mozilla на телефоне → MyMemory. remember — сохранить в историю (работает потом без интернета)
// Частые надписи и таблички (короткие слова модель переводит неточно): [ru, en, az, uz]
const SIGNS = [
  ["Закрыто", "Closed", "Bağlıdır", "Yopiq"], ["Открыто", "Open", "Açıqdır", "Ochiq"], ["Вход", "Entrance", "Giriş", "Kirish"], ["Выход", "Exit", "Çıxış", "Chiqish"],
  ["Бесплатно", "Free", "Pulsuz", "Bepul"], ["Туалет", "Toilet", "Tualet", "Hojatxona"], ["Касса", "Ticket office", "Kassa", "Kassa"],
  ["К себе", "Pull", "Özünüzə", "O'zingizga"], ["От себя", "Push", "Özünüzdən", "O'zingizdan"], ["Обеденный перерыв", "Lunch break", "Nahar fasiləsi", "Tushlik tanaffusi"],
  ["Курить запрещено", "No smoking", "Siqaret çəkmək qadağandır", "Chekish taqiqlanadi"], ["Вход запрещён", "No entry", "Giriş qadağandır", "Kirish taqiqlanadi"],
  ["Аптека", "Pharmacy", "Aptek", "Dorixona"], ["Больница", "Hospital", "Xəstəxana", "Kasalxona"], ["Остановка", "Bus stop", "Dayanacaq", "Bekat"],
  ["Осторожно", "Caution", "Diqqət", "Ehtiyot bo'ling"], ["Занято", "Occupied", "Məşğuldur", "Band"], ["Свободно", "Vacant", "Boşdur", "Bo'sh"],
  ["Распродажа", "Sale", "Endirim", "Chegirma"], ["Не работает", "Out of order", "İşləmir", "Ishlamaydi"]
];
async function trTranslate(text, from, to, remember = true, onLocal) {
  if (!text || from === to) return text;
  const norm = s => s.toLowerCase().replace(/[!?.,«»"]/g, "").trim();
  const col = { ru: 0, en: 1, az: 2 }, scol = { ru: 0, en: 1, az: 2, uz: 3 };
  if (col[from] != null && col[to] != null) {
    const hit = PHRASES.find(p => norm(p[col[from]]) === norm(text));
    if (hit) return hit[col[to]];
  }
  if (scol[from] != null && scol[to] != null) {
    const sign = SIGNS.find(p => norm(p[scol[from]]) === norm(text));
    if (sign) return sign[scol[to]];
  }
  const old = trHist().find(h => h.f === from && h.t === to && norm(h.s) === norm(text));
  if (old) return old.r;
  const tries = [];
  if (navigator.onLine && await trOnlineReady()) tries.push(trOnline);
  if (await mtCanTranslate(from, to)) tries.push(mtTranslate);
  if (navigator.onLine) tries.push(trMyMemory);
  for (const go of tries) {
    try {
      if (go === mtTranslate) onLocal?.();
      const res = await go(text, from, to);
      if (!res) continue;
      if (remember) trRemember(from, to, text, res);
      return res;
    } catch { /* следующий способ */ }
  }
  return null;
}
async function trMyMemory(text, from, to) {
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`, { signal: AbortSignal.timeout(12000) });
  const j = await r.json(), res = j?.responseData?.translatedText;
  if (!res || j.responseStatus !== 200) throw new Error("bad");
  // MyMemory иногда отдаёт HTML-сущности (bo&#39;yiga) — превращаем в обычный текст
  const d = document.createElement("textarea");
  d.innerHTML = res;
  return d.value;
}
// Онлайн через сервер Hamyol (Microsoft Translator или Google Cloud по бесплатной квоте; ключ хранится только на сервере)
let trOnlineState = null;
function trOnlineReady() {
  trOnlineState ??= fetch("/api/az/mt", { signal: AbortSignal.timeout(5000) }).then(r => r.json()).then(j => !!j.online).catch(() => { trOnlineState = null; return false; });
  return trOnlineState;
}
async function trOnline(text, from, to) {
  const r = await fetch("/api/az/mt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, from, to }), signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error("http " + r.status);
  return (await r.json()).text;
}

// ---------- Офлайн-азербайджанский: движок Bergamot и модели Firefox Translations (Mozilla) в кэше safar-az-mt ----------
// Прямых моделей ru↔az нет — переводим через английский (ru→en→az), как делает сам Firefox.
const MT_CACHE = "safar-az-mt";
const MT_ENGINE = ["/az-mt/registry.json", "/az-mt/translator.js", "/az-mt/worker/translator-worker.js", "/az-mt/worker/bergamot-translator-worker.js", "/az-mt/worker/bergamot-translator-worker.wasm"];
const MT_ENGINE_MB = 5.3;
const mtDir = () => store.get("az_mt_dir", "both");
const MT_DIRS = { en: { both: ["azen", "enaz"], to: ["enaz"], from: ["azen"] }, ru: { both: ["azen", "enaz", "ruen", "enru"], to: ["ruen", "enaz"], from: ["azen", "enru"] } };
const mtPairs = () => MT_DIRS[LANG === "en" ? "en" : "ru"][mtDir()] || MT_DIRS.ru.both;
const mtLangs = new Set(["ru", "en", "az"]);
let mtReg = null, mtTr = null, mtBusy = null, mtHave = null;
const mtRegistry = () => (mtReg ??= caches.open(MT_CACHE).then(c => c.match("/az-mt/registry.json")).then(r => r ? r.json() : fetch("/az-mt/registry.json").then(r => r.json())).catch(e => { mtReg = null; throw e; }));
const mtFiles = reg => pair => Object.values(reg[pair] || {}).map(f => f.name);
const mtMb = reg => Math.round(MT_ENGINE_MB + mtPairs().flatMap(p => Object.values(reg[p] || {})).reduce((s, f) => s + f.size, 0) / 1048576);
// Какие пары моделей уже лежат в кэше (и движок вместе с ними)
async function mtDownloaded() {
  if (mtHave) return mtHave;
  const have = new Set();
  try {
    const cache = await caches.open(MT_CACHE);
    if (!(await Promise.all(MT_ENGINE.map(u => cache.match(u)))).every(Boolean)) return (mtHave = have);
    const reg = await mtRegistry();
    for (const pair of Object.keys(reg)) if ((await Promise.all(mtFiles(reg)(pair).map(u => cache.match(u)))).every(Boolean)) have.add(pair);
  } catch { /* кэша нет */ }
  return (mtHave = have);
}
// Нужные для перевода пары: напрямую или через английский
const mtRoute = (from, to) => from === "en" || to === "en" ? [from + to] : [from + "en", "en" + to];
async function mtCanTranslate(from, to) {
  if (!mtLangs.has(from) || !mtLangs.has(to) || (from !== "az" && to !== "az") || typeof WebAssembly !== "object") return false;
  const have = await mtDownloaded();
  return mtRoute(from, to).every(p => have.has(p));
}
async function mtTranslate(text, from, to) {
  if (!mtTr) {
    const M = await import("/az-mt/translator.js");
    mtTr = new M.LatencyOptimisedTranslator({ registryUrl: "/az-mt/registry.json", pivotLanguage: "en", downloadTimeout: 0 });
  }
  const r = await mtTr.translate({ from, to, text, html: false });
  return r.target.text.trim();
}
async function mtDownload() {
  if (mtBusy) return;
  if (typeof WebAssembly !== "object" || !("caches" in window)) return toast(t("mt_old"));
  mtBusy = { got: 0, total: 1 };
  mtRedraw();
  try {
    navigator.storage?.persist?.().catch(() => {});
    offRegister();
    const regRes = await fetch("/az-mt/registry.json?dl=1", { cache: "no-store" }), reg = await regRes.clone().json();
    const cache = await caches.open(MT_CACHE);
    await cache.put("/az-mt/registry.json", regRes);   // свежий реестр (вдруг Mozilla обновила модели)
    mtReg = Promise.resolve(reg);
    const need = [...MT_ENGINE.slice(1), ...mtPairs().flatMap(mtFiles(reg))];
    const sizes = Object.fromEntries(Object.values(reg).flatMap(p => Object.values(p)).map(f => [f.name, f.size]));
    const todo = [];
    for (const u of need) if (!(await cache.match(u))) todo.push(u);
    // Проценты — от всей загрузки: уже скачанные файлы сразу засчитываем (после перерыва не «с нуля»)
    const sz = u => sizes[u] || 1.3e6, left = todo.reduce((s, u) => s + sz(u), 0);
    mtBusy.total = need.reduce((s, u) => s + sz(u), 0) || 1;
    mtBusy.got = mtBusy.total - left;
    const est = await navigator.storage?.estimate?.().catch(() => null);
    if (est && est.quota - est.usage < left * 1.1) { toast(t("mt_space", { mb: Math.round(left / 1048576) })); throw new Error("space"); }
    // Докачка: модели (по 30 МБ) качаем кусками по 2 МБ и каждый кусок сразу сохраняем (кэш safar-az-mt-parts).
    // Оборвалось (заблокировали телефон, пропала сеть) — в следующий раз продолжаем с того же места.
    store.set("az_mt_want", true);
    mtWake();
    const parts = await caches.open(MT_PARTS);
    const chunks = u => { const size = sizes[u] || 0, n = size ? Math.ceil(size / MT_CHUNK) : 0; return Array.from({ length: n }, (_, i) => [`${u}?part=${i}`, i * MT_CHUNK, Math.min(size, (i + 1) * MT_CHUNK) - 1]); };
    for (const u of todo) for (const [key, from, to] of chunks(u)) if (await parts.match(key)) mtBusy.got += to - from + 1;
    mtProgress();
    // ?dl — мимо сервис-воркера, чтобы видеть ход скачивания
    const read = async (res, sink) => {
      const reader = res.body.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; sink.push(value); mtBusy.got += value.length; mtProgress(); }
    };
    for (const u of todo) {
      const type = { headers: { "Content-Type": "application/octet-stream" } }, list = chunks(u);
      let whole = null;
      for (const [key, from, to] of list) {
        if (await parts.match(key)) continue;
        const res = await fetch(u + "?dl=1", { cache: "no-store", headers: { Range: `bytes=${from}-${to}` } });
        // Сервер ещё не скачал эту модель себе и отдаёт её целиком — берём целиком (одним куском)
        if (res.status === 200) { mtBusy.got -= list.filter(([, f, t2]) => f < from).reduce((s, [, f, t2]) => s + t2 - f + 1, 0); whole = []; await read(res, whole); break; }
        if (res.status !== 206 || !res.body) throw new Error("http " + res.status);
        const buf = [];
        await read(res, buf);
        await parts.put(key, new Response(new Blob(buf), type));
      }
      let blob;
      if (whole) blob = new Blob(whole);
      else if (list.length) blob = new Blob(await Promise.all(list.map(async ([key]) => (await parts.match(key)).blob())));
      else { const res = await fetch(u + "?dl=1", { cache: "no-store" }); if (!res.ok || !res.body) throw new Error("http " + res.status); const b = []; await read(res, b); blob = new Blob(b); }
      await cache.put(u, new Response(blob, { headers: { "Content-Type": u.endsWith(".wasm") ? "application/wasm" : u.endsWith(".js") ? "text/javascript" : "application/octet-stream" } }));
      await Promise.all(list.map(([key]) => parts.delete(key)));
    }
    store.set("az_mt_want", false);
    caches.delete(MT_PARTS).catch(() => {});
    mtHave = null;
    mtBusy = null;
    toast(t("mt_done"));
  } catch (e) { mtBusy = null; mtHave = null; if (e.message !== "space") toast(document.hidden ? t("mt_paused") : t("mt_fail")); }
  mtUnwake();
  mtRedraw();
}
const MT_PARTS = "safar-az-mt-parts", MT_CHUNK = 2 * 1048576;
// Пока качаем — экран не гаснет (иначе телефон усыпляет страницу и загрузка встаёт)
let mtLock = null;
async function mtWake() { try { mtLock = await navigator.wakeLock?.request("screen"); } catch { /* не поддерживается */ } }
function mtUnwake() { mtLock?.release?.().catch(() => {}); mtLock = null; }
// Вернулись в приложение или появилась сеть, а загрузка не закончена — продолжаем сами
const mtResume = () => { if (store.get("az_mt_want", false) && !mtBusy && !document.hidden && navigator.onLine) mtDownload(); };
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (mtBusy && !mtLock) mtWake(); setTimeout(mtResume, 1500); } });
addEventListener("online", () => setTimeout(mtResume, 1500));
setTimeout(mtResume, 4000);
async function mtDelete() {
  store.set("az_mt_want", false);
  try { await caches.delete(MT_CACHE); await caches.delete(MT_PARTS); } catch { /* уже нет */ }
  mtTr?.delete?.(); mtTr = null; mtHave = null; mtReg = null;
  mtRedraw();
}
function mtBoxHtml() {
  const pairs = t("mt_pairs");
  const busy = mtBusy ? `<div class="az-pbar"><i style="width:${Math.round(mtBusy.got / mtBusy.total * 100)}%"></i></div><p class="hint" data-mt-pct>${t("mt_busy", { p: Math.round(mtBusy.got / mtBusy.total * 100) })}</p><p class="hint" style="margin:0">${t("mt_keep")}</p>` : "";
  setTimeout(mtFill);
  const mine = LANG === "en" ? "en" : "ru", dirs = [["both", t("mt_dir_both")], ["to", t("mt_dir_to")], ["from", t("mt_dir_from")]];
  return `<p style="margin-top:0" data-mt-sub>${t("mt_sub", { mb: LANG === "en" ? 72 : 144, pairs })}</p>
    ${mtBusy ? "" : `<div class="mt-dirs" role="radiogroup" aria-label="${esc(t("mt_dir"))}">${dirs.map(([k, n]) => `<label class="mt-dir"><input type="radio" name="mtDir" value="${k}" ${k === mtDir() ? "checked" : ""}> <span>${n.replace("{l}", mine === "en" ? "English" : "русского").replace("{l2}", mine === "en" ? "English" : "русский")}</span> <small data-mt-size="${k}"></small></label>`).join("")}</div>`}
    ${busy}<div class="az-btns" data-mt-btns></div>`;
}
// Состояние (скачано / нет) узнаём асинхронно — из кэша
async function mtFill() {
  const box = $("#mtBox");
  if (!box || mtBusy) return;
  const have = await mtDownloaded(), ready = mtPairs().every(p => have.has(p));
  const reg = await mtRegistry().catch(() => null);
  const sub = box.querySelector("[data-mt-sub]");
  if (sub && reg) sub.textContent = t("mt_sub", { mb: mtMb(reg), pairs: t("mt_pairs") });
  // Размер для каждого варианта
  if (reg) $$("[data-mt-size]", box).forEach(el => { const ps = MT_DIRS[LANG === "en" ? "en" : "ru"][el.dataset.mtSize]; el.textContent = "≈ " + Math.round(MT_ENGINE_MB + ps.flatMap(p => Object.values(reg[p] || {})).reduce((s2, f) => s2 + f.size, 0) / 1048576) + (LANG === "en" ? " MB" : " МБ") + (ps.every(p => have.has(p)) ? " ✓" : ""); });
  const btns = box.querySelector("[data-mt-btns]");
  if (!btns) return;
  btns.innerHTML = ready
    ? `<p class="az-ok">${icon("check")} ${t("mt_ready")}</p><button type="button" class="az-btn ghost" data-mt-del>${icon("ban")} ${t("mt_del")}</button>`
    : `<button type="button" class="az-btn" data-mt-dl>${icon("download")} ${t(store.get("az_mt_want", false) ? "mt_resume" : "mt_dl")}</button>`;
}
function mtRedraw() { const box = $("#mtBox"); if (box) box.innerHTML = mtBoxHtml(); }
function mtProgress() {
  const box = $("#mtBox");
  if (!box || !mtBusy) return;
  const p = Math.round(mtBusy.got / mtBusy.total * 100), bar = box.querySelector(".az-pbar i"), pct = box.querySelector("[data-mt-pct]");
  if (!bar) return mtRedraw();
  bar.style.width = p + "%";
  pct.textContent = t("mt_busy", { p });
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-mt-dl]")) return mtDownload();
  if (e.target.closest("[data-mt-del]")) return mtDelete();
});

// Офлайн-переводчик Android-приложения (Google ML Kit, ~50 языков; азербайджанского в нём нет — для него готовые фразы)
const AZ_MLKIT = new Set(["ru", "en", "tr"]);
document.addEventListener("click", e => {
  if (!e.target.closest("[data-az-tr-dl]")) return;
  const ret = new URL("/az", location.origin), fb = new URL(ret);
  ret.hash = fb.hash = "#translate";
  fb.searchParams.set("safar_voice_unavailable", "1");
  const f = $("#trFrom")?.value, to = $("#trTo")?.value;
  location.href = `intent://voice-translate?return=${encodeURIComponent(ret.href)}${AZ_MLKIT.has(f) ? "&from=" + f : ""}${AZ_MLKIT.has(to) ? "&to=" + to : ""}&mode=download#Intent;scheme=safar;package=uz.safar.app;S.browser_fallback_url=${encodeURIComponent(fb.href)};end`;
});
// Вернулись из приложения: перевод попадает в историю (работает и без интернета), служебные параметры убираем из адреса
(() => {
  const p = new URLSearchParams(location.search);
  if (!p.has("safar_voice_text") && !p.has("safar_voice_unavailable")) return;
  const s = p.get("safar_voice_text"), r = p.get("safar_voice_translation"), f = p.get("safar_voice_from") || "ar", to = p.get("safar_voice_to") || "ru";
  if (s && r && TR_LANGS[f] && TR_LANGS[to]) setTimeout(() => { trRemember(f, to, s, r); trShow(s, r, to, true); }, 300);
  if (p.has("safar_voice_unavailable")) setTimeout(() => toast(t("tr_dl_android")), 300);
  ["safar_voice_text", "safar_voice_translation", "safar_voice_from", "safar_voice_to", "safar_voice_unavailable"].forEach(k => p.delete(k));
  history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash);
})();

// История переводов — на телефоне (до 200 последних), находится и без интернета
const TR_HIST_MAX = 200;
const trHist = () => store.get("az_tr_hist", []);
function trRemember(f, to, s, r) {
  const list = trHist().filter(h => !(h.f === f && h.t === to && h.s.toLowerCase() === s.toLowerCase()));
  list.unshift({ f, t: to, s, r, at: Date.now() });
  store.set("az_tr_hist", list.slice(0, TR_HIST_MAX));
  const box = $("#trHist");
  if (box) box.innerHTML = trHistHtml();
}
let trHistAll = false;
function trHistHtml() {
  const list = trHist();
  if (!list.length) return "";
  const shown = trHistAll ? list : list.slice(0, 5);
  return `<div class="az-chat-head"><h2 class="az-h2">${t("tr_hist")}</h2><button type="button" class="az-btn ghost" data-tr-hist-clear>${t("tr_hist_clear")}</button></div>
    ${shown.map((h, i) => `<button type="button" class="az-phrase" data-tr-hist="${i}"><b lang="${h.t}">${esc(h.r)}</b><span>${esc(h.s)} · ${h.f.toUpperCase()} → ${h.t.toUpperCase()}</span></button>`).join("")}
    ${!trHistAll && list.length > 5 ? `<button type="button" class="az-btn ghost wide" data-tr-hist-more>${t("tr_hist_more", { n: list.length })}</button>` : ""}`;
}
// Темы готовых фраз
const trGroup = () => store.get("az_tr_group", "basic");
function trPhrasesHtml() {
  const g = PHRASE_GROUPS.find(x => x.id === trGroup()) || PHRASE_GROUPS[0];
  const start = PHRASES.indexOf(g.items[0]);
  return g.items.map((p, i) => `<button type="button" class="az-phrase" data-phrase="${start + i}"><b lang="az">${esc(p[2])}</b><span>${esc(LANG === "en" ? p[1] : p[0])}</span></button>`).join("");
}

function trShow(src, res, lang, saved = false) {
  const out = $("#trOut");
  if (!out) return;
  out.innerHTML = `<div class="az-result"><small>${esc(src)}${saved ? ` · ${icon("check")} ${t("tr_saved")}` : ""}</small><p lang="${lang}">${esc(res)}</p>
    <div class="az-btns"><button type="button" class="az-btn" data-say="${esc(res)}" data-lang="${lang}">${icon("volume")} ${t("tr_say")}</button><button type="button" class="az-btn ghost" data-big="${esc(res)}">${icon("maximize")} ${t("tr_show")}</button></div></div>`;
  out.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function trSay(text, lang) {
  if (!("speechSynthesis" in window)) return toast(t("tr_no_voice"));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TR_LANGS[lang]?.[1] || lang;
  // Азербайджанского голоса часто нет — турецкий звучит ближе всего
  const voices = speechSynthesis.getVoices();
  if (voices.length && !voices.some(v => v.lang.startsWith(lang))) {
    if (lang === "az" && voices.some(v => v.lang.startsWith("tr"))) u.lang = "tr-TR"; else toast(t("tr_no_voice"));
  }
  u.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
function trBig(text) {
  $(".az-big")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="az-big" role="dialog" aria-modal="true"><p lang="az">${esc(text)}</p><small>${t("tr_tap_close")}</small></div>`);
}
function trMic(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast(t("tr_no_mic"));
  const rec = new SR();
  rec.lang = TR_LANGS[$("#trFrom").value]?.[1] || "ru-RU";
  rec.interimResults = false;
  const label = btn.innerHTML;
  btn.innerHTML = `${icon("mic")} ${t("tr_listen")}`;
  btn.disabled = true;
  rec.onresult = ev => { $("#trText").value = ev.results[0][0].transcript; trGo(); };
  rec.onend = () => { btn.innerHTML = label; btn.disabled = false; };
  rec.onerror = () => toast(t("tr_no_mic"));
  rec.start();
}

// ---------- Без интернета: приложение (свой сервис-воркер az-sw.js) и города ----------
const OFF_DATA = "safar-az-offline", OFF_SHELL = "safar-az-v28";   // OFF_SHELL — как V в az-sw.js
const offPacks = () => store.get("az_offline", {});
const offBusy = new Set();
const offUrl = id => `/az-offline/city/${id}.json`;

async function offRegister() {
  if (!("serviceWorker" in navigator)) return null;
  try { await navigator.serviceWorker.register("/az-sw.js", { scope: "/az" }); return await navigator.serviceWorker.ready; }
  catch { return null; }
}
// Приложение уже сохранено, если в кэше сервис-воркера лежит страница
async function offAppReady() {
  try { return "caches" in window && !!(await (await caches.open(OFF_SHELL)).match("/az")); } catch { return false; }
}
function offAppHtml(state) {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return `<div class="az-note">${icon("info")}<span>${t("off_app_no")}</span></div>`;
  if (state === "ok") return `<div class="az-price" style="margin:0"><b style="font-size:1.4rem">${icon("circle-check")}</b><span>${t("off_app_ok")}</span></div>`;
  if (state === "busy") return `<button type="button" class="az-btn wide" disabled>${t("off_busy")}</button>`;
  return `<button type="button" class="az-btn wide" data-off-app>${icon("download")} ${t("off_app_btn")}</button>`;
}
async function offAppCheck() { if (await offAppReady() && $("#offApp")) $("#offApp").innerHTML = offAppHtml("ok"); }

function offCityHtml(c) {
  const pk = offPacks()[c.id], busy = offBusy.has(c.id);
  return `<div class="az-card" id="off-${c.id}"><div class="az-chat-head"><div><b style="font-size:1.1rem">${LL(...c.n)}</b>
      <small style="display:block;color:var(--muted)">${pk ? `${icon("circle-check")} ${t("off_places", { n: pk.n, date: fmtDay(pk.at) })}${mapPacks()[c.id] ? " · " + mt2("has", { mb: Math.round(mapPacks()[c.id].size / 1048576) }) : ""}` : busy ? t("off_busy") : ""}</small></div></div>
    <div class="az-btns ${pk ? "two" : ""}">${busy ? `<button type="button" class="az-btn" disabled>${t("off_busy")}</button>`
      : pk ? `<a class="az-btn" href="#map/${c.id}">${icon("map-pinned")} ${t("off_open")}</a><button type="button" class="az-btn ghost" data-off-more="${c.id}">${icon("more")}</button>`
      : `<button type="button" class="az-btn" data-off-dl="${c.id}">${icon("download")} ${t("off_dl")}</button>`}</div>
    ${pk ? `<div class="az-btns two" id="offMore-${c.id}" hidden><button type="button" class="az-btn ghost" data-off-dl="${c.id}">${icon("refresh")} ${t("off_update")}</button><button type="button" class="az-btn red" data-off-del="${c.id}">${icon("ban")} ${t("off_del")}</button></div>` : ""}
  </div>`;
}
const offRedraw = id => { const el = $("#off-" + id); if (el) el.outerHTML = offCityHtml(OFF_CITY[id]); };

// Пакет города для работы без интернета — из данных приложения (без сторонних сервисов):
// места (достопримечательности, музеи) + полезное (вокзалы, автовокзалы, аэропорты, аптеки, больницы, банкоматы, туалеты),
// а ещё фото и описания из Википедии — их сохраняет сервис-воркер (кэш safar-az-photos), описания — на телефоне
let SERVICES = null, svcPromise = null;
function loadServices() {
  if (SERVICES) return Promise.resolve(SERVICES);
  svcPromise ||= new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "data/az-services.js";
    sc.onload = () => { SERVICES = window.SAFAR_SERVICES || []; resolve(SERVICES); };
    sc.onerror = () => { svcPromise = null; reject(new Error("services")); };
    document.head.appendChild(sc);
  });
  return svcPromise;
}
const SVC_KIND = { rail: "train", bus: "bus", airport: "airport", pharmacy: "pharmacy", hospital: "hospital", clinic: "clinic", atm: "atm", bank: "atm", exchange: "atm", toilets: "toilets" };
async function offDownloadCity(id, quiet = false) {
  const c = OFF_CITY[id];
  if (!c || offBusy.has(id)) return false;
  let ok = true;
  offBusy.add(id); offRedraw(id);
  try {
    navigator.storage?.persist?.().catch(() => {});   // просим браузер не удалять скачанное при нехватке места
    offRegister();                                   // заодно сохраняем и само приложение
    const ci = CITIES.indexOf(c.city), svc = await loadServices();
    // [вид, широта, долгота, название, по-русски, по-английски]
    const places = [
      ...POIS.filter(p => p.city === c.city && p.c === "a").map(p => [p.s === "museum" ? "museum" : "sight", p.la, p.lo, p.n, p.nr || "", p.ne || ""]),
      ...svc.filter(r => r[3] === ci && SVC_KIND[r[0]]).map(r => [SVC_KIND[r[0]], r[1], r[2], r[4] || "", "", ""])
    ];
    const cache = await caches.open(OFF_DATA);
    await cache.put(offUrl(id), new Response(JSON.stringify({ id, at: Date.now(), places }), { headers: { "Content-Type": "application/json" } }));
    // Фото города и главных мест — через сервис-воркер в кэш (не загрузилось какое-то — не страшно)
    if (navigator.onLine) {
      const sights = POIS.filter(p => p.city === c.city && p.im).sort((x, y) => fame(y) - fame(x)).slice(0, 20);
      const urls = [c.city.img && commonsImg(c.city.img, 480), c.city.img && commonsImg(c.city.img, 640), ...sights.map(p => commonsImg(p.im, 160))].filter(Boolean);
      await Promise.allSettled(urls.map(u => fetch(u, { mode: "no-cors", signal: AbortSignal.timeout(20000) })));
      await Promise.allSettled([wikiSummary(c.city.wiki || {}), ...sights.slice(0, 8).filter(p => p.wp).map(p => { const [l, ...r] = p.wp.split(":"); return wikiSummary({ [l]: r.join(":") }, [l]); })]);
    }
    const packs = offPacks();
    packs[id] = { at: Date.now(), n: places.length };
    store.set("az_offline", packs);
    // Карта города (векторная, работает без интернета) — кусками с докачкой
    try {
      await mapDownload(id, txt => { const el = $(`#off-${id} small`); if (el) el.textContent = txt; });
      if (!quiet) toast(mt2("done"));
    } catch { ok = false; if (!quiet) toast(mt2("fail")); }
    if (!quiet) toast(t("off_done", { city: LL(...c.n), n: places.length }));
  } catch { ok = false; if (!quiet) toast(t("off_fail")); }
  offBusy.delete(id);
  offRedraw(id);
  return ok;
}

// ---------- Автоскачивание: ближайший город (места + карта) сам, при открытии приложения ----------
// Чтобы всё работало без интернета, даже если человек забыл нажать «Скачать». Где человек — только если
// геолокация уже разрешена (не спрашиваем сами); не знаем — скачиваем Баку. Выключается в «Без интернета».
// Не качаем при экономии трафика (Data Saver) и на медленной связи (2G).
const autoOn = () => store.get("az_auto_dl", true);
let autoBusy = false;
async function autoPos() {
  if (USER_POS) return USER_POS;
  try {
    if ((await navigator.permissions?.query({ name: "geolocation" }))?.state !== "granted") return null;
    const p = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }));
    USER_POS = [p.coords.latitude, p.coords.longitude];
    return USER_POS;
  } catch { return null; }
}
async function autoOffline() {
  const net = navigator.connection;
  if (autoBusy || !autoOn() || !navigator.onLine || net?.saveData || /2g/.test(net?.effectiveType || "")) return;
  autoBusy = true;
  try {
    const pos = await autoPos();
    // Ближайший город и соседний, если до него меньше 40 км (едут часто туда-обратно); без места — Баку
    const near = pos ? OFF_CITIES.map(c => [c, km(pos, c.p)]).sort((a, b) => a[1] - b[1]).filter(([, d], i) => i === 0 || d < 40).slice(0, 2).map(([c]) => c)
      : [OFF_CITY[BAKU?.id] || OFF_CITIES[0]].filter(Boolean);
    const done = store.get("az_auto_done", {});
    for (const c of near) {
      if (offPacks()[c.id] && mapPacks()[c.id]) continue;
      // Не получилось недавно — не мучаем сеть: следующая попытка через час
      if (done[c.id] && Date.now() - done[c.id] < 3600e3) continue;
      done[c.id] = Date.now(); store.set("az_auto_done", done);
      toast(t("auto_start", { city: LL(...c.n) }));
      if (await offDownloadCity(c.id, true)) toast(t("auto_done", { city: LL(...c.n) }));
    }
    // Потом — перевод по фото (~12 МБ) и азербайджанский переводчик (~144 МБ, с докачкой): тоже сами, по очереди
    if (!(await photoReadyCheck()) && !(done.ocr && Date.now() - done.ocr < 3600e3)) {
      done.ocr = Date.now(); store.set("az_auto_done", done);
      try { await photoDownload(); toast(t("auto_ocr")); } catch { /* в следующий раз */ }
    }
    const mtHas = await mtDownloaded(), mtReady = mtPairs().every(p => mtHas.has(p));
    if (!mtReady && !mtBusy && !(done.mt && Date.now() - done.mt < 3600e3)) {
      done.mt = Date.now(); store.set("az_auto_done", done);
      toast(t("auto_mt"));
      await mtDownload();
    }
  } finally { autoBusy = false; }
}
// Сразу при открытии (только дождёмся, пока нарисуется экран)
if (document.readyState === "complete") setTimeout(autoOffline, 300); else addEventListener("load", () => setTimeout(autoOffline, 300));
setInterval(autoOffline, 15 * 60e3);                                    // уехали в другой город — скачаем и его
addEventListener("online", () => setTimeout(autoOffline, 5000));
async function offDeleteCity(id) {
  try { await (await caches.open(OFF_DATA)).delete(offUrl(id)); } catch { /* уже нет */ }
  await mapDelete(id);
  const packs = offPacks();
  delete packs[id];
  store.set("az_offline", packs);
  offRedraw(id);
}
async function offLoadCity(id) {
  try { const r = await (await caches.open(OFF_DATA)).match(offUrl(id)); return r ? await r.json() : null; } catch { return null; }
}

// ---------- Офлайн-карта города ----------
// Leaflet — с cdnjs (сервис-воркер сохраняет его заранее). Не загрузился — остаётся список мест с расстоянием.
let leafletP = null;
function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(true);
  leafletP ||= new Promise(resolve => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => resolve(true);
    s.onerror = () => { leafletP = null; resolve(false); };
    document.head.appendChild(s);
  });
  return leafletP;
}
const MAP = { map: null, layer: null, me: null, watch: null, pos: null, places: [], kind: "", city: null };
// Цена входа для места из скачанного города: [вид, широта, долгота, название, ru, en]
const offFee = p => p[0] === "sight" || p[0] === "museum" ? poiPrice({ c: "a", s: p[0] === "museum" ? "museum" : "", n: p[3], nr: p[4], ne: p[5], city: MAP.city?.city }) : null;
const placeName = p => (LANG === "ru" ? p[4] : p[5]) || p[3] || t("t_" + p[0]);
TX.t_airport = ["Аэропорт", "Airport"];
function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const x = Math.sin((b[0] - a[0]) * rad / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const fmtDist = d => d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)} ${LANG === "en" ? "m" : "м"}` : `${d.toFixed(d < 10 ? 1 : 0).replace(".", LANG === "en" ? "." : ",")} ${LANG === "en" ? "km" : "км"}`;

async function mapStart(id) {
  const c = OFF_CITY[id], data = await offLoadCity(id);
  if (!data || curHash !== "#map/" + id) return;
  MAP.places = data.places; MAP.city = c; MAP.kind = "";
  mapList();
  // Своё место — без интернета тоже работает (GPS)
  if (navigator.geolocation) MAP.watch = navigator.geolocation.watchPosition(p => {
    MAP.pos = [p.coords.latitude, p.coords.longitude];
    if (MAP.map) { if (!MAP.me) MAP.me = L.circleMarker(MAP.pos, { radius: 9, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(MAP.map); else MAP.me.setLatLng(MAP.pos); }
    mapList();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  if (!(await loadLeaflet()) || curHash !== "#map/" + id) { $("#azMap")?.insertAdjacentHTML("afterend", `<div class="az-note">${icon("info")}<span>${t("map_no_lib")}</span></div>`); $("#azMap")?.remove(); return; }
  MAP.map = L.map("azMap", { zoomControl: true }).setView(c.p, id === "baku" ? 13 : 14);
  azBase(MAP.map, c.p);
  if (MAP.pos) MAP.me = L.circleMarker(MAP.pos, { radius: 9, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(MAP.map);
  mapMarkers();
  MAP.map.on("moveend", mapMarkers);
  placesLayer(MAP.map);
}
function mapStop() {
  if (MAP.watch != null) navigator.geolocation.clearWatch(MAP.watch);
  MAP.map?.remove();
  Object.assign(MAP, { map: null, layer: null, me: null, watch: null });
}
const mapShown = () => MAP.places.filter(p => !MAP.kind || KINDS[p[0]][0] === MAP.kind);
// На карте — только места в видимой области (не больше 300): в Баку их полторы тысячи, и слабый телефон бы тормозил
const MAP_MAX = 3000;
// Значки, которые на экране ближе ~64 px друг к другу, — один кружок с числом (иначе в центре Баку сплошная куча).
// Нажали на кружок — карта приближается. Вблизи (масштаб 17+) — все значки по отдельности.
const CLUSTER_PX = 64;
function clusterize(map, items, ll) {
  if (map.getZoom() >= 17) return items.map(it => [it]);
  const cells = new Map();
  for (const it of items) {
    const pt = map.project(ll(it)), key = Math.floor(pt.x / CLUSTER_PX) + ":" + Math.floor(pt.y / CLUSTER_PX);
    const g = cells.get(key);
    if (g) g.push(it); else cells.set(key, [it]);
  }
  return [...cells.values()];
}
function clusterMarker(map, group, ll) {
  const n = group.length, la = group.reduce((s, it) => s + ll(it)[0], 0) / n, lo = group.reduce((s, it) => s + ll(it)[1], 0) / n;
  const size = n < 10 ? 34 : n < 100 ? 40 : 46;
  return L.marker([la, lo], { icon: L.divIcon({ className: "", html: `<span class="az-cluster" style="width:${size}px;height:${size}px">${n}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }) })
    .on("click", () => map.setView([la, lo], Math.min(map.getZoom() + 2, 18)));
}
function mapMarkers() {
  if (!MAP.map) return;
  MAP.layer?.remove();
  const box = MAP.map.getBounds().pad(0.2), c = MAP.map.getCenter();
  const inView = mapShown().filter(p => box.contains([p[1], p[2]]))
    .sort((a, b) => km([c.lat, c.lng], [a[1], a[2]]) - km([c.lat, c.lng], [b[1], b[2]])).slice(0, MAP_MAX);
  $("#azMap")?.classList.toggle("far", MAP.map.getZoom() < 13);
  const ll = p => [p[1], p[2]];
  MAP.layer = L.layerGroup(clusterize(MAP.map, inView, ll).map(g => {
    if (g.length > 1) return clusterMarker(MAP.map, g, ll);
    const p = g[0], [, ic, color] = KINDS[p[0]];
    const city = MAP.city.city, fee = offFee(p), chip = fee || farePrice(p[0], city, p[3]);
    return L.marker([p[1], p[2]], { icon: L.divIcon({ className: "", html: `<span class="az-pin" style="background:${color}">${icon(ic)}</span>${pinPrice(chip, fee ? !fee.est : city === BAKU)}`, iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup(`<b>${esc(placeName(p))}</b><br>${t("t_" + p[0])}${fee ? priceLine(fee) : fareLine(farePrice(p[0], city, p[3]))}<a href="${goHref(p[1], p[2], placeName(p))}">${icon("directions")} ${t("route_short")} →</a><div style="margin-top:6px">${placeSaveBtn(p[1], p[2], placeName(p), "", "pl-mini")}</div>`);
  })).addTo(MAP.map);
  declutterPrices();
}
function mapList() {
  const box = $("#mapList");
  if (!box) return;
  const from = MAP.pos || MAP.city.p;
  const list = mapShown().map(p => [p, km(from, [p[1], p[2]])]).sort((a, b) => a[1] - b[1]).slice(0, 40);
  $("#mapListTitle").textContent = MAP.pos ? t("map_near") : LL(...MAP.city.n);
  box.innerHTML = list.length ? list.map(([p, d]) => `<button type="button" class="az-row" data-map-go="${p[1]},${p[2]}"><span class="az-pin big" style="background:${KINDS[p[0]][2]}">${icon(KINDS[p[0]][1])}</span><div><b>${esc(placeName(p))}</b><small>${t("t_" + p[0])} · ${fmtDist(d)}</small>${(f => f ? `<small class="az-row-price">${esc(f)}</small>` : "")(offFee(p) ? [priceChip(offFee(p)), uzsOf(offFee(p))].filter(Boolean).join(" · ") : farePrice(p[0], MAP.city.city, p[3])?.text)}</div></button>`).join("")
    : `<p class="az-empty">—</p>`;
}

// ---------- Карта страны: все места из приложения (работает и без интернета там, где подложку уже смотрели) ----------
const WORLD = { cat: "a", focus: null };
const CAT_COLOR = { a: "#3554a5", h: "#1898ad", f: "#c8553d", s: "#c98f22" };
async function worldStart(arg) {
  const fc = arg?.startsWith("@") ? CITY[arg.slice(1)] : null, fp = arg?.startsWith("=") ? POI[arg.slice(1)] : null;
  if (fp) WORLD.cat = fp.c;
  WORLD.focus = fp;
  $$("[data-world-cat]").forEach(b => b.classList.toggle("on", b.dataset.worldCat === WORLD.cat));
  if (!(await loadLeaflet()) || !curHash.startsWith("#map")) { $("#azMap")?.insertAdjacentHTML("afterend", `<div class="az-note">${icon("info")}<span>${t("map_no_lib")}</span></div>`); $("#azMap")?.remove(); worldList(); return; }
  const view = fp ? [[fp.la, fp.lo], 16] : fc ? [[fc.lat, fc.lon], 13] : USER_POS ? [USER_POS, 13] : BAKU ? [[BAKU.lat, BAKU.lon], 12] : [[40.3, 47.7], 7];
  MAP.map = L.map("azMap", { zoomControl: true }).setView(view[0], view[1]);
  azBase(MAP.map, view[0]);
  if (USER_POS) MAP.me = L.circleMarker(USER_POS, { radius: 9, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(MAP.map);
  let tm;
  MAP.map.on("moveend", () => { clearTimeout(tm); tm = setTimeout(worldDraw, 150); });
  placesLayer(MAP.map);
  worldDraw();
  if (fp) MAP.layer?.eachLayer(m => { if (m.options.pid === fp.id) m.openPopup(); });
}
// В видимой части карты: при мелком масштабе — самые известные места, при крупном — ближайшие к центру (не больше 300 значков)
function worldInView() {
  const b = MAP.map.getBounds().pad(0.15), c = MAP.map.getCenter(), far = MAP.map.getZoom() < 12;
  if (WORLD.cat === "t") return TRANSPORT.filter(p => b.contains([p.la, p.lo]))
    .sort(far ? (x, y) => (y.k === "airport") - (x.k === "airport") : (x, y) => km([c.lat, c.lng], [x.la, x.lo]) - km([c.lat, c.lng], [y.la, y.lo]));
  return POIS.filter(p => p.c === WORLD.cat && b.contains([p.la, p.lo]))
    .sort(far ? (x, y) => fame(y) - fame(x) : (x, y) => km([c.lat, c.lng], [x.la, x.lo]) - km([c.lat, c.lng], [y.la, y.lo]));
}
function worldDraw() {
  if (!MAP.map) return;
  if (WORLD.cat === "t" && !TRANSPORT.length) return loadTransport().then(l => { if (l.length) worldDraw(); });
  MAP.layer?.remove();
  const list = worldInView(), shown = list.slice(0, 4000);
  $("#azMap")?.classList.toggle("far", MAP.map.getZoom() < 12);
  if (WORLD.focus && WORLD.focus.c === WORLD.cat && !shown.includes(WORLD.focus)) shown.unshift(WORLD.focus);
  const ll = p => [p.la, p.lo];
  MAP.layer = L.layerGroup(clusterize(MAP.map, shown, ll).map(g => {
    if (g.length > 1 && !g.includes(WORLD.focus)) return clusterMarker(MAP.map, g, ll);
    const p = g.includes(WORLD.focus) ? WORLD.focus : g[0];
    if (p.c === "t") return transportMarker(p);
    const ph = poiPhoto(p, 320), pr = poiPrice(p);
    return L.marker([p.la, p.lo], { pid: p.id, zIndexOffset: pr && !pr.est ? 1000 : 0, icon: L.divIcon({ className: "", html: `<span class="az-pin" style="background:${CAT_COLOR[p.c]}">${icon(poiIcon(p))}</span>${pinPrice(pr, pr && !pr.est)}`, iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup(`${ph ? `<img src="${ph}" alt="" style="width:100%;max-width:220px;border-radius:10px;display:block;margin-bottom:6px">` : ""}<b>${esc(poiName(p))}</b><br>${typeLabel(p.s)} · ${esc(cityName(p.city))}${priceLine(pr)}<a href="#place/${p.id}">${t("details")} →</a> · <a href="${goHref(p.la, p.lo, poiName(p))}">${icon("directions")} ${t("route_short")}</a><div style="margin-top:6px">${placeSaveBtn(p.la, p.lo, poiName(p), p.id, "pl-mini")}</div>`);
  })).addTo(MAP.map);
  declutterPrices();
  worldList(list);
}
function worldList(list) {
  const box = $("#worldList");
  if (!box) return;
  if (WORLD.cat === "t") { const items = (list || []).slice(0, 12); box.innerHTML = items.length ? items.map(transportRow).join("") : `<p class="az-empty">${t("map_zoom_out")}</p>`; return; }
  const items = (list || POIS.filter(p => p.c === WORLD.cat).sort((a, b) => fame(b) - fame(a))).slice().sort((a, b) => fame(b) - fame(a)).slice(0, 12);
  box.innerHTML = items.length ? items.map(poiRow).join("") : `<p class="az-empty">${t("map_zoom_out")}</p>`;
}
document.addEventListener("click", e => {
  const cat = e.target.closest("[data-world-cat]");
  if (cat) { WORLD.cat = cat.dataset.worldCat; WORLD.focus = null; $$("[data-world-cat]").forEach(b => b.classList.toggle("on", b === cat)); return worldDraw(); }
  if (e.target.closest("[data-world-where]")) {
    if (!navigator.geolocation) return toast(t("map_no_geo"));
    navigator.geolocation.getCurrentPosition(p => {
      USER_POS = [p.coords.latitude, p.coords.longitude];
      if (!MAP.map) return;
      if (MAP.me) MAP.me.setLatLng(USER_POS); else MAP.me = L.circleMarker(USER_POS, { radius: 9, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(MAP.map);
      MAP.map.setView(USER_POS, 15);
    }, () => toast(t("map_no_geo")), { enableHighAccuracy: true, timeout: 20000 });
  }
});

document.addEventListener("click", async e => {
  if (e.target.closest("[data-off-app]")) {
    $("#offApp").innerHTML = offAppHtml("busy");
    const reg = await offRegister();
    // Ждём, пока сервис-воркер положит приложение в кэш
    for (let i = 0; i < 20 && !(await offAppReady()); i++) await new Promise(r => setTimeout(r, 500));
    navigator.storage?.persist?.().catch(() => {});
    $("#offApp").innerHTML = offAppHtml(reg && await offAppReady() ? "ok" : "");
    if (!reg) toast(t("off_app_no"));
    return;
  }
  const dl = e.target.closest("[data-off-dl]");
  if (dl) return offDownloadCity(dl.dataset.offDl);
  const more = e.target.closest("[data-off-more]");
  if (more) { const m = $("#offMore-" + more.dataset.offMore); m.hidden = !m.hidden; return; }
  const del = e.target.closest("[data-off-del]");
  if (del) {
    const c = OFF_CITY[del.dataset.offDel];
    if (await askConfirm(t("off_del_q", { city: LL(...c.n) }), "", t("off_del"), true)) offDeleteCity(c.id);
    return;
  }
  const kind = e.target.closest("[data-map-kind]");
  if (kind) { MAP.kind = kind.dataset.mapKind; $$("[data-map-kind]").forEach(b => b.classList.toggle("on", b === kind)); mapMarkers(); mapList(); return; }
  const go = e.target.closest("[data-map-go]");
  if (go && MAP.map) { const [la, lo] = go.dataset.mapGo.split(",").map(Number); MAP.map.setView([la, lo], 17); $("#azMap").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  if (e.target.closest("[data-map-where]")) {
    if (MAP.pos && MAP.map) { MAP.map.setView(MAP.pos, 16); return $("#azMap").scrollIntoView({ behavior: "smooth", block: "center" }); }
    if (!navigator.geolocation) return toast(t("map_no_geo"));
    navigator.geolocation.getCurrentPosition(p => { MAP.pos = [p.coords.latitude, p.coords.longitude]; MAP.map?.setView(MAP.pos, 16); mapList(); }, () => toast(t("map_no_geo")), { enableHighAccuracy: true, timeout: 20000 });
  }
});

// ---------- Чат между аккаунтами ----------
const CHAT = {
  token: (() => { try { return localStorage.getItem("safar_token"); } catch { return null; } })(),
  me: null, unread: 0, timer: null, with: null, last: 0, config: null, login: null
};
async function chatApi(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(CHAT.token ? { Authorization: "Bearer " + CHAT.token } : {}) } });
  if (r.status === 401) { chatLogout(); throw new Error("login"); }
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
function chatLogout() {
  if (CHAT.token) fetch("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + CHAT.token } }).catch(() => {});
  CHAT.token = null; CHAT.me = null; CHAT.unread = 0;
  try { localStorage.removeItem("safar_token"); } catch { /* приватный режим */ }
  renderTop();
}
const initial = name => esc((name || "?").trim().charAt(0).toUpperCase());
// Карточка «Мой ID»: крупный номер, «Скопировать» и «Поделиться»
function idCard() {
  const pid = CHAT.me?.pid;
  return `<div class="az-card az-id" id="azIdCard"><small>${t("my_id")}</small><b>${pid ? fmtPid(pid) : "…"}</b><p>${t("my_id_sub")}</p>
    <div class="az-btns"><button type="button" class="az-btn" data-copy-id ${pid ? "" : "disabled"}>${icon("copy")} ${t("copy")}</button><button type="button" class="az-btn ghost" data-share-id ${pid ? "" : "disabled"}>${icon("share")} ${t("share")}</button></div></div>`;
}
// 100001 → «100 001»: проще прочитать и продиктовать
const fmtPid = pid => String(pid).replace(/\B(?=(\d{3})+$)/g, " ");
const seenTxt = ms => Date.now() - ms < 3 * 60e3 ? t("online") : t("seen", { t: Date.now() - ms < 864e5 ? fmtTime(ms) : fmtDay(ms) });

function chatScreen(id) {
  if (!CHAT.token) return `${head("message", t("chat"), t("chat_lead"))}
    <div class="az-card"><p style="margin-top:0">${t("chat_login_sub")}</p><div id="chatLogin" class="az-btns"><button type="button" class="az-btn" data-login>${icon("tg")} ${t("chat_login")}</button></div></div>`;
  if (id === "find") return `${head("search", t("chat_new"))}
    <input class="az-input" id="chatQ" type="search" autocomplete="off" placeholder="${esc(t("chat_search_ph"))}" aria-label="${esc(t("chat_search_ph"))}">
    <div id="chatFound" style="margin-top:12px"></div>`;
  if (id) return `${backBtn()}<div class="az-chat">
      <div class="az-chat-head"><div class="az-row" style="margin:0;cursor:default;border:0;padding-left:0;background:none"><span class="az-avatar" id="chatAv">…</span><div><b id="chatName">…</b><small id="chatSeen"></small></div></div>
        <button type="button" class="az-btn ghost" data-chat-menu aria-label="${t("chat_block")}">${icon("more")}</button></div>
      <div id="chatMenu" class="az-btns" hidden><button type="button" class="az-btn ghost" data-chat-block>${icon("ban")} <span id="chatBlockLbl">${t("chat_block")}</span></button><button type="button" class="az-btn red" data-chat-report>${icon("flag")} ${t("chat_report")}</button></div>
      <div class="az-msgs" id="chatMsgs" aria-live="polite"><p class="az-empty">…</p></div>
      <form class="az-send" id="chatSend"><textarea class="az-input" name="text" rows="1" maxlength="1000" placeholder="${esc(t("chat_ph"))}" aria-label="${esc(t("chat_ph"))}"></textarea><button class="az-btn" type="submit" aria-label="${t("chat_send")}">${icon("send")}</button></form>
    </div>`;
  return `${head("message", t("chat"), t("chat_lead"))}
    <a class="az-row az-myid" href="#account">${icon("id-card")}<div><small>${t("my_id")}</small><b id="chatMyId">${CHAT.me?.pid ? fmtPid(CHAT.me.pid) : "…"}</b></div>${icon("chevron-right", "go")}</a>
    <form id="chatById" class="az-card"><label for="chatPid"><b>${t("write_by_id")}</b></label>
      <div class="az-btns" style="grid-template-columns:minmax(0,1fr) auto;margin-top:8px"><input class="az-input" id="chatPid" name="pid" inputmode="numeric" autocomplete="off" placeholder="${esc(t("id_ph"))}"><button class="az-btn" type="submit">${t("open")}</button></div></form>
    <div class="az-btns" style="margin:0 0 14px"><a class="az-btn ghost" href="#chat/find">${icon("search")} ${t("chat_new")}</a></div>
    <div id="chatConvs"><p class="az-empty">…</p></div>`;
}

// Открыть переписку по постоянному ID (поле «Написать по ID» и ссылка …/az#chat/p100001)
async function chatOpenPid(pid, replace = false) {
  pid = String(pid || "").replace(/\D/g, "");
  if (pid.length < 6) return toast(t("id_none"));
  if (CHAT.me?.pid === +pid) return toast(t("id_self"));
  try {
    const r = await chatApi("/api/az/users?q=" + pid);
    if (!r.users.length) return toast(t("id_none"));
    if (replace) location.replace("#chat/" + r.users[0].id); else location.hash = "#chat/" + r.users[0].id;
    return true;
  } catch { toast(t("offline")); }
}

function chatStart(id) {
  if (!CHAT.token) return;
  if (/^p\d+$/.test(id || "")) { chatStop(); NAV.pop(); return chatOpenPid(id.slice(1), true).then(ok => { if (!ok) location.replace("#chat"); }); }
  if (id === "find") {
    const q = $("#chatQ");
    q.focus();
    let tm;
    q.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(chatFind, 300); });
    return;
  }
  if (id) {
    CHAT.with = +id; CHAT.last = 0;
    const load = async () => {
      try {
        const r = await chatApi(`/api/az/msgs?with=${CHAT.with}&after=${CHAT.last}`);
        if (CHAT.with !== +id) return;
        chatRenderHead(r);
        chatAppend(r.msgs, !CHAT.last);
        $$("#chatMsgs .az-msg.mine small[data-unread]").forEach(s => {
          if (+s.closest(".az-msg").dataset.id <= r.readTo) { s.textContent = s.textContent.replace(/ ✓$/, " ✓✓"); delete s.dataset.unread; }
        });
      } catch (e) { if (e.message === "404" || e.message === "400") { toast(t("chat_nobody")); goBack(); } }
    };
    load();
    CHAT.timer = setInterval(load, 4000);
    $("#chatSend textarea").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatSend").requestSubmit(); } });
    return;
  }
  const load = async () => {
    try {
      const r = await chatApi("/api/az/convs");
      const box = $("#chatConvs");
      if (!box) return;
      box.innerHTML = r.convs.length ? r.convs.map(c => `<a class="az-row" href="#chat/${c.id}"><span class="az-avatar">${initial(c.name)}</span><div><b>${esc(c.name)}</b><small>${c.mine ? t("chat_you") : ""}${esc(c.text)}</small></div>${c.unread ? `<span class="az-unread">${c.unread}</span>` : icon("chevron-right", "go")}</a>`).join("")
        : `<div class="az-empty">${icon("message")}${t("chat_none")}</div>`;
    } catch { /* нет сети — покажем при следующей попытке */ }
  };
  load();
  CHAT.timer = setInterval(load, 10000);
}
function chatStop() { clearInterval(CHAT.timer); CHAT.timer = null; CHAT.with = null; }

async function chatFind() {
  let q = $("#chatQ")?.value.trim();
  const box = $("#chatFound");
  if (!box) return;
  if (/^#?[\d\s]+$/.test(q || "")) q = q.replace(/[#\s]/g, "");   // «100 001» и «#100001» — тоже ID
  if (!q || q.length < 2) { box.innerHTML = ""; return; }
  try {
    const r = await chatApi("/api/az/users?q=" + encodeURIComponent(q));
    box.innerHTML = r.users.length ? r.users.map(u => `<a class="az-row" href="#chat/${u.id}"><span class="az-avatar">${initial(u.name)}</span><div><b>${esc(u.name)}</b><small>${u.pid ? `ID ${fmtPid(u.pid)} · ` : ""}${seenTxt(u.seen)}</small></div>${icon("chevron-right", "go")}</a>`).join("")
      : `<div class="az-empty">${t("chat_nobody")}</div>`;
  } catch { box.innerHTML = `<div class="az-empty">${t("offline")}</div>`; }
}

let chatPeer = null;
function chatRenderHead(r) {
  chatPeer = r.user;
  $("#chatAv").textContent = (r.user.name || "?").trim().charAt(0).toUpperCase();
  $("#chatName").textContent = r.user.name;
  $("#chatSeen").textContent = seenTxt(r.user.seen) + (r.user.pid ? ` · ID ${fmtPid(r.user.pid)}` : "");
  $("#chatBlockLbl").textContent = r.blocked ? t("chat_unblock") : t("chat_block");
  $("#chatBlockLbl").dataset.on = r.blocked ? "1" : "";
  const form = $("#chatSend");
  form.hidden = r.blocked;
  if (r.blocked && !$("#chatBlockedNote")) form.insertAdjacentHTML("beforebegin", `<div class="az-note" id="chatBlockedNote">${icon("ban")}<span>${t("chat_blocked")}</span></div>`);
  if (!r.blocked) $("#chatBlockedNote")?.remove();
}
function chatAppend(msgs, first) {
  const box = $("#chatMsgs");
  if (!box) return;
  if (first) box.innerHTML = msgs.length ? "" : `<p class="az-empty" id="chatFirst">${t("chat_first")}</p>`;
  if (!msgs.length) return;
  $("#chatFirst")?.remove();
  const nearBottom = innerHeight + scrollY >= document.body.scrollHeight - 120;
  let day = box.dataset.day || "";
  box.insertAdjacentHTML("beforeend", msgs.map(m => {
    const d = fmtDay(m.at), sep = d !== day ? `<span class="az-day">${d}</span>` : "";
    day = d;
    return `${sep}<div class="az-msg ${m.mine ? "mine" : ""}" data-id="${m.id}">${esc(m.text)}<small ${m.mine && !m.read ? "data-unread" : ""}>${fmtTime(m.at)}${m.mine ? (m.read ? " ✓✓" : " ✓") : ""}</small></div>`;
  }).join(""));
  box.dataset.day = day;
  CHAT.last = msgs[msgs.length - 1].id;
  if (first || nearBottom) scrollTo(0, document.body.scrollHeight);
}

document.addEventListener("submit", async e => {
  if (e.target.id !== "chatSend") return;
  e.preventDefault();
  const ta = e.target.text, text = ta.value.trim();
  if (!text || !CHAT.with) return;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    await chatApi("/api/az/msgs", { method: "POST", body: JSON.stringify({ to: CHAT.with, text }) });
    ta.value = "";
    const r = await chatApi(`/api/az/msgs?with=${CHAT.with}&after=${CHAT.last}`);
    chatAppend(r.msgs, false);
    scrollTo(0, document.body.scrollHeight);
  } catch { toast(t("chat_err")); }
  btn.disabled = false;
  ta.focus();
});
document.addEventListener("click", async e => {
  if (e.target.closest("[data-chat-menu]")) { const m = $("#chatMenu"); m.hidden = !m.hidden; return; }
  if (e.target.closest("[data-chat-block]") && chatPeer) {
    const on = !$("#chatBlockLbl").dataset.on;
    if (on && !(await askConfirm(t("chat_block_q", { name: esc(chatPeer.name) }), t("chat_block_sub"), t("chat_block"), true))) return;
    try { await chatApi("/api/az/block", { method: "POST", body: JSON.stringify({ id: chatPeer.id, on }) }); } catch { return toast(t("chat_err")); }
    $("#chatMenu").hidden = true;
    return chatRenderHead({ user: chatPeer, blocked: on });
  }
  if (e.target.closest("[data-chat-report]") && chatPeer) {
    if (!(await askConfirm(t("chat_report_q", { name: esc(chatPeer.name) }), t("chat_report_sub"), t("chat_report"), true))) return;
    const lastTheirs = $$("#chatMsgs .az-msg:not(.mine)").pop()?.dataset.id;
    try { await chatApi("/api/az/report", { method: "POST", body: JSON.stringify({ id: chatPeer.id, msg: lastTheirs ? +lastTheirs : null, reason: "chat" }) }); } catch { return toast(t("chat_err")); }
    toast(t("chat_reported"));
    $("#chatMenu").hidden = true;
    return chatRenderHead({ user: chatPeer, blocked: true });
  }
  if (e.target.closest("[data-login]")) return chatLogin();
  if (e.target.closest("[data-copy-id]") && CHAT.me?.pid) {
    try { await navigator.clipboard.writeText(String(CHAT.me.pid)); toast(t("copied")); }
    catch { toast(fmtPid(CHAT.me.pid)); }
    return;
  }
  if (e.target.closest("[data-share-id]") && CHAT.me?.pid) {
    const url = `${location.origin}/az#chat/p${CHAT.me.pid}`, text = t("share_text", { id: CHAT.me.pid, url });
    if (navigator.share) return navigator.share({ title: "Hamyol", text, url }).catch(() => {});
    try { await navigator.clipboard.writeText(text); toast(t("copied")); } catch { toast(text); }
  }
});
document.addEventListener("submit", e => {
  if (e.target.id !== "chatById") return;
  e.preventDefault();
  chatOpenPid(e.target.pid.value);
});

// Вход через Telegram: сервер даёт одноразовый код → человек подтверждает в боте → страница получает токен
async function chatLogin() {
  const box = $("#chatLogin");
  if (!CHAT.config) { try { CHAT.config = await (await fetch("/api/config", { cache: "no-store" })).json(); } catch { CHAT.config = {}; } }
  if (!CHAT.config.telegramBot) { box.insertAdjacentHTML("beforeend", `<div class="az-note">${icon("info")}<span>${t("chat_login_off")}</span></div>`); return; }
  try {
    const r = await (await fetch("/api/auth/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
    window.open(r.url, "_blank", "noopener");
    box.innerHTML = `<p class="az-lead" style="margin:0">${t("chat_login_wait")}</p><a class="az-btn ghost" href="${esc(r.url)}" target="_blank" rel="noopener">${icon("tg")} Telegram</a>`;
    const until = Date.now() + (r.ttl || 600000);
    clearInterval(CHAT.login);
    CHAT.login = setInterval(async () => {
      if (Date.now() > until) { clearInterval(CHAT.login); return route(); }
      try {
        const p = await fetch("/api/auth/poll?code=" + encodeURIComponent(r.code));
        if (p.status === 410) { clearInterval(CHAT.login); return route(); }
        const j = await p.json();
        if (j.token) {
          clearInterval(CHAT.login);
          CHAT.token = j.token;
          try { localStorage.setItem("safar_token", j.token); } catch { /* приватный режим */ }
          await chatMe();
          route();
        }
      } catch { /* нет сети — следующая попытка */ }
    }, 2000);
  } catch { toast(t("chat_err")); }
}

// Профиль и непрочитанные (значок на главной и в шапке) — раз в 30 секунд
async function chatMe() {
  if (!CHAT.token) return;
  try {
    CHAT.me = await chatApi("/api/az/me");
    const changed = CHAT.unread !== CHAT.me.unread;
    CHAT.unread = CHAT.me.unread;
    // ID пришёл с сервера — подставляем туда, где он уже показан
    if ($("#azIdCard b")?.textContent === "…") $("#azIdCard").outerHTML = idCard();
    if ($("#chatMyId")) $("#chatMyId").textContent = fmtPid(CHAT.me.pid);
    const nm = $("#azName input");
    if (nm && !nm.value) nm.value = CHAT.me.name;
    if (changed) { renderTop(); if (curHash === "#home") $("#azMain").innerHTML = SCREENS.home(); }
  } catch { /* нет сети или вышли */ }
}

// ---------- Старт ----------
renderTop();
route();
chatMe();
setInterval(chatMe, 30000);
// Приложение сохраняется для работы без интернета сразу при первом открытии (несколько файлов, ~150 КБ)
// Не ждём событие «load»: оно приходит, только когда загрузились все фото, а медленное фото с Commons может идти минуту
if ("serviceWorker" in navigator) setTimeout(offRegister, 1500);
// Без интернета — показываем один раз, когда пропал
addEventListener("offline", () => toast(t("offline")));

// Выбрали другое направление — пересчитываем: что уже скачано, сколько ещё
document.addEventListener("change", e => {
  if (e.target.name !== "mtDir") return;
  store.set("az_mt_dir", e.target.value);
  mtHave = null;
  mtFill();
});

document.addEventListener("change", e => {
  if (!e.target.matches?.("[data-auto-dl]")) return;
  store.set("az_auto_dl", e.target.checked);
  if (e.target.checked) { store.set("az_auto_done", {}); autoOffline(); }
});
