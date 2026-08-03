import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  if (ns.bladeburner.inBladeburner()) return;
  if (ns.bladeburner.joinBladeburnerDivision()) {
    reportSuccess(ns, "bladeburner-joined", "Bladeburner-Division beigetreten");
    return;
  }
  if (getCapabilities(ns).singularity) {
    const skills = ns.getPlayer().skills;
    const combat = [
      ["str", skills.strength], ["def", skills.defense],
      ["dex", skills.dexterity], ["agi", skills.agility],
    ].sort((left, right) => left[1] - right[1]);
    if (combat[0][1] < 100) {
      ns.singularity.travelToCity("Sector-12");
      ns.singularity.gymWorkout("Powerhouse Gym", combat[0][0], false);
      reportInfo(ns, `bladeburner-train-${combat[0][0]}`, "Training für Bladeburner gestartet", [
        `${combat[0][0]}: ${combat[0][1].toFixed(0)} / 100`,
      ]);
      return;
    }
  }
  reportBlocker(ns, "bladeburner-join", "Bladeburner-Aufnahmekriterien fehlen", [
    "Für den Beitritt werden ausreichend hohe Kampfwerte benötigt.",
  ], ["Stärke, Verteidigung, Geschicklichkeit und Agilität trainieren."]);
}
