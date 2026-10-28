// Приложение «Азербайджан» — отдельная страница /az внутри Safar (az.html, js/az-app.js, css/az.css).
// Узбекское приложение (/) и Мекка (/mecca) не затрагиваются.
// Здесь же — чат между аккаунтами: вход тот же, что в Safar (Telegram), а в поиске видны только те,
// кто сам открыл чат и завёл профиль. Есть блокировка и жалобы (хранятся в az_reports для администратора).
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const path = require("path");
const env = require("./env");
const { db } = require("./db");
const { requireUser, requireAdmin } = require("./auth");
const { send, sendJSON, readJSON, rateLimiter, HttpError } = require("./http");

const FILE = path.join(env.ROOT, "az.html");
const SW_FILE = path.join(env.ROOT, "az-sw.js");

db.exec(`
  CREATE TABLE IF NOT EXISTS az_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, created INTEGER NOT NULL, last_seen INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS az_msgs (
    id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
    text TEXT NOT NULL, created INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS az_msgs_pair ON az_msgs(from_id, to_id, id);
  CREATE INDEX IF NOT EXISTS az_msgs_to ON az_msgs(to_id, read);
  CREATE TABLE IF NOT EXISTS az_blocks (
    user_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, created INTEGER NOT NULL,
    PRIMARY KEY (user_id, blocked_id)
  );
  -- Постоянный ID для чата: выдаётся один раз и навсегда закреплён за аккаунтом.
  -- AUTOINCREMENT и отсутствие каскадного удаления — номер не достанется никому другому, даже если аккаунт удалят.
  CREATE TABLE IF NOT EXISTS az_ids (
    pid INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS az_reports (
    id INTEGER PRIMARY KEY, by_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    msg_id INTEGER, reason TEXT NOT NULL, created INTEGER NOT NULL
  );
`);

// ID начинаются с 100001 — шесть цифр, легко продиктовать
if (!db.prepare("SELECT 1 FROM sqlite_sequence WHERE name = 'az_ids'").get()) db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('az_ids', 100000)").run();
// Сначала ищем, и только потом выдаём новый: «INSERT OR IGNORE» с AUTOINCREMENT тратил бы номер на каждый запрос
function pidOf(userId) {
  const row = db.prepare("SELECT pid FROM az_ids WHERE user_id = ?").get(userId);
  if (row) return row.pid;
  return Number(db.prepare("INSERT INTO az_ids (user_id, created) VALUES (?, ?)").run(userId, Date.now()).lastInsertRowid);
}

const MAX_TEXT = 1000;
const KEEP_MS = 365 * 864e5;
const sending = rateLimiter(40, 60e3);       // сообщений в минуту с одного аккаунта
const reporting = rateLimiter(10, 3600e3);   // жалоб в час
const clean = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

async function page(req, res) {
  try { send(req, res, 200, await fsp.readFile(FILE), "text/html; charset=utf-8", "no-cache"); }
  catch { send(req, res, 404, "Not found", "text/plain; charset=utf-8"); }
}

// Профиль чата: заводится при первом открытии чата (имя — из аккаунта, можно поменять)
function profile(u) {
  const now = Date.now();
  db.prepare(`INSERT INTO az_profiles (user_id, name, created, last_seen) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen`).run(u.id, clean(u.name, 40) || "Hamyol", now, now);
  pidOf(u.id);
  return db.prepare("SELECT * FROM az_profiles WHERE user_id = ?").get(u.id);
}
const blocked = (a, b) => !!db.prepare("SELECT 1 FROM az_blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)").get(a, b, b, a);
const iBlocked = (a, b) => !!db.prepare("SELECT 1 FROM az_blocks WHERE user_id = ? AND blocked_id = ?").get(a, b);
const person = id => db.prepare("SELECT p.user_id AS id, p.name, p.last_seen AS seen, i.pid FROM az_profiles p LEFT JOIN az_ids i ON i.user_id = p.user_id WHERE p.user_id = ?").get(id);
const otherId = url => { const id = +url.searchParams.get("with"); if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "bad user"); return id; };

// Офлайн-переводчик: движок Bergamot (Mozilla, MPL-2.0) лежит в vendor/bergamot, модели Firefox Translations v2.1
// берём с CDN Mozilla через сервер (CDN не отдаёт CORS). Скачанное хранится у человека в кэше safar-az-mt.
const MT_DIR = path.join(env.ROOT, "vendor", "bergamot");
const MT_CACHE = path.join(env.STORAGE, "mt-models");   // модели, которые сервер уже скачал с CDN
const MT_CDN = "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/translations-models/";
const MT_MODELS = {
  azen: {
    model: ["20261006203147--2191211e-ff91-42b9-bd17-e4e7642745c0--30fd6918-01fc-4dd3-bccd-84eab074a17c.bin", 31561787, "21d16602a6b21738d2f750e918bc369b01d83e3d11d4ad1f9ce0a9c99599f50c"],
    lex: ["20261006203140--feb77620-d921-4acb-87fc-9a4466a55de2--0188a663-ea2f-4d4c-b751-a875f8171a9f.bin", 4820648, "d534a8a29537e2539cac09d23360f27291765a030d424e108b9b0cabaa593672"],
    vocab: ["20261006203138--a3437277-6cc1-4477-baa4-7041d2727825--2f838041-4562-4f03-b83f-c2f024743e23.spm", 835773, "9ae0beed517ad39a95b4e1ae95be4ddfdeba8b004139886d40a3a50874e16aa6"]
  },
  enaz: {
    model: ["20261006203228--b54a8f81-7b8b-4a46-81e9-2bc40528020b--492ed9b0-dbe4-4a20-a6c9-96c5a6392606.bin", 31561787, "fcf1f5f36dd586db7078e938252f17ecb90ae6f2d1b28952fc3878738f81336a"],
    lex: ["20261006203232--e2aa7fcc-0dc3-4951-9114-4ce606d2bae3--b25ae7b3-b26d-40f6-8650-a984e9154d10.bin", 3166552, "6b2f36c13a98c677af7a5f4e0087636fe2af44e004dd142add1ac2207cfa8ad1"],
    vocab: ["20261006203230--297335ec-ee05-42bf-bdfd-8fff8b151da7--d0b3d6a9-ef61-4bdc-a0fe-8bfa18068476.spm", 840767, "ebe0ebd2e652a03e2f23c2209b8c297930df2c5da9391c4afe7762ec04af899a"]
  },
  ruen: {
    model: ["20260901210056--9781ee2a-d15e-4fe8-893d-687193373fff--37b65106-c6cd-4ed2-a28e-3acd72725429.bin", 31561787, "aa0efa194b3dbd2da129ba0b8db8ef139126cb0914e57072f62061294746f1e2"],
    lex: ["20260901210100--fd808a7b-0081-427d-83a5-7043bdd97a87--215ca362-0436-495d-b89d-542187b696cb.bin", 4397908, "c944e753f298bbdf6506388de7257fb48cbd12c83e2807e2c284fc323771895b"],
    vocab: ["20260901210058--222363ca-4a98-48a9-9162-65acdffc2572--ba370dc8-709d-42cd-b68c-83b912bd3e38.spm", 952371, "de8af5f87e231ee4016cec4bb482e6b584cb1ca34dcb624fc7b8398f25bb35df"]
  },
  enru: {
    model: ["db6b48bb-b563-4ea1-bbf4-b033fa9cc482.bin", 31561787, "184cb5cda528eeefc0f75f5d0035d787b71d74af135e3c5608d01ae02ecfb920"],
    lex: ["e88cc45c-0e0b-45d3-a957-8d1ba3a9b5aa.bin", 2774540, "4d91839726b960e70b6d05c53d0cffd16262832b1c0e1ea99d66f412dcc6a239"],
    vocab: ["568807dd-9620-4c4d-a0b5-d651d64c0ab0.spm", 904455, "56ee63e14e8cb926c394242adc3ed7cc602644c3d33058cff2ce2959d52a6258"]
  }
};
// Реестр в формате bergamot-translator: {"azen": {"model": {name, size, expectedSha256Hash}, …}}
const MT_REGISTRY = JSON.stringify(Object.fromEntries(Object.entries(MT_MODELS).map(([pair, files]) =>
  [pair, Object.fromEntries(Object.entries(files).map(([kind, [, size, hash]]) => [kind, { name: `/az-mt/m/${pair}/${kind}`, size, expectedSha256Hash: hash }]))])));
const MT_TYPES = { ".js": "text/javascript; charset=utf-8", ".wasm": "application/wasm" };
const MT_FILES = new Set(["translator.js", "worker/translator-worker.js", "worker/bergamot-translator-worker.js", "worker/bergamot-translator-worker.wasm"]);

// Точный онлайн-перевод (бесплатные квоты): Microsoft Translator F0 — 2 млн символов в месяц, или Google Cloud — 500 тыс.
// Ключ — в .env (AZ_MS_KEY + AZ_MS_REGION или AZ_GOOGLE_KEY). Без ключа приложение переводит через MyMemory, как раньше.
const MS_KEY = process.env.AZ_MS_KEY || "", MS_REGION = process.env.AZ_MS_REGION || "", GOOGLE_KEY = process.env.AZ_GOOGLE_KEY || "";
const MT_LANGS = new Set(["ru", "en", "az", "tr", "uz"]);
const translating = rateLimiter(60, 60e3);   // запросов в минуту с одного адреса
const MONTH_LIMIT = +process.env.AZ_MT_MONTH_CHARS || (MS_KEY ? 1900000 : 480000);   // запас ниже бесплатной квоты
let used = { month: "", chars: 0 };
async function onlineTranslate(text, from, to) {
  const month = new Date().toISOString().slice(0, 7);
  if (used.month !== month) used = { month, chars: 0 };
  if (used.chars + text.length > MONTH_LIMIT) throw new HttpError(429, "monthly quota");
  used.chars += text.length;
  if (MS_KEY) {
    const r = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`, {
      method: "POST", signal: AbortSignal.timeout(10e3),
      headers: { "Ocp-Apim-Subscription-Key": MS_KEY, ...(MS_REGION ? { "Ocp-Apim-Subscription-Region": MS_REGION } : {}), "Content-Type": "application/json" },
      body: JSON.stringify([{ Text: text }])
    });
    if (!r.ok) throw new HttpError(502, "translator " + r.status);
    return (await r.json())[0]?.translations?.[0]?.text || "";
  }
  const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(GOOGLE_KEY)}`, {
    method: "POST", signal: AbortSignal.timeout(10e3), headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: from, target: to, format: "text" })
  });
  if (!r.ok) throw new HttpError(502, "translator " + r.status);
  return (await r.json()).data?.translations?.[0]?.translatedText || "";
}

const routes = [
  ["GET", "/az", page],
  ["GET", "/az-mt/registry.json", (req, res) => send(req, res, 200, MT_REGISTRY, "application/json; charset=utf-8", "no-cache")],
  ["GET", /^\/az-mt\/m\/(azen|enaz|ruen|enru)\/(model|lex|vocab)$/, async (req, res, url, m) => {
    const [loc, size, hash] = MT_MODELS[m[1]][m[2]], file = path.join(MT_CACHE, loc);
    const head = { "Content-Type": "application/octet-stream", "Content-Length": size, "Cache-Control": "public, max-age=31536000, immutable", "Accept-Ranges": "bytes" };
    // Уже скачанная сервером модель — с диска; иначе качаем с CDN, отдаём и заодно сохраняем (проверив SHA-256)
    if (await fsp.stat(file).then(st => st.size === size, () => false)) {
      // Кусок файла (Range: bytes=от-до) — телефон докачивает с того места, где прервалось
      const rg = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
      if (rg) {
        const start = +rg[1], end = Math.min(rg[2] ? +rg[2] : size - 1, size - 1);
        if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
        res.writeHead(206, { ...head, "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${size}` });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, head);
      return fs.createReadStream(file).pipe(res);
    }
    const r = await fetch(MT_CDN + loc, { signal: AbortSignal.timeout(1800e3) }).catch(() => null);
    if (!r || !r.ok) return send(req, res, 502, "Model unavailable", "text/plain; charset=utf-8");
    res.writeHead(200, head);
    await fsp.mkdir(MT_CACHE, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.part`, out = fs.createWriteStream(tmp), sha = crypto.createHash("sha256");
    try {
      for await (const chunk of r.body) {
        sha.update(chunk); out.write(chunk);
        if (!res.destroyed && !res.write(chunk)) await new Promise(ok => { res.once("drain", ok); res.once("close", ok); });
      }
      await new Promise(ok => out.end(ok));
      if (sha.digest("hex") === hash) await fsp.rename(tmp, file); else await fsp.rm(tmp, { force: true });
    } catch { out.destroy(); await fsp.rm(tmp, { force: true }); }
    res.end();
  }],
  ["GET", /^\/az-mt\/([\w/.-]+)$/, async (req, res, url, m) => {
    if (!MT_FILES.has(m[1])) return send(req, res, 404, "Not found", "text/plain; charset=utf-8");
    send(req, res, 200, await fsp.readFile(path.join(MT_DIR, m[1])), MT_TYPES[path.extname(m[1])], "no-cache");
  }],
  // Онлайн-перевод через сервер: ключ API не попадает в браузер
  ["GET", "/api/az/mt", (req, res) => sendJSON(req, res, 200, { online: !!(MS_KEY || GOOGLE_KEY), engine: MS_KEY ? "microsoft" : GOOGLE_KEY ? "google" : "" })],
  ["POST", "/api/az/mt", async (req, res) => {
    if (!MS_KEY && !GOOGLE_KEY) throw new HttpError(503, "no key");
    if (translating(req.socket.remoteAddress || "")) throw new HttpError(429, "too many");
    const b = await readJSON(req, 4000), text = clean(b.text, 500), from = String(b.from), to = String(b.to);
    if (!text || !MT_LANGS.has(from) || !MT_LANGS.has(to) || from === to) throw new HttpError(400, "bad request");
    sendJSON(req, res, 200, { text: await onlineTranslate(text, from, to) });
  }],
  ["GET", "/az/", (req, res) => { res.writeHead(301, { Location: "/az" }); res.end(); }],
  // Свой сервис-воркер для работы без интернета (управляет только /az)
  ["GET", "/az-sw.js", async (req, res) => {
    try { send(req, res, 200, await fsp.readFile(SW_FILE), "text/javascript; charset=utf-8", "no-cache"); }
    catch { send(req, res, 404, "Not found", "text/plain; charset=utf-8"); }
  }],

  // Мой профиль (и заодно — «я в сети»)
  ["GET", "/api/az/me", (req, res) => {
    const p = profile(requireUser(req));
    const unread = db.prepare("SELECT COUNT(*) AS n FROM az_msgs m WHERE to_id = ? AND read = 0 AND NOT EXISTS (SELECT 1 FROM az_blocks WHERE user_id = m.to_id AND blocked_id = m.from_id)").get(p.user_id).n;
    sendJSON(req, res, 200, { id: p.user_id, pid: pidOf(p.user_id), name: p.name, unread });
  }],
  ["PUT", "/api/az/me", async (req, res) => {
    const u = requireUser(req), b = await readJSON(req, 2000), name = clean(b.name, 40);
    if (name.length < 2) throw new HttpError(400, "name too short");
    profile(u);
    db.prepare("UPDATE az_profiles SET name = ? WHERE user_id = ?").run(name, u.id);
    sendJSON(req, res, 200, { id: u.id, pid: pidOf(u.id), name });
  }],

  // Поиск людей: по ID (только цифры, «#100001» тоже подходит) или по имени — только те, кто открывал чат
  ["GET", "/api/az/users", (req, res, url) => {
    const me = profile(requireUser(req)), q = clean(url.searchParams.get("q"), 40).toLowerCase();
    const pid = /^#?\s*(\d{6,9})$/.exec(q)?.[1];
    if (pid) {
      const row = db.prepare("SELECT user_id FROM az_ids WHERE pid = ?").get(+pid), p = row && person(row.user_id);
      return sendJSON(req, res, 200, { users: p && p.id !== me.user_id && !blocked(me.user_id, p.id) ? [p] : [] });
    }
    if (q.length < 2) return sendJSON(req, res, 200, { users: [] });
    const rows = db.prepare(`SELECT p.user_id AS id, p.name, p.last_seen AS seen, i.pid FROM az_profiles p LEFT JOIN az_ids i ON i.user_id = p.user_id
      WHERE p.user_id != ? AND instr(lower(p.name), ?) > 0 ORDER BY p.last_seen DESC LIMIT 20`).all(me.user_id, q);
    sendJSON(req, res, 200, { users: rows.filter(r => !blocked(me.user_id, r.id)) });
  }],

  // Мои переписки: последний ответ и сколько непрочитанных
  ["GET", "/api/az/convs", (req, res) => {
    const me = profile(requireUser(req)).user_id;
    const rows = db.prepare(`SELECT CASE WHEN from_id = ? THEN to_id ELSE from_id END AS other, MAX(id) AS last
      FROM az_msgs WHERE from_id = ? OR to_id = ? GROUP BY other ORDER BY last DESC LIMIT 100`).all(me, me, me);
    const convs = rows.map(r => {
      const p = person(r.other), m = db.prepare("SELECT * FROM az_msgs WHERE id = ?").get(r.last);
      if (!p || iBlocked(me, r.other)) return null;
      const unread = db.prepare("SELECT COUNT(*) AS n FROM az_msgs WHERE from_id = ? AND to_id = ? AND read = 0").get(r.other, me).n;
      return { id: p.id, pid: p.pid, name: p.name, seen: p.seen, text: m.text.slice(0, 120), mine: m.from_id === me, at: m.created, unread };
    }).filter(Boolean);
    sendJSON(req, res, 200, { convs });
  }],

  // Сообщения с человеком (after — только новые, для опроса раз в несколько секунд)
  ["GET", "/api/az/msgs", (req, res, url) => {
    const me = profile(requireUser(req)).user_id, other = otherId(url), after = +url.searchParams.get("after") || 0;
    const p = person(other);
    if (!p) throw new HttpError(404, "no such user");
    const msgs = db.prepare(`SELECT id, from_id, text, created, read FROM (
        SELECT * FROM az_msgs WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) AND id > ? ORDER BY id DESC LIMIT 200
      ) ORDER BY id`).all(me, other, other, me, after);
    db.prepare("UPDATE az_msgs SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0").run(other, me);
    // До какого моего сообщения собеседник дочитал — чтобы обновить ✓✓ у уже показанных
    const readTo = db.prepare("SELECT MAX(id) AS id FROM az_msgs WHERE from_id = ? AND to_id = ? AND read = 1").get(me, other).id || 0;
    sendJSON(req, res, 200, {
      user: { id: p.id, pid: p.pid, name: p.name, seen: p.seen }, blocked: iBlocked(me, other), readTo,
      msgs: msgs.map(m => ({ id: m.id, mine: m.from_id === me, text: m.text, at: m.created, read: !!m.read }))
    });
  }],

  ["POST", "/api/az/msgs", async (req, res) => {
    const me = profile(requireUser(req)).user_id, b = await readJSON(req, 8000);
    const to = +b.to, text = clean(b.text, MAX_TEXT);
    if (!Number.isInteger(to) || to === me || !person(to)) throw new HttpError(400, "bad user");
    if (!text) throw new HttpError(400, "empty");
    if (sending(me)) throw new HttpError(429, "too many messages");
    if (blocked(me, to)) throw new HttpError(403, "blocked");
    const r = db.prepare("INSERT INTO az_msgs (from_id, to_id, text, created) VALUES (?, ?, ?, ?)").run(me, to, text, Date.now());
    sendJSON(req, res, 200, { id: Number(r.lastInsertRowid) });
  }],

  ["POST", "/api/az/block", async (req, res) => {
    const me = profile(requireUser(req)).user_id, b = await readJSON(req, 2000), id = +b.id;
    if (!Number.isInteger(id) || id === me) throw new HttpError(400, "bad user");
    if (b.on === false) db.prepare("DELETE FROM az_blocks WHERE user_id = ? AND blocked_id = ?").run(me, id);
    else db.prepare("INSERT OR IGNORE INTO az_blocks (user_id, blocked_id, created) VALUES (?, ?, ?)").run(me, id, Date.now());
    sendJSON(req, res, 200, { ok: true });
  }],

  ["POST", "/api/az/report", async (req, res) => {
    const me = profile(requireUser(req)).user_id, b = await readJSON(req, 4000), id = +b.id;
    if (!Number.isInteger(id) || id === me || !person(id)) throw new HttpError(400, "bad user");
    if (reporting(me)) throw new HttpError(429, "too many reports");
    db.prepare("INSERT INTO az_reports (by_id, user_id, msg_id, reason, created) VALUES (?, ?, ?, ?, ?)")
      .run(me, id, Number.isInteger(+b.msg) ? +b.msg : null, clean(b.reason, 300) || "—", Date.now());
    // Пожаловался — значит, и видеть этого человека больше не хочет
    db.prepare("INSERT OR IGNORE INTO az_blocks (user_id, blocked_id, created) VALUES (?, ?, ?)").run(me, id, Date.now());
    sendJSON(req, res, 200, { ok: true });
  }],

  // Для администратора (X-Admin-Token): последние жалобы с текстом сообщений
  ["GET", "/api/az/reports", (req, res) => {
    requireAdmin(req);
    const rows = db.prepare(`SELECT r.*, p.name AS user_name, m.text AS msg_text FROM az_reports r
      LEFT JOIN az_profiles p ON p.user_id = r.user_id LEFT JOIN az_msgs m ON m.id = r.msg_id ORDER BY r.id DESC LIMIT 200`).all();
    sendJSON(req, res, 200, { reports: rows });
  }]
];

function onStart() {
  const sweep = () => db.prepare("DELETE FROM az_msgs WHERE created < ?").run(Date.now() - KEEP_MS);
  sweep();
  setInterval(sweep, 24 * 3600e3).unref();
}

// Перевод по фото: распознавание текста Tesseract.js (Apache-2.0) и словари aze/rus — со своего сервера, чтобы работало офлайн
const OCR_DIR = path.join(env.ROOT, "vendor", "tesseract");
const OCR_FILES = new Set(["tesseract.min.js", "worker.min.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js", "lang/aze.traineddata.gz", "lang/rus.traineddata.gz"]);
routes.push(["GET", /^\/az-ocr\/([\w/.-]+)$/, async (req, res, url, m) => {
  if (!OCR_FILES.has(m[1])) return send(req, res, 404, "Not found", "text/plain; charset=utf-8");
  send(req, res, 200, await fsp.readFile(path.join(OCR_DIR, m[1])), m[1].endsWith(".js") ? "text/javascript; charset=utf-8" : "application/octet-stream", "no-cache");
}]);

// Офлайн-карты городов — server/az-maps.js
routes.push(...require("./az-maps").routes);

module.exports = { routes, onStart };
