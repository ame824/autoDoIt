import { reportInfo } from "../core/notifier.js";
import { readNodeRushState } from "../lib/node-rush.js";

/** @param {NS} ns */
export async function main(ns) {
  const count = ns.sleeve.getNumSleeves();
  const nodeRush = readNodeRushState(ns);
  const trainCharisma = nodeRush?.stage === "labyrinth-charisma";
  const university = ns.enums.LocationName.VolhavenZBInstituteOfTechnology;
  const leadership = ns.enums.UniversityClassType.leadership;
  for (let index = 0; index < count; index += 1) {
    const sleeve = ns.sleeve.getSleeve(index);
    if (sleeve.shock > 0) ns.sleeve.setToShockRecovery(index);
    else if (sleeve.sync < 100) ns.sleeve.setToSynchronize(index);
    else if (trainCharisma) {
      const task = ns.sleeve.getTask(index);
      if (task?.type !== "CLASS" || task.classType !== leadership) {
        ns.sleeve.setToUniversityCourse(index, university, leadership);
      }
    } else if (ns.sleeve.getTask(index)?.type !== "CRIME") {
      ns.sleeve.setToCommitCrime(index, "Homicide");
    }
  }
  reportInfo(ns, "sleeves-active", "Sleeves werden automatisch verwaltet", [
    `${count} Sleeves geprüft.`,
    trainCharisma
      ? `BN15-Priorität: Schockabbau → Synchronisierung → Leadership bis ${ns.format.number(nodeRush.targetCharisma)} Charisma.`
      : "Priorität: Schockabbau → Synchronisierung → Homicide.",
  ]);
}
