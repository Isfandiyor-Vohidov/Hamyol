// Жесты пальцем (выключаются в настройках «Aa» → «Листать разделы свайпом»):
//  • свайп влево / вправо — страница едет за пальцем, из-за края выезжает соседний раздел нижнего меню.
//    Срабатывает только на явный горизонтальный жест: при прокрутке вниз/вверх и в лентах не мешает;
//    раздел меняется, если протянуть дальше 40% экрана или уверенно смахнуть;
//  • свайп от левого края — «Назад», только в приложении на iPhone (на Android и в браузере у системы свой жест).
(() => {
  const EDGE = 20, DUR = 280;
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("calm");
  const swipeOn = () => typeof dispGet !== "function" || dispGet().swipe;
  const edgeOn = () => typeof IS_IOS !== "undefined" && IS_IOS && IS_STANDALONE && !window.Telegram?.WebApp?.initData;
  let g = null, arrow = null, busy = false, lastScroll = 0;
  addEventListener("scroll", () => { lastScroll = Date.now(); }, { passive: true });

  const tabsOrder = () => $$(".bottom-nav [data-tab]").map(a => a.dataset.tab);
  const modalOpen = () => !$("#modal").classList.contains("hidden");
  const blocked = el => el.closest(`.leaflet-container, input, textarea, select, button, label, [contenteditable], .picker, .picker-menu,
    #onb, #consentDlg, #dispSheet, .nav-wrap, .nav-sheet, .rv-photos, .lightbox, .m-tabs, .chips, [data-noswipe]`);
  // Элемент, который сам листается вбок (ленты карточек, вкладки) — свайп оставляем ему
  function scrollsX(el) {
    for (; el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 4) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
    }
    return false;
  }
  const W = () => window.innerWidth;
  const setX = (el, x, anim) => {
    if (!el) return;
    el.style.transition = anim ? `transform ${DUR}ms cubic-bezier(.2,.7,.2,1)` : "none";
    el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
  };

  function preparePeer(s, dir) {
    const order = tabsOrder(), i = order.indexOf(currentTab);
    const name = order[i + (dir < 0 ? 1 : -1)];
    s.cur = $(".tab.active");
    if (!name || !s.cur) return;
    const peer = $("#tab-" + name);
    if (!peer) return;
    if (!rendered[name] && name !== "map" && name !== "budget") { rendered[name] = true; RENDER[name]?.(); }
    const r = s.cur.getBoundingClientRect();
    Object.assign(peer.style, { top: r.top + scrollY + "px", left: r.left + "px", width: r.width + "px" });
    peer.classList.add("swipe-peer");
    s.peer = peer; s.peerName = name; s.peerSide = dir < 0 ? 1 : -1;
  }
  function clearPeer(s) {
    if (s.peer) { s.peer.classList.remove("swipe-peer"); s.peer.style.cssText = ""; }
    if (s.cur) s.cur.style.cssText = "";
  }

  function showArrow(p) {
    if (!arrow) {
      document.body.insertAdjacentHTML("beforeend", `<div class="swipe-back" aria-hidden="true">${icon("arrow-left")}</div>`);
      arrow = $(".swipe-back");
    }
    arrow.style.setProperty("--p", Math.min(1, p));
    arrow.classList.toggle("ready", p >= 1);
  }
  function hideArrow() {
    if (!arrow) return;
    const a = arrow; arrow = null;
    a.classList.add("out");
    setTimeout(() => a.remove(), 200);
  }

  document.addEventListener("touchstart", e => {
    g = null;
    if (busy || e.touches.length !== 1) return;
    const p = e.touches[0], edge = p.clientX < EDGE && edgeOn();
    if (!edge) {
      if (!swipeOn() || modalOpen() || currentTab === "map" || Date.now() - lastScroll < 300) return;   // страница ещё едет после прокрутки
      if (blocked(e.target) || scrollsX(e.target)) return;
    }
    g = { x: p.clientX, y: p.clientY, edge, dir: null, lastX: p.clientX, lastT: Date.now(), v: 0 };
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (!g) return;
    const p = e.touches[0], dx = p.clientX - g.x, dy = p.clientY - g.y, now = Date.now();
    g.v = (p.clientX - g.lastX) / Math.max(1, now - g.lastT); g.lastX = p.clientX; g.lastT = now;
    if (!g.dir) {
      // Решаем, какой это жест, только после заметного движения: горизонталь — если вбок в 2,2 раза больше, чем вниз
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
      if (Math.abs(dx) < Math.abs(dy) * 2.2) return (g = null);
      g.dir = "x"; g.x0 = dx;
      if (!g.edge) preparePeer(g, dx);
    }
    const x = dx - g.x0;   // без рывка на старте
    if (g.edge) {
      if (modalOpen()) setX($("#modal"), Math.max(0, dx));
      else showArrow(dx / 120);
      return;
    }
    if (!g.peer) { setX(g.cur, x * 0.2); return; }
    const xx = g.peerSide > 0 ? Math.min(0, x) : Math.max(0, x);
    setX(g.cur, xx);
    setX(g.peer, xx + g.peerSide * W());
  }, { passive: true });

  function finish(e) {
    if (!g) return;
    const s = g; g = null;
    if (s.dir !== "x") return;
    const p = e?.changedTouches?.[0], dx = p ? p.clientX - s.x - s.x0 : 0;
    const flick = Math.abs(s.v) > 0.7 && Math.abs(dx) > 90 && Math.sign(s.v) === Math.sign(dx);

    if (s.edge) {
      const ready = arrow?.classList.contains("ready");
      hideArrow();
      const go = dx > 0 && (dx > W() * 0.35 || flick || ready);
      if (modalOpen()) {
        const m = $("#modal");
        if (!go) { setX(m, 0, true); setTimeout(() => (m.style.cssText = ""), DUR); return; }
        setX(m, W(), true);
        setTimeout(() => { goBack(); setTimeout(() => (m.style.cssText = ""), 50); }, reduce() ? 0 : DUR);
        return;
      }
      if (go) goBack();
      return;
    }

    if (!s.peer) { setX(s.cur, 0, true); setTimeout(() => s.cur && (s.cur.style.cssText = ""), DUR); return; }
    const toward = s.peerSide > 0 ? dx < 0 : dx > 0;
    const go = toward && (Math.abs(dx) > W() * 0.4 || flick);
    busy = true;
    if (go) {
      setX(s.cur, -s.peerSide * W(), true);
      setX(s.peer, 0, true);
      setTimeout(() => {
        s.peer.classList.add("swiped");
        clearPeer(s);
        window.scrollTo(0, 0);
        goTab(s.peerName);
        setTimeout(() => { s.peer.classList.remove("swiped"); busy = false; }, 60);
      }, reduce() ? 0 : DUR);
    } else {
      setX(s.cur, 0, true);
      setX(s.peer, s.peerSide * W(), true);
      setTimeout(() => { clearPeer(s); busy = false; }, DUR);
    }
  }
  document.addEventListener("touchend", finish, { passive: true });
  document.addEventListener("touchcancel", () => {
    if (g?.cur || g?.peer) clearPeer(g);
    if (g?.edge) $("#modal").style.cssText = "";
    g = null; hideArrow();
  }, { passive: true });
})();
