// Отзывы и оценки (с фото: до 3 на отзыв, файлы в storage/photos)
const fs = require("node:fs");
const path = require("node:path");
const { db } = require("./db");
const { send, sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const { STORAGE } = require("./env");

// Фото к отзывам: колонка с именами файлов (добавляется в старую базу при первом запуске)
if (!db.prepare("PRAGMA table_info(reviews)").all().some(c => c.name === "photos")) {
  db.exec("ALTER TABLE reviews ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'");
}
// Оценки по пунктам (чистота, цена/качество, обслуживание, расположение) — JSON, по желанию автора
if (!db.prepare("PRAGMA table_info(reviews)").all().some(c => c.name === "crit")) {
  db.exec("ALTER TABLE reviews ADD COLUMN crit TEXT NOT NULL DEFAULT '{}'");
}
const CRIT = ["clean", "value", "service", "location"];
const parseCrit = c => Object.fromEntries(CRIT.map(k => [k, Math.round(+c?.[k])]).filter(([, v]) => v >= 1 && v <= 5));
const PHOTOS = path.join(STORAGE, "photos");
fs.mkdirSync(PHOTOS, { recursive: true });
const MAX_PHOTOS = 3, MAX_PHOTO_BYTES = 900_000;
// Тип картинки — по первым байтам файла, а не по тому, что прислал браузер
function imageType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  return null;
}
function decodePhotos(list) {
  if (!Array.isArray(list)) return [];
  if (list.length > MAX_PHOTOS) throw new HttpError(400, "too many photos");
  return list.map(d => {
    const m = /^data:image\/(jpeg|webp|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
    if (!m) throw new HttpError(400, "bad photo");
    const buf = Buffer.from(m[2], "base64");
    const type = imageType(buf);
    if (!type || buf.length > MAX_PHOTO_BYTES) throw new HttpError(400, "bad photo");
    return { buf, type };
  });
}
const { D } = require("./data");
const auth = require("./auth");

const limited = rateLimiter(10, 10 * 60e3);   // не больше 10 отзывов с одного IP за 10 минут

// Ключ отзыва должен указывать на существующий город или место
function validKey(key) {
  const m = /^(city|poi):([\w-]{1,80})$/.exec(key);
  return !!m && !!(m[1] === "city" ? D.CITY[m[2]] : D.POI[m[2]]);
}
const summaryOf = key => {
  const r = db.prepare("SELECT COALESCE(SUM(stars), 0) AS s, COUNT(*) AS n FROM reviews WHERE key = ? AND hidden = 0").get(key);
  return [r.s, r.n];
};

const routes = [
  ["GET", "/api/reviews/summary", (req, res) => {
    const out = {};
    for (const r of db.prepare("SELECT key, SUM(stars) AS s, COUNT(*) AS n FROM reviews WHERE hidden = 0 GROUP BY key").all()) out[r.key] = [r.s, r.n];
    sendJSON(req, res, 200, out);
  }],

  ["GET", "/api/reviews", (req, res, url) => {
    const key = url.searchParams.get("key") || "";
    const list = db.prepare(`SELECT r.id, r.name, r.text, r.stars, r.date, r.reply, r.reply_date, r.photos, r.crit, r.user_id IS NOT NULL AS verified
      FROM reviews r WHERE r.key = ? AND r.hidden = 0 ORDER BY r.id DESC LIMIT 200`).all(key);
    sendJSON(req, res, 200, list.map(r => ({ ...r, verified: !!r.verified, photos: JSON.parse(r.photos || "[]"), crit: JSON.parse(r.crit || "{}") })));
  }],

  ["POST", "/api/reviews", async (req, res) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const data = await readJSON(req, 3_500_000);   // с фото запрос крупнее
    const user = auth.userFrom(req);
    const photos = decodePhotos(data.photos);
    const key = String(data.key || "");
    const name = (user ? user.name : String(data.name || "")).trim().slice(0, 40);
    const text = String(data.text || "").trim().slice(0, 1000);
    const stars = Math.round(+data.stars);
    if (!validKey(key) || !name || !text || !(stars >= 1 && stars <= 5)) throw new HttpError(400, "invalid review");
    const crit = key.startsWith("poi:") ? parseCrit(data.crit) : {};   // по пунктам — только у мест
    const { lastInsertRowid: id } = db.prepare("INSERT INTO reviews (key, name, text, stars, date, user_id, crit) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(key, name, text, stars, Date.now(), user ? user.id : null, JSON.stringify(crit));
    if (photos.length) {
      const names = photos.map((p, i) => `${id}-${i}.${p.type}`);
      photos.forEach((p, i) => fs.writeFileSync(path.join(PHOTOS, names[i]), p.buf));
      db.prepare("UPDATE reviews SET photos = ? WHERE id = ?").run(JSON.stringify(names), id);
    }
    sendJSON(req, res, 201, { ok: true, summary: summaryOf(key) });
  }]
];

// Фото отзыва: только если сам отзыв не скрыт модератором
const PHOTO_MIME = { jpg: "image/jpeg", webp: "image/webp", png: "image/png" };
routes.push(["GET", /^\/photos\/(\d+)-(\d)\.(jpg|webp|png)$/, (req, res, url, m) => {
  const r = db.prepare("SELECT hidden FROM reviews WHERE id = ?").get(+m[1]);
  const file = path.join(PHOTOS, `${m[1]}-${m[2]}.${m[3]}`);
  if (!r || r.hidden || !fs.existsSync(file)) return send(req, res, 404, "Not found", "text/plain; charset=utf-8");
  send(req, res, 200, fs.readFileSync(file), PHOTO_MIME[m[3]], "public, max-age=31536000, immutable");
}]);

module.exports = { routes, validKey, summaryOf, parseCrit };
