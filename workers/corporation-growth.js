import { CORPORATION_UPGRADES } from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation()) return;
  const corporation = corp.getCorporation();
  const upgrade = CORPORATION_UPGRADES
    .map((name) => ({ name, cost: corp.getUpgradeLevelCost(name) }))
    .filter(({ cost }) => Number.isFinite(cost) && cost <= corporation.funds * 0.05)
    .sort((a, b) => a.cost - b.cost)[0];
  if (upgrade) {
    corp.levelUpgrade(upgrade.name);
    return;
  }
  for (const divisionName of corporation.divisions) {
    const cost = corp.getHireAdVertCost(divisionName);
    if (cost <= corp.getCorporation().funds * 0.03) {
      corp.hireAdVert(divisionName);
      return;
    }
  }
}
