import { BOOST_MATERIALS, boostMaterialTargets } from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation() || !corp.hasUnlock("Warehouse API")) return;
  const corporation = corp.getCorporation();
  const sizes = Object.fromEntries(BOOST_MATERIALS.map(([material]) => [
    material,
    corp.getMaterialData(material).size,
  ]));
  let budget = corporation.funds * 0.02;
  for (const divisionName of corporation.divisions) {
    const division = corp.getDivision(divisionName);
    const industry = corp.getIndustryData(division.industry);
    for (const city of division.cities) {
      if (!corp.hasWarehouse(divisionName, city)) continue;
      const warehouse = corp.getWarehouse(divisionName, city);
      const targets = boostMaterialTargets(industry, warehouse.size, sizes);
      for (const [material, target] of Object.entries(targets)) {
        const current = corp.getMaterial(divisionName, city, material);
        const amount = Math.max(0, target - current.stored);
        const affordable = Math.floor(budget / Math.max(1, current.marketPrice));
        const freeCapacity = Math.max(0, warehouse.size - warehouse.sizeUsed);
        const fits = Math.floor(freeCapacity / Math.max(0.0001, sizes[material]) * 0.95);
        const purchase = Math.min(amount, affordable, fits);
        if (purchase <= 0) continue;
        try { corp.bulkPurchase(divisionName, city, material, purchase); } catch { continue; }
        budget -= purchase * current.marketPrice;
        if (budget <= 0) return;
      }
    }
  }
}
