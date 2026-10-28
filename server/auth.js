// Пользователи и сессии. Вход — через Telegram (Mini App или виджет на сайте), см. server/telegram.js
const crypto = require("node:crypto");
const { db } = require("./db");
const { HttpError } = require("./http");
const env = require("./env");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    tg_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    username TEXT,
    photo TEXT,
    lang TEXT,
    created INTEGER NOT NULL,
    last_seen INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL
  );
`);

const SESSION_DAYS = 60;
const hash = s => crypto.createHash("sha256").update(s).digest("hex");

// Создать или обновить пользователя по данным Telegram
function upsertTelegramUser(tg) {
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ").slice(0, 60) || tg.username || "Telegram";
  const now = Date.now();
  db.prepare(`INSERT INTO users (tg_id, name, username, photo, lang, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tg_id) DO UPDATE SET name = excluded.name, username = excluded.username,
      photo = COALESCE(excluded.photo, users.photo), last_seen = excluded.last_seen`)
    .run(tg.id, name, tg.username || null, tg.photo_url || null, tg.language_code || null, now, now);
  return db.prepare("SELECT * FROM users WHERE tg_id = ?").get(tg.id);
}

// Токен сессии отдаётся клиенту один раз; в базе хранится только его хэш
function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("INSERT INTO sessions (token_hash, user_id, created, expires) VALUES (?, ?, ?, ?)")
    .run(hash(token), userId, now, now + SESSION_DAYS * 86400e3);
  return token;
}

function userFrom(req) {
  const m = /^Bearer\s+([\w-]{20,})$/.exec(req.headers.authorization || "");
  if (!m) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires > ?`).get(hash(m[1]), Date.now());
  return row || null;
}

function requireUser(req) {
  const u = userFrom(req);
  if (!u) throw new HttpError(401, "login required");
  return u;
}

function logout(req) {
  const m = /^Bearer\s+([\w-]{20,})$/.exec(req.headers.authorization || "");
  if (m) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(m[1]));
}

// Администратор: заголовок X-Admin-Token совпадает с ADMIN_TOKEN из .env (сравнение за постоянное время)
function requireAdmin(req) {
  const got = Buffer.from(String(req.headers["x-admin-token"] || ""));
  const want = Buffer.from(env.ADMIN_TOKEN);
  if (!env.ADMIN_TOKEN || got.length !== want.length || !crypto.timingSafeEqual(got, want)) throw new HttpError(403, "admin only");
}

// Чистка просроченных сессий раз в сутки
setInterval(() => db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now()), 86400e3).unref();

module.exports = { upsertTelegramUser, createSession, userFrom, requireUser, requireAdmin, logout, hash };
