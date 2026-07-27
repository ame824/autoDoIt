import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const DIVISION = "autoDoIt Agriculture";
const CITIES = ["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"];
const UPGRADES = [
  "Smart Factories",
  "Smart Storage",
  "Wilson Analytics",
  "Nuoptimal Nootropic Injector Implants",
  "Speech Processor Implants",
  "Neural Accelerators",
  "FocusWires",
  "ABC SalesBots",
  "Project Insight",
];

function bootstrapOffice(ns, division, city) {
  const corp = ns.corporation;
  const office = corp.getOffice(division, city);
  if (office.size < 6) {
    const cost = corp.getOfficeSizeUpgradeCost(division, city, 6 - office.size);
    if (corp.getCorporation().funds >= cost) corp.upgradeOfficeSize(division, city, 6 - office.size);
  }

  let updated = corp.getOffice(division, city);
  while (updated.numEmployees < updated.size) {
    if (!corp.hireEmployee(division, city)) break;
    updated = corp.getOffice(division, city);
  }

  const size = corp.getOffice(division, city).size;
  const operations = Math.floor(size / 3);
  const engineers = Math.floor(size / 3);
  const business = Math.floor(size / 6);
  const management = size - operations - engineers - business;
  corp.setJobAssignment(division, city, "Operations", operations);
  corp.setJobAssignment(division, city, "Engineer", engineers);
  corp.setJobAssignment(division, city, "Business", business);
  corp.setJobAssignment(division, city, "Management", management);
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.corporation) {
    reportBlocker(ns, "corporation-api", "Corporation-Automatisierung ist gesperrt", [
      "Die Corporation-API benötigt BitNode 3 oder Source-File 3.",
    ], [
      "BitNode 3 abschließen, um Source-File 3 zu erhalten.",
    ]);
    return;
  }

  const corp = ns.corporation;
  if (!corp.hasCorporation()) {
    const useSeedMoney = capabilities.reset.currentNode === 3;
    const selfFund = !useSeedMoney;
    if (
      corp.canCreateCorporation(selfFund) === "Success" &&
      corp.createCorporation("autoDoIt Industries", selfFund)
    ) {
      reportSuccess(ns, "corporation-created", "Corporation gegründet");
    } else {
      reportBlocker(ns, "corporation-create", "Corporation kann noch nicht gegründet werden", [
        selfFund
          ? "Außerhalb von BitNode 3 wird ausreichend eigenes Startkapital benötigt."
          : "Die Startbedingungen dieses BitNodes sind noch nicht erfüllt.",
      ]);
      return;
    }
  }

  let corporation = corp.getCorporation();
  let divisionName = corporation.divisions.find((name) => {
    try {
      return corp.getDivision(name).industry === "Agriculture";
    } catch {
      return false;
    }
  });
  if (!divisionName) {
    const industry = corp.getIndustryData("Agriculture");
    if (corporation.funds >= industry.cost) {
      corp.expandIndustry("Agriculture", DIVISION);
      divisionName = DIVISION;
      reportSuccess(ns, "corporation-division", "Agriculture-Division gegründet");
    } else {
      reportInfo(ns, "corporation-saving-division", "Corporation spart auf Agriculture", [
        `Benötigt: ${ns.format.number(industry.cost)}`,
      ]);
      return;
    }
  }

  for (const unlock of ["Warehouse API", "Office API"]) {
    if (corp.hasUnlock(unlock)) continue;
    const cost = corp.getUnlockCost(unlock);
    if (corp.getCorporation().funds < cost) {
      reportInfo(ns, `corporation-unlock-${unlock}`, `Corporation spart auf ${unlock}`, [
        `Benötigt: ${ns.format.number(cost)}`,
      ]);
      return;
    }
    corp.purchaseUnlock(unlock);
  }

  const division = corp.getDivision(divisionName);
  for (const city of CITIES) {
    if (!division.cities.includes(city)) {
      try {
        corp.expandCity(divisionName, city);
      } catch {
        continue;
      }
    }
    if (!corp.hasWarehouse(divisionName, city)) {
      const cost = corp.getConstants().warehouseInitialCost;
      if (corp.getCorporation().funds >= cost) corp.purchaseWarehouse(divisionName, city);
    }
    bootstrapOffice(ns, divisionName, city);
    if (corp.hasWarehouse(divisionName, city)) {
      corp.sellMaterial(divisionName, city, "Food", "MAX", "MP");
      corp.sellMaterial(divisionName, city, "Plants", "MAX", "MP");
    }
  }

  corporation = corp.getCorporation();
  const upgrade = UPGRADES
    .map((name) => ({ name, cost: corp.getUpgradeLevelCost(name) }))
    .filter(({ cost }) => Number.isFinite(cost) && cost <= corporation.funds * 0.10)
    .sort((a, b) => a.cost - b.cost)[0];
  if (upgrade) corp.levelUpgrade(upgrade.name);

  reportInfo(ns, "corporation-active", "Corporation wird automatisch verwaltet", [
    `Kapital: ${ns.format.number(corporation.funds)}`,
    `${corp.getDivision(divisionName).cities.length}/${CITIES.length} Städte`,
  ]);
}
