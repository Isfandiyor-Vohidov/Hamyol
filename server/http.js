// Ответы, сжатие и разбор запросов
const zlib = require("node:zlib");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8"
};

function send(req, res, status, body, type, cache = "no-store", extra = {}) {
  const headers = {
    "Content-Type": type, "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
    // Встраивать страницы можно только самому Safar и Telegram (Mini App в веб-версии) — защита от кликджекинга
    "Content-Security-Policy": "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
    // Открыли по HTTPS (в том числе через ngrok или прокси) — браузер и дальше ходит только по HTTPS
    ...(req.headers["x-forwarded-proto"] === "https" || req.socket?.encrypted ? { "Strict-Transport-Security": "max-age=15552000" } : {}),
    ...extra
  };
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  // Уже сжатое (кэш статики) — отдаём как есть
  if (extra["Content-Encoding"]) { headers.Vary = "Accept-Encoding"; res.writeHead(status, headers); return res.end(buf); }
  if (buf.length > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "") && !/^image\/(png|jpeg|webp)/.test(type)) {
    headers["Content-Encoding"] = "gzip";
    headers["Vary"] = "Accept-Encoding";
    res.writeHead(status, headers);
    res.end(zlib.gzipSync(buf));
  } else {
    res.writeHead(status, headers);
    res.end(buf);
  }
}

const sendJSON = (req, res, status, data) => send(req, res, status, JSON.stringify(data), MIME[".json"]);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function readBody(req, limit = 20_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, "too large")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJSON(req, limit) {
  try { return JSON.parse(await readBody(req, limit) || "{}"); }
  catch (e) { throw e instanceof HttpError ? e : new HttpError(400, "bad json"); }
}

// IP клиента (за прокси — первый адрес из X-Forwarded-For, только если включено доверие прокси)
const clientIp = req => (process.env.TRUST_PROXY && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) ||
  req.socket.remoteAddress || "?";

// Ограничение частоты: не больше max событий за windowMs на ключ
function rateLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k); }, windowMs).unref();
  return key => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > max;
  };
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = { MIME, send, sendJSON, HttpError, readBody, readJSON, clientIp, rateLimiter, esc };
