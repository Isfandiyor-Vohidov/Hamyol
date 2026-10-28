// Вход через Google (Google Identity Services): одна кнопка, без паролей и писем.
// Приложение получает от Google подписанный ID-токен, сервер проверяет его у Google (tokeninfo):
// что он выдан для нашего GOOGLE_CLIENT_ID, не просрочен и почта подтверждена. Бесплатно.
// Нужна только настройка GOOGLE_CLIENT_ID в .env (Google Cloud → APIs & Services → Credentials → OAuth client ID → Web).
const { db } = require("./db");
const env = require("./env");
const auth = require("./auth");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");

// Колонки для Google-аккаунтов (у старой базы их нет — добавляем один раз)
for (const sql of ["ALTER TABLE users ADD COLUMN google_sub TEXT", "ALTER TABLE users ADD COLUMN email TEXT"]) {
  try { db.exec(sql); } catch { /* колонка уже есть */ }
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub ON users(google_sub)");

const limited = rateLimiter(30, 60 * 60e3);
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

// Проверка ID-токена у Google. Возвращает данные пользователя или бросает 401
async function verify(credential) {
  if (typeof credential !== "string" || credential.length > 4096 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential)) throw new HttpError(400, "bad credential");
  let info;
  try {
    const res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { signal: AbortSignal.timeout(10000) });
    info = await res.json();
    if (!res.ok) throw new Error(info.error_description || res.status);
  } catch (e) { throw new HttpError(401, "google token rejected"); }
  if (info.aud !== env.GOOGLE_CLIENT_ID || !ISSUERS.has(info.iss) || +info.exp * 1000 < Date.now() || !info.sub) throw new HttpError(401, "google token rejected");
  if (info.email && info.email_verified !== "true" && info.email_verified !== true) throw new HttpError(401, "email not verified");
  return info;
}

function upsertGoogleUser(g) {
  const name = String(g.name || [g.given_name, g.family_name].filter(Boolean).join(" ") || (g.email || "").split("@")[0] || "Google").slice(0, 60);
  const photo = /^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(g.picture || "") ? g.picture : null;
  const now = Date.now();
  db.prepare(`INSERT INTO users (google_sub, email, name, photo, lang, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(google_sub) DO UPDATE SET name = excluded.name, email = excluded.email, photo = COALESCE(excluded.photo, users.photo), last_seen = excluded.last_seen`)
    .run(String(g.sub), g.email || null, name, photo, String(g.locale || "").slice(0, 5) || null, now, now);
  return db.prepare("SELECT * FROM users WHERE google_sub = ?").get(String(g.sub));
}

const routes = [
  ["POST", "/api/auth/google", async (req, res) => {
    if (!env.GOOGLE_CLIENT_ID) throw new HttpError(404, "not found");
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const b = await readJSON(req, 6000);
    const user = upsertGoogleUser(await verify(b.credential));
    sendJSON(req, res, 200, { token: auth.createSession(user.id), user: require("./telegram").publicUser(user) });
  }]
];

module.exports = { routes, verify, upsertGoogleUser };
