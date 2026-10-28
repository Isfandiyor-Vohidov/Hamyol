// «Цены на месте»: путешественники присылают, сколько реально заплатили; приложение показывает медиану.
// Справочник позиций и стартовые оценки — js/prices-data.js (общий с браузером).
const crypto = require("node:crypto");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const { D } = require("./data");
const auth = require("./auth");
const { PRICE_ITEMS, priceTier } = require("../js/prices-data.js");

db.exec(`
  CREATE TABLE IF NOT EXISTS price_reports (
    id INTEGER PRIMARY KEY,
    city TEXT NOT NULL,
    item TEXT NOT NULL,
    price INTEGER NOT NULL,
    at INTEGER NOT NULL,
    who TEXT NOT NULL,
    user_id INTEGER
  );
  CREATE INDEX IF NOT EXISTS price_reports_city ON price_reports(city, item, at);
`);

const ITEM = Object.fromEntries(PRICE_ITEMS.map(i => [i.id, i]));
const FRESH = 180 * 24 * 3600e3;                    // учитываем сообщения за последние полгода
const limited = rateLimiter(20, 10 * 60e3);         // не больше 20 сообщений с одного IP за 10 минут
// IP храним только в виде хэша — чтобы один человек не «накручивал» позицию, но без лишних личных данных
const whoOf = req => crypto.createHash("sha256").update(clientIp(req) + ":safar-prices").digest("hex").slice(0, 16);

function median(xs) {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function cityStats(city) {
  const rows = db.prepare("SELECT item, price FROM price_reports WHERE city = ? AND at > ?").all(city, Date.now() - FRESH);
  const by = {};
  for (const r of rows) (by[r.item] ||= []).push(r.price);
  const out = {};
  for (const item in by) out[item] = { median: median(by[item]), n: by[item].length };
  return out;
}

const routes = [
  ["GET", "/api/prices", (req, res, url) => {
    const city = url.searchParams.get("city") || "";
    if (!D.CITY[city]) throw new HttpError(400, "unknown city");
    sendJSON(req, res, 200, cityStats(city));
  }],

  ["POST", "/api/prices", async (req, res) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const data = await readJSON(req);
    const city = String(data.city || ""), item = ITEM[data.item], price = Math.round(+data.price);
    if (!D.CITY[city] || !item || !(price > 0)) throw new HttpError(400, "invalid report");
    // Отсекаем явные опечатки: в 5 раз дешевле или дороже ориентира — не принимаем
    const k = priceTier(city);
    if (price < item.min * k / 5 || price > item.max * k * 5) throw new HttpError(422, "price out of range");
    const who = whoOf(req), user = auth.userFrom(req);
    // Один человек — одно сообщение по позиции в городе за сутки (новое заменяет старое)
    const prev = db.prepare("SELECT id FROM price_reports WHERE city = ? AND item = ? AND who = ? AND at > ?").get(city, item.id, who, Date.now() - 24 * 3600e3);
    if (prev) db.prepare("UPDATE price_reports SET price = ?, at = ? WHERE id = ?").run(price, Date.now(), prev.id);
    else db.prepare("INSERT INTO price_reports (city, item, price, at, who, user_id) VALUES (?, ?, ?, ?, ?, ?)").run(city, item.id, price, Date.now(), who, user ? user.id : null);
    sendJSON(req, res, 201, { ok: true, stats: cityStats(city)[item.id] });
  }]
];

module.exports = { routes };
