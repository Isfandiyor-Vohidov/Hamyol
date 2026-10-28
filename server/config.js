// Какие возможности включены на сервере — приложение показывает только их
const env = require("./env");
const { sendJSON } = require("./http");
const { apkInfo } = require("./android");

const routes = [
  ["GET", "/api/config", (req, res) => sendJSON(req, res, 200, {
    telegramBot: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT ? env.TELEGRAM_BOT : null,
    googleClientId: env.GOOGLE_CLIENT_ID || null,
    sosLive: env.SOS_LIVE,
    ai: !!env.ANTHROPIC_API_KEY,
    bookingAid: env.BOOKING_AID || null,
    publicUrl: env.PUBLIC_URL || null,
    apk: apkInfo(),
    admin: env.ADMIN_ENABLED,
    esimUrl: /^https:\/\//.test(env.ESIM_URL) ? env.ESIM_URL : null,
    insuranceUrl: /^https:\/\//.test(env.INSURANCE_URL) ? env.INSURANCE_URL : null,
    operator: env.OPERATOR || null,
    contact: env.CONTACT || (env.TELEGRAM_BOT ? "https://t.me/" + env.TELEGRAM_BOT : null)
  })]
];

module.exports = { routes };
