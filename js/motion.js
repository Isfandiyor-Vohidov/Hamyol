// Анимации интерфейса: элементы появляются при прокрутке (по очереди, у каждого типа свой ход),
// счётчики набирают число, кнопки отвечают волной на нажатие.
// Если в системе включено «Уменьшить движение», модуль ничего не делает.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Что анимируем и как появляется: rise — поднимается, slide — выезжает слева, pop — вырастает, fade — проявляется
  const KINDS = [
    ["rise", ".card, .hero-inner > *, .ai-msg"],
    ["slide", ".row, .off-list > li, .pk-list > li, .svc-row, .bk-row, .phrase, .review, .tour-card, .acc-perks li, .timeline .stop, .timeline .move, .biz-place"],
    ["pop", ".stat, .rc-card, .guide-tile, .wcard, .sos-card, .rate, .fact, .forecast > div, .tip"],
    ["fade", ".block-head, .panel, .day-card, .viz, .wiki, .now-weather, .chips:not(.food-flags) > .chip, .seg, .filters, .m-actions > *, .map-controls > *, .review-form, .claim-box"]
  ];
  const SEL = KINDS.map(k => k[1]).join(",");
  // Не трогаем: карту, заставку, подсказки поиска и графиков
  // Вкладки-панели (.tm-pane, .m-pane) появляются своей анимацией: скрытые в момент подготовки они остались бы прозрачными
  const SKIP = ".leaflet-container, #splash, .search-results, .viz-tip, .tm-pane, .m-pane:not(.active)";
  // Блоки, которые перерисовываются при каждом изменении: анимируем только первый показ
  const ONCE = "#tripDays, #ratesBox, #packBox, #offSaved, #offResults";
  const STEP = 55, MAX_STEPS = 8;

  const io = new IntersectionObserver(entries => {
    let i = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      show(e.target, Math.min(i++, MAX_STEPS) * STEP);
    }
  }, { rootMargin: "0px 0px -5% 0px", threshold: 0.01 });

  function prepare(el) {
    if (el.dataset.rv || el.closest(SKIP)) return;
    if (!el.getClientRects().length) return;   // скрыт (display: none) — без анимации, иначе останется прозрачным, когда его покажут
    const once = el.closest(ONCE);
    if (once) {
      if (once._rvSeen) return;
      setTimeout(() => { once._rvSeen = true; });
    }
    el.dataset.rv = KINDS.find(([, s]) => el.matches(s))[0];
    el.classList.add("rv");
    io.observe(el);
    // Страховка: если наблюдатель не сработал (вкладка не отрисовывается), видимое не должно остаться пустым
    setTimeout(() => {
      if (!el.classList.contains("rv") || el.classList.contains("rv-in") || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < innerHeight) { io.unobserve(el); show(el, 0); }
    }, 2000);
  }

  function show(el, delay) {
    el.style.setProperty("--rv-d", delay + "ms");
    el.classList.add("rv-in");
    const done = e => {
      if (e && e.target !== el) return;
      el.removeEventListener("animationend", done);
      el.classList.remove("rv", "rv-in");
      el.style.removeProperty("--rv-d");
      delete el.dataset.rv;
    };
    el.addEventListener("animationend", done);
    setTimeout(done, delay + 1200);   // на случай, если элемент скрыли посреди анимации
    if (el.matches(".stat")) countUp(el.querySelector("b"), delay);
  }

  function scan(root) {
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    if (root.matches(SEL)) prepare(root);
    root.querySelectorAll(SEL).forEach(prepare);
  }
  function forget(root) {
    if (root.nodeType !== 1) return;
    if (root.classList.contains("rv")) io.unobserve(root);
    root.querySelectorAll(".rv").forEach(el => io.unobserve(el));
  }

  // Новые элементы (списки, карточки, окна) готовим к появлению сразу при вставке
  new MutationObserver(list => {
    for (const m of list) {
      // Карта добавляет и убирает сотни маркеров при каждом сдвиге — такие изменения пропускаем сразу
      if (m.target.closest?.(SKIP)) continue;
      m.removedNodes.forEach(forget);
      m.addedNodes.forEach(scan);
    }
  }).observe(document.body, { childList: true, subtree: true });
  scan(document.body);

  // Счётчики на главной: от нуля до значения
  function countUp(b, delay) {
    if (!b) return;
    const target = +b.textContent.replace(/\D/g, "");
    if (!target) return;
    const fmt = n => typeof fmtNum === "function" ? fmtNum(n) : String(Math.round(n));
    const start = performance.now() + delay, dur = 1100;
    b.textContent = fmt(0);
    const step = now => {
      if (!b.isConnected) return;
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      b.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Итоговое число — даже если кадры не рисуются (фоновая вкладка)
    setTimeout(() => { if (b.isConnected) b.textContent = fmt(target); }, delay + dur + 80);
  }

  // Раскрывающиеся блоки (<details>): высота меняется плавно, а не скачком
  const EASE = "cubic-bezier(.16, 1, .3, 1)";
  document.addEventListener("click", e => {
    const sum = e.target.closest("details > summary");
    if (!sum || e.target.closest("a, input, select, textarea") ) return;
    const d = sum.parentElement;
    e.preventDefault();
    d._anim?.cancel();
    const from = d.offsetHeight;
    const closing = d.open;
    d.style.overflow = "hidden";
    if (closing) d.classList.add("closing");
    else d.open = true;
    // Высота в закрытом виде: заголовок плюс отступы и рамка самого блока
    const cs = getComputedStyle(d), px = k => parseFloat(cs[k]) || 0;
    const to = closing ? sum.offsetHeight + px("paddingTop") + px("paddingBottom") + px("borderTopWidth") + px("borderBottomWidth") : d.offsetHeight;
    const anim = d.animate({ height: [from + "px", to + "px"] }, { duration: closing ? 320 : 420, easing: EASE });
    d._anim = anim;
    const done = () => {
      if (d._anim !== anim) return;
      if (closing) d.open = false;
      d.classList.remove("closing");
      d.style.overflow = "";
      d._anim = null;
    };
    anim.onfinish = done;
    setTimeout(done, (closing ? 320 : 420) + 80);   // если кадры не рисуются (фоновая вкладка), событие конца может не прийти
    anim.oncancel = () => { d.classList.remove("closing"); d.style.overflow = ""; };
  });

  // Волна от точки нажатия
  document.addEventListener("pointerdown", e => {
    const el = e.target.closest(".btn, .seg button, .m-tabs button, .chip, .tabs a, .bottom-nav a, .say");
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement("i");
    s.className = "ripple";
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(s);
    s.addEventListener("animationend", () => s.remove());
  });
})();
