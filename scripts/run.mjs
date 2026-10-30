// Safar на своём компьютере: запускает туннель (ngrok или Cloudflare) и сервер, следит за ними и перезапускает при падении.
// Запуск: start.bat (двойной щелчок), start-cloudflare.bat или  node scripts/run.mjs
//
// .env:
//   PORT=8000                          порт сервера
//   TUNNEL=ngrok | cloudflare          чем открывать сервер в интернет (по умолчанию ngrok)
//   NGROK_DOMAIN=имя.ngrok-free.app    постоянный бесплатный адрес из кабинета ngrok (Domains) — тогда адрес
//                                      не меняется после перезапуска, и Android-приложение (APK) не нужно пересобирать
//   CF_TUNNEL_TOKEN=…                  Cloudflare: токен именованного туннеля (Zero Trust → Networks → Tunnels) —
//   CF_HOSTNAME=hamyol.uz              и его адрес. Без токена — быстрый туннель *.trycloudflare.com (бесплатно,
//                                      без регистрации и без лимита трафика, но адрес новый при каждом запуске)
//   CLOUDFLARED=C:\…\cloudflared.exe   путь к cloudflared, если его нет в PATH
// Журналы: storage/logs/server.log и storage/logs/ngrok.log или cloudflared.log
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries((existsSync(join(ROOT, ".env")) ? readFileSync(join(ROOT, ".env"), "utf8") : "")
  .split(/\r?\n/).map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const PORT = env.PORT || "3000";
const TUNNEL = /^c(loud)?f/i.test(process.env.TUNNEL || env.TUNNEL || "") ? "cloudflare" : "ngrok";
const host = s => (s || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const DOMAIN = TUNNEL === "ngrok" ? host(env.NGROK_DOMAIN) : env.CF_TUNNEL_TOKEN ? host(env.CF_HOSTNAME) : "";
const LOGS = join(ROOT, "storage", "logs");
mkdirSync(LOGS, { recursive: true });

const stamp = () => new Date().toLocaleString("ru-RU");
const say = msg => console.log(`[${stamp()}] ${msg}`);

// Процесс, который перезапускается при падении: пауза растёт до минуты, после часа стабильной работы — сбрасывается.
// opts может быть функцией — тогда настройки (например, адрес сайта) берутся заново при каждом запуске
function keepAlive(name, cmd, args, opts = {}, onOut = null) {
  const log = createWriteStream(join(LOGS, name + ".log"), { flags: "a" });
  let delay = 2000, startedAt = 0, child = null, stopping = false;
  const start = () => {
    startedAt = Date.now();
    say(`${name}: запускаю`);
    log.write(`\n===== ${stamp()} запуск =====\n`);
    child = spawn(cmd, args, { cwd: ROOT, windowsHide: true, ...(typeof opts === "function" ? opts() : opts) });
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    if (onOut) { child.stdout?.on("data", d => onOut(String(d))); child.stderr?.on("data", d => onOut(String(d))); }
    child.on("error", e => say(`${name}: не удалось запустить (${e.message})` +
      (e.code === "ENOENT" && name === "cloudflared" ? ". Установите: winget install --id Cloudflare.cloudflared — и откройте окно заново" : "")));
    child.on("exit", code => {
      if (stopping) return;
      if (Date.now() - startedAt > 3600e3) delay = 2000;
      say(`${name}: остановился (код ${code}), перезапуск через ${Math.round(delay / 1000)} с`);
      setTimeout(start, delay);
      delay = Math.min(delay * 2, 60000);
    });
  };
  start();
  return { stop() { stopping = true; child?.kill(); }, restart() { delay = 1000; child?.kill(); } };
}

// cloudflared после установки через winget появляется в PATH только в новых окнах — ищем и в обычных местах
function cloudflaredPath() {
  if (env.CLOUDFLARED && existsSync(env.CLOUDFLARED)) return env.CLOUDFLARED;
  const pf86 = process.env["ProgramFiles(x86)"], pf = process.env.ProgramFiles, la = process.env.LOCALAPPDATA;
  const known = [pf86 && join(pf86, "cloudflared", "cloudflared.exe"), pf && join(pf, "cloudflared", "cloudflared.exe"),
    la && join(la, "Microsoft", "WinGet", "Links", "cloudflared.exe")].filter(Boolean);
  return known.find(p => existsSync(p)) || "cloudflared";
}

// Адрес туннеля ngrok — из его локального API
async function ngrokUrl(tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const j = await (await fetch("http://127.0.0.1:4040/api/tunnels")).json();
      const t = j.tunnels.find(x => x.public_url.startsWith("https://"));
      if (t) return t.public_url;
    } catch { /* ngrok ещё запускается */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

let url = DOMAIN ? `https://${DOMAIN}` : null, server = null, tunnel;
// Быстрый туннель Cloudflare печатает свой адрес в журнал; после перезапуска адрес новый — сервер перезапускаем с ним
let cfFound = null;
const cfReady = new Promise(r => { cfFound = r; });
const cfOut = text => {
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!m || m[0] === url) return;
  const first = !url;
  url = m[0];
  writeFileSync(join(LOGS, "last-url.txt"), url + "\n");
  if (first && !server) return cfFound(url);
  say(first ? `Публичный адрес: ${url}` : `Адрес Cloudflare сменился: ${url}. Ссылки и APK со старым адресом работать не будут.`);
  server?.restart();
};

if (TUNNEL === "cloudflare") {
  say(`Safar: порт ${PORT}, туннель Cloudflare${DOMAIN ? ", постоянный адрес " + DOMAIN : " (быстрый: адрес *.trycloudflare.com меняется при каждом запуске)"}`);
  const args = env.CF_TUNNEL_TOKEN
    ? ["tunnel", "--no-autoupdate", "run", "--token", env.CF_TUNNEL_TOKEN]
    : ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`];
  tunnel = keepAlive("cloudflared", cloudflaredPath(), args, {}, DOMAIN ? null : cfOut);
  if (!DOMAIN) url = await Promise.race([cfReady, new Promise(r => setTimeout(() => r(null), 45000))]);
} else {
  say(`Safar: порт ${PORT}, туннель ngrok${DOMAIN ? ", постоянный адрес " + DOMAIN : ", адрес временный (задайте NGROK_DOMAIN в .env)"}`);
  tunnel = keepAlive("ngrok", "ngrok", ["http", ...(DOMAIN ? [`--url=${DOMAIN}`] : []), PORT, "--log=stdout"]);
  if (!DOMAIN) url = await ngrokUrl();
}
if (url) say(`Публичный адрес: ${url}`);
else say(`Не удалось узнать адрес туннеля — смотрите storage/logs/${TUNNEL === "cloudflare" ? "cloudflared" : "ngrok"}.log`);

// Сервер получает публичный адрес (ссылки в Telegram, sitemap, Mini App)
server = keepAlive("server", process.execPath, ["server.js"], () => ({ env: { ...process.env, PORT, ...(url ? { PUBLIC_URL: url } : {}) } }));

// APK собран под конкретный адрес: если адрес сменился, напоминаем пересобрать
const twa = join(ROOT, "android", "twa", "twa-manifest.json");
if (url && existsSync(twa)) {
  const apkHost = JSON.parse(readFileSync(twa, "utf8")).host;
  if (apkHost && apkHost !== new URL(url).host) say(`Внимание: APK собран под ${apkHost}, а сейчас адрес ${new URL(url).host}. Пересоберите: npm run android -- --url ${url}`);
}
writeFileSync(join(LOGS, "last-url.txt"), (url || "") + "\n");

// Пока туннель ngrok временный — следим, не сменился ли адрес после перезапуска ngrok
if (TUNNEL === "ngrok" && !DOMAIN) setInterval(async () => {
  const now = await ngrokUrl(1);
  if (now && url && now !== url) say(`Адрес ngrok сменился: ${now}. Ссылки и APK со старым адресом работать не будут.`);
}, 5 * 60e3);

const shutdown = () => { say("Останавливаю…"); server.stop(); tunnel.stop(); setTimeout(() => process.exit(0), 500); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
say("Работает. Окно можно свернуть; чтобы остановить — Ctrl+C или закройте окно.");
