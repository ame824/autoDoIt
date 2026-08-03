import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { readNodeRushState, spendableMoney } from "../lib/node-rush.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).active) return;
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-home", "Home-Kerne müssen noch manuell erweitert werden", [
      "Automatische Kern-Upgrades benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Home-Kerne bei verfügbarem Budget manuell erweitern.",
    ]);
    return;
  }

  const money = ns.getPlayer().money;
  const spendable = spendableMoney(money, readNodeRushState(ns));
  let budget = spendable * CONFIG.homeUpgradeBudgetFraction;
  let coreUpgrades = 0;

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const cost = ns.singularity.getUpgradeHomeCoresCost();
    if (!Number.isFinite(cost) || cost < 0 || cost > budget) break;
    if (!ns.singularity.upgradeHomeCores()) break;
    budget -= cost;
    coreUpgrades += 1;
  }

  if (coreUpgrades > 0) {
    reportSuccess(ns, `home-core-batch-${coreUpgrades}`, "Home-Server erweitert", [
      `${coreUpgrades} Kern-Upgrades gekauft.`,
      "Das Ziel für gleichzeitigen Modulbetrieb ist bereits erreicht.",
    ]);
    return;
  }

  const nextCoreCost = ns.singularity.getUpgradeHomeCoresCost();
  if (Number.isFinite(nextCoreCost)) {
    reportInfo(ns, "home-core-saving", "Home-Upgrade wartet auf Budget", [
      `Nächstes Kern-Upgrade: ${ns.format.number(nextCoreCost)}`,
      `Freigegebenes Budget: ${ns.format.number(spendable * CONFIG.homeUpgradeBudgetFraction)}`,
    ]);
  }
}
