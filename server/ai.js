// ИИ-гид на Claude: чат с инструментами по реальным данным Safar (города, места, планы, бюджет).
// Нужно: npm install и ANTHROPIC_API_KEY в .env. Модель — AI_MODEL (по умолчанию claude-opus-5-5).
//
// Разговор хранится на сервере целиком (включая блоки рассуждений) и только дополняется:
// у Claude Opus 5.5 рассуждения привязаны к разговору, правка прошлых сообщений сломала бы запрос.
const crypto = require("node:crypto");
const env = require("./env");
const { db } = require("./db");
const { readJSON, clientIp, rateLimiter, HttpError, sendJSON } = require("./http");
const auth = require("./auth");
const { D, cityName, poiName, regionName, typeLabel, km, score } = require("./data");

let Anthropic = null;
try { const mod = require("@anthropic-ai/sdk"); Anthropic = mod.default || mod.Anthropic || mod; }
catch { /* пакет не установлен — ИИ-гид выключен */ }

const MODEL = env.AI_MODEL || "claude-opus-5-5";
const EFFORT = process.env.AI_EFFORT || "medium";
const enabled = !!(Anthropic && env.ANTHROPIC_API_KEY);
const client = enabled ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
// Запасная модель при отказе по соображениям безопасности + явная политика для рассуждений (см. README)
const BETAS = ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"];

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    ip TEXT,
    messages TEXT NOT NULL,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_usage (
    who TEXT NOT NULL,
    day TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (who, day)
  );
`);

// ---------- Системная подсказка (неизменная — кэшируется) ----------
const SYSTEM = `You are Hamyol's travel guide for Uzbekistan, inside the Hamyol web app.
Help travellers plan trips: where to go, what to see, where to stay and eat, how long to stay, how to get between cities, and how much it costs.

Ground every concrete fact about places, hotels, prices and distances in the tools. The tools search Hamyol's database built from OpenStreetMap, Wikidata and the Central Bank of Uzbekistan. If the tools don't have something, say so plainly instead of inventing names, addresses, phone numbers or prices. General travel knowledge about Uzbekistan (history, customs, food) is fine without tools.

When you mention a place or city that a tool returned, link it with its "link" field in Markdown, e.g. [Registan](#place/r17141908) or [Samarkand](#city/samarkand) - the app opens these in place.
Hotel prices in Hamyol are estimates by star rating, not live prices - say "about" and suggest checking with the "Check price" button.
When the traveller wants an itinerary, decide the cities and nights, check the cost with estimate_trip, and call propose_trip so they can load it into the trip planner with one tap.

Reply in the traveller's language (the context line at the start of the conversation names the app language). Keep answers concise and practical: short paragraphs or lists, no tables.`;

// ---------- Инструменты ----------
const CATS = { hotel: "h", sight: "a", shopping: "s", food: "f" };
const tools = [
  {
    name: "search_places",
    description: "Search Hamyol's database of real places in Uzbekistan (from OpenStreetMap): hotels and guest houses, sights and museums, bazaars and shops, restaurants and cafés. Returns the most notable matches with type, city, address, opening hours, stars and estimated hotel price.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to match in the place name, e.g. 'plov', 'Registan', 'carpet'. Optional." },
        city: { type: "string", description: "City name in any language or Hamyol city id, e.g. 'Samarkand'. Optional." },
        category: { type: "string", enum: ["hotel", "sight", "shopping", "food", "any"], description: "Kind of place." },
        min_stars: { type: "integer", description: "Hotels only: minimum star rating 1-5. Optional." },
        limit: { type: "integer", description: "How many results, 1-15 (default 8)." }
      },
      required: ["category"]
    },
    eager_input_streaming: true
  },
  {
    name: "get_city",
    description: "Get facts about a city or town in Uzbekistan: names, region, population, short description, counts of hotels/sights/shops/restaurants, best months to visit (from 2021-2024 climate data) and its most famous sights.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string", description: "City name in any language or Hamyol city id." } },
      required: ["city"]
    },
    eager_input_streaming: true
  },
  {
    name: "plan_day",
    description: "Build a one-day sightseeing plan in a city: the most notable sights in an efficient walking order with distances.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string", description: "City name or id." } },
      required: ["city"]
    },
    eager_input_streaming: true
  },
  {
    name: "estimate_trip",
    description: "Estimate the cost of a multi-city trip with Hamyol's budget tariffs (accommodation, intercity transport, food, local transport, tickets). Distances are road estimates. Returns totals in UZS and USD at today's Central Bank rate.",
    input_schema: {
      type: "object",
      properties: {
        stops: {
          type: "array", description: "Cities in travel order with nights in each.",
          items: { type: "object", properties: { city: { type: "string" }, nights: { type: "integer" } }, required: ["city", "nights"] }
        },
        travelers: { type: "integer", description: "Number of travelers (default 2)." },
        hotel_stars: { type: "integer", enum: [2, 3, 4, 5], description: "Hotel class (default 3)." },
        transport: { type: "string", enum: ["train", "afrosiyob", "bus", "shared_taxi", "car", "plane"], description: "Intercity transport (default train)." }
      },
      required: ["stops"]
    },
    eager_input_streaming: true
  },
  {
    name: "propose_trip",
    description: "Show the traveller a trip they can load into Hamyol's trip planner with one tap. Call it once you have settled on an itinerary.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short trip title in the traveller's language." },
        stops: {
          type: "array",
          items: { type: "object", properties: { city: { type: "string" }, nights: { type: "integer" } }, required: ["city", "nights"] }
        },
        transport: { type: "string", enum: ["train", "afrosiyob", "bus", "shared_taxi", "car", "plane"] }
      },
      required: ["title", "stops"]
    },
    eager_input_streaming: true
  }
];

// Проверка входа инструмента: с потоковой передачей ввода сервер API его не проверяет
function validate(name, input) {
  const isStr = v => typeof v === "string" && v.length > 0 && v.length < 200;
  const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const stopsOk = s => Array.isArray(s) && s.length > 0 && s.length <= 15 && s.every(x => x && isStr(x.city) && isInt(x.nights, 0, 60));
  if (!input || typeof input !== "object") return false;
  switch (name) {
    case "search_places":
      return ["hotel", "sight", "shopping", "food", "any"].includes(input.category) &&
        (input.query == null || typeof input.query === "string") && (input.city == null || typeof input.city === "string") &&
        (input.min_stars == null || isInt(input.min_stars, 1, 5)) && (input.limit == null || isInt(input.limit, 1, 15));
    case "get_city": case "plan_day": return isStr(input.city);
    case "estimate_trip":
      return stopsOk(input.stops) && (input.travelers == null || isInt(input.travelers, 1, 50)) &&
        (input.hotel_stars == null || [2, 3, 4, 5].includes(input.hotel_stars)) && (input.transport == null || typeof input.transport === "string");
    case "propose_trip": return isStr(input.title) && stopsOk(input.stops);
    default: return false;
  }
}

// Город по названию на любом языке или по id
function findCity(q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return null;
  if (D.CITY[s]) return D.CITY[s];
  const names = c => Object.values(c.n).map(v => String(v).toLowerCase());
  return D.CITIES.find(c => names(c).includes(s)) || D.CITIES.find(c => names(c).some(n => n.startsWith(s) || s.startsWith(n) && n.length > 3));
}

let usdRate = { rate: 11900, at: 0 };
async function usdUzs() {
  if (Date.now() - usdRate.at < 6 * 3600e3) return usdRate.rate;
  try {
    const list = await (await fetch("https://cbu.uz/ru/arkhiv-kursov-valyut/json/", { signal: AbortSignal.timeout(8000) })).json();
    const usd = list.find(r => r.Ccy === "USD");
    if (usd) usdRate = { rate: +usd.Rate, at: Date.now() };
  } catch { /* оставляем прежний курс */ }
  return usdRate.rate;
}

const hotelUsd = p => {
  const base = p.st ? D.STAR_USD[p.st] : (D.HOTEL_BASE_USD[p.s] || 45);
  const f = D.CITY_PRICE_FACTOR[p.city.n.ru] || (p.city.t === "city" ? 0.9 : 0.75);
  return Math.max(10, Math.round(base * f / 5) * 5);
};

const placeOut = (lang, p) => ({
  name: poiName(lang, p), link: `#place/${p.id}`, type: typeLabel("en", p.s), city: cityName(lang, p.city),
  ...(p.st ? { stars: p.st } : {}), ...(p.c === "h" ? { est_price_usd_per_night: hotelUsd(p) } : {}),
  ...(p.ad ? { address: p.ad } : {}), ...(p.oh ? { opening_hours: p.oh } : {}), ...(p.cu ? { cuisine: p.cu } : {}),
  ...(p.fm ? { wikipedia_languages: p.fm } : {})
});

async function runTool(name, input, lang) {
  if (name === "search_places") {
    const city = input.city ? findCity(input.city) : null;
    if (input.city && !city) return { error: `City "${input.city}" not found in Hamyol.` };
    const cat = CATS[input.category];
    const q = String(input.query || "").toLowerCase().trim();
    const list = D.POIS.filter(p => (!cat || p.c === cat) && (!city || p.city === city) &&
      (!input.min_stars || (p.st || 0) >= input.min_stars) &&
      (!q || [p.n, p.nr, p.ne, p.nu, p.cu, p.s].filter(Boolean).join(" ").toLowerCase().includes(q)))
      .sort((a, b) => score(b) - score(a) || (b.st || 0) - (a.st || 0) || (b.city.pop || 0) - (a.city.pop || 0))
      .slice(0, input.limit || 8);
    return { count: list.length, places: list.map(p => placeOut(lang, p)) };
  }
  if (name === "get_city") {
    const c = findCity(input.city);
    if (!c) return { error: `City "${input.city}" not found in Hamyol.` };
    const cl = D.climate[c.cl];
    const comfort = ([tx, , , rd]) => Math.max(0, 10 - (tx > 28 ? (tx - 28) * 0.8 : 0) - (tx < 18 ? (18 - tx) * 0.6 : 0) - Math.max(0, rd - 4) * 0.4);
    let best = [];
    if (cl) { const sc = cl.m.map(comfort), top = Math.max(...sc); best = sc.map((v, i) => v >= Math.max(6.5, top - 1.5) ? i + 1 : 0).filter(Boolean); }
    const sights = D.POIS.filter(p => p.city === c && p.c === "a").sort((a, b) => score(b) - score(a)).slice(0, 6);
    const story = D.CITY_STORIES[c.n.ru]?.d[2];
    return {
      name: cityName(lang, c), names: c.n, link: `#city/${c.id}`, region: regionName("en", c.r), population: c.pop || null,
      ...(story ? { description: story } : {}),
      counts: { hotels: c.counts.h, sights: c.counts.a, shopping: c.counts.s, food: c.counts.f },
      best_months: best, ...(cl ? { climate_monthly_high_low_c: cl.m.map(m => [Math.round(m[0]), Math.round(m[1])]) } : {}),
      top_sights: sights.map(p => placeOut(lang, p))
    };
  }
  if (name === "plan_day") {
    const c = findCity(input.city);
    if (!c) return { error: `City "${input.city}" not found in Hamyol.` };
    const picked = [];
    for (const p of D.POIS.filter(p => p.city === c && p.c === "a" && km(c, p) < 15 && (p.s !== "monument" || (p.fm || 0) >= 20))
      .sort((a, b) => score(b) - score(a))) {
      if (picked.length >= 6) break;
      if (picked.some(q => km(q, p) < 0.15 || poiName(lang, q) === poiName(lang, p))) continue;
      picked.push(p);
    }
    if (!picked.length) return { error: "Not enough sights in Hamyol's data for a plan here." };
    // Порядок: ближайший сосед от самого известного места
    const order = [picked.shift()];
    while (picked.length) {
      const last = order[order.length - 1];
      picked.sort((a, b) => km(last, a) - km(last, b));
      order.push(picked.shift());
    }
    return {
      city: cityName(lang, c), link: `#city/${c.id}`,
      stops: order.map((p, i) => ({ ...placeOut(lang, p), ...(i ? { km_from_previous: +(km(order[i - 1], p) * 1.3).toFixed(1) } : {}) }))
    };
  }
  if (name === "estimate_trip" || name === "propose_trip") {
    const stops = [];
    for (const s of input.stops) {
      const c = findCity(s.city);
      if (!c) return { error: `City "${s.city}" not found in Hamyol.` };
      stops.push({ c, nights: s.nights });
    }
    if (name === "propose_trip") {
      return { shown: true, stops: stops.map(s => ({ id: s.c.id, name: cityName(lang, s.c), nights: s.nights })), _trip: true };
    }
    const T = D.DEFAULT_TARIFFS, people = input.travelers || 2, stars = input.hotel_stars || 3, mode = input.transport || "train";
    const rooms = Math.ceil(people / 2);
    const nights = stops.reduce((a, s) => a + s.nights, 0), days = nights + 1;
    let dist = 0;
    for (let i = 1; i < stops.length; i++) dist += km(stops[i - 1].c, stops[i].c) * (mode === "plane" ? 1 : 1.25);
    const transport = mode === "car" ? dist * T.transportPerKm.car * Math.ceil(people / 4) : dist * T.transportPerKm[mode] * people;
    const items = {
      accommodation: nights * rooms * T.hotelPerNight[stars], intercity_transport: transport,
      food: days * people * T.foodPerDay.mid, local_transport: days * people * T.localPerDay, tickets: days * people * T.sightsPerDay
    };
    const total = Object.values(items).reduce((a, b) => a + b, 0);
    const rate = await usdUzs();
    const usd = v => Math.round(v / rate);
    return {
      days, nights, travelers: people, rooms, hotel_stars: stars, transport: mode, distance_km: Math.round(dist),
      total_uzs: Math.round(total), total_usd: usd(total), per_person_usd: usd(total / people),
      breakdown_usd: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, usd(v)])),
      usd_rate_uzs: rate, note: "Estimate; excludes shopping and flights to Uzbekistan."
    };
  }
  return { error: "unknown tool" };
}

// ---------- Ограничения ----------
const burst = rateLimiter(6, 60e3);   // не больше 6 сообщений в минуту с IP
function underDailyLimit(who) {
  const day = new Date().toISOString().slice(0, 10);
  db.prepare("INSERT INTO ai_usage (who, day, n) VALUES (?, ?, 1) ON CONFLICT(who, day) DO UPDATE SET n = n + 1").run(who, day);
  return db.prepare("SELECT n FROM ai_usage WHERE who = ? AND day = ?").get(who, day).n <= env.AI_DAILY_LIMIT;
}

// ---------- Чат (ответ — поток событий SSE) ----------
async function chat(req, res) {
  if (!enabled) throw new HttpError(404, "ai disabled");
  const ip = clientIp(req);
  if (burst(ip)) throw new HttpError(429, "too many requests");
  const body = await readJSON(req, 8000);
  const user = auth.userFrom(req);
  const text = String(body.message || "").trim().slice(0, 2000);
  if (!text) throw new HttpError(400, "empty message");
  if (!underDailyLimit(user ? "u" + user.id : "ip" + ip)) throw new HttpError(429, "daily limit");
  const lang = ["uz", "uzc", "ru", "en", "tr", "de", "zh", "ko"].includes(body.lang) ? body.lang : "ru";
  const toolLang = ["uz", "ru", "en"].includes(lang) ? lang : lang === "uzc" ? "uz" : "en";

  // Разговор: продолжаем свой или начинаем новый
  let conv = body.conversationId && db.prepare("SELECT * FROM ai_conversations WHERE id = ?").get(String(body.conversationId));
  if (conv && (conv.user_id ? conv.user_id !== user?.id : conv.ip !== ip)) conv = null;
  let messages = conv ? JSON.parse(conv.messages) : [];
  // Очень длинный разговор — начинаем новый (простая «компакция»: без переноса старой истории)
  if (JSON.stringify(messages).length > 300_000) { conv = null; messages = []; }
  const id = conv ? conv.id : crypto.randomBytes(12).toString("base64url");
  const context = messages.length ? "" : `[Context: today is ${new Date().toISOString().slice(0, 10)}; app language: ${lang}; currency shown: ${String(body.currency || "USD").slice(0, 3)}]\n\n`;
  messages.push({ role: "user", content: context + text });

  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" });
  const emit = ev => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  emit({ type: "start", conversationId: id });
  const save = () => {
    const now = Date.now();
    db.prepare(`INSERT INTO ai_conversations (id, user_id, ip, messages, created, updated) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET messages = excluded.messages, updated = excluded.updated`)
      .run(id, user?.id ?? null, ip, JSON.stringify(messages), now, now);
  };
  save();

  let aborted = false, current = null;
  res.on("close", () => { aborted = true; current?.abort(); });

  try {
    for (let step = 0, jsonRetries = 0; step < 8 && !aborted; step++) {
      current = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: BETAS,
        fallbacks: "default",
        thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
        output_config: { effort: EFFORT },
        cache_control: { type: "ephemeral" },
        system: SYSTEM,
        tools,
        messages
      });
      for await (const ev of current) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") emit({ type: "text", delta: ev.delta.text });
        if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") emit({ type: "tool", name: ev.content_block.name });
      }
      let message;
      try {
        message = await current.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Нечитаемый JSON во входе инструмента — повторяем ход (API-ошибки пробрасываем)
        if (err instanceof Anthropic.APIError || aborted || jsonRetries++ >= 2) throw err;
        step--;
        continue;
      }
      const dropped = (message.input_transformations || []).filter(x => x.type === "thinking_dropped");
      if (dropped.length) console.warn("AI: thinking blocks dropped", dropped);

      // Отказ (вся цепочка моделей отказала) — ответ в историю не добавляем
      if (message.stop_reason === "refusal") { emit({ type: "refusal" }); break; }
      const toolUses = message.content.filter(b => b.type === "tool_use");
      // Вызов инструмента обрезан лимитом — не сохраняем его (иначе tool_use останется без результата)
      if (message.stop_reason === "max_tokens" && toolUses.length) { emit({ type: "error", code: "failed" }); break; }
      messages.push({ role: "assistant", content: message.content });
      if (message.stop_reason !== "tool_use" || !toolUses.length) { save(); break; }

      const results = [];
      for (const tu of toolUses) {
        if (!validate(tu.name, tu.input)) {
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: JSON.stringify({ INVALID_INPUT: tu.input }) });
          continue;
        }
        let out;
        try { out = await runTool(tu.name, tu.input, toolLang); }
        catch (e) { out = { error: "tool failed: " + e.message }; }
        if (out._trip) {
          emit({ type: "trip", title: tu.input.title, transport: tu.input.transport || null, stops: out.stops });
          delete out._trip;
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out), ...(out.error ? { is_error: true } : {}) });
      }
      messages.push({ role: "user", content: results });
      save();
    }
    emit({ type: "done" });
  } catch (e) {
    if (!aborted) {
      const status = e instanceof Anthropic.APIError ? e.status : 0;
      console.error("AI error:", status, e.message);
      emit({ type: "error", code: status === 429 ? "busy" : status === 401 ? "config" : "failed" });
    }
  } finally {
    res.end();
  }
}

const routes = [
  ["POST", "/api/ai/chat", chat],
  // История разговора для показа в чате (только текст)
  ["GET", "/api/ai/history", (req, res, url) => {
    const user = auth.userFrom(req);
    const conv = db.prepare("SELECT * FROM ai_conversations WHERE id = ?").get(url.searchParams.get("id") || "");
    if (!conv || (conv.user_id ? conv.user_id !== user?.id : conv.ip !== clientIp(req))) return sendJSON(req, res, 200, { messages: [] });
    const out = [];
    for (const m of JSON.parse(conv.messages)) {
      const text = typeof m.content === "string" ? m.content.replace(/^\[Context:[^\]]*\]\s*/, "")
        : m.content.filter(b => b.type === "text").map(b => b.text).join("");
      if (text) out.push({ role: m.role, text });
    }
    sendJSON(req, res, 200, { messages: out });
  }]
];

function onStart() {
  if (!Anthropic) console.log("ИИ-гид: выполните npm install, чтобы включить");
  else if (!env.ANTHROPIC_API_KEY) console.log("ИИ-гид: добавьте ANTHROPIC_API_KEY в .env, чтобы включить");
  else console.log(`ИИ-гид: включён (${MODEL}, effort ${EFFORT})`);
}

module.exports = { routes, onStart, enabled, runTool, validate, tools };
