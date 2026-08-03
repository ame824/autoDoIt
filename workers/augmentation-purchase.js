import { CONFIG } from "../core/config.js";
import { reportSuccess } from "../core/notifier.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { FACTION_PLAN_FILE, parseFactionPlan } from "../lib/faction-plan.js";
import { readNodeRushState, spendableMoney } from "../lib/node-rush.js";

/** @param {NS} ns */
export async function main(ns) {
  if (readHomeRamFocus(ns).ramOnly) return;
  const target = parseFactionPlan(ns.read(FACTION_PLAN_FILE))?.purchaseTarget;
  if (!target || !target.prerequisitesMet || Number(target.factionRep) < Number(target.requirement)) return;
  const available = spendableMoney(ns.getPlayer().money, readNodeRushState(ns));
  if (available - CONFIG.augmentationMoneyReserve < Number(target.price)) return;
  if (ns.singularity.purchaseAugmentation(target.faction, target.name)) {
    reportSuccess(ns, `aug-${target.name}-${Date.now()}`, `Augmentierung gekauft: ${target.name}`, [
      `Fraktion: ${target.faction}`,
      ...(target.neuroFluxStage ? ["Alle verfügbaren fraktionsspezifischen Augmentierungen sind bereits abgeschlossen."] : []),
    ]);
  }
}
