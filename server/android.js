// Android-приложение: раздача APK и связь сайта с приложением (Digital Asset Links).
// APK собирается командой `npm run android` (scripts/build-android.mjs) и лежит в android/safar.apk.
// Ключ подписи (android/*.keystore) наружу не отдаётся — сервер отдаёт только два файла ниже.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const env = require("./env");
const { send, sendJSON, MIME } = require("./http");

const DIR = path.join(env.ROOT, "android");
const APK = path.join(DIR, "safar.apk");
const LINKS = path.join(DIR, "assetlinks.json");

// Есть ли APK и какой он: для кнопки «Скачать приложение»
function apkInfo() {
  try {
    const st = fs.statSync(APK);
    return { size: st.size, updated: st.mtime.toISOString() };
  } catch { return null; }
}

async function download(req, res) {
  const info = apkInfo();
  if (!info) return sendJSON(req, res, 404, { error: "apk not built" });
  res.writeHead(200, {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="Hamyol.apk"',
    "Content-Length": info.size,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(APK).pipe(res);
}

// Подтверждение, что приложение с этим ключом подписи — от этого сайта: тогда оно открывается без адресной строки
async function assetLinks(req, res) {
  try {
    send(req, res, 200, await fsp.readFile(LINKS), MIME[".json"], "public, max-age=3600");
  } catch {
    sendJSON(req, res, 200, []);
  }
}

const routes = [
  ["GET", "/download/safar.apk", download],
  ["HEAD", "/download/safar.apk", download],
  ["GET", "/.well-known/assetlinks.json", assetLinks]
];

module.exports = { routes, apkInfo };
