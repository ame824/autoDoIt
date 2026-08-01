/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation() || !corp.hasUnlock("Office API")) return;
  for (const divisionName of corp.getCorporation().divisions) {
    const division = corp.getDivision(divisionName);
    for (const city of division.cities) {
      const office = corp.getOffice(divisionName, city);
      if (office.avgEnergy < 98) corp.buyTea(divisionName, city);
      if (office.avgMorale < 98) corp.throwParty(divisionName, city, 500_000);
    }
  }
}
