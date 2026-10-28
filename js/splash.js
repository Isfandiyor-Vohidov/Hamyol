// Заставка Safar: ~1,4 секунды (повторно — 0,5), каждый раз немного разная.
// Контур Узбекистана (OpenStreetMap, упрощён), маршрут по реальным координатам городов,
// цвет неба — по текущему времени в Ташкенте. Вся анимация — на CSS (transform/opacity), без покадрового JS.
// Скрипт подключается без defer — анимация стартует до загрузки данных приложения.
(() => {
  const el = document.getElementById("splash");
  if (!el) return;

  const UZ_PATH = "M20 335L78 341L79 335L87 333L84 331L81 332L78 327L74 293L83 291L92 275L112 275L124 273L123 268L125 270L129 268L129 257L126 254L130 254L130 249L135 245L135 248L140 249L139 252L143 250L151 254L154 264L160 264L160 261L155 258L148 244L140 239L147 234L165 237L165 232L168 232L166 226L188 246L197 246L204 259L212 264L227 263L232 265L238 262L238 265L243 267L246 273L242 273L241 275L246 279L246 284L244 287L239 286L241 290L244 288L245 292L250 293L253 298L262 302L259 305L254 300L248 299L246 303L253 314L253 316L249 319L248 329L271 343L286 340L301 343L301 339L306 345L312 348L317 348L321 345L323 338L334 340L339 343L353 358L354 371L363 392L374 401L373 405L376 410L378 420L377 426L381 436L449 487L450 490L468 504L476 510L485 507L496 519L524 536L552 559L569 562L573 560L587 569L591 569L600 578L606 578L614 581L617 587L612 591L608 598L607 615L610 620L606 626L614 631L616 628L625 629L630 625L636 627L640 630L639 634L645 636L649 641L661 635L665 639L678 641L680 630L678 624L682 608L690 603L697 586L704 588L712 567L697 551L693 552L696 546L693 542L694 533L692 528L696 527L693 521L700 518L700 511L694 505L673 507L671 496L653 490L652 484L660 483L659 473L656 468L660 468L659 464L668 463L673 458L696 466L718 468L724 460L724 456L722 453L725 450L725 444L732 445L732 442L733 445L736 441L735 434L737 443L739 443L742 439L737 429L740 428L744 430L743 427L746 424L746 422L741 422L725 427L719 424L719 422L747 416L762 419L759 411L762 412L764 408L761 397L757 393L764 390L765 376L768 377L773 374L782 386L785 387L789 381L805 377L808 372L812 372L821 367L822 359L827 356L845 379L842 385L829 392L828 396L819 399L822 405L833 408L833 416L836 420L856 417L854 412L872 408L874 410L884 413L885 416L888 417L891 418L891 413L894 413L894 419L897 422L903 418L903 414L909 415L915 413L910 409L922 396L926 398L928 401L936 403L937 398L933 395L936 392L932 389L935 387L939 392L940 391L949 395L949 390L955 391L955 385L959 383L960 380L968 377L971 376L972 378L972 376L975 381L975 377L979 377L977 375L980 372L976 374L976 371L969 371L965 374L959 370L944 368L943 362L932 355L922 360L924 355L921 350L922 347L916 351L906 347L905 344L908 337L901 327L897 326L896 330L895 328L897 319L890 324L893 324L894 328L892 334L888 338L881 338L881 349L872 352L870 345L863 349L859 345L855 347L848 341L845 345L844 331L841 325L834 325L828 330L818 321L814 323L810 321L812 314L816 314L828 306L830 300L834 299L838 292L843 292L843 290L847 291L849 281L856 283L864 275L871 273L870 268L860 264L848 271L843 271L836 284L832 284L831 280L827 277L822 280L819 283L819 287L813 290L811 296L806 297L804 302L801 300L796 306L779 310L776 317L770 318L767 322L770 325L765 324L762 327L759 325L755 326L754 331L746 333L747 343L745 342L729 355L732 359L730 361L725 363L724 362L727 360L723 357L718 358L718 363L722 365L722 381L726 383L724 386L726 389L722 391L710 387L688 372L688 369L695 364L692 359L696 356L694 353L691 358L688 357L687 348L682 349L674 346L654 350L617 349L607 294L578 290L578 259L582 260L583 216L569 222L553 190L532 175L522 159L518 157L496 169L430 163L355 174L307 121L305 111L276 90L187 36L164 20L20 64L20 335ZM856 420L857 430L863 433L863 436L860 441L869 439L865 433L868 430L863 432L860 421L856 420ZM859 414L859 416L859 414ZM894 418L894 418ZM896 435L898 438L904 434L901 432L896 435Z";
  const proj = (lat, lon) => [20 + (lon - 55.99855) * 0.75471 * 73.88454, 20 + (45.59068 - lat) * 73.88454];

  // [широта, долгота, названия на языках: uz, uzc, ru, en, tr, de, zh, ko]
  const C = {
    tashkent: [41.2995, 69.2401, ["Toshkent", "Тошкент", "Ташкент", "Tashkent", "Taşkent", "Taschkent", "塔什干", "타슈켄트"]],
    samarkand: [39.6542, 66.9597, ["Samarqand", "Самарқанд", "Самарканд", "Samarkand", "Semerkant", "Samarkand", "撒马尔罕", "사마르칸트"]],
    bukhara: [39.7747, 64.4286, ["Buxoro", "Бухоро", "Бухара", "Bukhara", "Buhara", "Buchara", "布哈拉", "부하라"]],
    khiva: [41.3783, 60.3639, ["Xiva", "Хива", "Хива", "Khiva", "Hiva", "Chiwa", "希瓦", "히바"]],
    kokand: [40.5286, 70.9425, ["Qo‘qon", "Қўқон", "Коканд", "Kokand", "Hokand", "Kokand", "浩罕", "코칸드"]],
    margilan: [40.4719, 71.7247, ["Marg‘ilon", "Марғилон", "Маргилан", "Margilan", "Margilan", "Margilan", "马尔吉兰", "마르길란"]],
    andijan: [40.7821, 72.3442, ["Andijon", "Андижон", "Андижан", "Andijan", "Andican", "Andischan", "安集延", "안디잔"]],
    namangan: [40.9983, 71.6726, ["Namangan", "Наманган", "Наманган", "Namangan", "Namangan", "Namangan", "纳曼干", "나망간"]],
    shahrisabz: [39.0578, 66.8342, ["Shahrisabz", "Шаҳрисабз", "Шахрисабз", "Shahrisabz", "Şehrisebz", "Schahrisabs", "沙赫里萨布兹", "샤흐리사브즈"]],
    karshi: [38.8606, 65.7891, ["Qarshi", "Қарши", "Карши", "Karshi", "Karşi", "Karschi", "卡尔希", "카르시"]],
    termez: [37.2242, 67.2783, ["Termiz", "Термиз", "Термез", "Termez", "Tirmiz", "Termez", "铁尔梅兹", "테르메즈"]],
    nukus: [42.4531, 59.6103, ["Nukus", "Нукус", "Нукус", "Nukus", "Nukus", "Nukus", "努库斯", "누쿠스"]],
    muynak: [43.7683, 59.0214, ["Mo‘ynoq", "Мўйноқ", "Муйнак", "Muynak", "Muynak", "Muynak", "穆伊纳克", "무이나크"]],
    nurata: [40.5614, 65.6886, ["Nurota", "Нурота", "Нурата", "Nurata", "Nurata", "Nurata", "努拉塔", "누라타"]]
  };
  const ROUTES = [
    ["tashkent", "samarkand", "bukhara", "khiva"],          // Великий шёлковый путь
    ["tashkent", "kokand", "margilan", "andijan", "namangan"], // Ферганская долина
    ["samarkand", "shahrisabz", "karshi", "termez"],         // Юг
    ["bukhara", "khiva", "nukus", "muynak"],                 // К Аральскому морю
    ["khiva", "bukhara", "nurata", "samarkand", "tashkent"], // С запада на восток
    ["tashkent", "samarkand", "shahrisabz", "termez"]
  ];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } }
  };
  const LANGS = ["uz", "uzc", "ru", "en", "tr", "de", "zh", "ko"];
  let lang = store.get("safar_lang") || (navigator.language || "ru").toLowerCase();
  if (lang.startsWith("uz-cyrl")) lang = "uzc";
  if (!LANGS.includes(lang)) lang = LANGS.includes(lang.slice(0, 2)) ? lang.slice(0, 2) : "ru";
  const NI = LANGS.indexOf(lang);
  el.querySelector(".sp-tag").textContent = ["O‘zbekiston bo‘ylab sayohat", "Ўзбекистон бўйлаб саёҳат", "Путешествие по Узбекистану",
    "Journey through Uzbekistan", "Özbekistan'da yolculuk", "Reise durch Usbekistan", "乌兹别克斯坦之旅", "우즈베키스탄 여행"][NI];

  const params0 = new URLSearchParams(location.search);
  // Время суток в Ташкенте → палитра неба
  let hour = new Date().getUTCHours() + 5;
  try { hour = +new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", hour: "numeric", hourCycle: "h23" }).format(new Date()); } catch { /* старый браузер */ }
  hour %= 24;
  el.dataset.phase = params0.get("phase") || (hour >= 5 && hour < 8 ? "dawn" : hour < 17 && hour >= 8 ? "day" : hour >= 17 && hour < 21 ? "dusk" : "night");

  // Отладка дизайна: ?splash — не закрывать заставку (&short — короткая версия, &route=2 — маршрут, &phase=day — время суток)
  const params = new URLSearchParams(location.search);
  const freeze = params.has("splash") ? +params.get("splash") || 0 : null;

  // Короткая версия, если заставку видели недавно или пользователь просит меньше анимации
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const short = params.has("short") || (freeze == null && (reduce || !!window.Telegram?.WebApp?.initData || Date.now() - (+store.get("safar_splash_seen") || 0) < 6 * 3600e3));
  store.set("safar_splash_seen", Date.now());
  if (short) el.classList.add("short");

  // Случайный маршрут, не повторяющий прошлый
  let ri = Math.floor(Math.random() * ROUTES.length);
  if (String(ri) === store.get("safar_splash_route")) ri = (ri + 1) % ROUTES.length;
  if (params.has("route")) ri = (+params.get("route") || 0) % ROUTES.length;
  store.set("safar_splash_route", ri);
  const stops = ROUTES[ri].map(id => C[id]);
  const pts = stops.map(c => proj(c[0], c[1]));

  // Плавные дуги между городами
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  pts.slice(1).forEach(([x, y], i) => {
    const [px, py] = pts[i];
    const s = (i % 2 ? 1 : -1) * 0.22;
    d += ` Q${((px + x) / 2 - (y - py) * s).toFixed(1)} ${((py + y) / 2 + (x - px) * s).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  // ---------- Кадр: приближение к маршруту ----------
  const target = (() => {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    let w = Math.max(Math.max(...xs) - Math.min(...xs) + 280, (Math.max(...ys) - Math.min(...ys) + 240) * 1000 / 661, 420);
    w = Math.min(w, 1300);
    const h = w * 661 / 1000;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return [Math.min(Math.max(cx - w / 2, -150), 1150 - w), Math.min(Math.max(cy - h / 2, -100), 761 - h), w, h];
  })();
  const kT = target[2] / 1000;

  // Подписи городов: сверху, снизу, справа или слева — где нет пересечений (в масштабе конечного кадра)
  const LBL = [[0, -22, "middle"], [0, 48, "middle"], [18, 10, "start"], [-18, 10, "end"]];
  const placed = [];
  const labels = pts.map(([x, y], i) => {
    // Ширина подписи: иероглифы и хангыль шире латиницы
    const name = stops[i][2][NI], w = [...name].reduce((a, ch) => a + (/[　-鿿가-힯]/.test(ch) ? 30 : 17), 0), X = x / kT, Y = y / kT;
    const box = ([dx, dy, an]) => {
      const left = an === "middle" ? X + dx - w / 2 : an === "start" ? X + dx : X + dx - w;
      return [left, Y + dy - 26, left + w, Y + dy + 4];
    };
    const hit = r => placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) ||
      pts.some(([px, py], j) => j !== i && px / kT > r[0] - 10 && px / kT < r[2] + 10 && py / kT > r[1] - 10 && py / kT < r[3] + 10);
    const opt = LBL.find(o => !hit(box(o))) || LBL[0];
    placed.push(box(opt));
    return opt;
  });

  // Карта сразу в конечном кадре (приближена к маршруту): движение даёт CSS — только transform и opacity,
  // поэтому заставка остаётся плавной, даже пока браузер загружает данные приложения
  const k = kT.toFixed(4);
  const svg = el.querySelector("#spMap");
  svg.setAttribute("viewBox", target.map(v => v.toFixed(1)).join(" "));
  svg.innerHTML = `
    <path class="sp-country" d="${UZ_PATH}"/>
    <path class="sp-route-bg" d="${d}"/>
    <path class="sp-route" pathLength="1" d="${d}"/>
    ${pts.map(([x, y], i) => `<g class="sp-city" style="--k:${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k})">
      <circle class="sp-ring" r="9"/><circle class="sp-dot" r="8"/>
      <text x="${labels[i][0]}" y="${labels[i][1]}" text-anchor="${labels[i][2]}">${stops[i][2][NI]}</text></g>`).join("")}`;
  const dest = el.querySelector(".sp-dest");
  dest.innerHTML = stops.map((c, i) => `<span style="--k:${i}">${i ? "→ " : ""}${c[2][NI]}</span>`).join(" ");

  // Отладка: ?splash — заставка не закрывается
  if (freeze != null) { window.Splash = { ready() {} }; return; }

  // ---------- Выход: заставка растворяется и слегка приближается, под ней — готовое приложение ----------
  let appReady = false, minTime = false, done = false, onReady = null;
  setTimeout(() => { minTime = true; maybeExit(); }, short ? 450 : 1400);
  el.addEventListener("click", () => { minTime = true; maybeExit(); });

  function maybeExit() {
    if (!appReady || !minTime || done) return;
    done = true;
    // Сначала отрисовываем первый экран под заставкой, и только потом начинаем растворение —
    // тяжёлая работа не попадает на кадры анимации
    document.getElementById("app").classList.remove("hidden");
    onReady?.();
    const remove = () => el.remove();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add("out");
      el.addEventListener("transitionend", e => { if (e.target === el) remove(); });
    }));
    setTimeout(remove, 1200);   // если вкладка не отрисовывается, кадры и transitionend могут не прийти
  }

  window.Splash = {
    // Вызывается приложением, когда данные загружены; cb — отрисовать первый экран
    ready(cb) { appReady = true; onReady = cb; maybeExit(); }
  };
})();
