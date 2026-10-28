// Кабинет бизнеса: владелец подтверждает заведение, правит данные, отвечает на отзывы, видит статистику.
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const auth = require("./auth");
const { D, poiName } = require("./data");
const track = require("./track");
const { notifyAdmins } = require("./market");

db.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    poi_id TEXT NOT NULL,
    role TEXT NOT NULL,
    contact TEXT NOT NULL,
    proof TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS place_owners (
    poi_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',
    since INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS overrides (
    poi_id TEXT PRIMARY KEY,
    description TEXT,
    phone TEXT,
    website TEXT,
    hours TEXT,
    price_from REAL,
    price_to REAL,
    photo TEXT,
    updated INTEGER NOT NULL
  );
`);

const limited = rateLimiter(10, 10 * 60e3);
const ownerOf = poiId => db.prepare("SELECT * FROM place_owners WHERE poi_id = ?").get(poiId);
const opt = (v, max) => { const s = String(v ?? "").trim(); if (s.length > max) throw new HttpError(400, "field too long"); return s || null; };
// Фото: только https-ссылка без символов, ломающих CSS url(…)
function photoUrl(v) {
  const s = opt(v, 500);
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { throw new HttpError(400, "bad photo url"); }
  if (u.protocol !== "https:" || /['"()\s\\<>]/.test(s)) throw new HttpError(400, "bad photo url");
  return u.href;
}
function webUrl(v) {
  const s = opt(v, 300);
  if (!s) return null;
  try { const u = new URL(/^https?:\/\//.test(s) ? s : "https://" + s); if (!/^https?:$/.test(u.protocol)) throw 0; return u.href; }
  catch { throw new HttpError(400, "bad website"); }
}
const price = v => v === "" || v == null ? null : (Number.isFinite(+v) && +v >= 0 && +v <= 100000 ? +v : (() => { throw new HttpError(400, "bad price"); })());

const routes = [
  // Публично: правки владельцев (их мало — отдаём все сразу)
  ["GET", "/api/overrides", (req, res) => {
    const out = {};
    for (const o of db.prepare(`SELECT o.*, po.plan FROM overrides o JOIN place_owners po ON po.poi_id = o.poi_id`).all()) {
      out[o.poi_id] = Object.fromEntries(Object.entries({ d: o.description, ph: o.phone, w: o.website, oh: o.hours, pf: o.price_from, pt: o.price_to, img: o.photo, plan: o.plan }).filter(([, v]) => v != null));
    }
    // Подтверждённые владельцы без правок — тоже отмечаем
    for (const po of db.prepare("SELECT poi_id, plan FROM place_owners").all()) out[po.poi_id] ||= { plan: po.plan };
    sendJSON(req, res, 200, out);
  }],

  // Заявка «это моё заведение»
  ["POST", "/api/business/claim", async (req, res) => {
    const u = auth.requireUser(req);
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req);
    const poi = D.POI[String(b.poi_id || "")];
    if (!poi) throw new HttpError(404, "place not found");
    if (ownerOf(poi.id)) throw new HttpError(409, "already has an owner");
    if (db.prepare("SELECT 1 FROM claims WHERE user_id = ? AND poi_id = ? AND status = 'pending'").get(u.id, poi.id)) throw new HttpError(409, "already pending");
    const role = ["owner", "manager", "staff"].includes(b.role) ? b.role : "owner";
    const contact = opt(b.contact, 60), proof = opt(b.proof, 1000);
    if (!contact || !proof || proof.length < 10) throw new HttpError(400, "contact and proof required");
    const now = Date.now();
    db.prepare("INSERT INTO claims (user_id, poi_id, role, contact, proof, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(u.id, poi.id, role, contact, proof, now, now);
    notifyAdmins(`🏢 Заявка владельца: «${poiName("ru", poi).replace(/[<>&]/g, "")}» (${poi.city.n.ru}). Откройте админку Hamyol.`);
    sendJSON(req, res, 201, { ok: true });
  }],

  // Мой бизнес: заявки, заведения, статистика, отзывы
  ["GET", "/api/business/me", (req, res) => {
    const u = auth.requireUser(req);
    const claims = db.prepare("SELECT id, poi_id, status, created FROM claims WHERE user_id = ? ORDER BY id DESC").all(u.id);
    const places = db.prepare("SELECT * FROM place_owners WHERE user_id = ?").all(u.id).map(po => {
      const key = "poi:" + po.poi_id;
      const o = db.prepare("SELECT * FROM overrides WHERE poi_id = ?").get(po.poi_id) || {};
      const rating = db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS avg FROM reviews WHERE key = ? AND hidden = 0").get(key);
      const reviews = db.prepare("SELECT id, name, text, stars, date, reply FROM reviews WHERE key = ? AND hidden = 0 ORDER BY id DESC LIMIT 30").all(key);
      return { poi_id: po.poi_id, plan: po.plan, since: po.since, overrides: o, stats: track.stats(key), rating, reviews };
    });
    sendJSON(req, res, 200, { claims, places });
  }],

  ["PUT", /^\/api\/business\/places\/([nwr]\d+)$/, async (req, res, url, m) => {
    const u = auth.requireUser(req);
    const po = ownerOf(m[1]);
    if (!po || po.user_id !== u.id) throw new HttpError(403, "not your place");
    const b = await readJSON(req);
    const row = {
      description: opt(b.description, 1000), phone: opt(b.phone, 40), website: webUrl(b.website), hours: opt(b.hours, 200),
      price_from: price(b.price_from), price_to: price(b.price_to), photo: photoUrl(b.photo)
    };
    db.prepare(`INSERT INTO overrides (poi_id, description, phone, website, hours, price_from, price_to, photo, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(poi_id) DO UPDATE SET description = excluded.description, phone = excluded.phone, website = excluded.website, hours = excluded.hours,
        price_from = excluded.price_from, price_to = excluded.price_to, photo = excluded.photo, updated = excluded.updated`)
      .run(m[1], row.description, row.phone, row.website, row.hours, row.price_from, row.price_to, row.photo, Date.now());
    sendJSON(req, res, 200, { ok: true });
  }],

  // Ответ владельца на отзыв о своём заведении
  ["POST", /^\/api\/business\/reviews\/(\d+)\/reply$/, async (req, res, url, m) => {
    const u = auth.requireUser(req);
    const r = db.prepare("SELECT * FROM reviews WHERE id = ?").get(+m[1]);
    const po = r && r.key.startsWith("poi:") && ownerOf(r.key.slice(4));
    if (!po || po.user_id !== u.id) throw new HttpError(403, "not your place");
    const { text } = await readJSON(req);
    const reply = opt(text, 1000);
    db.prepare("UPDATE reviews SET reply = ?, reply_date = ? WHERE id = ?").run(reply, reply ? Date.now() : null, r.id);
    sendJSON(req, res, 200, { ok: true });
  }]
];

module.exports = { routes };
