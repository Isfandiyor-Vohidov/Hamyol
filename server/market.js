// Маркетплейс гидов: заявки гидов, экскурсии, бронирования с уведомлениями в Telegram.
// Оплата — гиду при встрече (подключение Payme/Click — см. README).
const env = require("./env");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const auth = require("./auth");
const { D, cityName } = require("./data");
const tg = require("./telegram");

db.exec(`
  CREATE TABLE IF NOT EXISTS guides (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bio TEXT NOT NULL,
    languages TEXT NOT NULL,
    cities TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY,
    guide_id INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    city_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_h REAL NOT NULL,
    price_usd REAL NOT NULL,
    max_people INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tours_city ON tours(city_id);
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    people INTEGER NOT NULL,
    contact TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
`);

const LANGS = ["uz", "ru", "en", "tr", "de", "zh", "ko", "fr", "es", "it", "ja", "ar", "fa", "kk", "tg"];
const limited = rateLimiter(20, 10 * 60e3);
const str = (v, max, min = 1) => {
  const s = String(v ?? "").trim();
  if (s.length < min || s.length > max) throw new HttpError(400, "invalid field");
  return s;
};
const isAdminUser = u => !!u && String(env.ADMIN_TG_IDS).split(",").map(s => s.trim()).includes(String(u.tg_id));
const myGuide = u => db.prepare("SELECT * FROM guides WHERE user_id = ?").get(u.id);
const appUrl = path => /^https:\/\//.test(env.PUBLIC_URL) ? env.PUBLIC_URL + "/" + path : "";
const escHtml = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function guideOut(g) {
  return { id: g.id, name: g.name, bio: g.bio, phone: g.phone, languages: g.languages.split(","), cities: JSON.parse(g.cities), status: g.status };
}
function tourOut(t, lang = "ru") {
  const c = D.CITY[t.city_id];
  return {
    id: t.id, city: t.city_id, cityName: c ? cityName(lang, c) : t.city_id, title: t.title, description: t.description,
    duration_h: t.duration_h, price_usd: t.price_usd, max_people: t.max_people, status: t.status,
    guide: { id: t.guide_id, name: t.guide_name, languages: (t.guide_languages || "").split(",").filter(Boolean) }
  };
}
const TOUR_SELECT = `SELECT t.*, g.name AS guide_name, g.languages AS guide_languages, g.user_id AS guide_user
  FROM tours t JOIN guides g ON g.id = t.guide_id`;

async function notifyAdmins(text) {
  const ids = String(env.ADMIN_TG_IDS).split(",").map(s => +s.trim()).filter(Boolean);
  for (const id of ids) await tg.notify(id, text);
}

const routes = [
  // ---------- Публично: экскурсии ----------
  ["GET", "/api/tours", (req, res, url) => {
    const city = url.searchParams.get("city");
    const rows = db.prepare(`${TOUR_SELECT} WHERE t.status = 'active' AND g.status = 'approved' ${city ? "AND t.city_id = ?" : ""}
      ORDER BY t.created DESC LIMIT 200`).all(...(city ? [city] : []));
    sendJSON(req, res, 200, rows.map(t => tourOut(t, url.searchParams.get("lang") || "ru")));
  }],
  ["GET", "/api/tours/counts", (req, res) => {
    const out = {};
    for (const r of db.prepare(`SELECT t.city_id AS c, COUNT(*) AS n FROM tours t JOIN guides g ON g.id = t.guide_id
      WHERE t.status = 'active' AND g.status = 'approved' GROUP BY t.city_id`).all()) out[r.c] = r.n;
    sendJSON(req, res, 200, out);
  }],

  // ---------- Гид: заявка, профиль, экскурсии ----------
  ["POST", "/api/guides/apply", async (req, res) => {
    const u = auth.requireUser(req);
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req);
    const langs = (Array.isArray(b.languages) ? b.languages : []).filter(l => LANGS.includes(l));
    const cities = (Array.isArray(b.cities) ? b.cities : []).filter(c => D.CITY[c]).slice(0, 20);
    if (!langs.length || !cities.length) throw new HttpError(400, "languages and cities required");
    const row = { name: str(b.name, 60, 2), bio: str(b.bio, 1500, 20), phone: str(b.phone, 30, 5) };
    const now = Date.now();
    const existing = myGuide(u);
    if (existing) {
      // После отказа анкету можно подать заново — она снова уходит на рассмотрение (заблокированных это не касается)
      const again = existing.status === "rejected";
      db.prepare("UPDATE guides SET name = ?, bio = ?, languages = ?, cities = ?, phone = ?, updated = ?" + (again ? ", status = 'pending'" : "") + " WHERE id = ?")
        .run(row.name, row.bio, langs.join(","), JSON.stringify(cities), row.phone, now, existing.id);
      if (again) notifyAdmins(`🧑‍🏫 Повторная заявка гида: <b>${escHtml(row.name)}</b> (${cities.length} гор.). Откройте админку Hamyol.`);
    } else {
      db.prepare("INSERT INTO guides (user_id, name, bio, languages, cities, phone, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(u.id, row.name, row.bio, langs.join(","), JSON.stringify(cities), row.phone, now, now);
      notifyAdmins(`🧑‍🏫 Новая заявка гида: <b>${escHtml(row.name)}</b> (${cities.length} гор.). Откройте админку Hamyol.`);
    }
    sendJSON(req, res, 200, guideOut(myGuide(u)));
  }],
  ["GET", "/api/guides/me", (req, res) => {
    const u = auth.requireUser(req);
    const g = myGuide(u);
    if (!g) return sendJSON(req, res, 200, { guide: null, isAdmin: env.ADMIN_ENABLED && isAdminUser(u) });
    const tours = db.prepare(`${TOUR_SELECT} WHERE t.guide_id = ? ORDER BY t.created DESC`).all(g.id).map(t => tourOut(t));
    const bookings = db.prepare(`SELECT b.*, t.title, u.name AS tourist FROM bookings b JOIN tours t ON t.id = b.tour_id
      JOIN users u ON u.id = b.user_id WHERE t.guide_id = ? ORDER BY b.created DESC LIMIT 100`).all(g.id);
    sendJSON(req, res, 200, { guide: guideOut(g), tours, bookings, isAdmin: env.ADMIN_ENABLED && isAdminUser(u) });
  }],
  ["POST", "/api/tours", async (req, res) => {
    const u = auth.requireUser(req);
    const g = myGuide(u);
    if (!g || g.status !== "approved") throw new HttpError(403, "guide not approved");
    const b = await readJSON(req);
    const t = tourInput(b, g);
    const now = Date.now();
    const r = db.prepare(`INSERT INTO tours (guide_id, city_id, title, description, duration_h, price_usd, max_people, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(g.id, t.city, t.title, t.description, t.duration, t.price, t.max, now, now);
    sendJSON(req, res, 201, { id: Number(r.lastInsertRowid) });
  }],
  ["PUT", /^\/api\/tours\/(\d+)$/, async (req, res, url, m) => {
    const u = auth.requireUser(req);
    const g = myGuide(u);
    const tour = db.prepare("SELECT * FROM tours WHERE id = ?").get(+m[1]);
    if (!g || !tour || tour.guide_id !== g.id) throw new HttpError(404, "not found");
    const b = await readJSON(req);
    if (b.status && ["active", "hidden"].includes(b.status) && Object.keys(b).length === 1) {
      db.prepare("UPDATE tours SET status = ?, updated = ? WHERE id = ?").run(b.status, Date.now(), tour.id);
    } else {
      const t = tourInput(b, g);
      db.prepare(`UPDATE tours SET city_id = ?, title = ?, description = ?, duration_h = ?, price_usd = ?, max_people = ?, updated = ? WHERE id = ?`)
        .run(t.city, t.title, t.description, t.duration, t.price, t.max, Date.now(), tour.id);
    }
    sendJSON(req, res, 200, { ok: true });
  }],

  // ---------- Бронирования ----------
  ["POST", "/api/bookings", async (req, res) => {
    const u = auth.requireUser(req);
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req);
    const tour = db.prepare(`${TOUR_SELECT} WHERE t.id = ? AND t.status = 'active' AND g.status = 'approved'`).get(+b.tour_id);
    if (!tour) throw new HttpError(404, "tour not found");
    const date = str(b.date, 10, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "bad date");
    const people = Math.round(+b.people);
    if (!(people >= 1 && people <= tour.max_people)) throw new HttpError(400, "bad people");
    const contact = str(b.contact, 60, 5), message = String(b.message || "").trim().slice(0, 500);
    const now = Date.now();
    const r = db.prepare(`INSERT INTO bookings (tour_id, user_id, date, people, contact, message, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(tour.id, u.id, date, people, contact, message, now, now);
    const guideUser = db.prepare("SELECT tg_id FROM users WHERE id = ?").get(tour.guide_user);
    const link = appUrl("#account");
    tg.notify(guideUser?.tg_id, `📩 <b>Новая заявка на экскурсию</b>\n«${escHtml(tour.title)}»\n📅 ${date} · 👥 ${people}\n👤 ${escHtml(u.name)}${u.username ? " (@" + escHtml(u.username) + ")" : ""}\n📞 ${escHtml(contact)}${message ? "\n💬 " + escHtml(message) : ""}`,
      link ? [[{ text: "Открыть кабинет гида", url: link }]] : null);
    sendJSON(req, res, 201, { id: Number(r.lastInsertRowid), status: "new" });
  }],
  ["GET", "/api/bookings/me", (req, res) => {
    const u = auth.requireUser(req);
    const rows = db.prepare(`SELECT b.*, t.title, t.city_id, t.price_usd, g.name AS guide_name FROM bookings b
      JOIN tours t ON t.id = b.tour_id JOIN guides g ON g.id = t.guide_id WHERE b.user_id = ? ORDER BY b.created DESC LIMIT 100`).all(u.id);
    sendJSON(req, res, 200, rows);
  }],
  // Смена статуса: гид — confirmed / declined, турист — cancelled
  ["POST", /^\/api\/bookings\/(\d+)\/status$/, async (req, res, url, m) => {
    const u = auth.requireUser(req);
    const { status } = await readJSON(req);
    const bk = db.prepare(`SELECT b.*, t.title, t.guide_id, g.user_id AS guide_user FROM bookings b JOIN tours t ON t.id = b.tour_id
      JOIN guides g ON g.id = t.guide_id WHERE b.id = ?`).get(+m[1]);
    if (!bk) throw new HttpError(404, "not found");
    const isGuide = bk.guide_user === u.id, isTourist = bk.user_id === u.id;
    const allowed = isGuide && ["confirmed", "declined"].includes(status) || isTourist && status === "cancelled";
    if (!allowed || ["cancelled", "declined"].includes(bk.status)) throw new HttpError(403, "not allowed");
    db.prepare("UPDATE bookings SET status = ?, updated = ? WHERE id = ?").run(status, Date.now(), bk.id);
    const other = db.prepare("SELECT tg_id FROM users WHERE id = ?").get(isGuide ? bk.user_id : bk.guide_user);
    const label = { confirmed: "✅ Гид подтвердил", declined: "❌ Гид отклонил", cancelled: "🚫 Турист отменил" }[status];
    tg.notify(other?.tg_id, `${label} экскурсию «${escHtml(bk.title)}» на ${bk.date}.`);
    sendJSON(req, res, 200, { ok: true });
  }]
];

function tourInput(b, g) {
  const cities = JSON.parse(g.cities);
  const city = String(b.city || "");
  if (!cities.includes(city)) throw new HttpError(400, "city not in guide profile");
  const duration = +b.duration_h, price = +b.price_usd, max = Math.round(+b.max_people);
  if (!(duration >= 0.5 && duration <= 72) || !(price >= 0 && price <= 10000) || !(max >= 1 && max <= 100)) throw new HttpError(400, "bad numbers");
  return { city, title: str(b.title, 100, 5), description: str(b.description, 2000, 20), duration, price, max };
}

module.exports = { routes, isAdminUser, myGuide, notifyAdmins };
