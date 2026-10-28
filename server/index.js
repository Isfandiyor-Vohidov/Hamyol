// Сервер Safar: приложение, SEO-страницы, API. Без внешних зависимостей (Node.js 22.13+).
const http = require("node:http");
const zlib = require("node:zlib");
const fsp = require("node:fs/promises");
const path = require("node:path");
const env = require("./env");
const { MIME, send, sendJSON } = require("./http");
const seo = require("./seo");

// Модули API: каждый экспортирует routes = [[метод, путь | RegExp, обработчик], …]
const MODULES = ["./reviews", "./config", "./track", "./telegram", "./me", "./ai", "./market", "./business", "./admin", "./android", "./prices", "./push", "./legal", "./reports", "./health", "./botremind", "./tickets", "./feedback", "./qa", "./crowd", "./together", "./stats", "./google", "./mecca", "./az"];
const ROUTES = [];
for (const m of MODULES) {
  try { ROUTES.push(...require(m).routes); }
  catch (e) { if (e.code !== "MODULE_NOT_FOUND" || !e.message.includes(m.slice(2))) throw e; }
}

// Отдаём наружу только файлы приложения (не .env, не storage, не исходники сервера)
const PUBLIC = [/^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/(css|js|data|icons)\/[\w.-]+$/];

// Сжатые копии файлов: сжимаем один раз на версию файла и держим в памяти.
// Brotli плотнее gzip (~25%), но медленный — готовим его в фоне, пока отдаём gzip.
const COMPRESSED = new Map();
const COMPRESSIBLE = /\.(js|css|html|json|svg|webmanifest|txt|xml)$/;
function compressedCopy(file, etag, buf) {
  let c = COMPRESSED.get(file);
  if (!c || c.etag !== etag) {
    c = { etag, gz: zlib.gzipSync(buf, { level: 9 }), br: null };
    COMPRESSED.set(file, c);
    zlib.brotliCompress(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } },
      (err, out) => { if (!err && COMPRESSED.get(file) === c) c.br = out; });
  }
  return c;
}

async function staticFile(req, res, url) {
  const p = decodeURIComponent(url.pathname);
  if (!PUBLIC.some(re => re.test(p))) return send(req, res, 404, "Not found", MIME[".txt"]);
  const file = path.join(env.ROOT, p);
  if (!file.startsWith(env.ROOT + path.sep)) return send(req, res, 403, "Forbidden", MIME[".txt"]);
  try {
    const st = await fsp.stat(file);
    // ETag: браузер переспрашивает, но скачивает файл заново только если он изменился
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, { ETag: etag, "Cache-Control": "no-cache" }); return res.end(); }
    const buf = await fsp.readFile(file), type = MIME[path.extname(file)] || "application/octet-stream";
    const accept = req.headers["accept-encoding"] || "";
    if (buf.length > 1024 && COMPRESSIBLE.test(file) && /\b(br|gzip)\b/.test(accept)) {
      const c = compressedCopy(file, etag, buf);
      const useBr = c.br && /\bbr\b/.test(accept);
      if (useBr || /\bgzip\b/.test(accept)) return send(req, res, 200, useBr ? c.br : c.gz, type, "no-cache", { ETag: etag, "Content-Encoding": useBr ? "br" : "gzip" });
    }
    send(req, res, 200, buf, type, "no-cache", { ETag: etag });
  } catch {
    send(req, res, 404, "Not found", MIME[".txt"]);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    for (const [method, pattern, handler] of ROUTES) {
      if (req.method !== method) continue;
      const match = typeof pattern === "string" ? (url.pathname === pattern ? [] : null) : url.pathname.match(pattern);
      if (match) return await handler(req, res, url, match);
    }
    if (url.pathname.startsWith("/api/")) return sendJSON(req, res, 404, { error: "not found" });
    if (req.method === "GET" && seo.handle(req, res, url)) return;
    if (req.method !== "GET" && req.method !== "HEAD") return sendJSON(req, res, 405, { error: "method not allowed" });
    await staticFile(req, res, url);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) sendJSON(req, res, status, { error: status === 500 ? "server error" : e.message });
  }
});

server.listen(env.PORT, () => {
  console.log(`Hamyol: http://localhost:${env.PORT}${env.PUBLIC_URL ? "  (публичный адрес: " + env.PUBLIC_URL + ")" : ""}`);
  for (const m of MODULES) {
    let mod = null;
    try { mod = require(m); } catch { continue; }
    mod.onStart?.();
  }
});
