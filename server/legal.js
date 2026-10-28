// Публичные страницы документов: /privacy и /terms (?lang=ru|uz|en|…). Нужны, например, для Google Play.
// Тексты — js/legal-data.js (общий с приложением). Оператор и контакт — OPERATOR и CONTACT в .env.
const env = require("./env");
const { send, esc } = require("./http");
const { LEGAL, LEGAL_UPDATED, legalLang } = require("../js/legal-data.js");

const DEFAULT_OPERATOR = { ru: "владелец сервиса Hamyol", uz: "Hamyol xizmati egasi", en: "the owner of the Hamyol service" };
// Контакт: адрес почты, ссылка или по умолчанию — Telegram-бот
function contactHtml(lang) {
  const c = env.CONTACT || (env.TELEGRAM_BOT ? `https://t.me/${env.TELEGRAM_BOT}` : "");
  if (!c) return { ru: "через раздел «Аккаунт» в приложении", uz: "ilovadagi «Akkaunt» bo‘limi orqali", en: "via the Account section in the app" }[lang];
  const href = /^https?:\/\//.test(c) ? c : /@/.test(c) ? "mailto:" + c : "";
  return href ? `<a href="${esc(href)}">${esc(c.replace(/^mailto:/, ""))}</a>` : esc(c);
}
const fill = (s, lang) => s.replaceAll("{operator}", esc(env.OPERATOR || DEFAULT_OPERATOR[lang])).replaceAll("{contact}", contactHtml(lang));

function page(kind, req, res, url) {
  const want = url.searchParams.get("lang") || (req.headers["accept-language"] || "ru").slice(0, 2);
  const lang = legalLang(want);
  const doc = LEGAL[kind][lang];
  const other = kind === "privacy" ? "terms" : "privacy";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — Hamyol</title><link rel="icon" href="/icons/icon.svg">
<style>body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;color:#18202e;background:#f7f2e9}
main{max-width:760px;margin:0 auto;padding:28px 18px 60px}h1{font-size:30px;margin:0 0 6px}h2{font-size:19px;margin:26px 0 6px}
a{color:#11798b}.top{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;margin-bottom:18px}.upd{color:#5f6b7d;font-size:14px}
ul{padding-left:20px}li{margin:6px 0}@media(prefers-color-scheme:dark){body{background:#0a1424;color:#e8eef8}a{color:#5ad6e4}.upd{color:#9aaac3}}</style></head>
<body><main><div class="top"><a href="/">Hamyol</a>${["ru", "uz", "en"].map(l => l === lang ? `<b>${l.toUpperCase()}</b>` : `<a href="/${kind}?lang=${l}">${l.toUpperCase()}</a>`).join("")}<a href="/${other}?lang=${lang}">${esc(LEGAL[other][lang].title)}</a></div>
<h1>${esc(doc.title)}</h1><p class="upd">${{ ru: "Обновлено", uz: "Yangilangan", en: "Updated" }[lang]}: ${LEGAL_UPDATED}</p>
${doc.sections.map(([h, body]) => `<h2>${esc(h)}</h2>${body.startsWith("<") ? fill(body, lang) : `<p>${fill(body, lang)}</p>`}`).join("\n")}
</main></body></html>`;
  send(req, res, 200, html, "text/html; charset=utf-8", "public, max-age=3600");
}

const routes = [
  ["GET", "/privacy", (req, res, url) => page("privacy", req, res, url)],
  ["GET", "/terms", (req, res, url) => page("terms", req, res, url)]
];

module.exports = { routes };
