// Вопросы и ответы у мест (как в TripAdvisor): «Можно ли с детьми?», «Есть ли парковка?».
// Спрашивать и отвечать может любой (после согласия на обработку данных); у ответа владельца места
// и проверенного гида — отметка. Владельцу места о новом вопросе приходит сообщение в Telegram.
// Администратор может скрыть вопрос или ответ (вкладка «Вопросы» в админке).
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const { D, poiName } = require("./data");
const auth = require("./auth");

db.exec(`
  CREATE TABLE IF NOT EXISTS qa_questions (
    id INTEGER PRIMARY KEY, key TEXT NOT NULL, text TEXT NOT NULL, name TEXT NOT NULL,
    user_id INTEGER, date INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS qa_questions_key ON qa_questions(key, id);
  CREATE TABLE IF NOT EXISTS qa_answers (
    id INTEGER PRIMARY KEY, qid INTEGER NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL, name TEXT NOT NULL, user_id INTEGER, role TEXT NOT NULL DEFAULT 'user',
    date INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS qa_answers_q ON qa_answers(qid, id);
`);

const limited = rateLimiter(10, 60 * 60e3);   // не больше 10 вопросов/ответов с одного IP в час
const clean = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
const escHtml = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const placeOf = key => /^poi:[nwr]\d{1,15}$/.test(key) ? D.POI[key.slice(4)] : null;
const requireAdmin = req => require("./admin").requireAdmin(req);

// Кто отвечает: владелец этого места, проверенный гид или обычный путешественник
function roleOf(user, key) {
  if (!user) return "user";
  try { if (db.prepare("SELECT 1 FROM place_owners WHERE poi_id = ? AND user_id = ?").get(key.slice(4), user.id)) return "owner"; } catch { /* модуль бизнеса не подключён */ }
  try { if (db.prepare("SELECT 1 FROM guides WHERE user_id = ? AND status = 'approved'").get(user.id)) return "guide"; } catch { /* модуль гидов не подключён */ }
  return "user";
}
function nameOf(user, raw) {
  const n = user ? user.name : clean(raw, 40);
  if (!n) throw new HttpError(400, "name required");
  return n;
}

const routes = [
  ["GET", "/api/qa", (req, res, url) => {
    const key = url.searchParams.get("key") || "";
    if (!placeOf(key)) return sendJSON(req, res, 200, []);
    const qs = db.prepare("SELECT id, text, name, date FROM qa_questions WHERE key = ? AND hidden = 0 ORDER BY id DESC LIMIT 50").all(key);
    const ans = db.prepare("SELECT id, text, name, role, date FROM qa_answers WHERE qid = ? AND hidden = 0 ORDER BY (role = 'owner') DESC, id ASC LIMIT 20");
    sendJSON(req, res, 200, qs.map(q => ({ ...q, answers: ans.all(q.id) })));
  }],

  ["POST", "/api/qa", async (req, res) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req, 4000), key = String(b.key || ""), p = placeOf(key);
    if (!p) throw new HttpError(400, "unknown place");
    const text = clean(b.text, 300);
    if ([...text].length < 8) throw new HttpError(400, "question too short");
    const user = auth.userFrom(req), name = nameOf(user, b.name);
    const r = db.prepare("INSERT INTO qa_questions (key, text, name, user_id, date) VALUES (?, ?, ?, ?, ?)").run(key, text, name, user ? user.id : null, Date.now());
    // Владельцу места — сообщение в Telegram, чтобы ответил
    try {
      const o = db.prepare("SELECT u.tg_id FROM place_owners po JOIN users u ON u.id = po.user_id WHERE po.poi_id = ?").get(p.id);
      if (o?.tg_id) require("./telegram").notify(o.tg_id, `❓ <b>Вопрос о «${escHtml(poiName("ru", p))}»</b>\n${escHtml(text)}\n\nОтветьте в Hamyol на странице места.`).catch(() => {});
    } catch { /* без бизнеса или бота */ }
    sendJSON(req, res, 201, { id: Number(r.lastInsertRowid) });
  }],

  ["POST", /^\/api\/qa\/(\d+)\/answer$/, async (req, res, url, m) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const q = db.prepare("SELECT * FROM qa_questions WHERE id = ? AND hidden = 0").get(+m[1]);
    if (!q) throw new HttpError(404, "not found");
    const b = await readJSON(req, 4000), text = clean(b.text, 500);
    if ([...text].length < 2) throw new HttpError(400, "answer too short");
    const user = auth.userFrom(req), name = nameOf(user, b.name), role = roleOf(user, q.key);
    db.prepare("INSERT INTO qa_answers (qid, text, name, user_id, role, date) VALUES (?, ?, ?, ?, ?, ?)").run(q.id, text, name, user ? user.id : null, role, Date.now());
    // Автору вопроса — уведомление, если он спрашивал после входа через Telegram
    if (q.user_id && (!user || user.id !== q.user_id)) {
      try {
        const u = db.prepare("SELECT tg_id FROM users WHERE id = ?").get(q.user_id), p = placeOf(q.key);
        if (u?.tg_id) require("./telegram").notify(u.tg_id, `💬 <b>Ответ на ваш вопрос${p ? ` о «${escHtml(poiName("ru", p))}»` : ""}</b>\n${escHtml(text)}`).catch(() => {});
      } catch { /* без бота */ }
    }
    sendJSON(req, res, 201, { ok: true, role });
  }],

  // ---------- Админка: последние вопросы и ответы, скрыть/показать ----------
  ["GET", "/api/admin/qa", (req, res) => {
    requireAdmin(req);
    const qs = db.prepare("SELECT 'q' AS type, id, key, text, name, date, hidden FROM qa_questions ORDER BY id DESC LIMIT 100").all();
    const as = db.prepare("SELECT 'a' AS type, a.id, q.key, a.text, a.name, a.date, a.hidden, a.role FROM qa_answers a JOIN qa_questions q ON q.id = a.qid ORDER BY a.id DESC LIMIT 100").all();
    sendJSON(req, res, 200, [...qs, ...as].sort((x, y) => y.date - x.date).slice(0, 150).map(r => ({ ...r, place: placeOf(r.key) ? poiName("ru", placeOf(r.key)) : r.key })));
  }],
  ["POST", /^\/api\/admin\/qa\/(q|a)\/(\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const { hidden } = await readJSON(req);
    const r = db.prepare(`UPDATE ${m[1] === "q" ? "qa_questions" : "qa_answers"} SET hidden = ? WHERE id = ?`).run(hidden ? 1 : 0, +m[2]);
    if (!r.changes) throw new HttpError(404, "not found");
    sendJSON(req, res, 200, { ok: true });
  }]
];

module.exports = { routes, roleOf };
