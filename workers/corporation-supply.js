/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation() || !corp.hasUnlock("Warehouse API")) return;
  const smartSupply = corp.hasUnlock("Smart Supply");
  for (const divisionName of corp.getCorporation().divisions) {
    const division = corp.getDivision(divisionName);
    for (const city of division.cities) {
      if (!corp.hasWarehouse(divisionName, city)) continue;
      const warehouse = corp.getWarehouse(divisionName, city);
      if (smartSupply && !warehouse.smartSupplyEnabled) corp.setSmartSupply(divisionName, city, true);
      if (division.industry === "Agriculture") {
        corp.sellMaterial(divisionName, city, "Food", "MAX", "MP");
        corp.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
      }
    }
  }
}
