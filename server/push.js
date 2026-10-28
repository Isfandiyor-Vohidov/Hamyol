// Push-уведомления о поездке: накануне начала (19:00 по Ташкенту) и утром каждого дня (8:00) — с погодой.
// Web Push без внешних библиотек: шифрование RFC 8291 (aes128gcm) и подпись VAPID (RFC 8292) на node:crypto.
// Ключи VAPID создаются при первом запуске: storage/vapid.json (не публикуется).
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { db } = require("./db");
const { sendJSON, readJSON, clientIp, rateLimiter, HttpError } = require("./http");
const { D } = require("./data");
const env = require("./env");

const b64u = buf => Buffer.from(buf).toString("base64url");
const unb64u = s => Buffer.from(String(s), "base64url");

// ---------- Ключи VAPID ----------
const VAPID_FILE = path.join(env.STORAGE, "vapid.json");
function vapidKeys() {
  if (fs.existsSync(VAPID_FILE)) return JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const keys = {
    privateJwk: privateKey.export({ format: "jwk" }),
    publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]))   // несжатая точка, 65 байт
  };
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}
const VAPID = vapidKeys();
const vapidPrivate = crypto.createPrivateKey({ key: VAPID.privateJwk, format: "jwk" });

function vapidAuth(endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.PUBLIC_URL || "mailto:push@safar.local" }));
  const sig = crypto.sign("sha256", Buffer.from(header + "." + body), { key: vapidPrivate, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${body}.${b64u(sig)}, k=${VAPID.publicKey}`;
}

// ---------- Шифрование содержимого (RFC 8291) ----------
function encrypt(payload, p256dh, authSecret) {
  const uaPublic = unb64u(p256dh), auth = unb64u(authSecret);
  const ecdh = crypto.createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// Отправка одного уведомления. Подписка устарела (404/410) — удаляем
async function pushTo(sub, msg) {
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "43200", Urgency: "normal", Authorization: vapidAuth(sub.endpoint) },
      body: encrypt(JSON.stringify(msg), sub.p256dh, sub.auth),
      signal: AbortSignal.timeout(15000)
    });
    if (res.status === 404 || res.status === 410) db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(sub.endpoint);
    return res.ok;
  } catch (e) {
    console.error("push:", e.message);
    return false;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'ru',
    trip TEXT NOT NULL DEFAULT '{}',
    sent TEXT NOT NULL DEFAULT '{}',
    created INTEGER NOT NULL
  );
`);

// ---------- Тексты уведомлений (8 языков; узбекская кириллица — как латиница) ----------
const LANGS = ["uz", "ru", "en", "tr", "de", "zh", "ko"];
const TX = {
  test_t: ["Bildirishnomalar yoqildi", "Уведомления включены", "Notifications are on", "Bildirimler açık", "Benachrichtigungen an", "通知已开启", "알림이 켜졌습니다"],
  test_b: ["Safarga bir kun qolganda va har kuni ertalab ob-havo bilan eslatamiz", "Напомним за день до поездки и каждое утро — с погодой", "We’ll remind you the day before your trip and every morning with the weather", "Seyahatten bir gün önce ve her sabah hava durumuyla hatırlatacağız", "Wir erinnern Sie am Vortag und jeden Morgen mit dem Wetter", "出发前一天和每天早上会提醒您，并附天气", "여행 전날과 매일 아침 날씨와 함께 알려 드릴게요"],
  eve_t: ["Ertaga sayohat!", "Завтра поездка!", "Your trip starts tomorrow!", "Yarın seyahat!", "Morgen geht’s los!", "明天出发！", "내일 여행 시작!"],
  day_t: ["{n}-kun · {city}", "День {n} · {city}", "Day {n} · {city}", "{n}. gün · {city}", "Tag {n} · {city}", "第{n}天 · {city}", "{n}일차 · {city}"],
  day_b: ["Bugun {max}° / {min}°, {wx}. Yaxshi sayohat!", "Сегодня {max}° / {min}°, {wx}. Хорошей поездки!", "Today {max}° / {min}°, {wx}. Have a great day!", "Bugün {max}° / {min}°, {wx}. İyi yolculuklar!", "Heute {max}° / {min}°, {wx}. Gute Reise!", "今天 {max}° / {min}°，{wx}。旅途愉快！", "오늘 {max}° / {min}°, {wx}. 즐거운 여행 되세요!"],
  day_b0: ["Bugungi rejani ilovada ko‘ring", "План на сегодня — в приложении", "Today’s plan is in the app", "Bugünün planı uygulamada", "Der Tagesplan ist in der App", "今天的计划在应用中", "오늘 일정은 앱에서 확인하세요"],
  w_clear: ["ochiq", "ясно", "clear", "açık", "klar", "晴", "맑음"],
  w_partly: ["qisman bulutli", "переменная облачность", "partly cloudy", "parçalı bulutlu", "teils bewölkt", "多云", "구름 조금"],
  w_cloudy: ["bulutli", "облачно", "cloudy", "bulutlu", "bewölkt", "阴", "흐림"],
  w_fog: ["tuman", "туман", "fog", "sis", "Nebel", "雾", "안개"],
  w_rain: ["yomg‘ir", "дождь", "rain", "yağmur", "Regen", "雨", "비"],
  w_snow: ["qor", "снег", "snow", "kar", "Schnee", "雪", "눈"],
  w_storm: ["momaqaldiroq", "гроза", "thunderstorm", "fırtına", "Gewitter", "雷雨", "뇌우"]
};
const tx = (key, lang, vars = {}) => {
  let s = TX[key][Math.max(0, LANGS.indexOf(lang === "uzc" ? "uz" : lang))] || TX[key][2];
  for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
  return s;
};
const wxKey = c => c === 0 ? "w_clear" : c <= 2 ? "w_partly" : c === 3 ? "w_cloudy" : c <= 48 ? "w_fog" : c <= 67 || (c >= 80 && c <= 82) ? "w_rain" : c <= 86 ? "w_snow" : "w_storm";
const cityName = (id, lang) => { const c = D.CITY[id]; return c ? (c.n[lang === "uzc" ? "uz" : lang] || c.n.en || c.n.ru) : id; };

// ---------- Расписание ----------
const tashkentNow = () => {
  const d = new Date(Date.now() + 5 * 3600e3);   // UTC+5, без перехода на летнее время
  return { hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
};
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
// Город на каждый день поездки — так же, как в планировщике: по ночам в каждом городе
function tripDays(trip) {
  const out = [];
  for (const s of trip.stops || []) for (let i = 0; i < Math.max(1, +s.nights || 0); i++) out.push(s.id);
  if (trip.stops?.length) out.push(trip.stops[trip.stops.length - 1].id);   // день отъезда
  return out;
}
const weatherCache = new Map();
async function weatherFor(cityId, date) {
  const c = D.CITY[cityId];
  if (!c) return null;
  const key = cityId + date;
  if (!weatherCache.has(key)) {
    weatherCache.set(key, fetch(`https://api.open-meteo.com/v1/forecast?timezone=Asia%2FTashkent&forecast_days=3&latitude=${c.lat.toFixed(3)}&longitude=${c.lon.toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min`)
      .then(r => r.json()).then(j => {
        const i = j.daily.time.indexOf(date);
        return i < 0 ? null : { code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]) };
      }).catch(() => null));
  }
  return weatherCache.get(key);
}

async function tick() {
  const { hour, date } = tashkentNow();
  if (hour !== 19 && hour !== 8) return;
  if (weatherCache.size > 500) weatherCache.clear();
  for (const sub of db.prepare("SELECT * FROM push_subs").all()) {
    const trip = JSON.parse(sub.trip || "{}"), sent = JSON.parse(sub.sent || "{}");
    if (!trip.start || !trip.stops?.length) continue;
    const days = tripDays(trip);
    let msg = null, mark = null;
    if (hour === 19 && trip.start === addDays(date, 1) && !sent["eve:" + trip.start]) {
      mark = "eve:" + trip.start;
      msg = { title: tx("eve_t", sub.lang), body: trip.stops.map(s => cityName(s.id, sub.lang)).join(" → "), url: "/#budget", tag: "trip-eve" };
    }
    const n = Math.round((Date.parse(date) - Date.parse(trip.start)) / 864e5);
    if (hour === 8 && n >= 0 && n < days.length && !sent["day:" + date]) {
      mark = "day:" + date;
      const w = await weatherFor(days[n], date);
      msg = {
        title: tx("day_t", sub.lang, { n: n + 1, city: cityName(days[n], sub.lang) }),
        body: w ? tx("day_b", sub.lang, { max: w.max, min: w.min, wx: tx(wxKey(w.code), sub.lang) }) : tx("day_b0", sub.lang),
        url: "/#city/" + days[n], tag: "trip-day"
      };
    }
    if (!msg) continue;
    if (await pushTo(sub, msg)) {
      sent[mark] = Date.now();
      db.prepare("UPDATE push_subs SET sent = ? WHERE endpoint = ?").run(JSON.stringify(sent), sub.endpoint);
    }
  }
}

// ---------- API ----------
const limited = rateLimiter(15, 10 * 60e3);
function cleanTrip(t) {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(t?.start || "") ? t.start : null;
  const stops = (Array.isArray(t?.stops) ? t.stops : []).filter(s => D.CITY[s?.id]).slice(0, 30).map(s => ({ id: s.id, nights: Math.max(0, Math.min(60, Math.round(+s.nights) || 0)) }));
  return { start, stops };
}
function validSub(s) {
  try {
    const u = new URL(s.endpoint);
    return u.protocol === "https:" && unb64u(s.keys.p256dh).length === 65 && unb64u(s.keys.auth).length === 16;
  } catch { return false; }
}

const routes = [
  ["GET", "/api/push/key", (req, res) => sendJSON(req, res, 200, { key: VAPID.publicKey })],

  ["POST", "/api/push/subscribe", async (req, res) => {
    if (limited(clientIp(req))) throw new HttpError(429, "too many requests");
    const data = await readJSON(req);
    const s = data.subscription;
    if (!s || !validSub(s)) throw new HttpError(400, "invalid subscription");
    const lang = ["uz", "uzc", "ru", "en", "tr", "de", "zh", "ko"].includes(data.lang) ? data.lang : "ru";
    const trip = JSON.stringify(cleanTrip(data.trip));
    const exists = db.prepare("SELECT 1 FROM push_subs WHERE endpoint = ?").get(s.endpoint);
    db.prepare(`INSERT INTO push_subs (endpoint, p256dh, auth, lang, trip, created) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, trip = excluded.trip`)
      .run(s.endpoint, s.keys.p256dh, s.keys.auth, lang, trip, Date.now());
    // Первая подписка — сразу проверочное уведомление
    if (!exists && data.test) await pushTo({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { title: tx("test_t", lang), body: tx("test_b", lang), url: "/#budget", tag: "safar-test" });
    sendJSON(req, res, 200, { ok: true });
  }],

  ["POST", "/api/push/unsubscribe", async (req, res) => {
    const { endpoint } = await readJSON(req);
    db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(String(endpoint || ""));
    sendJSON(req, res, 200, { ok: true });
  }]
];

// Проверка расписания раз в 10 минут (уведомление уходит один раз: отметка в sent)
function onStart() { setInterval(() => tick().catch(e => console.error("push tick:", e.message)), 10 * 60e3).unref(); }

module.exports = { routes, onStart, encrypt, tripDays, tx, wxKey, cityName, weatherFor };
