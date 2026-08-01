import { reportSuccess } from "../core/notifier.js";
import { CORPORATION_CITIES } from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation() || !corp.hasUnlock("Warehouse API")) return;
  const corporation = corp.getCorporation();
  for (const divisionName of corporation.divisions) {
    let division = corp.getDivision(divisionName);
    for (const city of CORPORATION_CITIES) {
      if (!division.cities.includes(city)) {
        try {
          corp.expandCity(divisionName, city);
          reportSuccess(ns, `corporation-city-${divisionName}-${city}`, `Corporation nach ${city} erweitert`);
        } catch { return; }
        return;
      }
      if (!corp.hasWarehouse(divisionName, city)) {
        if (corp.getCorporation().funds < corp.getConstants().warehouseInitialCost) return;
        corp.purchaseWarehouse(divisionName, city);
        reportSuccess(ns, `corporation-warehouse-${divisionName}-${city}`, `Corporation-Lager in ${city} gekauft`);
        return;
      }
    }
  }
}
