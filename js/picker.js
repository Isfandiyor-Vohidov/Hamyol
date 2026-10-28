// Красивые выпадающие списки вместо системных (язык и валюта в шапке).
// Настоящий <select> остаётся в разметке, только скрыт: его значение и событие change используют остальные модули.
// render(option, inButton) — HTML пункта; клавиатура: ↑ ↓ Home End Enter Esc.
function enhanceSelect(sel, render) {
  if (!sel || sel.closest(".picker")) return;
  const wrap = document.createElement("div");
  wrap.className = "picker picker-" + sel.id;
  sel.after(wrap);
  wrap.append(sel);
  sel.classList.add("picker-native");
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "picker-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", sel.getAttribute("aria-label") || "");
  const menu = document.createElement("div");
  menu.className = "picker-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrap.append(btn, menu);

  const sync = () => {
    const o = sel.selectedOptions[0];
    btn.innerHTML = (o ? render(o, true) : "") + icon("chevron-down", "picker-chev");
  };
  const build = () => {
    menu.innerHTML = [...sel.options].map((o, i) =>
      `<div role="option" class="picker-opt${o.selected ? " on" : ""}" data-i="${i}" aria-selected="${o.selected}" tabindex="-1" style="--n:${i}">${render(o, false)}${icon("check", "picker-check")}</div>`).join("");
  };
  const place = () => {
    // Меню не должно выходить за край экрана
    menu.style.left = menu.style.right = "";
    const r = menu.getBoundingClientRect();
    if (r.left < 8) { menu.style.left = "0"; menu.style.right = "auto"; }
    else if (r.right > innerWidth - 8) { menu.style.right = "0"; menu.style.left = "auto"; }
  };
  const open = () => {
    document.querySelectorAll(".picker.open").forEach(p => p !== wrap && p._close());
    clearTimeout(menu._t);
    menu.classList.remove("closing");
    build();
    menu.hidden = false;
    place();
    wrap.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    (menu.querySelector(".on") || menu.firstElementChild)?.focus({ preventScroll: true });
  };
  const close = focus => {
    if (menu.hidden || menu.classList.contains("closing")) return;
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    if (focus) btn.focus();
    // Анимация закрытия, затем прячем
    menu.classList.add("closing");
    clearTimeout(menu._t);
    menu._t = setTimeout(() => { menu.classList.remove("closing"); menu.hidden = true; }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 170);
  };
  const pick = i => {
    if (i < 0) return;
    if (sel.selectedIndex !== i) {
      sel.selectedIndex = i;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sync();
    close(true);
  };

  btn.addEventListener("click", () => menu.hidden ? open() : close());
  btn.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
  menu.addEventListener("click", e => { const o = e.target.closest(".picker-opt"); if (o) pick(+o.dataset.i); });
  menu.addEventListener("keydown", e => {
    const items = [...menu.children];
    let i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") i = Math.min(items.length - 1, i + 1);
    else if (e.key === "ArrowUp") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = items.length - 1;
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); return pick(i); }
    else if (e.key === "Escape") { e.preventDefault(); return close(true); }
    else if (e.key === "Tab") return close();
    else return;
    e.preventDefault();
    items[i]?.focus();
  });
  // Касание мимо открытого меню только закрывает его. Само нажатие «проглатываем»: иначе на телефоне
  // оно проваливалось на то, что под пальцем (например, кнопку аккаунта рядом с выбором языка)
  document.addEventListener("pointerdown", e => {
    if (wrap.contains(e.target)) return;
    if (menu.hidden) return;
    close();
    const block = ev => { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); };
    document.addEventListener("click", block, { capture: true, once: true });
    setTimeout(() => document.removeEventListener("click", block, { capture: true }), 700);
  });
  window.addEventListener("resize", () => close());

  wrap._sync = sync;
  wrap._close = () => close();
  sync();
}
// После программной смены значения или пересборки списка (смена языка)
const syncPickers = () => document.querySelectorAll(".picker").forEach(p => p._sync?.());
