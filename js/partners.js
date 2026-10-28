// «Для бизнеса» (#partners): что даёт заведению Safar и тариф «Партнёр», заявка в один тап через Telegram-бота.
const BIZ_PERKS = [
  ["star", "bz_p1", "bz_p1_sub"], ["image", "bz_p2", "bz_p2_sub"], ["message", "bz_p3", "bz_p3_sub"],
  ["trending", "bz_p4", "bz_p4_sub"], ["languages", "bz_p5", "bz_p5_sub"], ["badge-check", "bz_p6", "bz_p6_sub"]
];
function openPartners() {
  const bot = SAFAR_CONFIG?.telegramBot;
  openModal(`
    <div class="m-head" style="background:var(--ornament), var(--g-s);min-height:170px;padding-top:66px"><h2>${icon("store")} ${t("bz_title")}</h2><p>${t("bz_sub")}</p></div>
    <div class="m-body">
      <div class="bz-perks">${BIZ_PERKS.map(([ic, k, s], i) => `
        <div class="bz-perk" style="--n:${i}"><i>${icon(ic)}</i><span><b>${t(k)}</b><small>${t(s)}</small></span></div>`).join("")}</div>
      <h3>${t("bz_how")}</h3>
      <ol class="bz-steps">
        <li>${t("bz_s1")}</li><li>${t("bz_s2")}</li><li>${t("bz_s3")}</li>
      </ol>
      <div class="bz-cta">
        ${bot ? `<a class="btn gold-btn" href="https://t.me/${esc(bot)}?start=biz" target="_blank" rel="noopener">${icon("tg")} ${t("bz_apply")}</a>` : ""}
        <a class="btn ghost" href="#business">${icon("arrow-right")} ${t("biz_open")}</a>
        <a class="btn ghost" href="#poster">${icon("print")} ${t("ps_title")}</a>
      </div>
      <p class="hint">${t("bz_note")}</p>
    </div>`);
}
EXT.routes.partners = openPartners;
// Ссылка в подвале главной, рядом с документами
EXT.onHome.push(() => {
  const el = $("#legalFooter");
  if (el && !el.querySelector("[href='#partners']")) el.insertAdjacentHTML("beforeend", `<a href="#partners">${icon("store")} ${t("bz_title")}</a>`);
});
