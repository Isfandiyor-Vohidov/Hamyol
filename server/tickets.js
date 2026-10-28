// «Мои билеты»: человек пересылает боту PDF или фото билета — файл сохраняется в его аккаунте,
// приложение скачивает его к себе и показывает без интернета.
// Файлы — storage/tickets/<id>.<ext>; видит и скачивает только владелец (по токену входа).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const env = require("./env");
const { db } = require("./db");
const { send, sendJSON, HttpError } = require("./http");
const auth = require("./auth");

const DIR = path.join(env.STORAGE, "tickets");
const MAX_SIZE = 15 * 1024 * 1024;   // Telegram отдаёт ботам файлы до 20 МБ
const MAX_PER_USER = 50;
const TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created INTEGER NOT NULL
  );
`);

const TXT = {
  ru: { ok: "🎫 <b>Билет сохранён в Hamyol</b>\n«{name}»\n\nОткройте Hamyol → «Мои билеты» — он будет доступен и без интернета.", type: "Пришлите билет файлом PDF или фото (JPG, PNG).", big: "Файл слишком большой — до 15 МБ.", many: "В Hamyol уже 50 билетов — удалите старые в «Мои билеты».", fail: "Не удалось сохранить билет, попробуйте ещё раз.", open: "🎫 Мои билеты" },
  uz: { ok: "🎫 <b>Chipta Hamyol’ga saqlandi</b>\n«{name}»\n\nHamyol → «Chiptalarim» bo‘limini oching — internetsiz ham ochiladi.", type: "Chiptani PDF fayl yoki rasm (JPG, PNG) qilib yuboring.", big: "Fayl juda katta — 15 MB gacha.", many: "Hamyol’da 50 ta chipta bor — eskilarini «Chiptalarim»da o‘chiring.", fail: "Chiptani saqlab bo‘lmadi, yana urinib ko‘ring.", open: "🎫 Chiptalarim" },
  en: { ok: "🎫 <b>Ticket saved to Hamyol</b>\n“{name}”\n\nOpen Hamyol → “My tickets” — it works offline too.", type: "Send the ticket as a PDF file or a photo (JPG, PNG).", big: "The file is too large — up to 15 MB.", many: "You already have 50 tickets in Hamyol — delete old ones in “My tickets”.", fail: "Couldn't save the ticket, please try again.", open: "🎫 My tickets" }
};
const L = lang => TXT[lang] || TXT.en;

// Вызывается ботом (server/telegram.js), когда в личный чат пришёл файл или фото
async function fromBot(msg, user, lang, tg, appUrl) {
  const x = L(lang);
  let fileId, name, mime, size;
  if (msg.document) {
    ({ file_id: fileId, file_name: name = "ticket", mime_type: mime = "", file_size: size = 0 } = msg.document);
  } else if (msg.photo?.length) {
    const p = msg.photo[msg.photo.length - 1];   // самое большое
    fileId = p.file_id; size = p.file_size || 0; mime = "image/jpeg";
    name = msg.caption || (lang === "uz" ? "Chipta rasmi" : lang === "en" ? "Ticket photo" : "Фото билета");
  } else return null;
  if (!TYPES[mime]) return x.type;
  if (size > MAX_SIZE) return x.big;
  if (db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ?").get(user.id).n >= MAX_PER_USER) return x.many;
  try {
    const f = await tg("getFile", { file_id: fileId });
    const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${f.file_path}`, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error("download " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_SIZE) return x.big;
    const id = crypto.randomBytes(12).toString("base64url");
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, `${id}.${TYPES[mime]}`), buf);
    const clean = String(name).replace(/[\u0000-\u001f<>]/g, "").replace(/\.(pdf|jpe?g|png|webp)$/i, "").slice(0, 120) || "ticket";
    db.prepare("INSERT INTO tickets (id, user_id, name, mime, size, created) VALUES (?, ?, ?, ?, ?, ?)").run(id, user.id, clean, mime, buf.length, Date.now());
    return { text: x.ok.replace("{name}", clean.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))), button: appUrl ? [[{ text: x.open, web_app: { url: appUrl + "/?start=tickets" } }]] : null };
  } catch (e) {
    console.error("Билет из бота:", e.message);
    return x.fail;
  }
}

const own = (req, id) => {
  const user = auth.requireUser(req);
  const t = db.prepare("SELECT * FROM tickets WHERE id = ? AND user_id = ?").get(String(id), user.id);
  if (!t) throw new HttpError(404, "not found");
  return t;
};
const fileOf = t => path.join(DIR, `${t.id}.${TYPES[t.mime]}`);

const routes = [
  ["POST", "/share-target", (req, res) => { res.writeHead(303, { Location: "/?start=tickets_new" }); res.end(); }],
  ["GET", "/api/tickets", (req, res) => {
    const user = auth.requireUser(req);
    sendJSON(req, res, 200, { tickets: db.prepare("SELECT id, name, mime, size, created FROM tickets WHERE user_id = ? ORDER BY created DESC").all(user.id) });
  }],
  ["GET", /^\/api\/tickets\/([\w-]{8,40})\/file$/, (req, res, url, m) => {
    const t = own(req, m[1]);
    let buf;
    try { buf = fs.readFileSync(fileOf(t)); } catch { throw new HttpError(404, "file missing"); }
    send(req, res, 200, buf, t.mime, "private, no-store", { "Content-Disposition": "inline" });
  }],
  ["DELETE", /^\/api\/tickets\/([\w-]{8,40})$/, (req, res, url, m) => {
    const t = own(req, m[1]);
    db.prepare("DELETE FROM tickets WHERE id = ?").run(t.id);
    try { fs.unlinkSync(fileOf(t)); } catch { /* файла уже нет */ }
    sendJSON(req, res, 200, { ok: true });
  }]
];

// Раз в сутки — убрать файлы, у которых больше нет записи (например, аккаунт удалён)
function cleanup() {
  try {
    const ids = new Set(db.prepare("SELECT id FROM tickets").all().map(r => r.id));
    for (const f of fs.readdirSync(DIR)) if (!ids.has(f.replace(/\.\w+$/, ""))) fs.unlinkSync(path.join(DIR, f));
  } catch { /* папки ещё нет */ }
}
function onStart() { setTimeout(cleanup, 600e3).unref(); setInterval(cleanup, 86400e3).unref(); }

module.exports = { routes, onStart, fromBot };
