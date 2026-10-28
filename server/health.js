// Состояние сервера (/health) для хостинга и мониторинга + ежедневная резервная копия базы.
// Копии: storage/backups/safar-ГГГГ-ММ-ДД.db, хранятся 7 последних. Первая — через час после запуска.
const fs = require("node:fs");
const path = require("node:path");
const env = require("./env");
const { db } = require("./db");
const { sendJSON } = require("./http");

const STARTED = Date.now();
const DIR = path.join(env.STORAGE, "backups");
const KEEP = 7;
let lastBackup = null;

function backup() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, `safar-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);   // целостная копия даже во время работы
    lastBackup = path.basename(file);
    const old = fs.readdirSync(DIR).filter(f => /^safar-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP);
    for (const f of old) fs.unlinkSync(path.join(DIR, f));
  } catch (e) { console.error("Резервная копия базы:", e.message); }
}

const routes = [
  ["GET", "/health", (req, res) => {
    let dbOk = false;
    try { dbOk = db.prepare("SELECT 1 AS x").get().x === 1; } catch { /* база недоступна */ }
    sendJSON(req, res, dbOk ? 200 : 503, {
      ok: dbOk, db: dbOk, uptime: Math.round((Date.now() - STARTED) / 1000),
      telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT), lastBackup
    });
  }]
];

function onStart() {
  setTimeout(() => { backup(); setInterval(backup, 86400e3).unref(); }, 3600e3).unref();
}

module.exports = { routes, onStart, backup };
