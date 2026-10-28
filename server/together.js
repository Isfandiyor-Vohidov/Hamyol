// «Поездка с друзьями» (как в Wanderlog): общий план, который редактируют все, у кого есть ссылка.
// В плане — маршрут, даты, настройки бюджета и «Делёж расходов». Вход не нужен: доступ — по секретной ссылке.
// Правки считаются по версиям: устройство присылает версию, от которой оно правило; если план уже
// поменял кто-то другой — сервер отвечает 409 и свежим планом, приложение показывает его.
// Неиспользуемые планы удаляются через 180 дней.
const crypto = require("crypto");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");

db.exec(`
  CREATE TABLE IF NOT EXISTS together (
    code TEXT PRIMARY KEY, state TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 1,
    by TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, updated INTEGER NOT NULL
  );
`);

const MAX_STATE = 30000;
const KEEP_MS = 180 * 864e5;
const creating = rateLimiter(20, 60 * 60e3);    // новых планов с одного IP в час
const editing = rateLimiter(600, 60 * 60e3);    // правок с одного IP в час
const CODE_RE = /^\/api\/together\/([A-Za-z0-9_-]{12})$/;
const newCode = () => crypto.randomBytes(9).toString("base64url");
const clean = (v, max) => (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);

// План — только известные поля, чтобы в общую ссылку нельзя было положить что угодно
function sanitize(s) {
  if (!s || typeof s !== "object" || !Array.isArray(s.r)) throw new HttpError(400, "bad state");
  const out = {
    r: s.r.slice(0, 40).filter(x => Array.isArray(x) && typeof x[0] === "string").map(([id, n]) => [clean(id, 40), Math.max(0, Math.min(60, +n || 0))]),
    d: /^\d{4}-\d{2}-\d{2}$/.test(s.d || "") ? s.d : "",
    p: Math.max(1, Math.min(50, +s.p || 2)), m: Math.max(1, Math.min(30, +s.m || 1)),
    h: clean(s.h, 20), f: clean(s.f, 20), t: clean(s.t, 20)
  };
  if (s.split && typeof s.split === "object") {
    const sp = s.split;
    out.split = {
      people: (Array.isArray(sp.people) ? sp.people : []).slice(0, 30).map(p => ({ id: clean(p?.id, 12), name: clean(p?.name, 40) })).filter(p => p.id && p.name),
      items: (Array.isArray(sp.items) ? sp.items : []).slice(0, 300).map(it => ({
        id: clean(it?.id, 12), what: clean(it?.what, 80), amt: Math.max(0, +it?.amt || 0), cur: clean(it?.cur, 5),
        by: clean(it?.by, 12), for: (Array.isArray(it?.for) ? it.for : []).slice(0, 30).map(x => clean(x, 12)), date: +it?.date || 0
      })).filter(it => it.id)
    };
  }
  const json = JSON.stringify(out);
  if (json.length > MAX_STATE) throw new HttpError(413, "plan too large");
  return json;
}
const view = row => ({ code: row.code, ver: row.ver, by: row.by, updated: row.updated, state: JSON.parse(row.state) });
const get = code => db.prepare("SELECT * FROM together WHERE code = ?").get(code);

const routes = [
  ["POST", "/api/together", async (req, res) => {
    if (creating(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req, MAX_STATE + 2000), now = Date.now(), code = newCode();
    db.prepare("INSERT INTO together (code, state, by, created, updated) VALUES (?, ?, ?, ?, ?)").run(code, sanitize(b.state), clean(b.name, 40), now, now);
    sendJSON(req, res, 200, view(get(code)));
  }],

  ["GET", CODE_RE, (req, res, url, m) => {
    const row = get(m[1]);
    if (!row) throw new HttpError(404, "not found");
    // Уже последняя версия — без лишнего плана в ответе (приложение спрашивает раз в 15 секунд)
    if (+url.searchParams.get("ver") === row.ver) return sendJSON(req, res, 200, { code: row.code, ver: row.ver, same: true });
    sendJSON(req, res, 200, view(row));
  }],

  ["PUT", CODE_RE, async (req, res, url, m) => {
    if (editing(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req, MAX_STATE + 2000), row = get(m[1]);
    if (!row) throw new HttpError(404, "not found");
    const state = sanitize(b.state);
    if (+b.ver !== row.ver) return sendJSON(req, res, 409, view(row));
    db.prepare("UPDATE together SET state = ?, ver = ver + 1, by = ?, updated = ? WHERE code = ? AND ver = ?").run(state, clean(b.name, 40), Date.now(), row.code, row.ver);
    sendJSON(req, res, 200, view(get(row.code)));
  }]
];

function onStart() {
  const sweep = () => db.prepare("DELETE FROM together WHERE updated < ?").run(Date.now() - KEEP_MS);
  sweep();
  setInterval(sweep, 24 * 3600e3).unref();
}

module.exports = { routes, onStart, sanitize };
