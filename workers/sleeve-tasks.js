import { reportInfo } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const count = ns.sleeve.getNumSleeves();
  for (let index = 0; index < count; index += 1) {
    const sleeve = ns.sleeve.getSleeve(index);
    if (sleeve.shock > 0) ns.sleeve.setToShockRecovery(index);
    else if (sleeve.sync < 100) ns.sleeve.setToSynchronize(index);
    else if (ns.sleeve.getTask(index)?.type !== "CRIME") {
      ns.sleeve.setToCommitCrime(index, "Homicide");
    }
  }
  reportInfo(ns, "sleeves-active", "Sleeves werden automatisch verwaltet", [
    `${count} Sleeves geprüft.`,
    "Priorität: Schockabbau → Synchronisierung → Homicide.",
  ]);
}
