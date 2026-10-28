// Знак Hamyol (иконка приложения) — векторная версия логотипа docs/logo.png:
// кольцо-компас со стрелкой, горы, дорога и наклонная орбита с самолётиком.
// Запуск: node scripts/build-hamyol-icon.mjs → icons/icon.svg (обычная) и icons/icon-maskable.svg (с полями для Android)
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BG = "#eef1f5", BLUE = "#5b84a8", BLUE_L = "#7aa0c1", BLUE_D = "#3f6891", ORANGE = "#c8794c";
const C = [256, 284], RO = 172, RI = 128;   // круг: центр, внешний и внутренний радиус кольца
const f = n => +n.toFixed(1);

// Орбита: эллипс вокруг круга, наклонённый вправо-вверх; видна передняя часть — от самолётика по часовой до левого края
const E = { cx: 256, cy: 300, rx: 192, ry: 84, rot: -32 * Math.PI / 180 };
const ept = (t, grow = 0) => {
  const x = (E.rx + grow) * Math.cos(t), y = (E.ry + grow) * Math.sin(t);
  return [E.cx + x * Math.cos(E.rot) - y * Math.sin(E.rot), E.cy + x * Math.sin(E.rot) + y * Math.cos(E.rot)];
};
// Толщина: тонко у самолётика, толсто спереди внизу слева
const T0 = -0.62, T1 = Math.PI + 0.12;   // от верхнего правого конца по часовой (через низ) до левого края
function orbitPath(extra = 0) {
  const N = 120, outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N, t = T0 + (T1 - T0) * k, w = (3 + 36 * Math.sin(Math.PI * k ** 0.65)) / 2 + extra;   // тонко у самолётика и у левого края, толще всего спереди внизу слева
    outer.push(ept(t, w)); inner.push(ept(t, -w));
  }
  return "M" + [...outer, ...inner.reverse()].map(p => `${f(p[0])} ${f(p[1])}`).join(" L") + " Z";
}
// Самолётик
const P = [318, 184], ang = -38 * Math.PI / 180;   // справа от стрелки, внутри кольца, нос вверх-вправо — как в логотипе
const rot = (x, y) => [P[0] + 6 * Math.cos(ang) + x * Math.cos(ang) - y * Math.sin(ang), P[1] + 6 * Math.sin(ang) + x * Math.sin(ang) + y * Math.cos(ang)];
const plane = [rot(40, 0), rot(-22, -23), rot(-9, 0), rot(-22, 20)].map(p => `${f(p[0])} ${f(p[1])}`).join(" L");

function mark() {
  return `
    <clipPath id="hyIn"><circle cx="${C[0]}" cy="${C[1]}" r="${RI}"/></clipPath>
    <clipPath id="hyOut"><circle cx="${C[0]}" cy="${C[1]}" r="${RO - 6}"/></clipPath>
    <!-- кольцо -->
    <circle cx="${C[0]}" cy="${C[1]}" r="${RO}" fill="${BLUE}"/>
    <circle cx="${C[0]}" cy="${C[1]}" r="${RI}" fill="${BG}"/>
    <!-- горы и снег -->
    <path clip-path="url(#hyIn)" fill="${BLUE}" d="M120 352 L192 268 L212 288 L264 200 L320 274 L340 258 L420 330 L420 470 L120 470 Z"/>
    <path fill="${BG}" d="M264 200 L249 230 L262 222 L272 238 L279 221 Z M192 268 L183 284 L193 278 L200 289 Z"/>
    <!-- дорога: от низа круга вверх к подножию горы -->
    <path clip-path="url(#hyOut)" d="M176 452 C 312 444, 322 392, 256 366 C 200 344, 216 302, 270 288" fill="none" stroke="${BG}" stroke-width="58" stroke-linecap="round"/>
    <path clip-path="url(#hyOut)" d="M176 452 C 312 444, 322 392, 256 366 C 200 344, 216 302, 270 288" fill="none" stroke="${ORANGE}" stroke-width="42" stroke-linecap="round"/>
    <!-- орбита с белой каймой и самолётик -->
    <path d="${orbitPath(5)}" fill="${BG}"/>
    <path d="${orbitPath(0)}" fill="${ORANGE}"/>
    <path d="M${plane} Z" fill="${BG}" transform="translate(0 0)" stroke="${BG}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M${plane} Z" fill="${ORANGE}"/>
    <!-- стрелка компаса над кольцом -->
    <path fill="${BG}" d="M256 22 L196 186 L256 160 L316 186 Z"/>
    <path fill="${BLUE_L}" d="M256 38 L206 178 L256 152 Z"/>
    <path fill="${BLUE_D}" d="M256 38 L306 178 L256 152 Z"/>`;
}
// Обычная иконка: знак почти во весь квадрат. Maskable (Android): знак в безопасном круге 80% — уменьшаем
const svg = (scale, note) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Hamyol — ${note}. Собрано scripts/build-hamyol-icon.mjs из логотипа docs/logo.png -->
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark()}
  </g>
</svg>
`;
await writeFile(join(ROOT, "icons", "icon.svg"), svg(1, "знак приложения"));
await writeFile(join(ROOT, "icons", "icon-maskable.svg"), svg(0.76, "знак с полями для круглых и квадратных иконок Android"));
console.log("icons/icon.svg, icons/icon-maskable.svg");
