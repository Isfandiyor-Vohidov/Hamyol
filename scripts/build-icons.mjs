// Сборка набора иконок Safar: Lucide (https://lucide.dev, лицензия ISC) + собственные узбекские мотивы.
// Запуск: node scripts/build-icons.mjs   →   js/icons.js
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LUCIDE = "https://cdn.jsdelivr.net/npm/lucide-static@0.460.0/icon-nodes.json";

// Имя в приложении → имя в Lucide
const MAP = {
  // интерфейс
  home: "house", city: "building-2", hotel: "hotel", map: "map", route: "route", search: "search", heart: "heart",
  user: "user-round", users: "users", sun: "sun", moon: "moon", star: "star", pin: "map-pin", clock: "clock", phone: "phone",
  globe: "globe", directions: "navigation", compass: "compass", share: "share-2", copy: "copy", print: "printer",
  calendar: "calendar-days", "calendar-plus": "calendar-plus", "calendar-check": "calendar-check", "calendar-range": "calendar-range",
  plus: "plus", minus: "minus", x: "x", check: "check", "chevron-right": "chevron-right", "chevron-down": "chevron-down", "chevron-up": "chevron-up",
  "chevron-left": "chevron-left", "arrow-right": "arrow-right", "arrow-left": "arrow-left", "arrow-down": "arrow-down", "arrow-up": "arrow-up", "arrow-up-right": "arrow-up-right",
  menu: "menu", "turn-left": "corner-up-left", "turn-right": "corner-up-right", "slight-left": "arrow-up-left", "slight-right": "arrow-up-right", uturn: "undo-2", roundabout: "rotate-cw", "volume-off": "volume-x", "nav-arrow": "navigation-2", crosshair: "crosshair", "text-size": "a-large-small", android: "smartphone", "file-down": "file-down", "ios-share": "share", "square-plus": "square-plus", tg: "send", flag: "flag", "user-check": "user-check", more: "ellipsis", refresh: "refresh-cw", list: "list", grid: "layout-grid", maximize: "maximize-2", send: "send-horizontal", sparkles: "sparkles", message: "message-circle", edit: "pencil",
  shield: "shield-check", store: "store", briefcase: "briefcase", logout: "log-out", reset: "rotate-ccw", info: "info",
  filter: "sliders-horizontal", locate: "locate-fixed", layers: "layers", volume: "volume-2", external: "external-link",
  download: "download", book: "book-open", languages: "languages", siren: "siren", lightbulb: "lightbulb", walk: "footprints",
  ticket: "ticket", wallet: "wallet", coins: "coins", exchange: "arrow-left-right", "credit-card": "credit-card", banknote: "banknote",
  thermometer: "thermometer", droplets: "droplets", wind: "wind", hourglass: "hourglass", ban: "ban", "circle-check": "circle-check",
  "circle-x": "circle-x", "badge-check": "badge-check", crown: "crown", award: "award", bell: "bell", key: "key-round", receipt: "receipt",
  trending: "trending-up", "trending-down": "trending-down", eye: "eye", image: "image", camera: "camera", lock: "lock", help: "circle-help", tag: "tag",
  // транспорт
  train: "train-front", "train-fast": "train-front-tunnel", bus: "bus", taxi: "car-taxi-front", car: "car", plane: "plane", ship: "ship",
  fuel: "fuel",
  // погода
  "w-sun": "sun", "w-moon": "moon", "w-partly": "cloud-sun", "w-partly-night": "cloud-moon", "w-cloud": "cloud", "w-fog": "cloud-fog",
  "w-drizzle": "cloud-drizzle", "w-rain": "cloud-rain", "w-snow": "cloud-snow", "w-storm": "cloud-lightning",
  // еда и отметки
  food: "utensils-crossed", coffee: "coffee", pizza: "pizza", soup: "soup", chef: "chef-hat", pot: "cooking-pot", sandwich: "sandwich",
  wifi: "wifi", "wifi-off": "wifi-off", leaf: "leaf", delivery: "bike", takeaway: "package", halal: "moon-star", outdoor: "trees", wheat: "wheat",
  "glass-water": "glass-water", candy: "candy", cake: "cake-slice",
  // места и типы
  sight: "landmark", museum: "landmark", bank: "landmark", shopping: "shopping-bag", basket: "shopping-basket", mall: "store",
  gift: "gift", palette: "palette", scissors: "scissors", gem: "gem", flame: "flame", viewpoint: "binoculars", gallery: "image",
  zoo: "paw-print", "theme-park": "ferris-wheel", castle: "castle", pickaxe: "pickaxe", amphora: "amphora", bed: "bed-double",
  // документы и здоровье
  "id-card": "id-card", "heart-pulse": "heart-pulse", stethoscope: "stethoscope", "shield-plus": "shield-plus", "file-check": "file-check", contact: "contact", "folder-lock": "folder-lock", mic: "mic", "door-open": "door-open", sunrise: "sunrise", "map-pinned": "map-pinned", "hand-helping": "hand-helping",
  "bed-single": "bed-single", house: "house", building: "building", pill: "pill", hospital: "hospital", clinic: "stethoscope",
  ambulance: "ambulance", alert: "triangle-alert", "shield-plain": "shield", smartphone: "smartphone", handshake: "handshake",
  "file-text": "file-text", mountain: "mountain-snow", tent: "tent", zap: "zap", trees: "trees", flower: "flower-2", sunrise: "sunrise",
  waves: "waves", signpost: "signpost", milestone: "milestone"
};

// Собственные иконки в стиле Lucide (сетка 24, линия 2, скруглённые концы)
const CUSTOM = {
  // купол медресе / мавзолея
  dome: `<path d="M12 2v2.2"/><path d="M6.5 12c0-3.7 2.4-6.4 5.5-7.8 3.1 1.4 5.5 4.1 5.5 7.8"/><path d="M5 12h14"/><path d="M6 12v9"/><path d="M18 12v9"/><path d="M10 21v-3.5a2 2 0 0 1 4 0V21"/><path d="M3 21h18"/>`,
  // минарет
  minaret: `<path d="M12 2v1.5"/><path d="M9.5 7 12 3.5 14.5 7"/><path d="M8.5 7h7"/><path d="M9.6 21 10.2 7"/><path d="M14.4 21 13.8 7"/><path d="M9.9 12.5h4.2"/><path d="M7 21h10"/>`,
  // городские ворота
  gate: `<path d="M3 21V9h4v12"/><path d="M17 21V9h4v12"/><path d="M3 9V6.5"/><path d="M7 9V6.5"/><path d="M17 9V6.5"/><path d="M21 9V6.5"/><path d="M7 11h10"/><path d="M9.5 21v-4.5a2.5 2.5 0 0 1 5 0V21"/><path d="M2 21h20"/>`,
  // обелиск / памятник
  monument: `<path d="M10.2 19 11.2 5 12 3l.8 2 1 14"/><path d="M8 19h8"/><path d="M6.5 21.5h11"/><path d="M8 19v2.5"/><path d="M16 19v2.5"/>`,
  // руины
  ruins: `<path d="M3 21h18"/><path d="M5 21V8h4v13"/><path d="M15 21V12h4v9"/><path d="M4 8h6"/><path d="M14 12h6"/><path d="m11 4 2.5 1.5"/>`,
  // катушка шёлка
  spool: `<path d="M6 3h12"/><path d="M6 21h12"/><path d="M8 3v18"/><path d="M16 3v18"/><path d="m8 7 8 2.5"/><path d="m8 11 8 2.5"/><path d="m8 15 8 2.5"/>`,
  // ковёр
  rug: `<rect x="5" y="4" width="14" height="16" rx="1"/><path d="m12 8 3 4-3 4-3-4z"/><path d="M7.5 4V2"/><path d="M12 4V2"/><path d="M16.5 4V2"/><path d="M7.5 22v-2"/><path d="M12 22v-2"/><path d="M16.5 22v-2"/>`,
  // туалет (WC)
  toilet: `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 9l1 6 1.5-4 1.5 4 1-6"/><path d="M17 9.6a2.2 2.2 0 1 0 0 4.8"/>`,
  // чайник (чайхана)
  teapot: `<path d="M5 10h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M5 12 2.5 9.5"/><path d="M8.5 10V8.5a2 2 0 0 1 4 0V10"/><path d="M10.5 6.5V5.5"/><path d="M6 21h9"/>`,
  // восьмиконечная звезда (гирих) — знак Safar
  girih: `<path d="M12 2.5 14 7.2l4.7-2-2 4.8L21.5 12l-4.8 2 2 4.7-4.7-2-2 4.8-2-4.8-4.7 2 2-4.7-4.8-2 4.8-2-2-4.8 4.7 2z"/><circle cx="12" cy="12" r="2.6"/>`
};

const attrStr = attrs => Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ");

const nodes = await (await fetch(LUCIDE)).json();
const symbols = {};
for (const [name, lucide] of Object.entries(MAP)) {
  const node = nodes[lucide];
  if (!node) throw new Error("нет иконки " + lucide);
  symbols[name] = node.map(([tag, attrs]) => `<${tag} ${attrStr(attrs)}/>`).join("");
}
Object.assign(symbols, CUSTOM);

const out = `// Иконки Safar. Сгенерировано scripts/build-icons.mjs — не редактируйте вручную.
// Lucide (https://lucide.dev) © Lucide Contributors, лицензия ISC; купол, минарет, ворота, ковёр и др. — собственные.
const ICON_SYMBOLS = ${JSON.stringify(symbols)};

// Спрайт: каждая иконка — <symbol>, на странице используется через <use>.
// Линия и заливка задаются в CSS (.i), поэтому их можно менять: толщина, заливка звёзд и сердечка.
(() => {
  const sprite = Object.entries(ICON_SYMBOLS).map(([n, body]) =>
    \`<symbol id="i-\${n}" viewBox="0 0 24 24">\${body}</symbol>\`).join("");
  const holder = document.createElement("div");
  holder.innerHTML = \`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">\${sprite}</svg>\`;
  document.body.prepend(holder.firstChild);
})();

// icon("hotel") → <svg class="i"> … ; второй аргумент — дополнительные классы
function icon(name, cls = "") {
  if (!ICON_SYMBOLS[name]) name = "pin";
  return \`<svg class="i i-\${name} \${cls}" aria-hidden="true" focusable="false"><use href="#i-\${name}"></use></svg>\`;
}
`;
await writeFile(join(ROOT, "js/icons.js"), out);
console.log(`Готово: ${Object.keys(symbols).length} иконок → js/icons.js`);
