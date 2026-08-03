import { getCapabilities } from "../core/capabilities.js";
import { reportInfo } from "../core/notifier.js";
import { buildFactionPlan, FACTION_PLAN_FILE } from "../lib/faction-plan.js";
import { createGangReputationGoal, GANG_REPUTATION_GOAL_FILE } from "../lib/gang-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  const player = ns.getPlayer();
  if (capabilities.gang && !ns.gang.inGang() && Number(player.karma) > -54_000) {
    ns.write(FACTION_PLAN_FILE, "", "w");
    ns.write(GANG_REPUTATION_GOAL_FILE, "", "w");
    reportInfo(ns, "faction-yield-to-gang", "Fraktionsarbeit pausiert für Gang-Freischaltung", [
      "Das Gang-Modul baut zuerst das benötigte negative Karma auf.",
    ]);
    return;
  }
  let gangFaction = "";
  if (capabilities.gang && ns.gang.inGang()) {
    gangFaction = String(ns.gang.getGangInformation().faction ?? "");
  }
  const factions = [...(player.factions ?? [])];
  const owned = new Set(ns.singularity.getOwnedAugmentations(true));
  const plan = buildFactionPlan(ns, factions, owned, gangFaction);
  const gangGoal = createGangReputationGoal(plan.workTarget, gangFaction);
  if (gangGoal) plan.workTarget = null;
  ns.write(FACTION_PLAN_FILE, JSON.stringify(plan), "w");
  ns.write(GANG_REPUTATION_GOAL_FILE, gangGoal ? JSON.stringify(gangGoal) : "", "w");
  if (gangGoal) reportInfo(ns, `gang-reputation-${gangGoal.augmentation}`, "Gang sammelt Reputation für Augmentierung", [
    `Ziel: ${gangGoal.augmentation}`,
    `Reputation: ${ns.format.number(gangGoal.factionRep)} / ${ns.format.number(gangGoal.requirement)}`,
    "Der Gangmanager priorisiert dafür Respekt und hält Wanted kontrolliert.",
  ]);
}
