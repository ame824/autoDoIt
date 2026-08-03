import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { readNodeRushState, spendableMoney } from "../lib/node-rush.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).ramOnly) return;
  let budget = spendableMoney(ns.getPlayer().money, readNodeRushState(ns)) *
    CONFIG.sleeveAugBudgetFraction;
  const count = ns.sleeve.getNumSleeves();
  for (let index = 0; index < count; index += 1) {
    const sleeve = ns.sleeve.getSleeve(index);
    if (sleeve.shock > 0 || sleeve.sync < 100) continue;
    const augmentations = ns.sleeve.getSleevePurchasableAugs(index)
      .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name));
    const augmentation = augmentations.find(({ cost }) => cost <= budget);
    if (augmentation && ns.sleeve.purchaseSleeveAug(index, augmentation.name)) {
      budget -= augmentation.cost;
    }
  }
}
