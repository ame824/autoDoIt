import { jobAllocation, officeTargetSize } from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation() || !corp.hasUnlock("Office API")) return;
  const corporation = corp.getCorporation();
  for (const divisionName of corporation.divisions) {
    const division = corp.getDivision(divisionName);
    for (const city of division.cities) {
      let office = corp.getOffice(divisionName, city);
      const target = officeTargetSize(division, city, corporation.funds);
      if (office.size < target) {
        const amount = Math.min(target - office.size, division.makesProducts && city === "Aevum" ? 15 : 3);
        const cost = corp.getOfficeSizeUpgradeCost(divisionName, city, amount);
        if (cost <= corp.getCorporation().funds * 0.03) corp.upgradeOfficeSize(divisionName, city, amount);
      }
      office = corp.getOffice(divisionName, city);
      while (office.numEmployees < office.size) {
        if (!corp.hireEmployee(divisionName, city)) break;
        office = corp.getOffice(divisionName, city);
      }
      const allocation = jobAllocation(office.size, division.makesProducts, city === "Aevum");
      for (const job of Object.keys(allocation)) corp.setJobAssignment(divisionName, city, job, 0);
      for (const [job, amount] of Object.entries(allocation)) {
        corp.setJobAssignment(divisionName, city, job, amount);
      }
    }
  }
}
