// «Жалобы и предложения»: обращения пользователей (ошибка в приложении, неверные данные, предложение, жалоба, другое).
// Отправляются только после согласия на обработку данных (js/consent.js). Хранится тип, текст, контакт (по желанию),
// служебные данные (раздел приложения, язык, версия) и id аккаунта, если человек вошёл, — без IP.
// Человек видит статус и ответ по номеру обращения и секретному ключу; администраторам приходит уведомление в Telegram,
// ответ из админки уходит человеку в бот (если он вошёл через Telegram).
const crypto = require("node:crypto");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const auth = require("./auth");

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    user_id INTEGER,
    key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    reply TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS feedback_status ON feedback(status, id);
`);

const KINDS = ["bug", "data", "idea", "complaint", "other"];
const STATUSES = ["new", "done", "rejected"];
const limited = rateLimiter(5, 60 * 60e3);   // не больше 5 обращений с одного IP в час
const clean = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
const escHtml = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const KIND_RU = { bug: "Ошибка в приложении", data: "Неверные данные", idea: "Предложение", complaint: "Жалоба", other: "Другое" };

function parseFeedback(b) {
  const kind = typeof b?.kind === "string" && KINDS.includes(b.kind) ? b.kind : null;
  if (!kind) throw new HttpError(400, "bad kind");
  const text = clean(b.text, 1000);
  if ([...text].length < 10) throw new HttpError(400, "text too short");
  const contact = clean(b.contact, 80);
  const m = b.meta && typeof b.meta === "object" ? b.meta : {};
  const meta = { page: clean(m.page, 60), lang: clean(m.lang, 5), ver: clean(m.ver, 20), device: clean(m.device, 40) };
  return { kind, text, contact, meta };
}
const requireAdmin = req => require("./admin").requireAdmin(req);

const routes = [
  ["POST", "/api/feedback", async (req, res) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const f = parseFeedback(await readJSON(req, 6000));
    const user = auth.userFrom(req), key = crypto.randomBytes(12).toString("base64url"), now = Date.now();
    const r = db.prepare("INSERT INTO feedback (kind, text, contact, meta, user_id, key, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(f.kind, f.text, f.contact, JSON.stringify(f.meta), user ? user.id : null, key, now, now);
    const id = Number(r.lastInsertRowid);
    try {
      require("./market").notifyAdmins(`📝 <b>Обращение #${id}</b> · ${KIND_RU[f.kind]}\n${escHtml(f.text.slice(0, 400))}${f.contact ? `\nКонтакт: ${escHtml(f.contact)}` : ""}\nОтветить: админка Hamyol → «Обращения».`).catch(() => {});
    } catch { /* без бота — только в админке */ }
    sendJSON(req, res, 201, { id, key });
  }],

  // Статус своих обращений: пары «номер.ключ» через запятую (ключ выдаётся только автору)
  ["GET", "/api/feedback/status", (req, res, url) => {
    const pairs = String(url.searchParams.get("q") || "").split(",").slice(0, 30)
      .map(p => p.split(".")).filter(([id, key]) => /^\d{1,9}$/.test(id) && /^[\w-]{10,30}$/.test(key || ""));
    const q = db.prepare("SELECT id, status, reply, updated FROM feedback WHERE id = ? AND key = ?");
    sendJSON(req, res, 200, pairs.map(([id, key]) => q.get(+id, key)).filter(Boolean));
  }],

  // ---------- Админка: вкладка «Обращения» ----------
  ["GET", "/api/admin/feedback", (req, res, url) => {
    requireAdmin(req);
    const status = STATUSES.includes(url.searchParams.get("status")) ? url.searchParams.get("status") : "new";
    sendJSON(req, res, 200, db.prepare("SELECT id, kind, text, contact, meta, user_id, status, reply, created FROM feedback WHERE status = ? ORDER BY id DESC LIMIT 200").all(status)
      .map(r => ({ ...r, meta: JSON.parse(r.meta || "{}") })));
  }],
  ["POST", /^\/api\/admin\/feedback\/(\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const b = await readJSON(req, 4000);
    if (!STATUSES.includes(b.status)) throw new HttpError(400, "bad status");
    const reply = clean(b.reply, 1000);
    const row = db.prepare("SELECT * FROM feedback WHERE id = ?").get(+m[1]);
    if (!row) throw new HttpError(404, "not found");
    db.prepare("UPDATE feedback SET status = ?, reply = ?, updated = ? WHERE id = ?").run(b.status, reply || row.reply, Date.now(), row.id);
    // Ответ — человеку в бот, если он отправлял обращение после входа через Telegram
    if (reply && row.user_id) {
      const u = db.prepare("SELECT tg_id FROM users WHERE id = ?").get(row.user_id);
      if (u?.tg_id) require("./telegram").notify(u.tg_id, `💬 <b>Ответ на обращение #${row.id}</b>\n${escHtml(reply)}`).catch(() => {});
    }
    sendJSON(req, res, 200, { ok: true });
  }]
];

module.exports = { routes, parseFeedback, KINDS };
