// Destination switching is deliberately available only from the Account screen.
const IS_MK_APP = window.SAFAR_APP === "mecca";

async function setRegion(region) {
  if (region === "mecca" && !IS_MK_APP) {
    try {
      const response = await fetch("/mecca", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error("Unable to open the Mecca app", error);
      toast(t("rg_open_error"));
      return;
    }
  }

  store.set("safar_region", region);
  // Азербайджан — отдельное приложение /az (оно и открывается первым при входе на сайт)
  if (region === "az") { location.href = "/az"; return; }
  if (IS_MK_APP) {
    if (region === "uz") location.href = "/";
    return;
  }
  if (region === "mecca") location.href = "/mecca";
  else document.documentElement.dataset.region = "uz";
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-pick-region]");
  if (!button || !(button.closest("#accBox") || button.closest(".mk-dir"))) return;
  setRegion(button.dataset.pickRegion);
});

if (!IS_MK_APP) {
  EXT.onInit.push(() => {
    document.documentElement.dataset.region = "uz";
    const addRegionSwitch = () => {
      const box = $("#accBox");
      if (!box || !box.firstElementChild || box.querySelector(".rg-acc")) return;
      box.insertAdjacentHTML("afterbegin", `
        <div class="rg-opts rg-acc">
          <div class="rg-opt rg-uz rg-current"><span class="rg-flag">🇺🇿</span><b>${t("rg_uz")}</b><small>${t("rg_uz_sub")}</small></div>
          <button type="button" class="rg-opt rg-mecca" data-pick-region="mecca"><span class="rg-flag">🕋</span><b>${t("rg_mecca")}</b><small>${t("rg_mecca_sub")}</small></button>
          <button type="button" class="rg-opt rg-az" data-pick-region="az"><span class="rg-flag">🇦🇿</span><b>${t("rg_az")}</b><small>${t("rg_az_sub")}</small></button>
        </div>`);
    };
    new MutationObserver(addRegionSwitch).observe($("#modalBody") || document.body, { childList: true, subtree: true });
  });
}
