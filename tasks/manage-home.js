import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-home", "Home-Upgrades müssen noch manuell gekauft werden", [
      "Automatische RAM- und Kern-Upgrades benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Home-RAM bei verfügbarem Budget manuell erweitern.",
    ]);
    return;
  }

  const money = ns.getPlayer().money;
  let budget = money * CONFIG.homeUpgradeBudgetFraction;
  const ramBefore = ns.getServerMaxRam("home");
  let ramUpgrades = 0;
  let coreUpgrades = 0;

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const cost = ns.singularity.getUpgradeHomeRamCost();
    if (!Number.isFinite(cost) || cost < 0 || cost > budget) break;
    if (!ns.singularity.upgradeHomeRam()) break;
    budget -= cost;
    ramUpgrades += 1;
  }

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const cost = ns.singularity.getUpgradeHomeCoresCost();
    if (!Number.isFinite(cost) || cost < 0 || cost > budget) break;
    if (!ns.singularity.upgradeHomeCores()) break;
    budget -= cost;
    coreUpgrades += 1;
  }

  if (ramUpgrades > 0 || coreUpgrades > 0) {
    const ramAfter = ns.getServerMaxRam("home");
    reportSuccess(ns, `home-batch-${ramAfter}-${coreUpgrades}`, "Home-Server erweitert", [
      ramUpgrades > 0
        ? `${ramUpgrades} RAM-Upgrades: ${ns.format.ram(ramBefore)} → ${ns.format.ram(ramAfter)}`
        : "RAM ist innerhalb des aktuellen Budgets bereits optimal.",
      coreUpgrades > 0 ? `${coreUpgrades} Kern-Upgrades gekauft.` : "Keine zusätzlichen Kerne gekauft.",
    ]);
    return;
  }

  const nextRamCost = ns.singularity.getUpgradeHomeRamCost();
  if (Number.isFinite(nextRamCost)) {
    reportInfo(ns, "home-upgrade-saving", "Home-Upgrade wartet auf Budget", [
      `Nächstes RAM-Upgrade: ${ns.format.number(nextRamCost)}`,
      `Freigegebenes Budget: ${ns.format.number(money * CONFIG.homeUpgradeBudgetFraction)}`,
    ]);
  }
}
