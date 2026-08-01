/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (
    !corp.hasCorporation() ||
    !corp.hasUnlock("Warehouse API") ||
    !corp.hasUnlock("Office API")
  ) return;
  for (const divisionName of corp.getCorporation().divisions) {
    const division = corp.getDivision(divisionName);
    if (!division.makesProducts || division.cities.length === 0) continue;
    const city = division.cities.includes("Aevum") ? "Aevum" : division.cities[0];
    const marketTa2 = corp.hasResearched(divisionName, "Market-TA.II");
    for (const productName of division.products) {
      const product = corp.getProduct(divisionName, city, productName);
      if (product.developmentProgress < 100) continue;
      corp.sellProduct(divisionName, city, productName, "MAX", "MP", true);
      if (marketTa2) corp.setProductMarketTA2(divisionName, productName, true);
    }
  }
}
