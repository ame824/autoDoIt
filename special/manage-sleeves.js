import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.sleeves) {
    reportBlocker(ns, "sleeve-api", "Sleeve-Automatisierung ist gesperrt", [
      "Die Sleeve-API benötigt BitNode 10 oder Source-File 10.",
    ], [
      "BitNode 10 abschließen, um Source-File 10 zu erhalten.",
    ]);
    return;
  }

  const count = ns.sleeve.getNumSleeves();
  const money = ns.getPlayer().money;
  for (let index = 0; index < count; index += 1) {
    const sleeve = ns.sleeve.getSleeve(index);
    if (sleeve.shock > 0) {
      ns.sleeve.setToShockRecovery(index);
      continue;
    }
    if (sleeve.sync < 100) {
      ns.sleeve.setToSynchronize(index);
      continue;
    }

    const augs = ns.sleeve
      .getSleevePurchasableAugs(index)
      .sort((a, b) => a.cost - b.cost);
    for (const aug of augs) {
      if (aug.cost > money * CONFIG.sleeveAugBudgetFraction) break;
      if (ns.sleeve.purchaseSleeveAug(index, aug.name)) break;
    }

    const task = ns.sleeve.getTask(index);
    if (task?.type !== "CRIME") ns.sleeve.setToCommitCrime(index, "Homicide");
  }

  reportInfo(ns, "sleeves-active", "Sleeves werden automatisch verwaltet", [
    `${count} Sleeves geprüft.`,
    "Priorität: Schockabbau → Synchronisierung → Homicide.",
  ]);
}

