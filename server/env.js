// Настройки из переменных окружения и файла .env (без зависимостей).
// Формат .env: KEY=VALUE, строки с # — комментарии. Переменные окружения важнее .env.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
} catch { /* .env нет — работаем на переменных окружения */ }

const env = process.env;
module.exports = {
  ROOT,
  STORAGE: env.SAFAR_STORAGE ? path.resolve(env.SAFAR_STORAGE) : path.join(ROOT, "storage"),   // другая папка — для тестов
  PORT: +env.PORT || 3000,
  PUBLIC_URL: (env.PUBLIC_URL || "").replace(/\/+$/, ""),   // https://safar.uz — для ссылок, sitemap и Telegram
  TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_BOT: (env.TELEGRAM_BOT || "").replace(/^@/, ""),
  SOS_LIVE: env.SOS_LIVE === "1",                            // 1 — кнопки «Экстренная помощь» звонят по-настоящему (по умолчанию тест)
  GOOGLE_CLIENT_ID: /^[\w-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID || "") ? env.GOOGLE_CLIENT_ID : "",   // вход через Google (бесплатно)
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || "",
  AI_MODEL: env.AI_MODEL || "",
  AI_DAILY_LIMIT: +env.AI_DAILY_LIMIT || 30,                  // сообщений ИИ-гиду в день на пользователя / IP
  BOOKING_AID: env.BOOKING_AID || "",                         // партнёрский id Booking.com
  ADMIN_ENABLED: env.ADMIN_ENABLED === "1",                   // админка выключена, пока не ADMIN_ENABLED=1
  ADMIN_TOKEN: env.ADMIN_TOKEN || "",
  ADMIN_TG_IDS: env.ADMIN_TG_IDS || "",
  ESIM_URL: env.ESIM_URL || "",                              // партнёрская ссылка на eSIM (пусто — кнопки нет)
  INSURANCE_URL: env.INSURANCE_URL || "",                    // партнёрская ссылка на страховку
  OPERATOR: env.OPERATOR || "",                               // кто оператор персональных данных (для политики конфиденциальности)
  CONTACT: env.CONTACT || ""                                  // почта или ссылка для связи (по умолчанию — Telegram-бот)                        // Telegram ID администраторов через запятую (узнать: /myid в боте)
};
