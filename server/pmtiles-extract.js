// Вырезка карты города из PMTiles-архива Protomaps (векторные плитки OpenStreetMap) — для офлайн-карт «Азербайджана».
// Читаем только нужные куски большого архива по HTTP Range: заголовок, каталоги и плитки внутри рамки города,
// и пишем свой маленький архив PMTiles v3. Формат: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
const zlib = require("zlib");
const { promisify } = require("util");
const gunzip = promisify(zlib.gunzip), gzip = promisify(zlib.gzip);

const UA = "HamyolTravelApp/1.0 (offline maps)";
async function rangeGet(url, start, length, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${start}-${start + length - 1}`, "User-Agent": UA }, signal: AbortSignal.timeout(120e3) });
      if (r.status !== 206 && r.status !== 200) throw new Error("HTTP " + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (r.status === 200) return buf.subarray(start, start + length);
      return buf;
    } catch (e) { if (i >= tries) throw e; await new Promise(ok => setTimeout(ok, 2000 * (i + 1))); }
  }
}

// ---------- Варинты и каталоги ----------
function readVarint(p) {
  let val = 0, mul = 1, b;
  do { b = p.buf[p.pos++]; val += (b & 0x7f) * mul; mul *= 128; } while (b >= 0x80);
  return val;
}
function writeVarint(out, v) {
  while (v >= 0x80) { out.push((v % 128) | 0x80); v = Math.floor(v / 128); }
  out.push(v);
}
function deserializeDir(buf) {
  const p = { buf, pos: 0 }, n = readVarint(p), e = [];
  let last = 0;
  for (let i = 0; i < n; i++) { last += readVarint(p); e.push({ tileId: last, offset: 0, length: 0, runLength: 1 }); }
  for (let i = 0; i < n; i++) e[i].runLength = readVarint(p);
  for (let i = 0; i < n; i++) e[i].length = readVarint(p);
  for (let i = 0; i < n; i++) { const v = readVarint(p); e[i].offset = v === 0 && i > 0 ? e[i - 1].offset + e[i - 1].length : v - 1; }
  return e;
}
function serializeDir(entries) {
  const out = [];
  writeVarint(out, entries.length);
  let last = 0;
  for (const e of entries) { writeVarint(out, e.tileId - last); last = e.tileId; }
  for (const e of entries) writeVarint(out, e.runLength);
  for (const e of entries) writeVarint(out, e.length);
  entries.forEach((e, i) => writeVarint(out, i > 0 && e.offset === entries[i - 1].offset + entries[i - 1].length ? 0 : e.offset + 1));
  return Buffer.from(out);
}
function findEntry(entries, tileId) {
  let m = 0, n = entries.length - 1;
  while (m <= n) {
    const k = (m + n) >> 1, c = tileId - entries[k].tileId;
    if (c > 0) m = k + 1; else if (c < 0) n = k - 1; else return entries[k];
  }
  if (n >= 0 && (entries[n].runLength === 0 || tileId - entries[n].tileId < entries[n].runLength)) return entries[n];
  return null;
}
// Номер плитки по кривой Гильберта — как в библиотеке pmtiles (zxyToTileId)
function rotate(n, x, y, rx, ry) { if (ry === 0) { if (rx !== 0) return [n - 1 - y, n - 1 - x]; return [y, x]; } return [x, y]; }
function zxyToTileId(z, x, y) {
  let acc = ((1 << z) * (1 << z) - 1) / 3, a = z - 1, tx = x, ty = y;
  for (let s = 1 << a; s > 0; s >>= 1) {
    const rx = tx & s, ry = ty & s;
    acc += ((3 * rx) ^ ry) * (1 << a);
    [tx, ty] = rotate(s, tx, ty, rx, ry);
    a--;
  }
  return acc;
}
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * (1 << z));
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z)); };
// Плитки для рамок [{ bbox: [minLon, minLat, maxLon, maxLat], minz, maxz }]
function tilesFor(areas) {
  const ids = new Set();
  for (const { bbox, minz, maxz } of areas) for (let z = minz; z <= maxz; z++) {
    const x0 = lon2x(bbox[0], z), x1 = lon2x(bbox[2], z), y0 = lat2y(bbox[3], z), y1 = lat2y(bbox[1], z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ids.add(zxyToTileId(z, x, y));
  }
  return [...ids].sort((a, b) => a - b);
}

// ---------- Чтение исходного архива ----------
async function openArchive(url) {
  const head = await rangeGet(url, 0, 16384), v = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (head.toString("latin1", 0, 7) !== "PMTiles" || v.getUint8(7) !== 3) throw new Error("not a PMTiles v3 archive");
  const u64 = o => Number(v.getBigUint64(o, true));
  const h = {
    rootOff: u64(8), rootLen: u64(16), metaOff: u64(24), metaLen: u64(32), leafOff: u64(40), leafLen: u64(48), dataOff: u64(56),
    internal: v.getUint8(97), tileComp: v.getUint8(98), tileType: v.getUint8(99)
  };
  const dec = b => h.internal === 2 ? gunzip(b) : b;
  const root = deserializeDir(await dec(head.subarray(h.rootOff, h.rootOff + h.rootLen)));
  const meta = await rangeGet(url, h.metaOff, h.metaLen);
  const leaves = new Map();
  const leaf = (off, len) => { const k = off + ":" + len; if (!leaves.has(k)) leaves.set(k, rangeGet(url, h.leafOff + off, len).then(dec).then(deserializeDir)); return leaves.get(k); };
  async function locate(tileId) {
    let dir = root;
    for (let depth = 0; depth < 4; depth++) {
      const e = findEntry(dir, tileId);
      if (!e) return null;
      if (e.runLength > 0) return { offset: h.dataOff + e.offset, length: e.length };
      dir = await leaf(e.offset, e.length);
    }
    return null;
  }
  return { h, meta, locate };
}

// ---------- Новый архив ----------
async function writeArchive({ entries, data, meta, h, bounds, minz, maxz, center }) {
  const ROOT_MAX = 16384 - 127;
  const enc = b => gzip(b);
  let rootBuf = await enc(serializeDir(entries)), leafBuf = Buffer.alloc(0);
  if (rootBuf.length > ROOT_MAX) {
    // Каталог не помещается в начало файла — делим на «листья» по 4096 записей
    const leaves = [], rootEntries = [];
    let off = 0;
    for (let i = 0; i < entries.length; i += 4096) {
      const chunk = entries.slice(i, i + 4096), b = await enc(serializeDir(chunk));
      leaves.push(b);
      rootEntries.push({ tileId: chunk[0].tileId, offset: off, length: b.length, runLength: 0 });
      off += b.length;
    }
    leafBuf = Buffer.concat(leaves);
    rootBuf = await enc(serializeDir(rootEntries));
  }
  const header = Buffer.alloc(127), v = new DataView(header.buffer);
  header.write("PMTiles", 0, "latin1");
  v.setUint8(7, 3);
  const rootOff = 127, metaOff = rootOff + rootBuf.length, leafOff = metaOff + meta.length, dataOff = leafOff + leafBuf.length;
  const put = (o, n) => v.setBigUint64(o, BigInt(n), true);
  put(8, rootOff); put(16, rootBuf.length); put(24, metaOff); put(32, meta.length); put(40, leafOff); put(48, leafBuf.length);
  put(56, dataOff); put(64, data.length);
  put(72, entries.reduce((s, e) => s + e.runLength, 0)); put(80, entries.length); put(88, new Set(entries.map(e => e.offset)).size);
  v.setUint8(96, 0); v.setUint8(97, 2); v.setUint8(98, h.tileComp); v.setUint8(99, h.tileType); v.setUint8(100, minz); v.setUint8(101, maxz);
  const e7 = d => Math.round(d * 1e7);
  v.setInt32(102, e7(bounds[0]), true); v.setInt32(106, e7(bounds[1]), true); v.setInt32(110, e7(bounds[2]), true); v.setInt32(114, e7(bounds[3]), true);
  v.setUint8(118, Math.min(maxz, 13)); v.setInt32(119, e7(center[1]), true); v.setInt32(123, e7(center[0]), true);
  return Buffer.concat([header, rootBuf, meta, leafBuf, data]);
}

// Вырезать: areas — рамки и уровни; center — [широта, долгота]; onProgress(сделано, всего)
async function extract(url, areas, center, onProgress = () => {}) {
  const src = await openArchive(url);
  const ids = tilesFor(areas), found = [];
  // Где лежит каждая плитка (каталоги-«листья» читаются по мере надобности и кэшируются)
  for (let i = 0; i < ids.length; i += 64) {
    const part = await Promise.all(ids.slice(i, i + 64).map(async id => [id, await src.locate(id)]));
    for (const [id, loc] of part) if (loc && loc.length) found.push({ id, ...loc });
    onProgress(Math.min(i + 64, ids.length) * 0.15, ids.length);
  }
  // Читаем данные кусками: соседние плитки — одним запросом (до 4 МБ, разрыв до 64 КБ)
  const byOff = [...new Map(found.map(f => [f.offset, f])).values()].sort((a, b) => a.offset - b.offset);
  const groups = [];
  for (const f of byOff) {
    const g = groups[groups.length - 1];
    if (g && f.offset - (g.start + g.len) < 65536 && f.offset + f.length - g.start < 4 * 1048576) { g.len = Math.max(g.len, f.offset + f.length - g.start); g.items.push(f); }
    else groups.push({ start: f.offset, len: f.length, items: [f] });
  }
  const blobs = new Map();
  let done = 0;
  for (let i = 0; i < groups.length; i += 4) {
    await Promise.all(groups.slice(i, i + 4).map(async g => {
      const buf = await rangeGet(url, g.start, g.len);
      for (const f of g.items) blobs.set(f.offset, buf.subarray(f.offset - g.start, f.offset - g.start + f.length));
      done += g.items.length;
    }));
    onProgress(ids.length * 0.15 + done / byOff.length * ids.length * 0.85, ids.length);
  }
  // Новый архив: одинаковые плитки (море, пустая степь) пишем один раз
  const outOff = new Map(), parts = [];
  let size = 0;
  for (const f of byOff) { outOff.set(f.offset, size); parts.push(blobs.get(f.offset)); size += f.length; }
  const entries = [];
  for (const f of found) {
    const off = outOff.get(f.offset), last = entries[entries.length - 1];
    if (last && last.offset === off && last.tileId + last.runLength === f.id) last.runLength++;
    else entries.push({ tileId: f.id, offset: off, length: f.length, runLength: 1 });
  }
  const all = areas.map(a => a.bbox);
  const bounds = [Math.min(...all.map(b => b[0])), Math.min(...all.map(b => b[1])), Math.max(...all.map(b => b[2])), Math.max(...all.map(b => b[3]))];
  const minz = Math.min(...areas.map(a => a.minz)), maxz = Math.max(...areas.map(a => a.maxz));
  return { buf: await writeArchive({ entries, data: Buffer.concat(parts), meta: src.meta, h: src.h, bounds, minz, maxz, center }), tiles: found.length };
}

module.exports = { extract, tilesFor, zxyToTileId, deserializeDir, serializeDir };
