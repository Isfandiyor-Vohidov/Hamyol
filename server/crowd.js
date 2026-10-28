// «Когда людно» у мест (как «Популярное время» в Google Maps), но только по честным отметкам:
// путешественник нажимает «Я здесь» на странице места, приложение проверяет, что он в 300 м от места.
// Храним только место, день недели и час по Ташкенту, день и хеш IP (чтобы один человек отмечался раз в день).
// Пока отметок меньше CROWD_MIN, график не показываем — лучше ничего, чем выдумка.
const crypto = require("crypto");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const { D } = require("./data");

db.exec(`
  CREATE TABLE IF NOT EXISTS crowd_marks (
    poi TEXT NOT NULL, day TEXT NOT NULL, dow INTEGER NOT NULL, hour INTEGER NOT NULL, who TEXT NOT NULL,
    UNIQUE (poi, day, who)
  );
  CREATE INDEX IF NOT EXISTS crowd_marks_poi ON crowd_marks(poi);
`);

const CROWD_MIN = 10;
const MAX_M = 300;
const limited = rateLimiter(30, 60 * 60e3);
const salt = crypto.randomBytes(16).toString("hex");   // хеш IP нельзя связать между перезапусками
const placeOf = key => /^poi:[nwr]\d{1,15}$/.test(key) ? D.POI[key.slice(4)] : null;
const la = o => o.la ?? o.lat, lo = o => o.lo ?? o.lon;
function meters(a, b) {
  const R = 6371e3, rad = Math.PI / 180;
  const x = Math.sin((la(b) - la(a)) * rad / 2) ** 2 + Math.cos(la(a) * rad) * Math.cos(la(b) * rad) * Math.sin((lo(b) - lo(a)) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const tashkent = (ms = Date.now()) => {
  const d = new Date(ms + 5 * 3600e3);
  return { day: d.toISOString().slice(0, 10), dow: d.getUTCDay(), hour: d.getUTCHours() };
};

// Сводка: сколько отметок по часам (за последние 180 дней) — всего и в тот же день недели, что сегодня
function summary(key) {
  const since = tashkent(Date.now() - 180 * 864e5).day;
  const rows = db.prepare("SELECT dow, hour, COUNT(*) AS n FROM crowd_marks WHERE poi = ? AND day >= ? GROUP BY dow, hour").all(key, since);
  const n = rows.reduce((s, r) => s + r.n, 0);
  if (n < CROWD_MIN) return { n, min: CROWD_MIN };
  const now = tashkent(), hours = Array(24).fill(0);
  for (const r of rows) hours[r.hour] += r.n;
  return { n, min: CROWD_MIN, hours, hour: now.hour };
}

const routes = [
  ["GET", "/api/crowd", (req, res, url) => {
    const key = url.searchParams.get("key") || "";
    sendJSON(req, res, 200, placeOf(key) ? summary(key) : { n: 0, min: CROWD_MIN });
  }],

  ["POST", "/api/crowd", async (req, res) => {
    const ip = clientIp(req);
    if (limited(ip)) throw new HttpError(429, "too many requests");
    const b = await readJSON(req, 1000), key = String(b.key || ""), p = placeOf(key);
    if (!p) throw new HttpError(400, "unknown place");
    const me = { lat: +b.lat, lon: +b.lon };
    if (!Number.isFinite(me.lat) || !Number.isFinite(me.lon)) throw new HttpError(400, "location required");
    if (meters(me, p) > MAX_M) throw new HttpError(400, "too far");
    const t = tashkent(), who = crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
    db.prepare("INSERT OR IGNORE INTO crowd_marks (poi, day, dow, hour, who) VALUES (?, ?, ?, ?, ?)").run(key, t.day, t.dow, t.hour, who);
    sendJSON(req, res, 200, summary(key));
  }]
];

module.exports = { routes, summary, meters, CROWD_MIN };
