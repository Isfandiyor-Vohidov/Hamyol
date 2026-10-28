// База данных: встроенный в Node.js SQLite (нужен Node 22.13+). Файл — storage/safar.db
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { STORAGE } = require("./env");

fs.mkdirSync(STORAGE, { recursive: true });
const db = new DatabaseSync(path.join(STORAGE, "safar.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    stars INTEGER NOT NULL,
    date INTEGER NOT NULL,
    user_id INTEGER,
    reply TEXT,
    reply_date INTEGER,
    hidden INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS reviews_key ON reviews(key);
`);

// Перенос отзывов из старого storage/reviews.json (первая версия сервера)
const legacy = path.join(STORAGE, "reviews.json");
if (fs.existsSync(legacy) && !db.prepare("SELECT COUNT(*) AS n FROM reviews").get().n) {
  try {
    const old = JSON.parse(fs.readFileSync(legacy, "utf8"));
    const ins = db.prepare("INSERT INTO reviews (key, name, text, stars, date) VALUES (?, ?, ?, ?, ?)");
    for (const key in old) for (const r of old[key]) ins.run(key, r.name, r.text, r.stars, r.date || Date.now());
    fs.renameSync(legacy, legacy + ".imported");
    console.log("Отзывы перенесены из reviews.json в базу");
  } catch (e) { console.error("Не удалось перенести reviews.json:", e.message); }
}

// Транзакция: всё или ничего
function tx(fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}

module.exports = { db, tx };
