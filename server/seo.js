// Страницы для поисковиков: /, /city/<id>, /place/<id>, /sitemap.xml, /robots.txt.
// Это та же index.html, но с заголовком, описанием, микроразметкой schema.org и текстом страницы.
// Браузер сразу запускает приложение (js/app.js убирает текстовый блок #seo и переходит на #city/<id>).
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, PUBLIC_URL } = require("./env");
const { send, MIME, esc } = require("./http");
const { D, t, cityName, poiName, regionName, typeLabel, km, score, commonsImg, lang3 } = require("./data");
const { db } = require("./db");

let tpl = null, tplMtime = 0;
function template() {
  const file = path.join(ROOT, "index.html");
  const m = fs.statSync(file).mtimeMs;
  if (!tpl || m !== tplMtime) { tpl = fs.readFileSync(file, "utf8"); tplMtime = m; }
  return tpl;
}

const baseUrl = req => PUBLIC_URL ||
  `${(process.env.TRUST_PROXY && req.headers["x-forwarded-proto"]) || "http"}://${req.headers.host || "localhost"}`;
const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

function page(req, { lang, title, desc, pathName, image, ld, body }) {
  const base = baseUrl(req);
  const url = base + pathName + (lang !== "ru" ? `?lang=${lang}` : "");
  const alt = ["ru", "uz", "en"].map(l => `<link rel="alternate" hreflang="${l}" href="${base}${pathName}${l !== "ru" ? "?lang=" + l : ""}">`).join("\n  ");
  const head = `
  <link rel="canonical" href="${esc(url)}">
  ${alt}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Hamyol">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(url)}">
  ${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  ${ld ? jsonLd(ld) : ""}
`;
  let html = template()
    .replace(/<html lang="[^"]*">/, () => `<html lang="${lang}">`)
    .replace("<head>", () => `<head>\n  <base href="/">`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(desc)}">`)
    .replace("</head>", () => head + "</head>")
    .replace("<body>", () => `<body>\n  <article id="seo" class="seo">${body}</article>`);
  send(req, res_(req), 200, html, MIME[".html"], "no-cache");
}
// res хранится на req, чтобы не тянуть его через все функции
const res_ = req => req._res;

const link = (lang, href, text) => `<a href="${href}${lang !== "ru" ? "?lang=" + lang : ""}">${esc(text)}</a>`;
const list = (title, items) => items.length ? `<h2>${esc(title)}</h2><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>` : "";

function rating(key) {
  const r = db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS avg FROM reviews WHERE key = ? AND hidden = 0").get(key);
  return r.n ? { "@type": "AggregateRating", ratingValue: +r.avg.toFixed(1), reviewCount: r.n, bestRating: 5, worstRating: 1 } : null;
}

// ---------- Главная ----------
function home(req, lang) {
  const sam = D.CITY.samarkand;
  const top = [...D.CITIES].sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, 40);
  page(req, {
    lang, pathName: "/",
    title: `Hamyol — ${t(lang, "tagline")}`,
    desc: t(lang, "hero_sub"),
    image: commonsImg(sam?.img),
    ld: { "@context": "https://schema.org", "@type": "WebSite", name: "Hamyol", url: baseUrl(req) + "/", inLanguage: lang },
    body: `<h1>Hamyol — ${esc(t(lang, "tagline"))}</h1><p>${esc(t(lang, "hero_sub"))}</p>` +
      list(t(lang, "nav_cities"), top.map(c => link(lang, `/city/${c.id}`, cityName(lang, c))))
  });
}

// ---------- Город ----------
function city(req, lang, c) {
  const story = D.CITY_STORIES[c.n.ru]?.d[{ uz: 0, ru: 1, en: 2 }[lang]];
  const name = cityName(lang, c), region = regionName(lang, c.r);
  const desc = t(lang, "seo_city_desc", { name, region, h: c.counts.h, a: c.counts.a, s: c.counts.s, f: c.counts.f });
  const pois = D.POIS.filter(p => p.city === c);
  const top = (cat, n) => pois.filter(p => p.c === cat).sort((a, b) => score(b) - score(a) || (b.st || 0) - (a.st || 0)).slice(0, n)
    .map(p => link(lang, `/place/${p.id}`, poiName(lang, p)) + ` — ${esc(typeLabel(lang, p.s))}`);
  const near = D.CITIES.filter(x => x !== c).sort((a, b) => km(c, a) - km(c, b)).slice(0, 6)
    .map(x => link(lang, `/city/${x.id}`, cityName(lang, x)));
  page(req, {
    lang, pathName: `/city/${c.id}`,
    title: t(lang, "seo_city_title", { name }),
    desc: story ? `${story} ${desc}` : desc,
    image: commonsImg(c.img),
    ld: {
      "@context": "https://schema.org", "@type": "City", name, description: story || desc,
      ...(c.img ? { image: commonsImg(c.img) } : {}),
      geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lon },
      containedInPlace: { "@type": "AdministrativeArea", name: region },
      ...(c.wd ? { sameAs: `https://www.wikidata.org/wiki/${c.wd}` } : {}),
      ...(rating("city:" + c.id) ? { aggregateRating: rating("city:" + c.id) } : {})
    },
    body: `<h1>${esc(name)}</h1><p>${esc(region)}${c.pop ? " · " + c.pop.toLocaleString("ru-RU") : ""}</p>
      ${story ? `<p>${esc(story)}</p>` : ""}<p>${esc(desc)}</p>` +
      list(t(lang, "cat_a"), top("a", 12)) + list(t(lang, "cat_h"), top("h", 12)) +
      list(t(lang, "cat_s"), top("s", 6)) + list(t(lang, "cat_f"), top("f", 8)) +
      list(t(lang, "seo_nearby_cities"), near)
  });
}

// ---------- Место ----------
const SCHEMA_TYPE = {
  hotel: "Hotel", hostel: "Hostel", guest_house: "BedAndBreakfast", motel: "Motel", apartment: "LodgingBusiness",
  museum: "Museum", gallery: "Museum", zoo: "Zoo", theme_park: "AmusementPark",
  marketplace: "Store", mall: "ShoppingCenter", restaurant: "Restaurant", cafe: "CafeOrCoffeeShop"
};
function place(req, lang, p) {
  const name = poiName(lang, p), type = typeLabel(lang, p.s), cname = cityName(lang, p.city);
  const desc = (p.de ? p.de + " " : "") + t(lang, "seo_place_desc", { name, type, city: cname });
  const near = D.POIS.filter(x => x !== p && x.c === p.c && x.city === p.city).sort((a, b) => km(p, a) - km(p, b)).slice(0, 6)
    .map(x => link(lang, `/place/${x.id}`, poiName(lang, x)));
  const web = /^https?:\/\//.test(p.w || "") ? p.w : "";
  const r = rating("poi:" + p.id);
  page(req, {
    lang, pathName: `/place/${p.id}`,
    title: t(lang, "seo_place_title", { name, type, city: cname }),
    desc,
    image: commonsImg(p.im),
    ld: {
      "@context": "https://schema.org",
      "@type": SCHEMA_TYPE[p.s] || (p.c === "h" ? "LodgingBusiness" : p.c === "s" ? "Store" : p.c === "f" ? "FoodEstablishment" : "TouristAttraction"),
      name, description: desc,
      ...(p.im ? { image: commonsImg(p.im) } : {}),
      geo: { "@type": "GeoCoordinates", latitude: p.la, longitude: p.lo },
      address: { "@type": "PostalAddress", ...(p.ad ? { streetAddress: p.ad } : {}), addressLocality: cname, addressCountry: "UZ" },
      ...(p.ph ? { telephone: p.ph } : {}), ...(web ? { url: web } : {}),
      ...(p.oh && p.oh !== "24/7" ? { openingHours: p.oh } : {}),
      ...(p.cu ? { servesCuisine: p.cu } : {}),
      ...(p.st ? { starRating: { "@type": "Rating", ratingValue: p.st } } : {}),
      ...(r ? { aggregateRating: r } : {})
    },
    body: `<h1>${esc(name)}</h1><p>${esc(type)} · ${link(lang, `/city/${p.city.id}`, cname)}</p>
      ${p.ad ? `<p>${esc(t(lang, "address"))}: ${esc(p.ad)}</p>` : ""}
      ${p.ph ? `<p>${esc(t(lang, "phone"))}: ${esc(p.ph)}</p>` : ""}
      ${p.oh ? `<p>${esc(t(lang, "hours"))}: ${esc(p.oh)}</p>` : ""}
      <p>${esc(desc)}</p>` + list(t(lang, "seo_nearby"), near)
  });
}

// ---------- sitemap.xml и robots.txt ----------
let sitemapCache = { key: "", xml: "" };
function sitemap(req, res) {
  const base = baseUrl(req);
  if (sitemapCache.key !== base + D.updated) {
    const day = (D.updated || new Date().toISOString()).slice(0, 10);
    const url = p => `<url><loc>${base}${p}</loc><lastmod>${day}</lastmod></url>`;
    sitemapCache = {
      key: base + D.updated,
      xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        [url("/"), ...D.CITIES.map(c => url(`/city/${c.id}`)), ...D.POIS.map(p => url(`/place/${p.id}`))].join("\n") + "\n</urlset>\n"
    };
  }
  send(req, res, 200, sitemapCache.xml, MIME[".xml"], "public, max-age=3600");
}
function robots(req, res) {
  send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${baseUrl(req)}/sitemap.xml\n`, MIME[".txt"], "public, max-age=3600");
}

// Возвращает true, если запрос обработан
function handle(req, res, url) {
  req._res = res;
  const lang = lang3(url.searchParams.get("lang") || "ru");
  if (url.pathname === "/" || url.pathname === "/index.html") { home(req, lang); return true; }
  if (url.pathname === "/sitemap.xml") { sitemap(req, res); return true; }
  if (url.pathname === "/robots.txt") { robots(req, res); return true; }
  let m = url.pathname.match(/^\/city\/([\w-]+)\/?$/);
  if (m && D.CITY[m[1]]) { city(req, lang, D.CITY[m[1]]); return true; }
  m = url.pathname.match(/^\/place\/([nwr]\d+)\/?$/);
  if (m && D.POI[m[1]]) { place(req, lang, D.POI[m[1]]); return true; }
  return false;
}

module.exports = { handle, baseUrl };
