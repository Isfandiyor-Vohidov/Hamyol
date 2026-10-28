// Админка: одобрение гидов и владельцев мест, модерация отзывов, статистика.
// Доступ: заголовок X-Admin-Token = ADMIN_TOKEN (создаётся автоматически в .env при первом запуске)
// или вход через Telegram пользователем, чей Telegram ID указан в ADMIN_TG_IDS.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const env = require("./env");
const { db } = require("./db");
const { sendJSON, readJSON, HttpError } = require("./http");
const auth = require("./auth");
const tg = require("./telegram");
const track = require("./track");
const { isAdminUser } = require("./market");
const { D, poiName } = require("./data");

function requireAdmin(req) {
  // Выключена — делаем вид, что её нет
  if (!env.ADMIN_ENABLED) throw new HttpError(404, "not found");
  if (isAdminUser(auth.userFrom(req))) return;
  auth.requireAdmin(req);   // иначе — по токену
}

const STATUSES = ["approved", "rejected", "blocked", "pending"];
const LABEL = { approved: "✅ одобрена", rejected: "❌ отклонена", blocked: "⛔ заблокирована", pending: "⏳ на рассмотрении" };

const routes = [
  ["GET", "/api/admin/overview", (req, res) => {
    requireAdmin(req);
    const n = sql => db.prepare(sql).get().n;
    sendJSON(req, res, 200, {
      users: n("SELECT COUNT(*) AS n FROM users"),
      reviews: n("SELECT COUNT(*) AS n FROM reviews"),
      guidesPending: n("SELECT COUNT(*) AS n FROM guides WHERE status = 'pending'"),
      guides: n("SELECT COUNT(*) AS n FROM guides WHERE status = 'approved'"),
      tours: n("SELECT COUNT(*) AS n FROM tours WHERE status = 'active'"),
      bookings: n("SELECT COUNT(*) AS n FROM bookings"),
      claimsPending: hasTable("claims") ? n("SELECT COUNT(*) AS n FROM claims WHERE status = 'pending'") : 0,
      reportsNew: hasTable("reports") ? n("SELECT COUNT(*) AS n FROM reports WHERE status = 'new'") : 0,
      feedbackNew: hasTable("feedback") ? n("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'") : 0,
      topBooking: track.top("booking", 30, 10),
      partners: track.partners(30)
    });
  }],

  // ---------- Гиды ----------
  ["GET", "/api/admin/guides", (req, res, url) => {
    requireAdmin(req);
    const status = url.searchParams.get("status") || "pending";
    const rows = db.prepare(`SELECT g.*, u.username, u.tg_id FROM guides g JOIN users u ON u.id = g.user_id
      WHERE g.status = ? ORDER BY g.created DESC LIMIT 200`).all(status);
    sendJSON(req, res, 200, rows.map(g => ({ ...g, cities: JSON.parse(g.cities), languages: g.languages.split(",") })));
  }],
  ["POST", /^\/api\/admin\/guides\/(\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const { status } = await readJSON(req);
    if (!STATUSES.includes(status)) throw new HttpError(400, "bad status");
    const g = db.prepare("SELECT g.*, u.tg_id FROM guides g JOIN users u ON u.id = g.user_id WHERE g.id = ?").get(+m[1]);
    if (!g) throw new HttpError(404, "not found");
    db.prepare("UPDATE guides SET status = ?, updated = ? WHERE id = ?").run(status, Date.now(), g.id);
    tg.notify(g.tg_id, `Ваша заявка гида в Hamyol ${LABEL[status]}.` + (status === "approved" ? " Теперь можно добавлять экскурсии в кабинете гида." : ""));
    sendJSON(req, res, 200, { ok: true });
  }],

  // ---------- Владельцы заведений ----------
  ["GET", "/api/admin/claims", (req, res, url) => {
    requireAdmin(req);
    const rows = db.prepare(`SELECT c.*, u.name AS user_name, u.username, u.tg_id FROM claims c JOIN users u ON u.id = c.user_id
      WHERE c.status = ? ORDER BY c.created DESC LIMIT 200`).all(url.searchParams.get("status") || "pending");
    sendJSON(req, res, 200, rows.map(c => {
      const p = D.POI[c.poi_id];
      return { ...c, place: p ? { name: poiName("ru", p), type: p.s, city: p.city.n.ru } : null };
    }));
  }],
  ["POST", /^\/api\/admin\/claims\/(\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const { status } = await readJSON(req);
    if (!["approved", "rejected"].includes(status)) throw new HttpError(400, "bad status");
    const c = db.prepare("SELECT c.*, u.tg_id FROM claims c JOIN users u ON u.id = c.user_id WHERE c.id = ?").get(+m[1]);
    if (!c) throw new HttpError(404, "not found");
    if (status === "approved") {
      const owner = db.prepare("SELECT user_id FROM place_owners WHERE poi_id = ?").get(c.poi_id);
      if (owner && owner.user_id !== c.user_id) throw new HttpError(409, "place already has an owner");
      db.prepare("INSERT OR IGNORE INTO place_owners (poi_id, user_id, since) VALUES (?, ?, ?)").run(c.poi_id, c.user_id, Date.now());
    }
    db.prepare("UPDATE claims SET status = ?, updated = ? WHERE id = ?").run(status, Date.now(), c.id);
    const p = D.POI[c.poi_id];
    tg.notify(c.tg_id, `Заявка на «${p ? poiName("ru", p) : c.poi_id}» в Hamyol ${LABEL[status]}.` + (status === "approved" ? " Откройте «Мой бизнес» в аккаунте, чтобы обновить данные." : ""));
    sendJSON(req, res, 200, { ok: true });
  }],
  // Тариф заведения: free / pro (оплата подписки подключается отдельно — см. README)
  ["POST", /^\/api\/admin\/owners\/([nwr]\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const { plan } = await readJSON(req);
    if (!["free", "pro"].includes(plan)) throw new HttpError(400, "bad plan");
    db.prepare("UPDATE place_owners SET plan = ? WHERE poi_id = ?").run(plan, m[1]);
    sendJSON(req, res, 200, { ok: true });
  }],

  // ---------- Отзывы ----------
  ["GET", "/api/admin/reviews", (req, res) => {
    requireAdmin(req);
    sendJSON(req, res, 200, db.prepare("SELECT * FROM reviews ORDER BY id DESC LIMIT 200").all());
  }],
  ["POST", /^\/api\/admin\/reviews\/(\d+)$/, async (req, res, url, m) => {
    requireAdmin(req);
    const { hidden } = await readJSON(req);
    db.prepare("UPDATE reviews SET hidden = ? WHERE id = ?").run(hidden ? 1 : 0, +m[1]);
    sendJSON(req, res, 200, { ok: true });
  }]
];

const hasTable = name => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

// При первом запуске — создать ADMIN_TOKEN и записать в .env
function onStart() {
  if (env.ADMIN_TOKEN) return;
  const token = crypto.randomBytes(24).toString("base64url");
  try {
    fs.appendFileSync(path.join(env.ROOT, ".env"), `\n# Доступ к админке Hamyol (заголовок X-Admin-Token или вход по ссылке #admin)\nADMIN_TOKEN=${token}\n`, { mode: 0o600 });
    env.ADMIN_TOKEN = process.env.ADMIN_TOKEN = token;
    console.log("Админка: ADMIN_TOKEN создан и записан в .env");
  } catch (e) { console.error("Не удалось записать ADMIN_TOKEN в .env:", e.message); }
}

module.exports = { routes, onStart, requireAdmin };
