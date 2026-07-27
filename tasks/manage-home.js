import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { affordable } from "../lib/logic.js";
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
  const choices = [
    {
      type: "RAM",
      cost: ns.singularity.getUpgradeHomeRamCost(),
      buy: () => ns.singularity.upgradeHomeRam(),
    },
    {
      type: "Kerne",
      cost: ns.singularity.getUpgradeHomeCoresCost(),
      buy: () => ns.singularity.upgradeHomeCores(),
    },
  ]
    .filter(({ cost }) => Number.isFinite(cost) && cost >= 0)
    .sort((a, b) => a.cost - b.cost);

  const next = choices[0];
  if (!next) return;
  if (!affordable(next.cost, money, CONFIG.homeUpgradeBudgetFraction)) {
    reportInfo(ns, "home-upgrade-saving", "Home-Upgrade wartet auf Budget", [
      `${next.type}: ${ns.format.number(next.cost)}`,
    ]);
    return;
  }

  if (next.buy()) {
    reportSuccess(ns, `home-${next.type}-${next.cost}`, `Home-${next.type} erweitert`);
  }
}

