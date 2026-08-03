import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).ramOnly) return;
  let budget = ns.getPlayer().money * CONFIG.sleeveAugBudgetFraction;
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
