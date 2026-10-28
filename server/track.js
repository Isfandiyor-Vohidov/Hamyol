// Учёт переходов на партнёров (бронирование отелей и т.п.) — без личных данных, только счётчики по дням
const { db } = require("./db");
const { sendJSON, readBody, clientIp, rateLimiter } = require("./http");

db.exec(`
  CREATE TABLE IF NOT EXISTS clicks (
    key TEXT NOT NULL,
    kind TEXT NOT NULL,
    day TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key, kind, day)
  );
`);

const limited = rateLimiter(60, 60e3);
const KINDS = new Set(["booking", "directions", "website", "phone", "share", "esim", "insurance", "rail", "taxi"]);
// Партнёры, на которых можно заработать — сводка для админки
const PARTNERS = ["booking", "esim", "insurance", "rail", "taxi"];

const routes = [
  // navigator.sendBeacon присылает text/plain — разбираем сами
  ["POST", "/api/track", async (req, res) => {
    if (limited(clientIp(req))) return sendJSON(req, res, 204, {});
    let data = {};
    try { data = JSON.parse(await readBody(req, 1000)); } catch { /* пусто */ }
    const key = String(data.key || ""), kind = String(data.kind || "");
    if (/^(city|poi|app):[\w-]{1,80}$/.test(key) && KINDS.has(kind)) {
      db.prepare("INSERT INTO clicks (key, kind, day, n) VALUES (?, ?, ?, 1) ON CONFLICT(key, kind, day) DO UPDATE SET n = n + 1")
        .run(key, kind, new Date().toISOString().slice(0, 10));
    }
    sendJSON(req, res, 200, { ok: true });
  }]
];

// Для админки и кабинета бизнеса
const stats = (key, days = 30) => db.prepare(`SELECT kind, SUM(n) AS n FROM clicks WHERE key = ? AND day >= ? GROUP BY kind`)
  .all(key, new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10));
const top = (kind, days = 30, limit = 20) => db.prepare(`SELECT key, SUM(n) AS n FROM clicks WHERE kind = ? AND day >= ? GROUP BY key ORDER BY n DESC LIMIT ?`)
  .all(kind, new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10), limit);

// Сколько переходов к каждому партнёру за N дней (и за последние 7 для сравнения)
function partners(days = 30) {
  const since = d => new Date(Date.now() - d * 86400e3).toISOString().slice(0, 10);
  const q = db.prepare(`SELECT kind, SUM(n) AS n FROM clicks WHERE day >= ? AND kind IN (${PARTNERS.map(() => "?").join(",")}) GROUP BY kind`);
  const toMap = rows => Object.fromEntries(rows.map(r => [r.kind, r.n]));
  const all = toMap(q.all(since(days), ...PARTNERS)), week = toMap(q.all(since(7), ...PARTNERS));
  return PARTNERS.map(kind => ({ kind, n: all[kind] || 0, week: week[kind] || 0 }));
}

module.exports = { routes, stats, top, partners };
