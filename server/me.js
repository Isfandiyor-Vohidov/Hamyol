// Профиль пользователя и синхронизация: избранное и поездка общие на всех устройствах
const fs = require("node:fs");
const path = require("node:path");
const { db, tx } = require("./db");
const { STORAGE } = require("./env");
const { sendJSON, readJSON, HttpError } = require("./http");
const auth = require("./auth");
const { publicUser } = require("./telegram");

db.exec(`
  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    favs TEXT NOT NULL DEFAULT '[]',
    trip TEXT,
    trip_updated INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL
  );
`);

const KEY_RE = /^(city|poi):[\w-]{1,80}$/;

function getData(userId) {
  const row = db.prepare("SELECT * FROM user_data WHERE user_id = ?").get(userId);
  return row ? { favs: JSON.parse(row.favs), trip: row.trip ? JSON.parse(row.trip) : null, tripUpdated: row.trip_updated }
    : { favs: [], trip: null, tripUpdated: 0 };
}

const routes = [
  ["GET", "/api/me", (req, res) => {
    const user = auth.requireUser(req);
    db.prepare("UPDATE users SET last_seen = ? WHERE id = ?").run(Date.now(), user.id);
    sendJSON(req, res, 200, { user: publicUser(user), data: getData(user.id) });
  }],

  ["PUT", "/api/me/data", async (req, res) => {
    const user = auth.requireUser(req);
    const body = await readJSON(req, 30000);
    const cur = getData(user.id);
    if (body.favs !== undefined) {
      if (!Array.isArray(body.favs) || body.favs.length > 1000 || !body.favs.every(k => typeof k === "string" && KEY_RE.test(k)))
        throw new HttpError(400, "bad favs");
      cur.favs = [...new Set(body.favs)];
    }
    if (body.trip !== undefined) {
      const s = JSON.stringify(body.trip);
      if (s.length > 10000) throw new HttpError(400, "trip too large");
      // Побеждает более свежая версия поездки
      if (+body.tripUpdated >= cur.tripUpdated) { cur.trip = body.trip; cur.tripUpdated = +body.tripUpdated || Date.now(); }
    }
    db.prepare(`INSERT INTO user_data (user_id, favs, trip, trip_updated, updated) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET favs = excluded.favs, trip = excluded.trip, trip_updated = excluded.trip_updated, updated = excluded.updated`)
      .run(user.id, JSON.stringify(cur.favs), cur.trip ? JSON.stringify(cur.trip) : null, cur.tripUpdated, Date.now());
    sendJSON(req, res, 200, cur);
  }],

  // Удаление аккаунта и данных (право пользователя из политики конфиденциальности).
  // Каскадом уходят сессии, синхронизация, анкета гида с экскурсиями, бронирования и заявки на заведения;
  // отзывы с фото и история ИИ-чата удаляются отдельно; сообщения о ценах остаются без привязки к аккаунту.
  ["POST", "/api/me/delete", async (req, res) => {
    const user = auth.requireUser(req);
    const photos = db.prepare("SELECT photos FROM reviews WHERE user_id = ?").all(user.id).flatMap(r => JSON.parse(r.photos || "[]"));
    tx(() => {
      db.prepare("DELETE FROM reviews WHERE user_id = ?").run(user.id);
      try { db.prepare("DELETE FROM ai_conversations WHERE user_id = ?").run(user.id); } catch { /* модуль ИИ не подключён */ }
      try { db.prepare("UPDATE price_reports SET user_id = NULL WHERE user_id = ?").run(user.id); } catch { /* модуль цен не подключён */ }
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    });
    for (const p of photos) { try { fs.unlinkSync(path.join(STORAGE, "photos", path.basename(p))); } catch { /* файла уже нет */ } }
    sendJSON(req, res, 200, { ok: true });
  }]
];

module.exports = { routes };
