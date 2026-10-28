// Анонимная статистика для теста на людях: сколько людей в день, какие разделы открывают, что делают,
// откуда пришли (метка ?from= — например, QR-постер конкретного хостела) и опрос «Как вам Safar?».
// Никаких IP, cookie и идентификаторов: «первый заход сегодня» и «первый заход вообще» отмечает
// само устройство, сервер хранит только счётчики по дням.
const { db } = require("./db");
const env = require("./env");
const { sendJSON, readBody, readJSON, clientIp, rateLimiter, HttpError } = require("./http");

db.exec(`
  CREATE TABLE IF NOT EXISTS stat_days (day TEXT PRIMARY KEY, users INTEGER NOT NULL DEFAULT 0, fresh INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS stat_events (day TEXT NOT NULL, name TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, name));
  CREATE TABLE IF NOT EXISTS stat_sources (day TEXT NOT NULL, src TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, src));
  CREATE TABLE IF NOT EXISTS survey (id INTEGER PRIMARY KEY, day TEXT NOT NULL, stars INTEGER NOT NULL, text TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT '');
`);

// Разделы (v:) и действия (a:), которые считаем. Всё остальное отбрасывается
const VIEWS = ["home", "cities", "hotels", "places", "map", "budget", "city", "place", "favs", "account", "prices", "guide", "tickets",
  "offline", "passport", "diary", "feedback", "partners", "poster", "together", "trip", "list", "nav", "docs", "sos", "translate", "mecca"];
const ACTIONS = ["trip_quick", "trip_ready", "trip_share", "together_create", "together_join", "fav_add", "review", "ticket_add",
  "crowd_mark", "route", "taxi", "call", "install", "offline_city", "login", "lang", "search"];
const NAMES = new Set([...VIEWS.map(v => "v:" + v), ...ACTIONS.map(a => "a:" + a)]);
const SRC_RE = /^[a-z0-9_-]{1,40}$/;

const limited = rateLimiter(120, 60 * 60e3);
const surveyLimited = rateLimiter(5, 24 * 3600e3);
const today = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);   // день по Ташкенту
const daysAgo = n => new Date(Date.now() + 5 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
const clean = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);

const addDay = db.prepare(`INSERT INTO stat_days (day, users, fresh) VALUES (?, ?, ?)
  ON CONFLICT(day) DO UPDATE SET users = users + excluded.users, fresh = fresh + excluded.fresh`);
const addEvent = db.prepare(`INSERT INTO stat_events (day, name, n) VALUES (?, ?, ?) ON CONFLICT(day, name) DO UPDATE SET n = n + excluded.n`);
const addSrc = db.prepare(`INSERT INTO stat_sources (day, src, n) VALUES (?, ?, 1) ON CONFLICT(day, src) DO UPDATE SET n = n + 1`);

// Сводка за N дней — для админки и команды /stats в боте
function summary(days = 14) {
  const since = daysAgo(days - 1);
  const byDay = db.prepare("SELECT day, users, fresh FROM stat_days WHERE day >= ? ORDER BY day").all(since);
  const events = db.prepare("SELECT name, SUM(n) AS n FROM stat_events WHERE day >= ? GROUP BY name ORDER BY n DESC").all(since);
  const sources = db.prepare("SELECT src, SUM(n) AS n FROM stat_sources WHERE day >= ? GROUP BY src ORDER BY n DESC LIMIT 30").all(since);
  const sv = db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS avg FROM survey WHERE day >= ?").get(since);
  const comments = db.prepare("SELECT day, stars, text, lang FROM survey WHERE day >= ? AND text != '' ORDER BY id DESC LIMIT 30").all(since);
  const stars = Object.fromEntries(db.prepare("SELECT stars, COUNT(*) AS n FROM survey WHERE day >= ? GROUP BY stars").all(since).map(r => [r.stars, r.n]));
  return { days, byDay, events, sources, survey: { n: sv.n, avg: sv.avg ? Math.round(sv.avg * 10) / 10 : null, stars, comments } };
}

// Короткий текст для бота
function botText() {
  const s = summary(7), t = s.byDay.find(d => d.day === today()) || { users: 0, fresh: 0 };
  const sum = k => s.byDay.reduce((a, d) => a + d[k], 0);
  const ev = name => s.events.find(e => e.name === name)?.n || 0;
  const top = s.events.filter(e => e.name.startsWith("v:")).slice(0, 5).map(e => `${e.name.slice(2)} ${e.n}`).join(", ") || "—";
  const src = s.sources.slice(0, 5).map(x => `${x.src} ${x.n}`).join(", ") || "—";
  return `📊 <b>Hamyol — статистика</b>
Сегодня: ${t.users} чел. (новых ${t.fresh})
За 7 дней: ${sum("users")} заходов, новых ${sum("fresh")}

Собрали поездку: ${ev("a:trip_quick") + ev("a:trip_ready")} · пригласили друзей: ${ev("a:together_create")}
В избранное: ${ev("a:fav_add")} · маршрутов: ${ev("a:route")} · установок: ${ev("a:install")}
Разделы: ${top}
Откуда пришли: ${src}
Опрос: ${s.survey.n ? `${s.survey.avg}★ (${s.survey.n} ответов)` : "пока нет ответов"}`;
}

const routes = [
  // navigator.sendBeacon присылает text/plain — разбираем сами. Тело: { u: 1, f: 1, src, ev: { "v:home": 3, … } }
  ["POST", "/api/stats", async (req, res) => {
    if (limited(clientIp(req))) return sendJSON(req, res, 200, { ok: true });
    let b = {};
    try { b = JSON.parse(await readBody(req, 4000)); } catch { /* пусто */ }
    const day = today();
    if (b.u === 1 || b.f === 1) addDay.run(day, b.u === 1 ? 1 : 0, b.f === 1 ? 1 : 0);
    if (b.f === 1 && typeof b.src === "string" && SRC_RE.test(b.src)) addSrc.run(day, b.src);
    if (b.ev && typeof b.ev === "object") {
      for (const [name, n] of Object.entries(b.ev).slice(0, 60)) {
        if (NAMES.has(name) && Number.isInteger(n) && n > 0) addEvent.run(day, name, Math.min(n, 200));
      }
    }
    sendJSON(req, res, 200, { ok: true });
  }],

  // Опрос «Как вам Safar?»: звёзды без согласия, текст — только после согласия (проверяет приложение)
  ["POST", "/api/survey", async (req, res) => {
    if (surveyLimited(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req, 3000), stars = +b.stars;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, "bad stars");
    db.prepare("INSERT INTO survey (day, stars, text, lang) VALUES (?, ?, ?, ?)").run(today(), stars, clean(b.text, 600), clean(b.lang, 5));
    // Низкая оценка с комментарием — сразу администраторам, чтобы быстро поправить
    if (stars <= 3 && clean(b.text, 600)) {
      try {
        const tg = require("./telegram");
        for (const id of String(env.ADMIN_TG_IDS).split(",").map(s => +s.trim()).filter(Boolean)) {
          tg.notify(id, `📝 <b>Опрос: ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</b>\n${clean(b.text, 600).replace(/[&<>]/g, "")}`).catch(() => {});
        }
      } catch { /* без бота */ }
    }
    sendJSON(req, res, 200, { ok: true });
  }],

  ["GET", "/api/admin/stats", (req, res, url) => {
    require("./admin").requireAdmin(req);
    sendJSON(req, res, 200, summary(Math.max(1, Math.min(90, +url.searchParams.get("days") || 14))));
  }]
];

// Вечерняя сводка администраторам (ADMIN_TG_IDS) в 21:00 по Ташкенту — только если в этот день были заходы
db.exec("CREATE TABLE IF NOT EXISTS stat_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
async function eveningReport() {
  const hour = new Date(Date.now() + 5 * 3600e3).getUTCHours(), day = today();
  if (hour !== 21) return;
  if (db.prepare("SELECT v FROM stat_meta WHERE k = 'report'").get()?.v === day) return;
  db.prepare("INSERT INTO stat_meta (k, v) VALUES ('report', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(day);
  if (!db.prepare("SELECT users FROM stat_days WHERE day = ?").get(day)?.users) return;
  const ids = String(env.ADMIN_TG_IDS).split(",").map(s => +s.trim()).filter(Boolean);
  if (!ids.length || !env.TELEGRAM_BOT_TOKEN) return;
  const tg = require("./telegram");
  for (const id of ids) await tg.notify(id, botText()).catch(() => {});
}
function onStart() { setInterval(() => eveningReport().catch(e => console.error("stats report:", e.message)), 10 * 60e3).unref(); }

module.exports = { routes, onStart, summary, botText, today, eveningReport };
