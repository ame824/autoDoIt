import { reportSuccess } from "../core/notifier.js";
import { CORPORATION_RESEARCH } from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation() || !corp.hasUnlock("Office API")) return;
  for (const divisionName of corp.getCorporation().divisions) {
    const division = corp.getDivision(divisionName);
    for (const research of CORPORATION_RESEARCH) {
      if (!division.makesProducts && research.startsWith("uPgrade:")) continue;
      if (corp.hasResearched(divisionName, research)) continue;
      const cost = corp.getResearchCost(divisionName, research);
      const reserve = Math.max(1_000, cost * 0.20);
      if (division.researchPoints < cost + reserve) break;
      try {
        corp.research(divisionName, research);
        reportSuccess(ns, `corporation-research-${divisionName}-${research}`, `Corporation-Forschung abgeschlossen: ${research}`);
      } catch {
        // A prerequisite may not be available yet; retry on a later phase.
      }
      return;
    }
  }
}
