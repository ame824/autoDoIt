import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.gang.inGang() || readHomeRamFocus(ns).ramOnly) return;
  const members = ns.gang.getMemberNames();
  let budget = ns.getPlayer().money * CONFIG.gangEquipmentBudgetFraction;
  const equipment = ns.gang.getEquipmentNames()
    .map((name) => ({ name, cost: ns.gang.getEquipmentCost(name) }))
    .sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name));

  for (const { name, cost } of equipment) {
    for (const member of members) {
      if (cost > budget) return;
      const info = ns.gang.getMemberInformation(member);
      const owned = new Set([...(info.upgrades ?? []), ...(info.augmentations ?? [])]);
      if (!owned.has(name) && ns.gang.purchaseEquipment(member, name)) budget -= cost;
    }
  }
}
