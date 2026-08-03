import { getCapabilities } from "../core/capabilities.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import {
  AGRICULTURE_DIVISION,
  CORPORATION_NAME,
  getIndustryStartingCost,
} from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  const capabilities = getCapabilities(ns);
  if (!corp.hasCorporation()) {
    const homeFocus = readHomeRamFocus(ns);
    if (homeFocus.ramOnly && capabilities.reset.currentNode !== 3) {
      reportInfo(ns, "corporation-wait-for-home-ram", "Corporation wartet auf das Home-RAM-Ziel");
      return;
    }
    const selfFund = capabilities.reset.currentNode !== 3;
    const creationStatus = corp.canCreateCorporation(selfFund);
    if (creationStatus !== "Success") {
      reportBlocker(ns, "corporation-create", "Corporation kann noch nicht gegründet werden", [
        `API-Status: ${String(creationStatus)}.`,
        selfFund
          ? "Außerhalb von BitNode 3 wird ausreichend eigenes Startkapital benötigt."
          : "Die Startbedingungen dieses BitNodes sind noch nicht erfüllt.",
      ], ["Weiter Geld verdienen; autoDoIt versucht die Gründung später erneut."]);
      return;
    }
    if (!corp.createCorporation(CORPORATION_NAME, selfFund)) {
      reportBlocker(ns, "corporation-create-runtime", "Corporation konnte nicht gegründet werden", [
        "Die v3-API hatte die Gründung freigegeben, gab beim Erstellen aber keinen Erfolg zurück.",
      ], ["Den Corporation-Bildschirm einmal öffnen und autoDoIt weiterlaufen lassen."]);
      return;
    }
    reportSuccess(ns, "corporation-created", "Corporation gegründet");
  }

  const corporation = corp.getCorporation();
  let divisionName = corporation.divisions.find((name) => {
    try { return corp.getDivision(name).industry === "Agriculture"; } catch { return false; }
  });
  if (!divisionName) {
    const startingCost = getIndustryStartingCost(corp.getIndustryData("Agriculture"));
    if (corporation.funds < startingCost) {
      reportInfo(ns, "corporation-saving-division", "Corporation spart auf Agriculture", [
        `Benötigt: ${ns.format.number(startingCost)}`,
      ]);
      return;
    }
    corp.expandIndustry("Agriculture", AGRICULTURE_DIVISION);
    divisionName = AGRICULTURE_DIVISION;
    reportSuccess(ns, "corporation-division", "Agriculture-Division gegründet");
  }

  for (const unlock of ["Warehouse API", "Office API", "Smart Supply"]) {
    if (corp.hasUnlock(unlock)) continue;
    const cost = corp.getUnlockCost(unlock);
    if (corp.getCorporation().funds >= cost) corp.purchaseUnlock(unlock);
    break;
  }
}
