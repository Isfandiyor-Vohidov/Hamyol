// Сообщения об ошибке в данных места: неверные часы работы, закрыто навсегда, неверный телефон или адрес, другое.
// Приложение отправляет их только после согласия на обработку данных (js/consent.js).
// Хранится место, причина, комментарий (до 300 символов), дата и, если человек вошёл, его id — без IP.
// Администратор видит их во вкладке «Ошибки» в админке (#admin) и отмечает «Исправлено» / «Отклонить».
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const { D, poiName } = require("./data");
const auth = require("./auth");

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    poi_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    date INTEGER NOT NULL,
    user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'new'
  );
  CREATE INDEX IF NOT EXISTS reports_status ON reports(status, id);
`);

const REASONS = ["hours", "closed", "contact", "other"];
const STATUSES = ["new", "fixed", "rejected"];
const MAX_COMMENT = 300;
const limited = rateLimiter(5, 60 * 60e3);   // не больше 5 сообщений с одного IP в час

// Проверка входных данных: место существует, причина из списка, комментарий не длиннее 300 символов,
// для «Другое» комментарий обязателен. Управляющие символы из комментария убираем
function parseReport(data) {
  const str = v => typeof v === "string" ? v : "";   // только строки: ["n123"] или {…} — отказ
  const poi = str(data?.poi), reason = str(data?.reason), raw = str(data?.comment);
  const comment = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
  if (!/^[nwr]\d{1,15}$/.test(poi) || !D.POI[poi]) throw new HttpError(400, "unknown place");
  if (!REASONS.includes(reason)) throw new HttpError(400, "bad reason");
  if ([...comment].length > MAX_COMMENT) throw new HttpError(400, "comment too long");
  if (reason === "other" && !comment) throw new HttpError(400, "comment required");
  return { poi, reason, comment };
}

// Админка подключается лениво: модуль отчётов работает и без неё
const requireAdmin = req => require("./admin").requireAdmin(req);

const routes = [
  ["POST", "/api/reports", async (req, res) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const r = parseReport(await readJSON(req, 4000));
    const user = auth.userFrom(req);
    db.prepare("INSERT INTO reports (poi_id, reason, comment, date, user_id) VALUES (?, ?, ?, ?, ?)")
      .run(r.poi, r.reason, r.comment, Date.now(), user ? user.id : null);
    sendJSON(req, res, 201, { ok: true });
  }],

  // ---------- Админка: вкладка «Ошибки» ----------
  ["GET", "/api/admin/reports", (req, res, url) => {
    requireAdmin(req);
    const status = STATUSES.includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "new";
    const rows = db.prepare("SELECT * FROM reports WHERE status = ? ORDER BY id DESC LIMIT 200").all(status);
    sendJSON(req, res, 200, rows.map(r => {
      const p = D.POI[r.poi_id];
      return { ...r, place: p ? { name: poiName("ru", p), type: p.s, city: p.city.n.ru } : null };
    }));
  }],
  ["POST", /^\/api\/admin\/reports\/(\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const { status } = await readJSON(req);
    if (!STATUSES.includes(status)) throw new HttpError(400, "bad status");
    const before = db.prepare("SELECT * FROM reports WHERE id = ?").get(+m[1]);
    const r = db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(status, +m[1]);
    if (!r.changes) throw new HttpError(404, "not found");
    // Награда за правки (как в 2GIS): автору — спасибо в Telegram, в приложении — медаль «Помощник Safar»
    if (status === "fixed" && before?.status !== "fixed" && before?.user_id) {
      try {
        const u = db.prepare("SELECT tg_id FROM users WHERE id = ?").get(before.user_id), p = D.POI[before.poi_id];
        if (u?.tg_id) require("./telegram").notify(u.tg_id, `🏅 <b>Спасибо! Мы исправили данные${p ? ` о «${poiName("ru", p).replace(/[&<>]/g, "")}»` : ""}.</b>\nВаша правка помогает другим путешественникам. В «Паспорте» Hamyol — медаль «Помощник».`).catch(() => {});
      } catch { /* без бота */ }
    }
    sendJSON(req, res, 200, { ok: true });
  }],

  // Сколько правок человека подтверждено (для медали «Помощник Safar»)
  ["GET", "/api/reports/mine", (req, res) => {
    const user = auth.userFrom(req);
    sendJSON(req, res, 200, { fixed: user ? db.prepare("SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND status = 'fixed'").get(user.id).n : 0 });
  }]
];

module.exports = { routes, parseReport, REASONS };
