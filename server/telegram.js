// Telegram: бот, вход на сайте через бота, вход в Mini App, уведомления.
// Нужно в .env: TELEGRAM_BOT_TOKEN и TELEGRAM_BOT (имя бота без @).
// Для кнопки Mini App нужен HTTPS-адрес сайта: PUBLIC_URL=https://…
const crypto = require("node:crypto");
const env = require("./env");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const auth = require("./auth");

const TOKEN = env.TELEGRAM_BOT_TOKEN;
const enabled = !!(TOKEN && env.TELEGRAM_BOT);
const sleep = ms => new Promise(r => setTimeout(r, ms));

db.exec(`
  CREATE TABLE IF NOT EXISTS login_codes (
    code TEXT PRIMARY KEY,
    created INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    used INTEGER NOT NULL DEFAULT 0
  );
`);
const CODE_TTL = 10 * 60e3;
const BIZ_LEADS = new Map();   // кто и когда оставлял заявку «Для бизнеса»
// Куда вернуть человека после входа (адрес сайта, с которого он нажал «Войти»). Живёт столько же, сколько код.
const RETURN_TO = new Map();
setInterval(() => { const old = Date.now() - CODE_TTL; for (const [k, v] of RETURN_TO) if (v.t < old) RETURN_TO.delete(k); }, 60e3).unref();
// Принимаем только HTTPS-адрес этого же сайта (PUBLIC_URL или хост запроса) — чужие ссылки бот не отправит
function returnUrl(req, ret) {
  try {
    const u = new URL(String(ret || ""));
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
    const pub = httpsUrl ? new URL(httpsUrl).host.toLowerCase() : "";
    if (u.protocol !== "https:" || (u.host.toLowerCase() !== host && u.host.toLowerCase() !== pub)) return httpsUrl ? httpsUrl + "/#account" : "";
    return u.origin + "/#account";
  } catch { return httpsUrl ? httpsUrl + "/#account" : ""; }
}

// ---------- Bot API ----------
async function tg(method, payload = {}, timeout = 15000) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout)
  });
  const json = await res.json();
  if (!json.ok) { const e = new Error(json.description || "telegram error"); e.code = json.error_code; throw e; }
  return json.result;
}

// Сообщение пользователю (если он запускал бота). Ошибки не роняют вызывающий код.
async function notify(tgId, text, buttons) {
  if (!enabled || !tgId) return false;
  try {
    await tg("sendMessage", {
      chat_id: tgId, text, parse_mode: "HTML", disable_web_page_preview: true,
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {})
    });
    return true;
  } catch (e) { console.error("Telegram notify:", e.message); return false; }
}

const httpsUrl = /^https:\/\//.test(env.PUBLIC_URL) ? env.PUBLIC_URL : "";
// Кнопка «Открыть Safar»: Mini App (нужен HTTPS) или обычная ссылка
function openButton(lang, start) {
  if (!httpsUrl) return null;
  const url = httpsUrl + "/" + (start ? `?start=${encodeURIComponent(start)}` : "");
  return [[{ text: T(lang).open, web_app: { url } }]];
}

// Меню бота: кнопки сразу в нужные разделы приложения (Mini App, нужен HTTPS)
function menuKeyboard(lang) {
  const x = T(lang);
  const app = (text, start) => ({ text, web_app: { url: httpsUrl + "/" + (start ? "?start=" + start : "") } });
  if (!httpsUrl) return [[{ text: x.rail, url: "https://eticket.uzrailpass.uz" }]];
  return [
    [app(x.open, "")],
    [app(x.trip, "budget"), app(x.trains, "trains")],
    [app(x.prices, "prices"), app(x.safety, "safety")],
    [app(x.phrases, "guide_phrases"), app(x.offline, "offline")]
  ];
}

const BOT_TEXT = {
  ru: {
    biz: "🏪 <b>Спасибо за заявку!</b>\n\nМы напишем вам в Telegram в ближайшее время и расскажем про тариф «Партнёр».\n\nА пока: найдите своё заведение в Hamyol и нажмите «Это ваше заведение?» — так вы получите доступ к кабинету.",
    hello: "Ассалому алайкум! 👋\n\n<b>Hamyol</b> — путешествия по Узбекистану: 349 городов, отели, базары, достопримечательности, карта, погода, план на день и бюджет поездки.",
    soon: "\n\nВеб-приложение скоро будет доступно по ссылке.",
    open: "🧭 Открыть Hamyol",
    loggedIn: "✅ Вы вошли в Hamyol как <b>{name}</b>.\nНажмите кнопку ниже, чтобы вернуться в приложение.",
    back: "↩️ Вернуться в Hamyol",
    expired: "⌛ Ссылка для входа устарела. Нажмите «Войти через Telegram» на сайте ещё раз.",
    trains: "🚆 Поезда",
    safety: "🛡 Безопасно ли?",
    prices: "💰 Цены на месте",
    offline: "📥 Без интернета",
    trip: "🗺 План поездки",
    phrases: "🗣 Разговорник",
    menu: "Что открыть?",
    rail: "🎫 Купить билет — uzrailpass.uz",
    sos: "🆘 <b>Экстренные номера в Узбекистане</b>\n\n🚒 101 — пожарные\n👮 102 — полиция\n🚑 103 — скорая помощь\n\nДержите копию паспорта в телефоне.",
    trainsText: "🚆 <b>Поезда между городами</b> (время примерное)\n\nТашкент → Самарканд: Afrosiyob ≈ 2 ч 10 мин\nТашкент → Бухара: Afrosiyob ≈ 3 ч 50 мин\nСамарканд → Бухара: Afrosiyob ≈ 1 ч 40 мин\nБухара → Хива: ≈ 6 ч 30 мин\n\nБилеты на Afrosiyob быстро заканчиваются — покупайте за несколько дней.",
    cmds: [["start","Открыть Hamyol и меню"],["trains","Поезда между городами"],["sos","Экстренные номера"],["remind","Напоминания о поездке"],["city","Город дня"],["word","Слово дня"],["help","Помощь"]],
    help: "Команды:\n/start — открыть Hamyol и меню\n/trains — поезда между городами\n/sos — экстренные номера\n/remind — напоминания о поездке по утрам\n/city — город дня\n/word — слово дня по-узбекски\n/myid — ваш Telegram ID\n/help — помощь"
  },
  uz: {
    biz: "🏪 <b>Arizangiz uchun rahmat!</b>\n\nTez orada Telegram’da yozamiz va «Hamkor» tarifi haqida aytib beramiz.\n\nHozircha: Hamyol’da muassasangizni toping va «Bu sizning muassasangizmi?» tugmasini bosing — kabinetga kirish shunday olinadi.",
    hello: "Assalomu alaykum! 👋\n\n<b>Hamyol</b> — O‘zbekiston bo‘ylab sayohat: 349 ta shahar, mehmonxonalar, bozorlar, diqqatga sazovor joylar, xarita, ob-havo, kunlik reja va sayohat byudjeti.",
    soon: "\n\nVeb-ilova tez orada havola orqali ochiladi.",
    open: "🧭 Hamyol’ni ochish",
    loggedIn: "✅ Siz Hamyol’ga <b>{name}</b> sifatida kirdingiz.\nIlovaga qaytish uchun pastdagi tugmani bosing.",
    back: "↩️ Hamyol’ga qaytish",
    expired: "⌛ Kirish havolasi eskirgan. Saytda «Telegram orqali kirish» tugmasini yana bosing.",
    trains: "🚆 Poyezdlar",
    safety: "🛡 Xavfsizmi?",
    prices: "💰 Joyidagi narxlar",
    offline: "📥 Internetsiz",
    trip: "🗺 Sayohat rejasi",
    phrases: "🗣 So‘zlashgich",
    menu: "Nimani ochamiz?",
    rail: "🎫 Chipta olish — uzrailpass.uz",
    sos: "🆘 <b>O‘zbekistonda favqulodda raqamlar</b>\n\n🚒 101 — o‘t o‘chirish\n👮 102 — militsiya\n🚑 103 — tez yordam\n\nPasport nusxasini telefonda saqlang.",
    trainsText: "🚆 <b>Shaharlar orasidagi poyezdlar</b> (vaqt taxminiy)\n\nToshkent → Samarqand: Afrosiyob ≈ 2 soat 10 daq\nToshkent → Buxoro: Afrosiyob ≈ 3 soat 50 daq\nSamarqand → Buxoro: Afrosiyob ≈ 1 soat 40 daq\nBuxoro → Xiva: ≈ 6 soat 30 daq\n\nAfrosiyob chiptalari tez tugaydi — bir necha kun oldin oling.",
    cmds: [["start","Hamyol va menyu"],["trains","Shaharlar orasidagi poyezdlar"],["sos","Favqulodda raqamlar"],["remind","Sayohat eslatmalari"],["city","Kun shahri"],["word","Kun so‘zi"],["help","Yordam"]],
    help: "Buyruqlar:\n/start — Hamyol va menyu\n/trains — poyezdlar\n/sos — favqulodda raqamlar\n/remind — ertalabki sayohat eslatmalari\n/city — kun shahri\n/word — kun so‘zi\n/myid — Telegram ID’ingiz\n/help — yordam"
  },
  en: {
    biz: "🏪 <b>Thanks for your request!</b>\n\nWe'll message you on Telegram soon about the Partner plan.\n\nMeanwhile, find your business in Hamyol and tap “Is this your business?” to get access to the dashboard.",
    hello: "Hello! 👋\n\n<b>Hamyol</b> is your guide to Uzbekistan: 349 cities, hotels, bazaars, sights, maps, weather, day plans and trip budgets.",
    soon: "\n\nThe web app link is coming soon.",
    open: "🧭 Open Hamyol",
    loggedIn: "✅ You're signed in to Hamyol as <b>{name}</b>.\nTap the button below to return to the app.",
    back: "↩️ Back to Hamyol",
    expired: "⌛ This sign-in link has expired. Tap “Sign in with Telegram” on the website again.",
    trains: "🚆 Trains",
    safety: "🛡 Is it safe?",
    prices: "💰 Local prices",
    offline: "📥 Offline",
    trip: "🗺 Trip planner",
    phrases: "🗣 Phrasebook",
    menu: "What would you like to open?",
    rail: "🎫 Buy tickets — uzrailpass.uz",
    sos: "🆘 <b>Emergency numbers in Uzbekistan</b>\n\n🚒 101 — fire\n👮 102 — police\n🚑 103 — ambulance\n\nKeep a copy of your passport on your phone.",
    trainsText: "🚆 <b>Trains between cities</b> (approximate times)\n\nTashkent → Samarkand: Afrosiyob ≈ 2 h 10 min\nTashkent → Bukhara: Afrosiyob ≈ 3 h 50 min\nSamarkand → Bukhara: Afrosiyob ≈ 1 h 40 min\nBukhara → Khiva: ≈ 6 h 30 min\n\nAfrosiyob tickets sell out fast — book a few days ahead.",
    cmds: [["start","Open Hamyol and menu"],["trains","Trains between cities"],["sos","Emergency numbers"],["remind","Trip reminders"],["city","City of the day"],["word","Word of the day"],["help","Help"]],
    help: "Commands:\n/start — open Hamyol and menu\n/trains — trains between cities\n/sos — emergency numbers\n/remind — morning trip reminders\n/city — city of the day\n/word — Uzbek word of the day\n/myid — your Telegram ID\n/help — help"
  }
};
const T = lang => BOT_TEXT[lang] || BOT_TEXT[String(lang || "").slice(0, 2)] || BOT_TEXT.en;
const langOf = from => ({ ru: "ru", uz: "uz", kk: "ru", ky: "ru", tg: "ru", be: "ru", uk: "ru" })[String(from?.language_code || "").slice(0, 2)] || "en";

// ---------- Обработка сообщений бота ----------
async function onUpdate(u) {
  const msg = u.message;
  // Файл или фото в личном чате — это билет для «Мои билеты» (server/tickets.js)
  if (msg?.from && msg.chat?.type === "private" && (msg.document || msg.photo)) {
    const r = await require("./tickets").fromBot(msg, auth.upsertTelegramUser(msg.from), langOf(msg.from), tg, httpsUrl);
    if (!r) return;
    return tg("sendMessage", typeof r === "string" ? { chat_id: msg.chat.id, text: r }
      : { chat_id: msg.chat.id, text: r.text, parse_mode: "HTML", ...(r.button ? { reply_markup: { inline_keyboard: r.button } } : {}) });
  }
  if (!msg?.text || !msg.from || msg.chat?.type !== "private") return;
  const lang = langOf(msg.from);
  const [cmd, param = ""] = msg.text.trim().split(/\s+/, 2);
  if (cmd === "/start" && param.startsWith("login_")) {
    const code = param.slice(6);
    const row = db.prepare("SELECT * FROM login_codes WHERE code = ?").get(code);
    if (!row || row.used || Date.now() - row.created > CODE_TTL) return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).expired });
    const user = auth.upsertTelegramUser(msg.from);
    db.prepare("UPDATE login_codes SET user_id = ? WHERE code = ?").run(user.id, code);
    const back = RETURN_TO.get(code)?.url;
    RETURN_TO.delete(code);
    return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).loggedIn.replace("{name}", escHtml(user.name)), parse_mode: "HTML",
      ...(back ? { reply_markup: { inline_keyboard: [[{ text: T(lang).back, url: back }]] } } : {}) });
  }
  if (cmd === "/start" && param === "biz") {
    const user = auth.upsertTelegramUser(msg.from);
    const last = BIZ_LEADS.get(msg.from.id) || 0;
    if (Date.now() - last > 86400e3) {
      BIZ_LEADS.set(msg.from.id, Date.now());
      const who = escHtml([msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") || user.name) + (msg.from.username ? " @" + escHtml(msg.from.username) : "");
      require("./market").notifyAdmins(`🏪 <b>Заявка от бизнеса</b>\n${who}\nTelegram ID: <code>${msg.from.id}</code>\nНапишите человеку, чтобы обсудить тариф «Партнёр».`).catch(() => {});
    }
    return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).biz, parse_mode: "HTML" });
  }
  if (cmd === "/start") {
    auth.upsertTelegramUser(msg.from);   // пользователь запустил бота — ему можно присылать уведомления
    const kb = param ? openButton(lang, param) : menuKeyboard(lang);
    return tg("sendMessage", {
      chat_id: msg.chat.id, text: T(lang).hello + (kb ? "" : T(lang).soon), parse_mode: "HTML",
      ...(kb ? { reply_markup: { inline_keyboard: kb } } : {})
    });
  }
  if (cmd === "/help") return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).help, reply_markup: { inline_keyboard: menuKeyboard(lang) } });
  if (cmd === "/city") return sendCityOfDay(msg.chat.id, lang);
  if (cmd === "/word") return sendWordOfDay(msg.chat.id, lang);
  if (cmd === "/remind" || cmd === "/remind_off") {
    const user = auth.upsertTelegramUser(msg.from);
    return tg("sendMessage", { chat_id: msg.chat.id, text: require("./botremind").command(cmd, user.id, lang), parse_mode: "HTML" });
  }
  if (cmd === "/menu") return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).menu, reply_markup: { inline_keyboard: menuKeyboard(lang) } });
  if (cmd === "/sos") return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).sos, parse_mode: "HTML" });
  if (cmd === "/trains") return tg("sendMessage", { chat_id: msg.chat.id, text: T(lang).trainsText, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: T(lang).rail, url: "https://eticket.uzrailpass.uz" }], ...(httpsUrl ? [[{ text: T(lang).trains, web_app: { url: httpsUrl + "/?start=trains" } }]] : [])] } });
  if (cmd === "/myid") return tg("sendMessage", { chat_id: msg.chat.id, text: `Telegram ID: <code>${msg.from.id}</code>`, parse_mode: "HTML" });
  // Сводка статистики — только администраторам (ADMIN_TG_IDS); остальным команда не отвечает
  if (cmd === "/stats" && String(env.ADMIN_TG_IDS).split(",").map(s => s.trim()).includes(String(msg.from.id))) {
    return tg("sendMessage", { chat_id: msg.chat.id, text: require("./stats").botText(), parse_mode: "HTML" });
  }
}
const escHtml = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// «Слово дня» (/word): та же фраза из разговорника, что и на главной приложения (js/content.js)
let PHRASES = null;
function phrases() {
  if (PHRASES) return PHRASES;
  try {
    const vm = require("node:vm"), ctx = {};
    vm.createContext(ctx);
    vm.runInContext(require("node:fs").readFileSync(require("node:path").join(env.ROOT, "js", "content.js"), "utf8") + ";globalThis.__P = PHRASES;", ctx);
    PHRASES = ctx.__P || [];
  } catch { PHRASES = []; }
  return PHRASES;
}
const WORD = { ru: ["🗣 <b>Слово дня по-узбекски</b>", "Произношение"], uz: ["🗣 <b>Kun so‘zi</b>", "Talaffuz"], en: ["🗣 <b>Uzbek word of the day</b>", "Say it"] };
async function sendWordOfDay(chatId, lang) {
  const list = phrases();
  if (!list.length) return;
  const p = list[Math.floor((Date.now() + 5 * 3600e3) / 864e5) % list.length], x = WORD[lang] || WORD.en;
  const tr = lang === "ru" ? `${p[2]}\n${x[1]}: <i>${escHtml(p[1])}</i>` : lang === "uz" ? `${p[2]} · ${p[3]}` : p[3];
  return tg("sendMessage", { chat_id: chatId, text: `${x[0]}\n\n<b>${escHtml(p[0])}</b>\n${escHtml(tr).replace(/&lt;(\/?)i&gt;/g, "<$1i>")}`, parse_mode: "HTML",
    ...(httpsUrl ? { reply_markup: { inline_keyboard: [[{ text: "🔊 " + (lang === "uz" ? "So‘zlashgich" : lang === "ru" ? "Разговорник" : "Phrasebook"), web_app: { url: httpsUrl + "/?start=guide_phrases" } }]] } } : {}) });
}

// «Город дня» (/city): один и тот же для всех в течение дня, из городов с фото и населением от 30 тысяч
const CITY_DAY = {
  ru: { t: "🏙 <b>Город дня: {name}</b>", pop: "{n} тыс. жителей", sights: "🏛 мест для осмотра: {a}", hotels: "🏨 отелей: {h}", food: "🍽 кафе и ресторанов: {f}", open: "Открыть в Hamyol" },
  uz: { t: "🏙 <b>Kun shahri: {name}</b>", pop: "{n} ming aholi", sights: "🏛 diqqatga sazovor joylar: {a}", hotels: "🏨 mehmonxonalar: {h}", food: "🍽 kafe va restoranlar: {f}", open: "Hamyol’da ochish" },
  en: { t: "🏙 <b>City of the day: {name}</b>", pop: "{n}k residents", sights: "🏛 sights: {a}", hotels: "🏨 hotels: {h}", food: "🍽 cafés & restaurants: {f}", open: "Open in Hamyol" }
};
async function sendCityOfDay(chatId, lang) {
  const { D, cityName, regionName, commonsImg } = require("./data");
  const list = D.CITIES.filter(c => c.img && c.pop >= 30000).sort((a, b) => a.idx - b.idx);
  if (!list.length) return;
  const c = list[Math.floor(Date.now() / 864e5) % list.length], x = CITY_DAY[lang] || CITY_DAY.en;
  const caption = [
    x.t.replace("{name}", escHtml(cityName(lang, c))),
    `${escHtml(regionName(lang, c.r))} · ${x.pop.replace("{n}", Math.round(c.pop / 1000))}`,
    "",
    x.sights.replace("{a}", c.counts.a), x.hotels.replace("{h}", c.counts.h), x.food.replace("{f}", c.counts.f)
  ].join("\n");
  const kb = httpsUrl ? { reply_markup: { inline_keyboard: [[{ text: "🧭 " + x.open, web_app: { url: `${httpsUrl}/?start=city_${c.id}` } }]] } } : {};
  try { await tg("sendPhoto", { chat_id: chatId, photo: commonsImg(c.img, 1000), caption, parse_mode: "HTML", ...kb }); }
  catch { await tg("sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML", ...kb }); }
}

// Долгий опрос getUpdates (вебхук не нужен — работает и без публичного адреса)
async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] }, 60000);
      for (const u of updates) {
        offset = u.update_id + 1;
        await onUpdate(u).catch(e => console.error("Telegram update:", e.message));
      }
    } catch (e) {
      if (e.code === 409) { console.log("Telegram: обновления получает другой сервер или вебхук — опрос на этом сервере выключен"); return; }
      if (e.code === 401) { console.log("Telegram: неверный TELEGRAM_BOT_TOKEN"); return; }
      await sleep(5000);
    }
  }
}

async function onStart() {
  if (!enabled) return;
  try {
    const me = await tg("getMe");
    console.log(`Telegram: бот @${me.username} подключён`);
    const cmds = lang => ({ commands: BOT_TEXT[lang].cmds.map(([command, description]) => ({ command, description })) });
    await tg("setMyCommands", cmds("en"));
    await tg("setMyCommands", { ...cmds("ru"), language_code: "ru" });
    await tg("setMyCommands", { ...cmds("uz"), language_code: "uz" });
    if (httpsUrl) {
      // Кнопка меню бота открывает Mini App
      await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Hamyol", web_app: { url: httpsUrl + "/" } } });
      console.log(`Telegram: Mini App → ${httpsUrl}`);
    } else {
      console.log("Telegram: для Mini App укажите PUBLIC_URL=https://… в .env (вход на сайте через бота работает и без него)");
    }
    if (process.env.TELEGRAM_POLLING !== "0") poll();
  } catch (e) { console.error("Telegram:", e.message); }
}

// ---------- Проверка подписи Mini App (initData) ----------
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const calc = crypto.createHmac("sha256", secret).update(check).digest("hex");
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  if (Date.now() / 1000 - +params.get("auth_date") > 86400) return null;   // старше суток
  try { return JSON.parse(params.get("user")); } catch { return null; }
}

const startLimited = rateLimiter(20, 10 * 60e3);
const publicUser = u => ({ id: u.id, name: u.name, username: u.username, photo: u.photo, via: u.tg_id ? "tg" : u.google_sub ? "google" : "" });

const routes = [
  // Вход из Mini App
  ["POST", "/api/auth/telegram", async (req, res) => {
    if (!enabled) throw new HttpError(404, "telegram disabled");
    const { initData } = await readJSON(req, 8000);
    const tgUser = verifyInitData(String(initData || ""));
    if (!tgUser?.id) throw new HttpError(401, "bad signature");
    const user = auth.upsertTelegramUser(tgUser);
    sendJSON(req, res, 200, { token: auth.createSession(user.id), user: publicUser(user) });
  }],

  // Вход на сайте: одноразовый код → t.me/<бот>?start=login_<код> → бот подтверждает
  ["POST", "/api/auth/start", async (req, res) => {
    if (!enabled) throw new HttpError(404, "telegram disabled");
    if (startLimited(clientIp(req))) throw new HttpError(429, "too many requests");
    const body = await readJSON(req, 2000).catch(() => ({}));
    const code = crypto.randomBytes(16).toString("base64url");
    db.prepare("INSERT INTO login_codes (code, created) VALUES (?, ?)").run(code, Date.now());
    const back = returnUrl(req, body.ret);
    if (back) RETURN_TO.set(code, { url: back, t: Date.now() });
    sendJSON(req, res, 200, { code, url: `https://t.me/${env.TELEGRAM_BOT}?start=login_${code}`,
      app: `tg://resolve?domain=${env.TELEGRAM_BOT}&start=login_${code}`, ttl: CODE_TTL });
  }],
  ["GET", "/api/auth/poll", (req, res, url) => {
    const code = url.searchParams.get("code") || "";
    const row = db.prepare("SELECT * FROM login_codes WHERE code = ?").get(code);
    if (!row || row.used || Date.now() - row.created > CODE_TTL) return sendJSON(req, res, 410, { error: "expired" });
    if (!row.user_id) return sendJSON(req, res, 200, { pending: true });
    db.prepare("UPDATE login_codes SET used = 1 WHERE code = ?").run(code);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id);
    sendJSON(req, res, 200, { token: auth.createSession(user.id), user: publicUser(user) });
  }],

  ["POST", "/api/auth/logout", (req, res) => { auth.logout(req); sendJSON(req, res, 200, { ok: true }); }]
];

// Чистка старых кодов
setInterval(() => db.prepare("DELETE FROM login_codes WHERE created < ?").run(Date.now() - 86400e3), 3600e3).unref();

module.exports = { routes, onStart, notify, enabled, publicUser };
