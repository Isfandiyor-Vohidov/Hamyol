// Safar на своём компьютере: запускает туннель ngrok и сервер, следит за ними и перезапускает при падении.
// Запуск: start.bat (двойной щелчок) или  node scripts/run.mjs
//
// .env:
//   PORT=8000                          порт сервера
//   NGROK_DOMAIN=имя.ngrok-free.app    постоянный бесплатный адрес из кабинета ngrok (Domains) — тогда адрес
//                                      не меняется после перезапуска, и Android-приложение (APK) не нужно пересобирать
// Журналы: storage/logs/server.log и storage/logs/ngrok.log
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries((existsSync(join(ROOT, ".env")) ? readFileSync(join(ROOT, ".env"), "utf8") : "")
  .split(/\r?\n/).map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]));
const PORT = env.PORT || "3000";
const DOMAIN = (env.NGROK_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const LOGS = join(ROOT, "storage", "logs");
mkdirSync(LOGS, { recursive: true });

const stamp = () => new Date().toLocaleString("ru-RU");
const say = msg => console.log(`[${stamp()}] ${msg}`);

// Процесс, который перезапускается при падении: пауза растёт до минуты, после часа стабильной работы — сбрасывается
function keepAlive(name, cmd, args, opts = {}) {
  const log = createWriteStream(join(LOGS, name + ".log"), { flags: "a" });
  let delay = 2000, startedAt = 0, child = null, stopping = false;
  const start = () => {
    startedAt = Date.now();
    say(`${name}: запускаю`);
    log.write(`\n===== ${stamp()} запуск =====\n`);
    child = spawn(cmd, args, { cwd: ROOT, windowsHide: true, ...opts });
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    child.on("error", e => say(`${name}: не удалось запустить (${e.message})`));
    child.on("exit", code => {
      if (stopping) return;
      if (Date.now() - startedAt > 3600e3) delay = 2000;
      say(`${name}: остановился (код ${code}), перезапуск через ${Math.round(delay / 1000)} с`);
      setTimeout(start, delay);
      delay = Math.min(delay * 2, 60000);
    });
  };
  start();
  return { stop() { stopping = true; child?.kill(); } };
}

// Адрес туннеля — из локального API ngrok
async function tunnelUrl(tries = 30) {
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

say(`Safar: порт ${PORT}${DOMAIN ? ", постоянный адрес " + DOMAIN : ", адрес ngrok временный (задайте NGROK_DOMAIN в .env)"}`);
const ngrok = keepAlive("ngrok", "ngrok", ["http", ...(DOMAIN ? [`--url=${DOMAIN}`] : []), PORT, "--log=stdout"]);
const url = DOMAIN ? `https://${DOMAIN}` : await tunnelUrl();
if (url) say(`Публичный адрес: ${url}`);
else say("Не удалось узнать адрес ngrok — смотрите storage/logs/ngrok.log");

// Сервер получает публичный адрес (ссылки в Telegram, sitemap, Mini App)
const server = keepAlive("server", process.execPath, ["server.js"], { env: { ...process.env, PORT, ...(url ? { PUBLIC_URL: url } : {}) } });

// APK собран под конкретный адрес: если адрес сменился, напоминаем пересобрать
const twa = join(ROOT, "android", "twa", "twa-manifest.json");
if (url && existsSync(twa)) {
  const host = JSON.parse(readFileSync(twa, "utf8")).host;
  if (host && host !== new URL(url).host) say(`Внимание: APK собран под ${host}, а сейчас адрес ${new URL(url).host}. Пересоберите: npm run android -- --url ${url}`);
}
writeFileSync(join(LOGS, "last-url.txt"), (url || "") + "\n");

// Пока туннель временный — следим, не сменился ли адрес после перезапуска ngrok
if (!DOMAIN) setInterval(async () => {
  const now = await tunnelUrl(1);
  if (now && url && now !== url) say(`Адрес ngrok сменился: ${now}. Ссылки и APK со старым адресом работать не будут.`);
}, 5 * 60e3);

const shutdown = () => { say("Останавливаю…"); server.stop(); ngrok.stop(); setTimeout(() => process.exit(0), 500); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
say("Работает. Окно можно свернуть; чтобы остановить — Ctrl+C или закройте окно.");
