// Напоминания о поездке в Telegram-боте: /remind — включить, /remind_off — выключить.
// Утром в 8:00 по Ташкенту — город дня и погода, накануне в 19:00 — «завтра в путь».
// Поездку берём из аккаунта (синхронизация «Поездки»), поэтому человек должен войти в Safar через Telegram.
const { db } = require("./db");
const env = require("./env");
const push = require("./push");

db.exec(`
  CREATE TABLE IF NOT EXISTS bot_reminders (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lang TEXT NOT NULL DEFAULT 'ru',
    sent TEXT NOT NULL DEFAULT '{}',
    created INTEGER NOT NULL
  );
`);

const TXT = {
  ru: { on: "🔔 <b>Напоминания включены.</b>\nНакануне поездки в 19:00 и каждое утро в 8:00 пришлю город дня и погоду.\nВыключить: /remind_off",
    noTrip: "\n\n⚠️ Пока не вижу вашей поездки. Войдите в Hamyol через Telegram и укажите даты во вкладке «Поездка» — она синхронизируется сама.",
    off: "🔕 Напоминания выключены. Включить снова: /remind",
    eve: "🧳 <b>Завтра в путь!</b>\n{route}", day: "☀️ <b>День {n} — {city}</b>\n{wx}", open: "🗺 Открыть план" },
  uz: { on: "🔔 <b>Eslatmalar yoqildi.</b>\nSafardan bir kun oldin 19:00 da va har kuni ertalab 8:00 da kun shahri va ob-havoni yuboraman.\nO‘chirish: /remind_off",
    noTrip: "\n\n⚠️ Sayohatingiz hali ko‘rinmayapti. Hamyol’ga Telegram orqali kiring va «Sayohat» bo‘limida sanalarni kiriting.",
    off: "🔕 Eslatmalar o‘chirildi. Qayta yoqish: /remind",
    eve: "🧳 <b>Ertaga yo‘lga!</b>\n{route}", day: "☀️ <b>{n}-kun — {city}</b>\n{wx}", open: "🗺 Rejani ochish" },
  en: { on: "🔔 <b>Reminders are on.</b>\nThe evening before your trip at 19:00 and every morning at 8:00 I'll send the city of the day and the weather.\nTurn off: /remind_off",
    noTrip: "\n\n⚠️ I can't see your trip yet. Sign in to Hamyol with Telegram and set your dates in the Trip tab — it syncs automatically.",
    off: "🔕 Reminders are off. Turn on again: /remind",
    eve: "🧳 <b>Tomorrow you're off!</b>\n{route}", day: "☀️ <b>Day {n} — {city}</b>\n{wx}", open: "🗺 Open plan" }
};
// Совет по погоде к утреннему сообщению: дождь, жара, холод
const TIPS = {
  ru: { rain: "☔ Возьмите зонт — днём возможен дождь.", hot: "🥵 Жарко: пейте воду, с 12 до 16 лучше в тени или в музее.", cold: "🧥 Холодно — оденьтесь потеплее." },
  uz: { rain: "☔ Soyabon oling — kunduzi yomg‘ir bo‘lishi mumkin.", hot: "🥵 Issiq: suv iching, 12 dan 16 gacha soyada yoki muzeyda bo‘ling.", cold: "🧥 Sovuq — issiqroq kiyining." },
  en: { rain: "☔ Take an umbrella — rain is possible today.", hot: "🥵 Hot day: drink water, stay in the shade or a museum from 12 to 4 pm.", cold: "🧥 Cold — dress warmly." }
};
function weatherTip(w, lang) {
  if (!w) return "";
  const x = TIPS[lang] || TIPS[String(lang || "").slice(0, 2)] || TIPS.en;
  if ((w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82) || w.code >= 95) return x.rain;
  if (w.max >= 35) return x.hot;
  if (w.min <= 0) return x.cold;
  return "";
}
// Праздники (как в js/holidays.js): в утреннем сообщении — «сегодня праздник, часы работы могут быть другими».
// Даты хайитов и Рамадана зависят от луны — примерные.
const HOLI_FIXED = { "01-01": "newyear", "03-08": "women", "03-21": "navruz", "05-09": "memory", "09-01": "independence", "10-01": "teachers", "12-08": "constitution" };
const HOLI_MOON = { 2026: { "03-20": "ramazan", "05-27": "qurbon" }, 2027: { "03-10": "ramazan", "05-16": "qurbon" }, 2028: { "02-27": "ramazan", "05-05": "qurbon" } };
const RAMADAN = { 2026: ["02-18", "03-19"], 2027: ["02-08", "03-09"], 2028: ["01-28", "02-26"] };
const HOLI_TXT = {
  ru: { newyear: "Новый год", women: "Женский день", navruz: "Навруз", memory: "День памяти", independence: "День независимости", teachers: "День учителя", constitution: "День Конституции", ramazan: "Рамазан хайит", qurbon: "Курбан хайит",
    today: "🎉 Сегодня {name} — музеи, банки и магазины могут работать по-другому.", ram: "🌙 Идёт Рамадан: днём часть кафе закрыта, после заката — ифтар и оживлённые улицы." },
  uz: { newyear: "Yangi yil", women: "Xotin-qizlar kuni", navruz: "Navro‘z", memory: "Xotira kuni", independence: "Mustaqillik kuni", teachers: "O‘qituvchilar kuni", constitution: "Konstitutsiya kuni", ramazan: "Ramazon hayiti", qurbon: "Qurbon hayiti",
    today: "🎉 Bugun {name} — muzey, bank va do‘konlar boshqacha ishlashi mumkin.", ram: "🌙 Ramazon oyi: kunduzi ayrim kafelar yopiq, kechqurun iftor." },
  en: { newyear: "New Year", women: "Women's Day", navruz: "Navruz", memory: "Remembrance Day", independence: "Independence Day", teachers: "Teachers' Day", constitution: "Constitution Day", ramazan: "Eid al-Fitr", qurbon: "Eid al-Adha",
    today: "🎉 Today is {name} — museums, banks and shops may keep different hours.", ram: "🌙 It's Ramadan: some cafés are closed in the daytime, streets come alive after sunset." }
};
function holidayTip(date, lang) {
  const x = HOLI_TXT[lang] || HOLI_TXT[String(lang || "").slice(0, 2)] || HOLI_TXT.en;
  const y = date.slice(0, 4), md = date.slice(5), h = HOLI_FIXED[md] || (HOLI_MOON[y] || {})[md];
  if (h) return x.today.replace("{name}", x[h]);
  const r = RAMADAN[y];
  return r && md >= r[0] && md <= r[1] ? x.ram : "";
}
const L = lang => TXT[lang] || TXT[String(lang || "").slice(0, 2)] || TXT.en;

// Поездка из аккаунта: { d: "2026-10-20", r: [[cityId, nights], …] } → { start, stops }
function tripOf(userId) {
  try {
    const row = db.prepare("SELECT trip FROM user_data WHERE user_id = ?").get(userId);
    const t = row?.trip ? JSON.parse(row.trip) : null;
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t.d || "") || !Array.isArray(t.r) || !t.r.length) return null;
    return { start: t.d, stops: t.r.map(([id, nights]) => ({ id, nights: +nights || 0 })) };
  } catch { return null; }
}

// Команды бота. Возвращает текст ответа или null, если команда не наша.
function command(cmd, userId, lang) {
  if (cmd === "/remind") {
    db.prepare(`INSERT INTO bot_reminders (user_id, lang, created) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET lang = excluded.lang`).run(userId, lang, Date.now());
    return L(lang).on + (tripOf(userId) ? "" : L(lang).noTrip);
  }
  if (cmd === "/remind_off") {
    db.prepare("DELETE FROM bot_reminders WHERE user_id = ?").run(userId);
    return L(lang).off;
  }
  return null;
}

const tashkent = () => {
  const d = new Date(Date.now() + 5 * 3600e3);
  return { hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
};
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const wxText = (w, lang) => w ? push.tx("day_b", lang, { max: w.max, min: w.min, wx: push.tx(push.wxKey(w.code), lang) }) : push.tx("day_b0", lang);

async function tick() {
  const { hour, date } = tashkent();
  if (hour !== 19 && hour !== 8) return;
  const tg = require("./telegram");
  const rows = db.prepare("SELECT r.*, u.tg_id FROM bot_reminders r JOIN users u ON u.id = r.user_id WHERE u.tg_id IS NOT NULL").all();
  for (const r of rows) {
    const trip = tripOf(r.user_id), sent = JSON.parse(r.sent || "{}");
    if (!trip) continue;
    const days = push.tripDays(trip), x = L(r.lang);
    const link = /^https:\/\//.test(env.PUBLIC_URL) ? env.PUBLIC_URL : "";
    let text = null, mark = null, url = link && link + "/?start=budget";
    if (hour === 19 && trip.start === addDays(date, 1) && !sent["eve:" + trip.start]) {
      mark = "eve:" + trip.start;
      text = x.eve.replace("{route}", trip.stops.map(s => push.cityName(s.id, r.lang)).join(" → "));
    }
    const n = Math.round((Date.parse(date) - Date.parse(trip.start)) / 864e5);
    if (hour === 8 && n >= 0 && n < days.length && !sent["day:" + date]) {
      mark = "day:" + date;
      const w = await push.weatherFor(days[n], date);
      text = x.day.replace("{n}", n + 1).replace("{city}", push.cityName(days[n], r.lang)).replace("{wx}", wxText(w, r.lang));
      const tip = weatherTip(w, r.lang);
      if (tip) text += "\n" + tip;
      const hol = holidayTip(date, r.lang);
      if (hol) text += "\n" + hol;
      if (link) url = link + "/?start=city_" + days[n];
    }
    if (!text) continue;
    const ok = await tg.notify(r.tg_id, text, url ? [[{ text: x.open, url }]] : null);
    if (ok) { sent[mark] = Date.now(); db.prepare("UPDATE bot_reminders SET sent = ? WHERE user_id = ?").run(JSON.stringify(sent), r.user_id); }
  }
}

function onStart() { setInterval(() => tick().catch(e => console.error("bot remind:", e.message)), 10 * 60e3).unref(); }

module.exports = { routes: [], onStart, command, tick, tripOf, weatherTip, holidayTip };
