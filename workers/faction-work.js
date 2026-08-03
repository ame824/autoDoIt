import { chooseFactionWorkType } from "../lib/logic.js";
import { FACTION_PLAN_FILE, parseFactionPlan } from "../lib/faction-plan.js";
import { reportInfo } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const target = parseFactionPlan(ns.read(FACTION_PLAN_FILE))?.workTarget;
  if (!target) return;
  const workType = chooseFactionWorkType(ns.singularity.getFactionWorkTypes(target.faction));
  if (!workType) {
    reportInfo(ns, `faction-no-work-${target.faction}`, `${target.faction} bietet keine Arbeit an`, [
      `Benötigt für ${target.augmentation}: ${ns.format.number(target.requirement)} Reputation.`,
    ]);
    return;
  }
  const current = ns.singularity.getCurrentWork();
  if (current?.type === "FACTION" && current?.factionName === target.faction) return;
  if (ns.singularity.workForFaction(target.faction, workType, false)) {
    reportInfo(ns, `faction-work-${target.faction}`, `Fraktionsarbeit gestartet: ${target.faction}`, [
      `Ziel: ${target.augmentation}`,
      `Preis: ${ns.format.number(target.price)}`,
      `Arbeitsart: ${workType}`,
    ]);
  }
}
